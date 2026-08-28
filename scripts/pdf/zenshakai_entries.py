#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全日本社会人ソフトテニス選手権大会の結果PDF（トーナメント表 + ラウンドロビン表）から、
エントリー（選手・所属情報）のみを抽出する。scripts/pdf/highschool_championship_entries.py
と同じ「捏造しない」方針で、matches/resultsは生成しない。

このPDF固有のレイアウト差:
  - 氏名は姓2文字+名2文字ぶんの固定スロットに均等割り付けされる。姓名境界は
    `_dynamic_name_split_x`がページ・列ごとに実測する（スロット1とスロット4の中点）。
  - 都道府県（支部）と所属（チーム名）は「(都道府県 所属)」と1つの括弧内に入るが列は別。
    しかも1エントリー2行(ペア)のうち1行目にしか出ない（2行目は氏名のみ、混成ペアは両方）。
  - 列のX座標はページ・ブロック（左の山/右の山）ごとに動く。列範囲は固定プリセットでなく
    `detect_bracket_cols`が全行に必ず出る括弧のX座標を基準に毎回検出する
    （`--bracket`の`:layout`指定は検出に失敗したときのフォールバック）。
  - トーナメント表（一般/年代別、男女とも）とラウンドロビン表（本大会では35歳女子・45歳女子）
    が混在し、ラウンドロビン表は表形式で別の抽出ロジックが要る。

使い方:
  python3 scripts/pdf/zenshakai_entries.py <pdf> --year 2023 \
      --bracket "doubles-none-boys=1-8" --bracket "doubles-none-girls=10-11:female" \
      --bracket "doubles-over35-boys=14-15:age" --roundrobin "doubles-over35-girls=17" \
      --bracket "doubles-over45-boys=19-20" --roundrobin "doubles-over45-girls=22" \
      --out data/tournaments/details/zennihon-workers
