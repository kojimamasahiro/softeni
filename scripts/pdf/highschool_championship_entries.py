#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全国高等学校総合体育大会（インターハイ）の結果PDF（トーナメント表形式、JSSTA/都道府県高体連
公式レイアウト）から、エントリー一覧（参加者・ペア/チーム）のみを抽出する。

対象は「選手・チーム情報」のみ。勝敗・スコアは抽出しない（＝matches/resultsは空で出力する）。
理由: このPDFの予選ラウンド（1回戦〜準々決勝前）は、勝者側に何も印字せず敗者のスコア数字のみを
ブラケット線の合流点付近に置く形式で、行番号だけでは勝敗を安全に確定できない
（幾何学的なブラケット線追跡が必要で、誤読のリスクがある）。準々決勝以降・団体戦は別形式
（ペア別ゲームスコア＋丸数字＝勝者）で完全にテキストから読み取れるが、本スクリプトでは
「捏造しない」方針を優先し、matches/results は生成しない（scripts/pdf/university_indoor.py と
同じ方針）。

対応レイアウト:
  - 個人戦（ダブルス）ドローページ: 「男子個人戦（Ｎ）」「女子個人戦（Ｎ）」
    左右2列、各エントリーは2行（1行目=選手A+都道府県、2行目=選手B+学校名）、
    エントリー番号は2行の中間の高さに単独で印字される。
  - 団体戦 概況ドローページ:「男子団体戦」「女子団体戦」（決勝進出までの1回戦〜決勝を
    1ページに集約した概況表。個々の対戦の得点は付随するが、勝者の判定は行わないため未使用）
    左右2列、1エントリー=1行（学校名＋(都道府県)＋エントリー番号）。

使い方:
  python3 scripts/pdf/highschool_championship_entries.py <pdf> \
      --year 2019 \
      --boys-doubles-pages 19-26 --girls-doubles-pages 56-63 \
      --boys-team-page 29 --girls-team-page 66 \
      --out data/tournaments/details/highschool-championship

