#!/usr/bin/env python3
"""天皇賜杯・皇后賜杯 全日本ソフトテニス選手権大会 ドロー表PDF → initialPlayers JSON。

対象レイアウト（2019年度 = 令和元年度 第74回、`2019_A08_40.pdf` で検証）:

    [番号] [氏名フィールド] ( [都道府県] [所属] ) [スコア]      ← 左ブロック
    [スコア] [氏名フィールド] ( [都道府県] [所属] ) [番号]      ← 右ブロック

1エントリー = 3行（選手1 / 括弧行 / 選手2）。括弧行にエントリー番号が入る。
都道府県・所属はペアで共通なら括弧行に、選手ごとに異なれば選手の行に印字される
（両方が異なる場合、括弧の中身は空になる）。そのため

    その選手の行に値があればそれを、無ければ括弧行の値を使う

という解決になる。

氏名は7スロット固定グリッド（全角スペース詰め）で、
    スロット0-2 = 姓 / スロット3 = 区切り / スロット4-6 = 名
という規則で分割できる（`藤　森　　　源` = 藤森+源、`林　　　大喜` = 林+大喜、
`柳　田　賢太朗` = 柳田+賢太朗）。姓が4文字のときだけスロット3まで食い込む
（`小　茄　子　川　　夏　月` = 小茄子川+夏月）。座標は定数で持たず、ページ・ブロック
ごとにグリッドの基準x・ピッチを実測する（男子ページはピッチ8.74pt、女子は8.51pt）。

行の組み立ては文字の **上端ではなく上下中心** で行う。所属欄はフォントが本文より
小さくなることがあり（列幅に収まらない長い名前）、上端で揃えると別の行に流れるため。

使い方:
    python3 scripts/pdf/zennihon_championship_entries.py INPUT.pdf \
        --pages 1-4 --out tools/zennihon-championship-2019/doubles-none-boys.initialPlayers.json
"""

from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from collections import Counter, defaultdict

import pdfplumber

IDEOGRAPHIC_SPACE = "　"
PARENS = "()（）"

PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]
PREF_BY_SHORT = {(p if p == "北海道" else p[:-1]): p for p in PREFECTURES}

# 都道府県ではないが、この大会の「都道府県」欄に正規に現れる所属区分
NON_PREFECTURE_AFFILIATIONS = {"日本学連", "学連", "日本連盟", "高体連", "中体連", "実業団"}

SCORE_CHARS = set("0123456789①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮")


def is_name_char(text: str) -> bool:
    if text == IDEOGRAPHIC_SPACE:
        return True
    if not text.strip():
        return False
    if text in SCORE_CHARS or text in PARENS or text in "・．.":
        return False
    return unicodedata.category(text[0]).startswith("L")


def center(c):
    return (c["top"] + c["bottom"]) / 2


def make_lines(chars, tol=1.5):
    """文字を上下中心でテキスト行にまとめる。戻り値は [(中心y, [文字...])]。"""
    lines = []
    for c in sorted(chars, key=center):
        if lines and center(c) - lines[-1][0] <= tol:
            lines[-1][1].append(c)
            lines[-1][0] = center(c)
        else:
            lines.append([center(c), [c]])
    return [(sum(center(x) for x in cs) / len(cs), sorted(cs, key=lambda x: x["x0"]))
            for _, cs in lines]


def widest_gap(chars, lo, hi):
    """[lo, hi) の中で、どの文字にも覆われていない最も広い帯の中心を返す。"""
    spans = sorted((c["x0"], c["x1"]) for c in chars if lo <= c["x0"] < hi)
    if not spans:
        return (lo + hi) / 2
    best, best_w = None, 0.0
    cur = spans[0][1]
    for x0, x1 in spans[1:]:
        if x0 - cur > best_w:
            best_w, best = x0 - cur, (cur + x0) / 2
        cur = max(cur, x1)
    return best if best is not None else (lo + hi) / 2


def detect_paren_columns(chars):
    """左右2ブロックの括弧列のx0を、出現数の多い順で確定する。

    見出し「男子 (1)」の括弧が1個だけ混ざるので、最頻の2本だけを採る。
    """
    opens = Counter(round(c["x0"], 1) for c in chars if c["text"] in "(（")
    closes = Counter(round(c["x0"], 1) for c in chars if c["text"] in ")）")
    ox = sorted(x for x, _ in opens.most_common(2))
    cx = sorted(x for x, _ in closes.most_common(2))
    if len(ox) != 2 or len(cx) != 2:
        raise RuntimeError(f"括弧列を2本検出できませんでした: {ox} / {cx}")
    return [(ox[0], cx[0]), (ox[1], cx[1])]