"""
import argparse
import collections
import json
import os
import re
import unicodedata
from typing import Dict, List, Optional, Tuple

import pdfplumber

VARIANT_MAP = str.maketrans(
    {"黑": "黒", "髙": "高", "﨑": "崎", "學": "学", "戶": "戸", "⻄": "西", "⻘": "青", "⾕": "谷"}
)


def norm(text) -> str:
    if text is None:
        return ""
    t = unicodedata.normalize("NFKC", text)
    t = t.translate(VARIANT_MAP)
    t = re.sub(r"[\s　]+", "", t)
    return t


def parse_page_range(spec: str) -> List[int]:
    out = []
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def _row_text(chars: List[dict], x0: float, x1: float) -> str:
    sel = sorted((c for c in chars if x0 <= c["x0"] < x1), key=lambda c: c["x0"])
    text = "".join(c["text"] for c in sel)
    text = text.replace("(", "").replace(")", "").replace("（", "").replace("）", "")
    return norm(text)


def _rows_by_top(
    chars: List[dict], tolerance: float = 5.0, max_span: float = 7.0
) -> Dict[float, List[dict]]:
    """top座標の近い文字を同一行としてまとめる。クラスタの「直近の要素」との距離で
    判定する（先頭要素とだけ比較すると、フォントのベースライン差が連鎖するケースで
    行が分裂する）。ただし直近要素だけを見ると、細かい断片が連鎖してnameの2行を
    跨いでしまうことがあるため、クラスタ全体のtop幅にも上限(max_span)を設ける。"""
    clusters: List[Dict] = []  # [{"key": 代表top, "min": ,"max": ,"chars": [...]}]
    for c in sorted(chars, key=lambda c: c["top"]):
        target = None
        for cl in clusters:
            if abs(cl["max"] - c["top"]) <= tolerance and (c["top"] - cl["min"]) <= max_span:
                target = cl
                break
        if target is None:
            target = {"key": c["top"], "min": c["top"], "max": c["top"], "chars": []}
            clusters.append(target)
        target["max"] = c["top"]
        target["chars"].append(c)
    return {cl["key"]: cl["chars"] for cl in clusters}


def _split_name(full: str) -> Tuple[str, str]:
    """座標情報が無いレイアウト向けのフォールバック。姓は基本2文字だが、氏名が
    2文字しかない場合は姓名それぞれ1文字ずつという運用（ユーザー確認済み）。"""
    full = full.strip()
    if len(full) == 2:
        return full[0], full[1]
    if len(full) <= 1:
        return full, ""
    return full[:2], full[2:]


def _split_name_by_x(chars: List[dict], threshold: float) -> Tuple[str, str]:
    """氏名の文字ごとのX座標で姓・名を分割する。しきい値未満が姓・以上が名になる。
    呼び出し側（`parse_bracket_page`）がページ・列ごとに動的計算したしきい値を渡す。"""
    sel = sorted(chars, key=lambda c: c["x0"])
    surname_chars = [c["text"] for c in sel if c["x0"] < threshold and not c["text"].isspace()]
    given_chars = [c["text"] for c in sel if c["x0"] >= threshold and not c["text"].isspace()]
    return norm("".join(surname_chars)), norm("".join(given_chars))


def _dynamic_name_split_x(name_rows: Dict[float, List[dict]]) -> Optional[float]:
    """トーナメント表の氏名セルは姓2文字+名2文字ぶんの固定スロットに均等割り付け
    される。姓・名いずれかが3文字になる場合はスロット間の空白位置へ「同じ側の
    内側だけ」あふれる（例:「朝比奈」→姓スロット1,空白,スロット2 / 「俊太朗」→
    名スロット1,空白,スロット2）ため、姓の最初の文字は常にスロット1、名の最後の
    文字は常にスロット4に来る——文字数(1〜3)や姓名合計2文字（1+1）のケースでも
    変わらない。したがって、そのページ・列で実際に使われた氏名列文字のX座標の
    最小値（=スロット1）と最大値（=スロット4）の中点が姓名境界になる
    （2022年度PDFで実測・2023年度PDFの`general`/`female`/`age`3レイアウトすべてで
    追試検証済み）。ページごとに氏名列の絶対X座標がずれる（同一レイアウト内でも
    ページ間で数pt動く）ため、レイアウトごとの固定しきい値ではなくページ・列
    ごとにこの中点を計算する。氏名文字が無ければNone（呼び出し側は`_split_name`
    にフォールバックする）。
    注意: この方式は「姓名の合計字数に関わらずスロット境界の字間が内部字間と
    等しい」トーナメント表専用。ラウンドロビン表は逆に境界の字間が内部字間より
    明確に大きいため`_split_name_by_max_gap`を使う（構造が違うので流用しない）。"""
    xs = [c["x0"] for row in name_rows.values() for c in row if not c["text"].isspace()]
    if not xs:
        return None
    return (min(xs) + max(xs)) / 2.0


def _split_name_by_max_gap(chars: List[dict]) -> Tuple[str, str]:
    """行内の文字ごとのX座標のうち最大の隙間を姓名境界とみなして分割する。
    ラウンドロビン表の氏名列は（トーナメント表と違い）姓名境界の字間が内部字間
    より明確に大きい（実測: 境界≈12pt前後 vs 内部≈7〜10pt、2022/2023年度の
    both レイアウトで確認）ため、行ごとに独立して機械的に分割できる
    （トーナメント表のような「境界と内部の字間が同じ」問題が起きない）。"""
    sel = sorted((c for c in chars if not c["text"].isspace()), key=lambda c: c["x0"])
    if len(sel) <= 1:
        return norm("".join(c["text"] for c in sel)), ""
    gaps = [sel[i + 1]["x0"] - sel[i]["x0"] for i in range(len(sel) - 1)]
    split_i = max(range(len(gaps)), key=lambda i: gaps[i])
    surname = norm("".join(c["text"] for c in sel[: split_i + 1]))
    given = norm("".join(c["text"] for c in sel[split_i + 1 :]))
    return surname, given


PREFECTURES_SHORT = [
    "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島",
    "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川",
    "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜",
    "静岡", "愛知", "三重",
    "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山",
    "鳥取", "島根", "岡山", "広島", "山口",
    "徳島", "香川", "愛媛", "高知",
    "福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄",
]
# 長い候補から先にマッチさせる（例: 神奈川 が 神奈 に化けないように）
PREFECTURES_SHORT_SORTED = sorted(PREFECTURES_SHORT, key=len, reverse=True)
PREF_SUFFIX = ("都", "道", "府", "県")
NON_PREF_TOKENS = {"日本学連", "学連", "高体連", "中体連", "日本連盟"}


def _fix_pref_overflow(pref: str, team: str) -> Tuple[str, str]:
    """都道府県列が47都道府県の短縮表記と完全一致しない場合、末尾の余分な文字
    （所属列の先頭が列境界の揺れで漏れ込んだもの）を所属列の先頭へ戻す。"""
    if not pref or pref in PREFECTURES_SHORT or pref in NON_PREF_TOKENS:
        return pref, team
    for cand in PREFECTURES_SHORT_SORTED:
        if pref.startswith(cand) and len(pref) > len(cand):
            return cand, pref[len(cand):] + team
    return pref, team


def split_prefecture_team(text: str) -> Tuple[str, str]:
    """括弧内の「都道府県+所属」を分離する。都道府県は47都道府県の短縮表記の
    先頭一致で判定する（例: 東京ガス → 東京 / ガス ではなく 東京 / 東京ガス）。"""
    if text in NON_PREF_TOKENS:
        return text, ""
    for pref in PREFECTURES_SHORT_SORTED:
        if text.startswith(pref):
            return pref, text[len(pref):]
    return text, ""


def canonical_prefecture(raw: str) -> str:
    t = norm(raw)
    if not t or t in NON_PREF_TOKENS or t.endswith(PREF_SUFFIX):
        return t
    return t


# ----------------------------- トーナメント表 -----------------------------
# 都道府県と所属(team)は別列。通常は1行目(選手A)にしか出ない(ペア共通)が、2人が
# 別クラブ・別都道府県の「混成ペア」では2行目にも別の値が出る。どちらの値も、
# 名前の行とフォントのベースラインが数pt(時にはmax_spanの行クラスタ幅を超えて)
# ずれることがあるため、行クラスタでなく氏名行を中心とした狭い帯(band)から拾う。
#
# 氏名列の姓名分割は`_dynamic_name_split_x`（ページ・列ごとに実際に使われた
# 氏名文字のX座標の最小/最大の中点を姓名境界とする）で行う。氏名列の絶対X座標
# 自体はページごとに数pt動くため（`general`/`female`/`age`/`2022`のどのレイアウト
# でもページ間の座標ドリフトを確認済み）、レイアウトごとの固定しきい値は持たず、
# ページ単位で動的計算する（2022年度PDFで発見・2023年度PDFの3レイアウトすべてで
# 追試検証済み。詳細は docs/raw/2026-08-26-zennihon-workers-2022-name-split-coordinate-fix.md）。
#
# 以下の列プリセットは`detect_bracket_cols`（下記）の自動検出が失敗したときの
# フォールバックでしかない。通常は使われないので、新しい年度のPDFのために
# 実測して追加する必要はない。
BR_LEFT = {
    "entry_no": (30, 60),
    "name": (60, 125),
    "prefecture": (125, 163),
    "team": (163, 232),
}
BR_RIGHT = {
    "entry_no": (520, 545),
    "name": (349, 415),
    "prefecture": (413, 452),
    "team": (452, 520),
}
# 女子ページはX座標が男子より全体的に左寄り（同じ列構成）。
FEM_LEFT = {
    "entry_no": (20, 44),
    "name": (44, 110),
    "prefecture": (110, 151),
    "team": (151, 232),
}
FEM_RIGHT = {
    "entry_no": (538, 560),
    "name": (340, 411),
    "prefecture": (411, 452),
    "team": (452, 533),
}
# 2022年度PDFは列構成自体はgeneralと同じ（都道府県+所属が1つの括弧内）だが、
# 男女・年代を問わず同一のX座標で、2023年度のgeneral/femaleのどちらとも
# 微妙に異なる（全体的に左寄り）。年度が変わるとX座標がずれる前提で、
# 新しい年度のPDFが来たら実測してプリセットを追加する。
Y2022_LEFT = {
    "entry_no": (19, 47),
    "name": (47, 122),
    "prefecture": (122, 157),
    "team": (157, 233),
}
Y2022_RIGHT = {
    "entry_no": (538, 560),
    "name": (353, 428),
    "prefecture": (428, 463),
    "team": (463, 538),
}


# ----------------------------- 列範囲の自動検出 -----------------------------
# 固定プリセットは「同じ年度・同じレイアウトならページをまたいでも列座標が同じ」という
# 前提に立っていたが、実際にはブロック（左の山/右の山）ごとに列幅がその中身に合わせて
# 詰められるため、同じページの左右でも、同じレイアウトの別ページでも列座標が動く
# （実例: 2023年度35歳男子15ページ目の右の山は14ページ目の右の山より氏名列が13pt左、
# エントリー番号列が10pt右。45歳男子20ページ目の右の山はエントリー番号列が
# `general`プリセットの範囲から完全に外れていた）。プリセットから外れたブロックは
# エントリー番号が欠けたり途中で切れたりして丸ごと落ちる——しかも「山ひとつぶんの
# 連番が末尾から欠ける」形になるので、欠番チェックでは検出できない。
#
# そこで列範囲はページ・ブロックごとに実データから検出する。基準にするのは、全行に
# 必ず出る「(都道府県 所属)」の括弧のX座標（1ブロック内では完全に一定で、ブロックの
# 全行の最頻値をとれば確実に決まる）。
#
# 括弧を原点とした相対オフセットのうち、氏名列の左端と所属列の左端の2つだけは
# レイアウトによって変わる（実測: 氏名列左端 = 括弧-57〜-68）ため、これも実測する。
# 列の間にはその列の内部字間よりはっきり大きい空きがあるので、「最大の空き」を
# 列境界とみなせばよい（`detect_rr_cols`がラウンドロビン表の見出し行から列を
# 検出しているのと同じ発想）。ただし右の山は氏名列の左隣がブラケット線のスコア文字で、
# 行ごとに有無が変わるぶん氏名列との空きが偶然小さくなる（実測で最大の空きが8.3ptしか
# ないページがあり、スコア文字を氏名列に取り込んでしまう）。そのためオフセットの実測は
# 左の山で行い、右の山へは同じ相対オフセットを流用する（同一ページの左右は同じ
# テンプレートで、実測すると相対オフセットは1.5pt以内で一致する）。
COL_MARGIN = 3.0  # 検出した境界から列側へ広げる余裕（座標のページ間ドリフト吸収）
# 氏名列の左端だけは余裕を大きく取る。氏名セルは姓2文字+名2文字ぶんの4スロットだが、
# それより長い氏名（実測の最長は8文字「ミヒニャック瑠偉」）はスロットの外へ左右対称に
# はみ出すため（実測4.2pt）、スロット1の位置で切ると先頭の1文字を落とす。
# 上限は右の山でブラケット線のスコア文字に届かない範囲（実測で最も近いケースが9.4pt）。
NAME_LEFT_MARGIN = 6.0
# 列境界とみなす最小の空き。氏名列の内部字間は実測6〜9pt、列間の空きは左の山で実測14.5〜18pt。
MIN_COL_GAP = 12.0
NAME_WIDTH_RANGE = (40.0, 80.0)  # 氏名列の幅の妥当範囲（実測54〜65pt）


def _mode_x(xs: List[float]) -> Optional[float]:
    if not xs:
        return None
    return collections.Counter(round(x, 1) for x in xs).most_common(1)[0][0]


def _largest_gap_start(xs: List[float]) -> Tuple[Optional[float], float]:
    """X座標の並びのうち最大の空きを探し、その右側の先頭X座標と空きの大きさを返す。"""
    xs = sorted(xs)
    if len(xs) < 2:
        return None, 0.0
    gap, i = max((xs[i + 1] - xs[i], i) for i in range(len(xs) - 1))
    return xs[i + 1], gap


def _side_anchors(page, side: str):
    """左右どちらかのブロックの文字と、そのブロックの「(」「)」のX座標を返す。"""
    mid = page.width / 2
    sel = [
        c
        for c in page.chars
        if c["top"] > 40 and ((c["x0"] < mid) if side == "left" else (c["x0"] >= mid))
    ]
    open_x = _mode_x([c["x0"] for c in sel if c["text"] == "("])
    close_x = _mode_x([c["x0"] for c in sel if c["text"] == ")"])
    if open_x is None or close_x is None or close_x <= open_x:
        return None
    return sel, open_x, close_x


def _detect_col_offsets(page, side: str) -> Optional[Tuple[float, float]]:
    """「(」を原点とした氏名列左端・所属列左端の相対オフセットを実測する。
    検出に自信が持てない場合（空きが小さい/氏名列幅が非常識）はNoneを返す。"""
    anchors = _side_anchors(page, side)
    if anchors is None:
        return None
    sel, open_x, close_x = anchors
    name_hi = open_x - COL_MARGIN
    name_lo, gap = _largest_gap_start([c["x0"] for c in sel if open_x - 110 <= c["x0"] < name_hi])
    if name_lo is None or gap < MIN_COL_GAP:
        return None
    if not (NAME_WIDTH_RANGE[0] <= name_hi - name_lo <= NAME_WIDTH_RANGE[1]):
        return None
    team_lo, team_gap = _largest_gap_start(
        [c["x0"] for c in sel if open_x + 1 < c["x0"] < close_x - 1]
    )
    if team_lo is None or team_gap < MIN_COL_GAP:
        return None
    return name_lo - open_x, team_lo - open_x


def detect_bracket_cols(page) -> Optional[Tuple[dict, dict]]:
    """トーナメント表1ページぶんの左右ブロックの列範囲を検出する。
    検出できなければNone（呼び出し側は年度別プリセットへフォールバックする）。"""
    offsets = _detect_col_offsets(page, "left") or _detect_col_offsets(page, "right")
    if offsets is None:
        return None
    name_off, team_off = offsets

    cfgs = []
    for side in ("left", "right"):
        anchors = _side_anchors(page, side)
        if anchors is None:
            return None
        _, open_x, close_x = anchors
        name_lo = open_x + name_off - NAME_LEFT_MARGIN
        team_lo = open_x + team_off - COL_MARGIN
        # エントリー番号は左の山では氏名列の左、右の山では閉じ括弧の右に出る。
        entry_no = (
            (name_lo - 30, name_lo - 2)
            if side == "left"
            else (close_x + COL_MARGIN, close_x + 32)
        )
        cfgs.append(
            {
                "entry_no": entry_no,
                "name": (name_lo, open_x - COL_MARGIN),
                "prefecture": (open_x + 1, team_lo),
                "team": (team_lo, close_x - 1),
            }
        )
    return cfgs[0], cfgs[1]


def parse_bracket_page(page, side_cfg: dict) -> List[Dict]:
    """1エントリー=2行（1行目=選手A、2行目=選手B）。

    氏名行の基準Y座標は、氏名列の文字だけを厳しいtoleranceでクラスタ化して決める。
    都道府県・所属・エントリー番号の文字が氏名と同じクラスタに巻き込まれると
    （フォントのベースライン差で近接するため）、そのクラスタの代表Y座標が本来の
    氏名行からずれてしまい、band検索の中心もろとも狂うため（実例: 所属だけが
    氏名行より数pt前にあるケースで、クラスタ代表値が前にずれ、逆方向にある
    都道府県を band が拾えなくなった）。"""
    ranges = [v for v in side_cfg.values() if isinstance(v, tuple)]
    x_lo = min(v[0] for v in ranges)
    x_hi = max(v[1] for v in ranges)
    chars = [c for c in page.chars if x_lo <= c["x0"] < x_hi and c["top"] > 40]
    name_chars = [c for c in chars if side_cfg["name"][0] <= c["x0"] < side_cfg["name"][1]]
    name_rows = _rows_by_top(name_chars, tolerance=1.5, max_span=2.0)
    name_tops = sorted(name_rows.keys())
    split_x = _dynamic_name_split_x(name_rows)

    def band_text(lo: float, hi: float, x0: float, x1: float) -> str:
        band = [c for c in chars if lo - 1 <= c["top"] <= hi + 1]
        return _row_text(band, x0, x1)

    results = []
    i = 0
    while i + 1 < len(name_tops):
        t1, t2 = name_tops[i], name_tops[i + 1]

        # エントリー番号は行クラスタの分裂幅上限(max_span)を超えて浮くことがあるため、
        # 2つの氏名行のY帯全体から拾う（entry_noは1エントリーにつき1回しか出ないため
        # 帯全体を見ても曖昧にならない）。
        entry_text = band_text(t1, t2, *side_cfg["entry_no"])
        name_a = _row_text(name_rows[t1], *side_cfg["name"])
        name_b = _row_text(name_rows[t2], *side_cfg["name"])

        # 都道府県・所属はそれぞれの選手の行を中心とした狭い帯（隣接行への
        # ベースラインずれを吸収する程度）から個別に拾う。2行目に無ければ
        # 1行目の値を共有する（ペア共通の都道府県・所属のケース）。
        pref_a = band_text(t1 - 6, t1 + 6, *side_cfg["prefecture"])
        team_a = band_text(t1 - 6, t1 + 6, *side_cfg["team"])
        pref_b = band_text(t2 - 6, t2 + 6, *side_cfg["prefecture"])
        team_b = band_text(t2 - 6, t2 + 6, *side_cfg["team"])
        pref_a, team_a = _fix_pref_overflow(pref_a, team_a)
        pref_b, team_b = _fix_pref_overflow(pref_b, team_b)
        # ペア共通の都道府県・所属は、選手Aの帯より選手Bの帯側に寄って印字される
        # ことがある（ベースラインのずれ方向はページ依存）。どちらか一方だけに
        # 値がある場合は、もう一方へも共有する。
        if not pref_a:
            pref_a = pref_b
        if not pref_b:
            pref_b = pref_a
        if not team_a:
            team_a = team_b
        if not team_b:
            team_b = team_a

        if not (entry_text.isdigit() and name_a and name_b and (team_a or team_b)):
            i += 1
            continue
        entry_no = int(entry_text)

        if split_x is not None:
            sur_a, giv_a = _split_name_by_x(name_rows[t1], split_x)
            sur_b, giv_b = _split_name_by_x(name_rows[t2], split_x)
        else:
            sur_a, giv_a = _split_name(name_a)
            sur_b, giv_b = _split_name(name_b)

        results.append(
            {
                "entryNo": entry_no,
                "playerA": {
                    "lastName": sur_a,
                    "firstName": giv_a,
                    "prefecture": pref_a,
                    "team": team_a,
                },
                "playerB": {
                    "lastName": sur_b,
                    "firstName": giv_b,
                    "prefecture": pref_b,
                    "team": team_b,
                },
            }
        )
        i += 2

    return results


def _dedupe_by_entry_no(entries: List[Dict]) -> List[Dict]:
    seen = set()
    out = []
    for e in entries:
        if e["entryNo"] in seen:
            continue
        seen.add(e["entryNo"])
        out.append(e)
    return out


BRACKET_LAYOUTS = {
    "general": (BR_LEFT, BR_RIGHT),
    "female": (FEM_LEFT, FEM_RIGHT),
    "2022": (Y2022_LEFT, Y2022_RIGHT),
}


def _block_entry_count(page, side: str) -> Optional[int]:
    """そのブロックにエントリーが何組あるかを「(都道府県 所属)」の開き括弧の数で数える。
    抽出結果の件数と突き合わせる検算用（括弧は全エントリーに1つずつ、必ず出る）。"""
    anchors = _side_anchors(page, side)
    if anchors is None:
        return None
    sel, _, _ = anchors
    return sum(1 for c in sel if c["text"] == "(")


def parse_bracket_pages(pdf, pages: List[int], layout: str = "general") -> List[Dict]:
    """列範囲はページ・ブロックごとに自動検出する（`detect_bracket_cols`）。
    `layout`のプリセットは自動検出が失敗したページのフォールバックとしてのみ使う。

    ブロック（左の山/右の山）ごとに、開き括弧の数＝エントリー数と抽出件数を突き合わせる。
    列座標のズレでブロックが丸ごと落ちるとエントリー番号は「末尾から連番で欠ける」形に
    なり、欠番チェックでは検出できない（2023年度35歳男子・45歳男子で実際に右の山が
    丸ごと欠けたまま欠番0だった）ため、この検算を必ず通すこと。"""
    out = []
    for p in pages:
        page = pdf.pages[p - 1]
        cols = detect_bracket_cols(page)
        if cols is None:
            cols = BRACKET_LAYOUTS[layout]
            print(f"warning: page {p}: 列範囲を自動検出できず {layout} プリセットで処理します")
        for side, cfg in zip(("left", "right"), cols):
            entries = parse_bracket_page(page, cfg)
            expected = _block_entry_count(page, side)
            if expected is not None and expected != len(entries):
                print(
                    f"warning: page {p} {side}: 開き括弧 {expected} 組に対し "
                    f"{len(entries)} 組しか抽出できていません（列座標を要確認）"
                )
            out.extend(entries)
    out.sort(key=lambda e: e["entryNo"])
    return _dedupe_by_entry_no(out)


# ----------------------------- トーナメント表（年代別、prefecture/teamが別列） -----------------------------
# 35歳/45歳の一部ページは「一般」と列の持たせ方が違う: 所属(team)は氏名と同じ行に
# 直接続けて印字され、都道府県は別行（entry_no行）に括弧書きされる。ただし2人が別々の
# 都道府県・所属を持つ「混成ペア」の場合は、都道府県も氏名の行に直接出る。
AGE_LEFT = {
    "entry_no": (30, 53),
    "name": (55, 110),
    "prefecture": (113, 152),
    "team": (152, 245),
}
AGE_RIGHT = {
    "entry_no": (528, 548),
    "name": (353, 410),
    "prefecture": (413, 452),
    "team": (452, 528),
}


BRACKET_LAYOUTS["age"] = (AGE_LEFT, AGE_RIGHT)


# ----------------------------- ラウンドロビン表 -----------------------------
# 表形式（3組×N グループ）。1エントリー=2行（1行目=選手A、2行目=選手B）。
# 列: エントリー番号/氏名/支部(都道府県)/所属(チーム)/対戦成績(1,2,3...)/勝率/差/順位。
# エントリー番号は氏名と同じ行だが、対戦成績の丸数字と同じベースラインのため
# 氏名行より数pt浮く（トーナメント表と同じ現象）。
RR_COLS = {
    "entry_no": (40, 60),
    "name": (65, 140),
    "prefecture": (140, 186),
    "team": (186, 280),
}


def detect_rr_cols(page) -> dict:
    """ページ見出し行（氏名/支部/所属/1）のX座標から列範囲を自動検出する。
    ラウンドロビン表はページごとに列幅が変わる（グループ数に応じて詰められる）ため、
    固定座標では合わないことがある。"""
    header_chars = [c for c in page.chars if c["top"] < 120]
    by_text: Dict[str, float] = {}
    for c in header_chars:
        by_text.setdefault(c["text"], c["x0"])
    name_x = by_text.get("氏")
    prefecture_x = by_text.get("支")
    # 対戦成績列の先頭は "1" とは限らない（ページをまたぐグループは "22" 等から
    # 始まる）。見出し行（"氏"と同じtop）の数字文字のうちX座標最小のものを
    # 対戦成績列の開始とみなす（データ行のエントリー番号を拾わないよう、
    # topをtop<120でなく見出し行そのものに絞る）。
    header_top = next((c["top"] for c in header_chars if c["text"] == "氏"), None)
    digit_xs = [
        c["x0"]
        for c in header_chars
        if c["text"].isdigit() and header_top is not None and abs(c["top"] - header_top) < 2
    ]
    col1_x = min(digit_xs) if digit_xs else None
    if not (name_x and prefecture_x and col1_x):
        return RR_COLS
    # 都道府県は実データでは短縮表記2〜3文字（〜30pt）で収まる。所属列の見出しの
    # X座標は使わない（実データの開始位置が見出しより数〜十数pt早いページがあり、
    # 都道府県側に食い込むため）。
    return {
        "entry_no": (name_x - 44, name_x - 16),
        "name": (name_x - 16, prefecture_x - 5),
        "prefecture": (prefecture_x - 5, prefecture_x + 30),
        "team": (prefecture_x + 30, col1_x - 10),
    }


def parse_roundrobin_page(page, cols: dict = None) -> List[Dict]:
    cols = cols or detect_rr_cols(page)
    x_hi = cols["team"][1] + 5
    chars = [c for c in page.chars if c["x0"] < x_hi and c["top"] > 40]
    name_chars = [c for c in chars if cols["name"][0] <= c["x0"] < cols["name"][1]]
    name_rows = _rows_by_top(name_chars, tolerance=1.5, max_span=2.0)
    name_tops = sorted(name_rows.keys())

    def band_text(lo: float, hi: float, x0: float, x1: float) -> str:
        band = [c for c in chars if lo - 1 <= c["top"] <= hi + 1]
        return _row_text(band, x0, x1)

    results = []
    i = 0
    while i + 1 < len(name_tops):
        t1, t2 = name_tops[i], name_tops[i + 1]

        entry_text = band_text(t1 - 6, t1 + 6, *cols["entry_no"])
        name_a = _row_text(name_rows[t1], *cols["name"])
        name_b = _row_text(name_rows[t2], *cols["name"])
        pref_a = band_text(t1 - 6, t1 + 6, *cols["prefecture"])
        team_a = band_text(t1 - 6, t1 + 6, *cols["team"])
        pref_b = band_text(t2 - 6, t2 + 6, *cols["prefecture"])
        team_b = band_text(t2 - 6, t2 + 6, *cols["team"])
        pref_a, team_a = _fix_pref_overflow(pref_a, team_a)
        pref_b, team_b = _fix_pref_overflow(pref_b, team_b)

        if not (entry_text.isdigit() and name_a and name_b):
            i += 1
            continue
        entry_no = int(entry_text)

        sur_a, giv_a = _split_name_by_max_gap(name_rows[t1])
        sur_b, giv_b = _split_name_by_max_gap(name_rows[t2])

        results.append(
            {
                "entryNo": entry_no,
                "playerA": {
                    "lastName": sur_a,
                    "firstName": giv_a,
                    "prefecture": pref_a,
                    "team": team_a,
                },
                "playerB": {
                    "lastName": sur_b,
                    "firstName": giv_b,
                    "prefecture": pref_b,
                    "team": team_b,
                },
            }
        )
        i += 2

    return results


def parse_roundrobin_pages(pdf, pages: List[int]) -> List[Dict]:
    out = []
    for p in pages:
        page = pdf.pages[p - 1]
        out.extend(parse_roundrobin_page(page))
    out.sort(key=lambda e: e["entryNo"])
    return _dedupe_by_entry_no(out)


# ----------------------------- JSON組み立て -----------------------------
def player_id(surname: str, given: str, team: str, prefecture: str) -> str:
    return f"{surname}_{given}_{team}_{prefecture}"


def build_doubles_json(entries: List[Dict]) -> Dict:
    participants = []
    seen = set()
    out_entries = []
    for e in entries:
        ids = []
        for p in (e["playerA"], e["playerB"]):
            pref = canonical_prefecture(p["prefecture"])
            team = p["team"]
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument(
        "--bracket",
        action="append",
        default=[],
        metavar="categoryId=pages[:layout]",
        help="例: doubles-none-boys=1-8  doubles-none-girls=10-11:female  "
        "doubles-over35-boys=14-15:age  (layout省略時は general)",
    )
    ap.add_argument(
        "--roundrobin",
        action="append",
        default=[],
        metavar="categoryId=pages",
        help="例: doubles-over35-girls=17",
    )
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    pdf = pdfplumber.open(args.pdf)
    out_dir = os.path.join(args.out, str(args.year))
    os.makedirs(out_dir, exist_ok=True)

    jobs = []
    for spec in args.bracket:
        cat, rest = spec.split("=")
        if ":" in rest:
            pages, layout = rest.split(":")
        else:
            pages, layout = rest, "general"
        entries = parse_bracket_pages(pdf, parse_page_range(pages), layout=layout)
        jobs.append((cat, build_doubles_json(entries)))
    for spec in args.roundrobin:
        cat, pages = spec.split("=")
        entries = parse_roundrobin_pages(pdf, parse_page_range(pages))
        jobs.append((cat, build_doubles_json(entries)))

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