依存: pdfplumber
"""
import argparse
import json
import os
import re
import unicodedata
from typing import Dict, List, Optional, Tuple

import pdfplumber

# 旧字体・異体字・CJK部首をNFKCで吸収しきれない分だけ常用字体へ寄せる
VARIANT_MAP = str.maketrans(
    {
        "黑": "黒",
        "髙": "高",
        "﨑": "崎",
        "學": "学",
        "戶": "戸",
        "⻄": "西",
        "⻘": "青",
        "⾕": "谷",
    }
)


def norm(text: Optional[str]) -> str:
    if text is None:
        return ""
    t = unicodedata.normalize("NFKC", text)
    t = t.translate(VARIANT_MAP)
    t = re.sub(r"[\s　]+", "", t)
    return t


def parse_page_range(spec: str) -> List[int]:
    """'19-26' や '29' を 1-indexed ページ番号のリストに変換する。"""
    out = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


# ----------------------------- 個人戦（ダブルス）ドロー -----------------------------
# X座標しきい値（本PDF実測: 令和元年度インターハイ 記録報告書 レイアウト）
# 姓・名は列内で均等割り付け（文字数に応じて字間が伸縮する）されているため、
# 「姓/名の内部の字間」だけで境界を判定すると誤る（2文字姓の内部字間が
# 姓/名境界の字間とほぼ同じ大きさになるケースがあった: 実例「奥西／巧」で
# 奥→西=24.2pt, 西→巧=37.6pt。2文字姓「浪岡」の内部字間24.6ptと一致し、
# 「奥西」が1セットであることを裏付ける）。
# 一方で、姓の文字数(1〜3文字)によらず「姓セルの右端 〜 名セルの左端」の
# 固定X座標（本PDFでは左側=約100pt, 右側=約405pt）は一貫していることを
# entryNo 5/7/29/40/64/90/135/150/170/183/258/268/271/280/296/8/97/107/
# 164/192/199/216/228/232/240/241/245/256/278/301/316 で実測・検証済み
# （2文字/3文字/1文字姓のいずれも、姓の全文字がしきい値未満、名の先頭文字が
# しきい値以上に収まる）。そのため氏名は「氏名として1つの範囲でまとめて
# 取得」しつつ、文字ごとのX座標を保持し、このしきい値で機械的に分割する
# （文字数ヒューリスティックではなく座標そのもので分割する）。
# 氏名/都道府県・学校名の境界も文字数によって多少前後するため、初期しきい値で
# 切った後、都道府県が正しい接尾辞（都道府県）で終わらない場合に文字を
# 付け替える補正パス（_fix_leaked_area）で吸収する。
DBL_LEFT = {
    "entry_no": (30, 59),
    "name": (40, 155),
    "area": (155, 222),
    "name_split_x": 100.0,
}
DBL_RIGHT = {
    "entry_no": (533, 560),
    "name": (340, 450),
    "area": (450, 530),
    "name_split_x": 405.0,
}

PREFECTURES = {
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県",
    "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
    "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県",
    "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
}
NON_PREF_TOKENS_SET = {"日本学連", "学連", "高体連", "中体連", "日本連盟"}


def _looks_like_valid_prefecture(text: str) -> bool:
    return text in PREFECTURES or text in NON_PREF_TOKENS_SET


def _fix_leaked_area(name_a: str, area: str, name_b: str, team: str) -> Tuple[str, str, str, str]:
    """都道府県（row1のarea）が正しい接尾辞で終わらない場合、name側の末尾の文字を
    area側の先頭へ1文字ずつ付け替えて修正する。同じ列境界の問題は row2（team）にも
    同様に起きるため、row1で確定したシフト数をrow2にもそのまま適用する。"""
    shifted = 0
    fixed_name_a, fixed_area = name_a, area
    while not _looks_like_valid_prefecture(fixed_area) and len(fixed_name_a) > 2 and shifted < 3:
        fixed_area = fixed_name_a[-1] + fixed_area
        fixed_name_a = fixed_name_a[:-1]
        shifted += 1
    if not _looks_like_valid_prefecture(fixed_area):
        # 直せなかった場合は元のまま返す（誤修正で氏名を壊さないため）
        return name_a, area, name_b, team
    fixed_name_b, fixed_team = name_b, team
    for _ in range(shifted):
        if len(fixed_name_b) <= 2:
            break
        fixed_team = fixed_name_b[-1] + fixed_team
        fixed_name_b = fixed_name_b[:-1]
    return fixed_name_a, fixed_area, fixed_name_b, fixed_team


def _split_name_by_x(chars: List[dict], threshold: float) -> Tuple[str, str]:
    """姓名の文字ごとのX座標を使って分割する（DBL_LEFT/DBL_RIGHTのname_split_x参照）。
    thresholdより左を姓、右を名とする。文字数に依存しないため1〜3文字のどの姓長にも
    対応する。全角スペース等の空白文字はnorm()と同じ扱いで除外してから判定する
    （空白の有無で姓名の文字数がずれないように）。"""
    sel = sorted(chars, key=lambda c: c["x0"])
    surname_chars = [c["text"] for c in sel if c["x0"] < threshold and not c["text"].isspace()]
    given_chars = [c["text"] for c in sel if c["x0"] >= threshold and not c["text"].isspace()]
    return norm("".join(surname_chars)), norm("".join(given_chars))


def _split_name(full: str) -> Tuple[str, str]:
    """座標情報が無い場合のフォールバック。姓は基本2文字だが、氏名が2文字しか
    ない場合は姓名それぞれ1文字ずつという運用（ユーザー確認済み）。"""
    full = full.strip()
    if len(full) == 2:
        return full[0], full[1]
    if len(full) <= 1:
        return full, ""
    return full[:2], full[2:]


def _dedupe_chars(chars: List[dict]) -> List[dict]:
    """同じ位置・同じ文字が2重に描画されている場合に1つへまとめる。

    2014年PDFの一部の選手名（毎ページ数名）は、同じグリフが(x0,top,text)まで完全一致で
    2回描画されていた（`ncs`がDeviceRGB/DeviceGrayで1回ずつ、恐らく作成ソフト側の太字表現）。
    そのまま行の文字を連結すると「猪猪本本拓拓己己」のように全角文字が1字ずつ二重化する。
    2015年以降のPDFには存在しない（実測でdupe数0）ため、無害な防御として全ページに適用する。"""
    seen = set()
    out = []
    for c in chars:
        key = (round(c["x0"], 1), round(c["top"], 1), c["text"])
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out


def _row_chars(chars: List[dict], x0: float, x1: float) -> List[dict]:
    sel = [c for c in chars if x0 <= c["x0"] < x1]
    sel.sort(key=lambda c: c["x0"])
    return sel


def _row_text(chars: List[dict], x0: float, x1: float) -> str:
    sel = _row_chars(chars, x0, x1)
    return norm("".join(c["text"] for c in sel))


def _rows_by_top(chars: List[dict], tolerance: float = 2.6) -> Dict[float, List[dict]]:
    """top座標が近い文字を同一行としてグループ化する（文字ごとの微小なサブピクセル差を吸収）。"""
    rows: Dict[float, List[dict]] = {}
    for c in sorted(chars, key=lambda c: c["top"]):
        key = None
        for existing in rows:
            if abs(existing - c["top"]) <= tolerance:
                key = existing
                break
        if key is None:
            key = c["top"]
            rows[key] = []
        rows[key].append(c)
    return rows


def parse_doubles_page(page, side_cfg: dict) -> List[Dict]:
    """ページ片側（左右どちらか）のダブルスエントリーを抽出する。"""
    ranges = [v for v in side_cfg.values() if isinstance(v, tuple)]
    x_lo = min(v[0] for v in ranges)
    x_hi = max(v[1] for v in ranges)
    split_x = side_cfg["name_split_x"]
    chars = _dedupe_chars([c for c in page.chars if x_lo <= c["x0"] < x_hi and c["top"] > 115])
    rows = _rows_by_top(chars)
    tops = sorted(rows.keys())

    def row_text_all(top: float) -> str:
        return "".join(c["text"] for c in sorted(rows[top], key=lambda c: c["x0"])).strip()

    # entry_no行は数字のみで構成される行。name行はそれ以外
    # （entry_no列のX範囲はname列の左端と近接/重複するため、内容で判定する）
    entry_no_tops = [t for t in tops if row_text_all(t).isdigit()]
    name_tops = [t for t in tops if t not in entry_no_tops]

    results = []
    i = 0
    while i + 1 < len(name_tops):
        t1, t2 = name_tops[i], name_tops[i + 1]
        # 2行の間にあるentry_no行を探す
        mid_candidates = [t for t in entry_no_tops if t1 < t < t2]
        if not mid_candidates:
            i += 1
            continue
        t_no = mid_candidates[0]
        entry_text = _row_text(rows[t_no], *side_cfg["entry_no"])
        if not entry_text.isdigit():
            i += 1
            continue
        entry_no = int(entry_text)

        name_a_chars = _row_chars(rows[t1], *side_cfg["name"])
        name_a_chars = [c for c in name_a_chars if not c["text"].isspace()]
        name_a = norm("".join(c["text"] for c in name_a_chars))
        area = _row_text(rows[t1], *side_cfg["area"])

        name_b_chars = _row_chars(rows[t2], *side_cfg["name"])
        name_b_chars = [c for c in name_b_chars if not c["text"].isspace()]
        name_b = norm("".join(c["text"] for c in name_b_chars))
        team = _row_text(rows[t2], *side_cfg["area"])

        if not (name_a and team):
            i += 1
            continue

        fixed_name_a, area, fixed_name_b, team = _fix_leaked_area(name_a, area, name_b, team)
        # _fix_leaked_area は文字列の末尾から都道府県側へ付け替えるため、
        # 座標分割も同じ「先頭len(fixed_name)文字」に対して行う（付け替え後の
        # 姓名だけを対象にし、都道府県側へ移した文字は座標分割に含めない）。
        if len(fixed_name_a) < len(name_a_chars):
            sur_a, giv_a = _split_name_by_x(name_a_chars[: len(fixed_name_a)], split_x)
        else:
            sur_a, giv_a = _split_name_by_x(name_a_chars, split_x)
        if len(fixed_name_b) < len(name_b_chars):
            sur_b, giv_b = _split_name_by_x(name_b_chars[: len(fixed_name_b)], split_x)
        else:
            sur_b, giv_b = _split_name_by_x(name_b_chars, split_x)

        results.append(
            {
                "entryNo": entry_no,
                "playerA": {"lastName": sur_a, "firstName": giv_a},
                "playerB": {"lastName": sur_b, "firstName": giv_b},
                "prefecture": area,
                "team": team,
            }
        )
        i += 2

    return results


def _dedupe_by_entry_no(entries: List[Dict]) -> List[Dict]:
    """次ページへの持ち越し表示（ページ末尾に前段勝者の氏名が再掲されるケース）による
    entryNo重複を除去する。最初に現れたもの（=本来のエントリー行）を正とする。"""
    seen = set()
    out = []
    for e in entries:
        if e["entryNo"] in seen:
            continue
        seen.add(e["entryNo"])
        out.append(e)
    return out


def parse_doubles_pages(pdf, pages: List[int]) -> List[Dict]:
    out = []
    for p in pages:
        page = pdf.pages[p - 1]
        out.extend(parse_doubles_page(page, DBL_LEFT))
        out.extend(parse_doubles_page(page, DBL_RIGHT))
    out.sort(key=lambda e: e["entryNo"])
    return _dedupe_by_entry_no(out)


# ----------------------------- 団体戦 概況ドロー -----------------------------
TEAM_LEFT = {
    "entry_no": (25, 46),
    "team": (50, 133),
    "area": (137, 192),
}
TEAM_RIGHT = {
    "team": (400, 483),
    "area": (486, 541),
    # entry_no は年度によって左端が数pt前後する（2015年PDFで実測547.2pt、
    # 2016-2019年は552pt前後）。549を下限にすると2015年の1桁目「3」が
    # 切り捨てられ「30」が「0」に化ける（entryNo重複の原因になった）ため、
    # 実測より広めの544を下限にする。
    "entry_no": (544, 570),
}


def parse_team_page(page, side_cfg: dict) -> List[Dict]:
    x_lo = min(v[0] for v in side_cfg.values())
    x_hi = max(v[1] for v in side_cfg.values())
    # ヘッダー除外のしきい値。2015年PDFはヘッダーが詰まっており、entryNo=1の行が
    # top=114に来る（従来の115だと切り捨てられる）。ヘッダー最終行はどの年度でも
    # top<=97.0程度のため、100まで下げても本体行を誤って含めない。
    chars = _dedupe_chars([c for c in page.chars if x_lo <= c["x0"] < x_hi and c["top"] > 100])
    # 括弧 ( ) はそのまま area 列に含まれるため取り除く
    chars = [c for c in chars if c["text"] not in ("(", ")", "（", "）")]
    rows = _rows_by_top(chars)

    out = []
    for top in sorted(rows.keys()):
        entry_text = _row_text(rows[top], *side_cfg["entry_no"])
        team = _row_text(rows[top], *side_cfg["team"])
        area = _row_text(rows[top], *side_cfg["area"])
        if entry_text.isdigit() and team:
            out.append({"entryNo": int(entry_text), "team": team, "prefecture": area})
    return out


def parse_team_overview_page(pdf, page_no: int, team_left: Optional[dict] = None, team_right: Optional[dict] = None) -> List[Dict]:
    """`team_left`/`team_right` で TEAM_LEFT/TEAM_RIGHT を上書きできる。
    団体戦概況ページの座標は年度によって数pt〜十数pt前後することがあり
    （2014年は entry_no の列自体が2015年以降と別の位置にあった）、
    全年度で使い回せる固定値が無い場合の逃げ道として用意している。"""
    page = pdf.pages[page_no - 1]
    left = team_left or TEAM_LEFT
    right = team_right or TEAM_RIGHT
    out = parse_team_page(page, left) + parse_team_page(page, right)
    out.sort(key=lambda e: e["entryNo"])
    return out


# ----------------------------- 都道府県の正準化 -----------------------------
PREF_SUFFIX = ("都", "道", "府", "県")
NON_PREF_TOKENS = {"日本学連", "学連", "高体連", "中体連", "日本連盟"}


def canonical_prefecture(raw: str) -> str:
    t = norm(raw)
    if not t:
        return t
    if t in NON_PREF_TOKENS:
        return t
    if t.endswith(PREF_SUFFIX):
        return t
    # 「東京」「大阪」「京都」「北海道」等の省略形はここでは寄せない
    # （normalize-prefectures.mjs 側の全国共通ロジックに委ねる）
    return t


# ----------------------------- JSON組み立て -----------------------------
def player_id(surname: str, given: str, team: str, prefecture: str) -> str:
    return f"{surname}_{given}_{team}_{prefecture}"


def build_doubles_json(entries: List[Dict]) -> Dict:
    participants = []
    seen = set()
    out_entries = []
    for e in entries:
        pref = canonical_prefecture(e["prefecture"])
        team = e["team"]
        ids = []
        for p in (e["playerA"], e["playerB"]):
            pid = player_id(p["lastName"], p["firstName"], team, pref)
            ids.append(pid)
            if pid not in seen:
                seen.add(pid)
                participants.append(
                    {
                        "id": pid,
                        "lastName": p["lastName"],
                        "firstName": p["firstName"],
                        "team": team,
                        "prefecture": pref,
                    }
                )
        out_entries.append({"entryNo": e["entryNo"], "playerIds": ids, "type": None})
    out_entries.sort(key=lambda x: x["entryNo"])
    return {"participants": participants, "entries": out_entries, "matches": [], "results": []}


def build_team_json(entries: List[Dict]) -> Dict:
    participants = []
    seen = set()
    out_entries = []
    for e in entries:
        pref = canonical_prefecture(e["prefecture"])
        team = e["team"]
        pid = f"{team}_{pref}"
        if pid not in seen:
            seen.add(pid)
            participants.append(
                {"id": pid, "lastName": None, "firstName": None, "team": team, "prefecture": pref}
            )
        out_entries.append({"entryNo": e["entryNo"], "playerIds": [pid], "type": None})
    out_entries.sort(key=lambda x: x["entryNo"])
    return {"participants": participants, "entries": out_entries, "matches": [], "results": []}


def _parse_col_spec(spec: str) -> dict:
    """`entry_no=45-63,team=63-140,area=137-192` を dict に変換する。"""
    out = {}
    for part in spec.split(","):
        key, rng = part.split("=")
        lo, hi = rng.split("-")
        out[key.strip()] = (float(lo), float(hi))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--boys-doubles-pages", help="例: 19-26")
    ap.add_argument("--girls-doubles-pages", help="例: 56-63")
    ap.add_argument("--boys-team-page", type=int)
    ap.add_argument("--girls-team-page", type=int)
    ap.add_argument(
        "--team-left-cols",
        help="団体戦ページ左段の列位置を上書き（既定はTEAM_LEFT）。"
        "例: 'entry_no=45-63,team=63-140,area=137-192'。年度によって団体戦ページの"
        "座標だけが数pt〜十数pt前後することがあり、それが原因でentryNoが読めない/"
        "所属が欠けるときに使う。",
    )
    ap.add_argument("--team-right-cols", help="団体戦ページ右段の列位置を上書き（既定はTEAM_RIGHT）")
    ap.add_argument("--out", required=True, help="details/highschool-championship ディレクトリ")
    args = ap.parse_args()

    pdf = pdfplumber.open(args.pdf)

    out_dir = os.path.join(args.out, str(args.year))
    os.makedirs(out_dir, exist_ok=True)

    team_left = _parse_col_spec(args.team_left_cols) if args.team_left_cols else None
    team_right = _parse_col_spec(args.team_right_cols) if args.team_right_cols else None

    jobs = []
    if args.boys_doubles_pages:
        boys_doubles = parse_doubles_pages(pdf, parse_page_range(args.boys_doubles_pages))
        jobs.append(("doubles-none-boys", build_doubles_json(boys_doubles)))
    if args.girls_doubles_pages:
        girls_doubles = parse_doubles_pages(pdf, parse_page_range(args.girls_doubles_pages))
        jobs.append(("doubles-none-girls", build_doubles_json(girls_doubles)))
    if args.boys_team_page:
        boys_team = parse_team_overview_page(pdf, args.boys_team_page, team_left, team_right)
        jobs.append(("team-none-boys", build_team_json(boys_team)))
    if args.girls_team_page:
        girls_team = parse_team_overview_page(pdf, args.girls_team_page, team_left, team_right)
        jobs.append(("team-none-girls", build_team_json(girls_team)))
    for name, data in jobs:
        path = os.path.join(out_dir, f"{name}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(
            f"wrote {path}  participants={len(data['participants'])} "
            f"entries={len(data['entries'])}"
        )


if __name__ == "__main__":
    main()