def detect_name_grid(chars, x_hi, x_lo=0.0):
    """氏名フィールドの7スロットのx0を実測する。"""
    xs = Counter(round(c["x0"], 1) for c in chars
                 if x_lo < c["x0"] < x_hi and is_name_char(c["text"]))
    top = sorted(x for x, _ in xs.most_common(7))
    if len(top) != 7:
        raise RuntimeError(f"氏名スロットが7個ではありません: {top}")
    pitch = (top[-1] - top[0]) / 6
    for i, x in enumerate(top):
        if abs(x - (top[0] + pitch * i)) > 1.0:
            raise RuntimeError(f"氏名スロットが等間隔ではありません: {top}")
    return top, pitch


def text_of(cs):
    return "".join(c["text"] for c in cs).strip()


def merge_wrapped(lines, note):
    """所属列で折り返された行を1つにまとめる。

    折り返しは稀（2019年度は延べ720人中1件＝`神戸松蔭女子学院大` + `学`）。
    **座標だけでは折り返しと「隣のエントリーの所属」を区別できない**ことを実測で確認して
    ある（行送り比 gap/size は 1.18 と 1.29 の2値しか無く、折り返しの1.18は
    別エントリー同士の間隔と完全に同じ値）。そのため最後の判断は
    「1文字だけの所属名は現実には無い」という意味的な条件に置く。取りこぼす方向に倒し、
    結合したものは必ず警告に出して人が確認できるようにする。
    """
    if len(lines) < 2:
        return lines
    max_right = max(max(c["x1"] for c in cs) for _, cs in lines)

    def size_of(cs):
        return max(c["size"] for c in cs)

    out = []
    i = 0
    while i < len(lines):
        y, cs = lines[i]
        while i + 1 < len(lines):
            nxt_y, nxt = lines[i + 1]
            size = size_of(cs)
            if (len(text_of(nxt)) == 1
                    and abs(size_of(nxt) - size) <= 0.2
                    and abs(nxt[0]["x0"] - cs[0]["x0"]) <= 0.5
                    and 1.05 <= (nxt_y - y) / size <= 1.35
                    and max(c["x1"] for c in cs) >= max_right - 1.5 * size):
                note(f"所属名の折り返しを結合: "
                     f"{''.join(c['text'] for c in cs)} + {''.join(c['text'] for c in nxt)}")
                cs = cs + nxt
                i += 1
            else:
                break
        out.append((y, cs))
        i += 1
    return out


def split_name(slots):
    """スロット番号→文字 の辞書から (姓, 名, 4文字姓か) を返す。"""
    surname = "".join(slots[i] for i in (0, 1, 2, 3) if i in slots)
    given = "".join(slots[i] for i in (4, 5, 6) if i in slots)
    return surname, given, 3 in slots


def normalize_prefecture(raw):
    raw = (raw or "").strip()
    if not raw:
        return None, False
    if raw in NON_PREFECTURE_AFFILIATIONS or raw in PREFECTURES:
        return raw, True
    if raw in PREF_BY_SHORT:
        return PREF_BY_SHORT[raw], True
    return raw, False


def extract_block(chars, open_x, close_x, x_lo, side, warnings, page_no):
    """1ブロック（左または右の1列）を解析する。

    x_lo … このブロックの左端。右ブロックでは中央のスコア帯を跨がないための下限。
    """
    def note(msg):
        warnings.append(f"p{page_no} {side}: {msg}")

    grid, pitch = detect_name_grid(chars, open_x, x_lo)
    name_lo, name_hi = grid[0] - 1.0, grid[-1] + pitch
    split_x = widest_gap([c for c in chars if open_x < c["x0"] < close_x], open_x, close_x)

    def picks(pred):
        return [c for c in chars if pred(c)]

    name_rows = make_lines(picks(
        lambda c: name_lo <= c["x0"] < name_hi and is_name_char(c["text"])))
    paren_rows = make_lines(picks(
        lambda c: c["text"] in "(（" and abs(c["x0"] - open_x) < 1.0))
    pref_lines = make_lines(picks(
        lambda c: open_x <= c["x0"] < split_x and c["text"] not in PARENS))
    team_lines = merge_wrapped(make_lines(picks(
        lambda c: split_x <= c["x0"] <= close_x and c["text"] not in PARENS)), note)
    num_lines = make_lines(picks(
        lambda c: c["text"].isdigit()
        and (c["x1"] <= name_lo if side == "left" else c["x0"] > close_x)))

    anchors = sorted(
        [{"y": y, "kind": "name", "chars": cs} for y, cs in name_rows]
        + [{"y": y, "kind": "paren", "chars": cs} for y, cs in paren_rows],
        key=lambda a: a["y"])
    if not anchors:
        return []
    for a in anchors:
        a.update(pref="", team="", number="")

    def attach(lines, field):
        for y, cs in lines:
            best = min(anchors, key=lambda a: abs(a["y"] - y))
            best[field] = (best[field] + text_of(cs)) if best[field] else text_of(cs)

    attach(pref_lines, "pref")
    attach(team_lines, "team")
    attach(num_lines, "number")

    entries = []
    for i, row in enumerate(anchors):
        if row["kind"] != "paren":
            continue
        players = [anchors[j] for j in (i - 1, i + 1)
                   if 0 <= j < len(anchors) and anchors[j]["kind"] == "name"]
        if len(players) != 2:
            note(f"番号{row['number'] or '?'}: 選手行が{len(players)}件")
            continue
        info = []
        for pl in players:
            slots = {}
            for c in pl["chars"]:
                idx = int(round((c["x0"] - grid[0]) / pitch))
                if c["text"] != IDEOGRAPHIC_SPACE and 0 <= idx <= 6:
                    slots[idx] = slots.get(idx, "") + c["text"]
            last, first, wide = split_name(slots)
            if wide:
                note(f"番号{row['number']}: 4文字姓として分割 {last}｜{first}（要目視）")
            pref, ok = normalize_prefecture(pl["pref"] or row["pref"])
            if not ok:
                note(f"番号{row['number']}: 都道府県辞書に無い {pref!r}")
            team = pl["team"] or row["team"]
            info.append({
                "lastName": last, "firstName": first, "team": team,
                "prefecture": pref, "playerId": None,
                "tempId": f"{last}_{first}_{team}",
            })
        entries.append({
            "number": int(row["number"]) if row["number"].isdigit() else None,
            "information": info,
        })
    return entries


def extract_page(page, page_no, warnings):
    chars = list(page.chars)
    (open_l, close_l), (open_r, close_r) = detect_paren_columns(chars)
    left = [c for c in chars if c["x0"] <= close_l]
    right = [c for c in chars if c["x0"] > close_l]
    return (extract_block(left, open_l, close_l, 0.0, "left", warnings, page_no)
            + extract_block(right, open_r, close_r, close_l, "right", warnings, page_no))


def parse_pages(spec, total):
    if not spec:
        return list(range(1, total + 1))
    out = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--pages", help="例: 1-4 / 6,7,8,9")
    ap.add_argument("--out")
    args = ap.parse_args()

    warnings, entries = [], []
    with pdfplumber.open(args.pdf) as pdf:
        for pno in parse_pages(args.pages, len(pdf.pages)):
            entries.extend(extract_page(pdf.pages[pno - 1], pno, warnings))

    entries.sort(key=lambda e: (e["number"] is None, e["number"]))
    result = []
    for e in entries:
        info = e["information"]
        result.append({
            "id": e["number"],
            "name": f"{info[0]['lastName']}・{info[1]['lastName']}（{info[0]['team']}）",
            "information": info,
            "category": "doubles",
        })

    # --- 検証レポート ---
    numbers = [e["id"] for e in result]
    seen = defaultdict(list)
    for e in result:
        seen[tuple(sorted(f"{p['lastName']}{p['firstName']}" for p in e["information"]))].append(e["id"])
    report = {
        "count": len(result),
        "id_range": [min(numbers), max(numbers)] if numbers else None,
        "duplicate_ids": [n for n, c in Counter(numbers).items() if c > 1],
        "missing_ids": [n for n in range(1, max(numbers) + 1) if n not in set(numbers)] if numbers else [],
        "empty_team": sorted({e["id"] for e in result for p in e["information"] if not p["team"]}),
        "empty_name": sorted({e["id"] for e in result for p in e["information"]
                              if not p["lastName"] or not p["firstName"]}),
        "duplicate_players": {"・".join(k): v for k, v in seen.items() if len(v) > 1},
        "warnings": warnings,
    }
    report["clean"] = not any(report[k] for k in
                              ("duplicate_ids", "missing_ids", "empty_team", "empty_name",
                               "duplicate_players", "warnings"))
    print(json.dumps(report, ensure_ascii=False, indent=2), file=sys.stderr)

    text = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"wrote {args.out} ({len(result)} entries)", file=sys.stderr)
    else:
        print(text)


if __name__ == "__main__":
    main()
