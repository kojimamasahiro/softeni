#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全国中学校ソフトテニス大会（全中 / secondaryschool-championship）の結果PDFから
`data/tournaments/details/secondaryschool-championship/<年>/*.json` を作る。

**同じ大会でも年度で組版系統がまったく違う**ので、年度ごとに読み方を切り替える。

  2018年度（第49回, `2018_C10_40.pdf`, 8ページ・テキストレイヤーあり）
    個人戦 … p5/p6 の「結果一覧」（ラウンド見出し＋1行1試合＋エントリー番号＋スコア）を読む。
             p1-p4 のブラケット表にも同じスコアが印字されているので、**独立に読んで照合**する
             （既定ON。`--no-verify` で省ける。248字すべて一致することを確認済み）。
    団体戦 … p7/p8 のブラケット表。行yからユニット木を作り、スコア字をyで割り当てる。

  2019年度（第50回, `2019_C09_40.pdf`, 6ページ・**スキャン画像**）
    テキストレイヤーが無い。300dpiでレンダリングし、**赤インク**（勝ち上がりの太線と
    スコア字）を色で分離して幾何的に読む。
      - 水平線分の連結成分 = 1ユニットのライン。ライン y は入力2本の中点に一致する。
      - **勝者は合流点の縦線の色**で決まる（勝者側の脚だけが赤い）。丸数字を読まずに済む。
        水平線の色は「1つでも勝った競技者の経路」なので勝敗判定には使えない（罠）。
      - スコア字の値だけは画像なので読めない。`zenchu-2019-score-glyphs.json`
        （グリフ座標→数字）を辞書として使う。作り方は下記。

グリフ辞書の作り方（2019）:
  1. `--dump-glyphs <dir>` で敗者スコア字を切り出し、コンタクトシートを出す。
  2. 階層クラスタリングが 0/1/2/3 の4クラスにきれいに割れるので、代表字を目視で同定する。
  3. 個々の字は「最近傍セントロイドと一致するか」で検算し、外れたものだけ拡大して確認する。
  （実施記録: docs/raw/2026-09-03-zenchu-2018-2019-results-from-pdf.md）

使い方:
  python3 scripts/pdf/zenchu_results.py ~/Downloads/2018_C10_40.pdf --year 2018 \
      --entries tools/secondaryschool-championship/2018 \
      --out data/tournaments/details/secondaryschool-championship/2018
  python3 scripts/pdf/zenchu_results.py ~/Downloads/2019_C09_40.pdf --year 2019 \
      --entries tools/secondaryschool-championship/2019 \
      --out data/tournaments/details/secondaryschool-championship/2019

依存: pdfplumber（2018）/ PyMuPDF・Pillow・numpy・scipy（2019）
"""
from __future__ import annotations

import argparse
import collections
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tournament_results_common import build, check, write  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
GLYPHS_2019 = os.path.join(HERE, "zenchu-2019-score-glyphs.json")

KINDS = ["doubles-none-boys", "doubles-none-girls", "team-none-boys", "team-none-girls"]

# ---------------------------------------------------------------- 2018 個人戦
RESULT_ROUNDS = {"一回戦": "1回戦", "二回戦": "2回戦", "三回戦": "3回戦",
                 "四回戦": "4回戦", "準々決勝": "準々決勝", "準決勝": "準決勝", "決勝": "決勝"}
SC = {"④": 4, "0": 0, "1": 1, "2": 2, "3": 3}
RESULT_LINE = re.compile(r"^(\d+)(.+?)ペア（(.+?)）([④0-3])－([④0-3])(\d+)(.+?)ペア（(.+?)）$")


def read_result_list(page):
    """2018 p5/p6「結果一覧」。1行1試合で、エントリー番号もスコアも印字されている。"""
    out, rnd = [], None
    for line in (page.extract_text() or "").split("\n"):
        s = line.replace(" ", "").replace("　", "")
        if s in RESULT_ROUNDS:
            rnd = RESULT_ROUNDS[s]
            continue
        m = RESULT_LINE.match(s)
        if not m:
            continue
        a, an, ai, sa, sb, b, bn, bi = m.groups()
        a, b, sa, sb = int(a), int(b), SC[sa], SC[sb]
        assert (sa == 4) != (sb == 4), f"勝者が一意でない: {s}"
        out.append({"round": rnd, "entries": [a, b], "winner": a if sa == 4 else b,
                    "winnerScore": 4, "loserScore": min(sa, sb), "retired": False,
                    "names": {a: (an, ai), b: (bn, bi)}})
    return out


def _rows_2018(page, xlo, xhi, ytop=60):
    ys = sorted({round(c["top"], 1) for c in page.chars
                 if (c["text"].isdigit() or c["text"] in "０１２３４５６７８９")
                 and xlo < c["x0"] < xhi and c["top"] > ytop})
    m = []
    for y in ys:
        if m and y - m[-1] < 3:
            continue
        m.append(y)
    return m


def verify_bracket_2018(pdf, matches, pages, base_step=32):
    """2018 p1-p4 のブラケット表を結果一覧と**独立に**読んで突き合わせる。

    ラウンド列の x座標は使わない。ページ最終戦のスコアが1列手前に置かれるため
    （skill の既知の罠）、各ブロックのライン y = (上端行+下端行)/2 の上下 4.8pt を
    期待位置として、スコア字を全体最近傍でマッチさせる。
    """
    rounds = ["1回戦", "2回戦", "3回戦", "準々決勝"]
    bad = 0
    for pi, pageno in enumerate(pages):
        page = pdf.pages[pageno]
        L = _rows_2018(page, 50, 65)[:16]
        R = _rows_2018(page, 530, 560)[:16]
        assert len(L) == 16 and len(R) == 16, (len(L), len(R))
        assert max(abs(a - b) for a, b in zip(L, R)) < 1, "左右の行yがずれている"
        scores = [((c["x0"] + c["x1"]) / 2, c["top"], SC[c["text"]]) for c in page.chars
                  if c["text"] in SC and 240 < (c["x0"] + c["x1"]) / 2 < 360 and c["top"] < L[-1] + 30]
        assert len(scores) == 62, f"p{pageno + 1}: スコア字が {len(scores)} 個（期待62）"
        slots = []
        for half, rs in (("L", L), ("R", R)):
            for r in range(4):
                w = 2 ** r
                for b in range(16 // w):
                    line = (rs[b * w] + rs[b * w + w - 1]) / 2
                    slots.append(((half, r, b), line + (4.8 if b % 2 else -4.8), half))
        mid = (L[0] + L[15]) / 2
        slots += [(("L", 4, 0), mid, "L"), (("R", 4, 0), mid, "R")]
        pairs = sorted((abs(sy - c[1]), si, ci)
                       for si, (_, sy, sh) in enumerate(slots)
                       for ci, c in enumerate(scores)
                       if ((c[0] < 295) if sh == "L" else (c[0] >= 295)))
        got, us, uc, worst = {}, set(), set(), 0.0
        for d, si, ci in pairs:
            if si in us or ci in uc:
                continue
            us.add(si); uc.add(ci); got[slots[si][0]] = scores[ci][2]; worst = max(worst, d)
        assert len(got) == 62, "スコア字の割り当てに漏れがある"
        assert worst < 20, f"スコア字と想定yのずれが大きい: {worst:.1f}pt"
        base = pi * base_step
        for half, off in (("L", base), ("R", base + 16)):
            for r in range(4):
                w = 2 ** (r + 1)
                for j in range(16 // w):
                    lo, hi = off + j * w + 1, off + (j + 1) * w
                    sel = [m for m in matches if m["round"] == rounds[r]
                           and lo <= min(m["entries"]) and max(m["entries"]) <= hi]
                    assert len(sel) == 1, (rounds[r], lo, hi, len(sel))
                    m = sel[0]
                    u, d2 = min(m["entries"]), max(m["entries"])
                    sc = {m["winner"]: 4}
                    sc[u if m["winner"] == d2 else d2] = m["loserScore"]
                    if [got[(half, r, 2 * j)], got[(half, r, 2 * j + 1)]] != [sc[u], sc[d2]]:
                        bad += 1
                        print(f"NG p{pageno + 1} {half} {rounds[r]} {lo}-{hi}", file=sys.stderr)
        sel = [m for m in matches if m["round"] == "準決勝"
               and base + 1 <= min(m["entries"]) and max(m["entries"]) <= base + 32]
        assert len(sel) == 1
        m = sel[0]
        u, d2 = min(m["entries"]), max(m["entries"])
        sc = {m["winner"]: 4}
        sc[u if m["winner"] == d2 else d2] = m["loserScore"]
        if [got[("L", 4, 0)], got[("R", 4, 0)]] != [sc[u], sc[d2]]:
            bad += 1
            print(f"NG p{pageno + 1} 準決勝", file=sys.stderr)
    return bad


# ---------------------------------------------------------------- 2018 団体戦
TEAM_SC = {"②": 2, "③": 3, "④": 4, "0": 0, "1": 1, "2": 2, "3": 3}
TEAM_ROUNDS = ["1回戦", "2回戦", "準々決勝", "準決勝"]


def _levels(rows, pairs, base):
    """行 → 1回戦の組 → ユニット木。unit.line は入力2本の中点。"""
    units, i = [], 0
    while i < len(rows):
        if (i, i + 1) in pairs:
            a = {"rows": (i,), "line": rows[i], "no": base + i, "inputs": None}
            b = {"rows": (i + 1,), "line": rows[i + 1], "no": base + i + 1, "inputs": None}
            units.append({"rows": (i, i + 1), "line": (rows[i] + rows[i + 1]) / 2, "inputs": (a, b)})
            i += 2
        else:
            units.append({"rows": (i,), "line": rows[i], "no": base + i, "inputs": None})
            i += 1
    lv = [units]
    while len(lv[-1]) > 1:
        cur = lv[-1]
        assert len(cur) % 2 == 0, f"ユニット数 {len(cur)} が偶数でない"
        lv.append([{"rows": cur[k]["rows"] + cur[k + 1]["rows"],
                    "line": (cur[k]["line"] + cur[k + 1]["line"]) / 2,
                    "inputs": (cur[k], cur[k + 1])} for k in range(0, len(cur), 2)])
    return lv


def read_team_page_2018(page):
    """2018 p7/p8。ラインの上(-8.4pt)／下(+5.3pt)にスコアが置かれる。"""
    halves, ms = {}, []
    for hs, (xlo, xhi), (nlo, nhi), outer, base in (("L", (190, 297), (55, 75), "min", 1),
                                                    ("R", (297, 410), (525, 550), "max", 14)):
        rows = _rows_2018(page, nlo, nhi)
        ss = sorted([((c["x0"] + c["x1"]) / 2, c["top"], TEAM_SC[c["text"]]) for c in page.chars
                     if c["text"] in TEAM_SC and xlo < (c["x0"] + c["x1"]) / 2 < xhi],
                    key=lambda t: t[1])
        edge = (min if outer == "min" else max)(x for x, _, _ in ss)
        col = [s for s in ss if abs(s[0] - edge) < 8]
        assert len(col) % 2 == 0, f"1回戦のスコア字が奇数個 ({len(col)})"
        pairs = set()
        for i in range(0, len(col), 2):
            a, b = col[i], col[i + 1]
            ra = min(range(len(rows)), key=lambda k: abs(rows[k] - a[1]))
            rb = min(range(len(rows)), key=lambda k: abs(rows[k] - b[1]))
            assert rb == ra + 1 and rows[ra] - a[1] > 2 and b[1] - rows[rb] > 2, \
                "1回戦の組がラインの上下から決まらない"
            pairs.add((ra, rb))
        lv = _levels(rows, pairs, base)
        slots = []
        for li, units in enumerate(lv):
            for u in units:
                if not u["inputs"]:
                    continue
                a, b = u["inputs"]
                slots.append((TEAM_ROUNDS[li], a["rows"], a["line"] - 8.4))
                slots.append((TEAM_ROUNDS[li], b["rows"], b["line"] + 5.3))
        slots.append(("決勝", lv[-1][0]["rows"], lv[-1][0]["line"]))
        cand = sorted((abs(y - c[1]), i, j) for i, (_, _, y) in enumerate(slots)
                      for j, c in enumerate(ss))
        got, us, uc, worst = {}, set(), set(), 0.0
        for d, i, j in cand:
            if i in us or j in uc:
                continue
            us.add(i); uc.add(j); got[(slots[i][0], slots[i][1])] = ss[j][2]; worst = max(worst, d)
        assert len(us) == len(slots), f"{hs}: スコア字の割り当てに漏れ"
        assert worst < 20, f"{hs}: スコア字と想定yのずれが大きい ({worst:.1f}pt)"
        halves[hs] = (lv, got)
        for li, units in enumerate(lv):
            for u in units:
                if not u["inputs"]:
                    continue
                x, y = u["inputs"]
                sx, sy = got[(TEAM_ROUNDS[li], x["rows"])], got[(TEAM_ROUNDS[li], y["rows"])]
                assert (sx >= 2) != (sy >= 2), f"{hs} {TEAM_ROUNDS[li]}: 勝者が一意でない {sx}/{sy}"
                u["no"] = x["no"] if sx > sy else y["no"]
                ms.append({"round": TEAM_ROUNDS[li], "entries": sorted([x["no"], y["no"]]),
                           "winner": u["no"], "winnerScore": max(sx, sy),
                           "loserScore": min(sx, sy), "retired": False})
    lu, ru = halves["L"][0][-1][0], halves["R"][0][-1][0]
    sx = halves["L"][1][("決勝", lu["rows"])]
    sy = halves["R"][1][("決勝", ru["rows"])]
    assert (sx >= 2) != (sy >= 2), "決勝の勝者が一意でない"
    ms.append({"round": "決勝", "entries": sorted([lu["no"], ru["no"]]),
               "winner": lu["no"] if sx > sy else ru["no"],
               "winnerScore": max(sx, sy), "loserScore": min(sx, sy), "retired": False})
    return ms


# -------------------------------------------------------------------- 2019
def _lazy_2019():
    global np, ndimage, Image, fitz
    import numpy as np                       # noqa: F401
    from scipy import ndimage                # noqa: F401
    from PIL import Image                    # noqa: F401
    import fitz                              # noqa: F401


def render_2019(pdf_path, dpi=300):
    _lazy_2019()
    doc = fitz.open(pdf_path)
    out = []
    for page in doc:
        pm = page.get_pixmap(dpi=dpi)
        im = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width, pm.n)
        im = im[:, :, :3].astype(int)
        r, g, b = im[:, :, 0], im[:, :, 1], im[:, :, 2]
        dark = (r + g + b) < 620
        red = dark & (r - g > 50) & (r - b > 50)
        out.append((dark, red))
    return out


def hsegs(dark, red, minlen=30, xlo=950, xhi=1560, ylo=400, yhi=2980):
    """水平線分（＝ユニットのライン）。h>25 の塊は文字なので落とす。"""
    H = ndimage.binary_opening(dark, structure=np.ones((1, minlen)))
    lab, n = ndimage.label(H, structure=np.ones((3, 3)))
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        ys, xs = sl
        if xs.stop - xs.start < minlen or ys.stop - ys.start > 25:
            continue
        if not (xlo <= xs.start and xs.stop - 1 <= xhi and ylo <= ys.start <= yhi):
            continue
        m = lab[sl] == i
        out.append({"y": round(float(np.where(m)[0].mean() + ys.start), 1),
                    "x0": int(xs.start), "x1": int(xs.stop - 1),
                    "red": float(red[sl][m].sum()) / m.sum()})
    return sorted(out, key=lambda s: s["y"])


def leg_red(dark, red, xj, y_in, y_out, halfw=9, margin=10):
    """合流点の縦線（入力ライン→出力ライン）の赤率。勝者側の脚だけが赤い。"""
    a, b = sorted((y_in, y_out))
    a, b = int(a + margin), int(b - margin)
    if b <= a:
        return 0.0
    d = dark[a:b, xj - halfw:xj + halfw + 1]
    r = red[a:b, xj - halfw:xj + halfw + 1]
    return float(r.sum()) / d.sum() if d.sum() else 0.0


def side_red(dark, red, seg, frac, side):
    x0, x1 = seg["x0"], seg["x1"]
    k = max(10, int((x1 - x0 + 1) * frac))
    a, b = (x0, x0 + k) if side == "L" else (x1 - k, x1)
    y = int(round(seg["y"]))
    d = dark[y - 6:y + 7, a:b + 1]
    r = red[y - 6:y + 7, a:b + 1]
    return float(r.sum()) / d.sum() if d.sum() else 0.0


def glyph_at(red, xj, y_line, vside, hside, xw=(5, 42), yw=(6, 74), minpix=12):
    """合流点の外側・ラインの上(下)にあるスコア字の bbox。"""
    x0, x1 = (xj + xw[0], xj + xw[1]) if hside == "R" else (xj - xw[1], xj - xw[0])
    if vside == "up":
        ys = slice(int(y_line) - yw[1], int(y_line) - yw[0])
    elif vside == "dn":
        ys = slice(int(y_line) + yw[0], int(y_line) + yw[1])
    else:
        ys = slice(int(y_line) - yw[1], int(y_line) + yw[1])
    sub = red[ys, x0:x1 + 1]
    lab, n = ndimage.label(sub, structure=np.ones((3, 3)))
    parts = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if (lab[sl] == i).sum() < minpix or h > 60 or w > 60:
            continue
        parts.append((sl[1].start, sl[1].stop - 1, sl[0].start, sl[0].stop - 1))
    if not parts:
        return None
    ref = min(p[0] for p in parts) if hside == "R" else max(p[1] for p in parts)
    parts = [p for p in parts if (p[0] - ref < 22 if hside == "R" else ref - p[1] < 22)]
    return (x0 + min(p[0] for p in parts), ys.start + min(p[2] for p in parts),
            x0 + max(p[1] for p in parts), ys.start + max(p[3] for p in parts))


DOUBLES_ROUNDS = ["1回戦", "2回戦", "3回戦", "準々決勝"]


def read_doubles_page_2019(dark, red, base):
    """32エントリー1ページ。左1-16／右17-32が同じ行yを共有する鏡像配置。"""
    segs = hsegs(dark, red, xhi=1510)
    sf = [s for s in segs if s["x1"] - s["x0"] > 80]
    assert len(sf) == 1, f"ページ最終戦の線分が {len(sf)} 本"
    sf = sf[0]
    rest = [s for s in segs if s is not sf]
    halves = {"L": [s for s in rest if s["x0"] < 1250], "R": [s for s in rest if s["x0"] >= 1250]}
    assert len(halves["L"]) == 30 and len(halves["R"]) == 30, \
        (len(halves["L"]), len(halves["R"]))
    out, tops = [], {}
    for hs, off in (("L", base), ("R", base + 16)):
        ss = sorted(halves[hs] + [sf], key=lambda s: s["y"])
        d = [ss[i + 1]["y"] - ss[i]["y"] for i in range(30)]
        assert max(d) - min(d) < 6, f"線分の間隔が不均一 ({min(d):.0f}-{max(d):.0f})"
        rows = [ss[i]["y"] for i in range(0, 31, 2)]
        lv = _levels(rows, {(i, i + 1) for i in range(0, 16, 2)}, off)
        win = {(i,): off + i for i in range(16)}
        for li, units in enumerate(lv):
            for u in units:
                a, b = u["inputs"]
                cand = [s for s in ss if abs(s["y"] - u["line"]) <= 6]
                assert len(cand) == 1, f"{hs} {u['rows']}: 出力ラインが {len(cand)} 本"
                o = cand[0]
                xj = o["x0"] + 4 if hs == "L" else o["x1"] - 4
                ra = leg_red(dark, red, xj, a["line"], o["y"])
                rb = leg_red(dark, red, xj, b["line"], o["y"])
                assert (ra > 0.5) != (rb > 0.5), \
                    f"{hs} {u['rows']}: 合流の色が判別できない {ra:.2f}/{rb:.2f}"
                up = ra > rb
                wu, lu = (a, b) if up else (b, a)
                gs = "R" if hs == "L" else "L"
                gw = glyph_at(red, xj, wu["line"], "up" if up else "dn", gs)
                gl = glyph_at(red, xj, lu["line"], "dn" if up else "up", gs)
                assert gw and gl, f"{hs} {u['rows']}: スコア字が見つからない"
                # 丸数字（勝者）は幅19px以上、裸の数字（敗者）は17px以下に完全に分かれる。
                # 合流の色から出した勝者と一致することを毎試合確かめる。
                assert gw[2] - gw[0] + 1 >= 19 and gl[2] - gl[0] + 1 <= 17, \
                    f"{hs} {u['rows']}: 丸数字の判定と合流の色が食い違う"
                out.append({"round": DOUBLES_ROUNDS[li], "winner": win[wu["rows"]],
                            "loser": win[lu["rows"]], "loseGlyph": gl})
                win[u["rows"]] = win[wu["rows"]]
        tops[hs] = win[lv[-1][0]["rows"]]
    lr, rr = side_red(dark, red, sf, 0.3, "L"), side_red(dark, red, sf, 0.3, "R")
    assert (lr > 0.5) != (rr > 0.5), f"準決勝の色が判別できない {lr:.2f}/{rr:.2f}"
    wh = "L" if lr > rr else "R"
    gL = glyph_at(red, sf["x0"], sf["y"], "mid", "L", xw=(5, 50), yw=(0, 40))
    gR = glyph_at(red, sf["x1"], sf["y"], "mid", "R", xw=(5, 50), yw=(0, 40))
    out.append({"round": "準決勝", "winner": tops[wh], "loser": tops["R" if wh == "L" else "L"],
                "loseGlyph": gR if wh == "L" else gL})
    return out, tops[wh]


def read_final_2019(dark, red):
    """ページ下部の再掲枠。ページ勝者の決勝の本数が印字される（丸数字なら優勝）。"""
    segs = hsegs(dark, red, xhi=1510)
    ymax = max(s["y"] for s in segs)
    sub = red[int(ymax) + 60:, :]
    lab, n = ndimage.label(sub, structure=np.ones((3, 3)))
    parts = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if (lab[sl] == i).sum() < 25 or h > 60 or w > 60:
            continue
        parts.append((sl[1].start, sl[1].stop - 1, sl[0].start, sl[0].stop - 1))
    assert parts, "再掲枠のスコア字が見つからない"
    ref = min(p[0] for p in parts)
    parts = [p for p in parts if p[0] - ref < 40]
    box = (min(p[0] for p in parts), int(ymax) + 60 + min(p[2] for p in parts),
           max(p[1] for p in parts), int(ymax) + 60 + max(p[3] for p in parts))
    return box, (box[2] - box[0] + 1) >= 19


TEAM_ROUNDS_2019 = ["1回戦", "2回戦", "準々決勝", "準決勝"]


def read_team_page_2019(dark, red):
    """25校のブラケット（左1-13／右14-25、不戦勝あり）。敗者の本数しか印字されない。"""
    segs = [s for s in hsegs(dark, red, minlen=80, xlo=650, xhi=1800, ylo=400, yhi=3150)
            if s["x1"] - s["x0"] > 80]
    cx = (min(s["x0"] for s in segs) + max(s["x1"] for s in segs)) / 2
    fin = [s for s in segs if s["x0"] < cx < s["x1"]]
    assert len(fin) == 1, f"決勝の線分が {len(fin)} 本"
    fin = fin[0]
    L = [s for s in segs if s["x1"] <= cx]
    R = [s for s in segs if s["x0"] >= cx]
    assert len(L) + len(R) + 1 == len(segs), "線分を左右に分けられない"
    ms, tops = [], {}
    for hs, ss, base in (("L", L + [fin], 1), ("R", R + [fin], 14)):
        key = (lambda s: s["x0"]) if hs == "L" else (lambda s: -s["x1"])
        bx = min(key(s) for s in ss)
        cols = collections.defaultdict(list)
        for s in ss:
            cols[int(round((key(s) - bx) / 105))].append(s)
        for c in cols:
            cols[c].sort(key=lambda s: s["y"])
        rows = cols[0]
        # 不戦勝の行は1回戦の列を素通りするので、線分が2列分の長さになる
        bye = [s["x1"] - s["x0"] > 180 for s in rows]
        units, i = [], 0
        while i < len(rows):
            if bye[i]:
                units.append({"seg": rows[i], "no": base + i})
                i += 1
            else:
                assert i + 1 < len(rows) and not bye[i + 1], f"{hs}: 1回戦の組が作れない"
                units.append({"a": {"seg": rows[i], "no": base + i},
                              "b": {"seg": rows[i + 1], "no": base + i + 1}})
                i += 2
        cur, k = [], 0
        for u in units:
            if "a" not in u:
                cur.append(u)
            else:
                cur.append({"seg": cols[1][k], "a": u["a"], "b": u["b"]}); k += 1
        assert k == len(cols[1]), f"{hs}: 1回戦の本数が合わない ({k}/{len(cols[1])})"
        lv, li = [cur], 1
        while len(lv[-1]) > 1:
            prev, outs = lv[-1], cols[li + 1]
            assert len(prev) // 2 == len(outs), f"{hs} lvl{li}: 出力ラインの本数が合わない"
            lv.append([{"seg": outs[j // 2], "a": prev[j], "b": prev[j + 1]}
                       for j in range(0, len(prev), 2)])
            li += 1

        def walk(u, level):
            if "a" not in u:
                return u["no"]
            na, nb = walk(u["a"], level - 1), walk(u["b"], level - 1)
            o = u["seg"]
            xj = o["x0"] + 4 if hs == "L" else o["x1"] - 4
            ra = leg_red(dark, red, xj, u["a"]["seg"]["y"], o["y"])
            rb = leg_red(dark, red, xj, u["b"]["seg"]["y"], o["y"])
            assert (ra > 0.5) != (rb > 0.5), \
                f"{hs} lvl{level}: 合流の色が判別できない {ra:.2f}/{rb:.2f}"
            up = ra > rb
            wn, ln = (na, nb) if up else (nb, na)
            lseg = u["b"]["seg"] if up else u["a"]["seg"]
            gs = "R" if hs == "L" else "L"
            g = glyph_at(red, xj, lseg["y"], "dn" if up else "up", gs, xw=(5, 100), yw=(6, 80))
            assert g, f"{hs} lvl{level}: 敗者の本数が見つからない"
            ms.append({"round": TEAM_ROUNDS_2019[level], "winner": wn, "loser": ln, "loseGlyph": g})
            return wn

        tops[hs] = walk(lv[-1][0], len(lv) - 1)
    lr, rr = side_red(dark, red, fin, 0.3, "L"), side_red(dark, red, fin, 0.3, "R")
    assert (lr > 0.5) != (rr > 0.5), f"決勝の色が判別できない {lr:.2f}/{rr:.2f}"
    wh = "L" if lr > rr else "R"
    lo = "R" if wh == "L" else "L"
    g = glyph_at(red, fin["x1"] if lo == "R" else fin["x0"], fin["y"], "mid",
                 "R" if lo == "R" else "L", xw=(5, 60), yw=(0, 45))
    assert g, "決勝の敗者の本数が見つからない"
    ms.append({"round": "決勝", "winner": tops[wh], "loser": tops[lo], "loseGlyph": g})
    return ms


def team_win_score(round_name, loser_score):
    """2019団体戦の勝者の本数。**PDFに印字が無いので推定**（Assumption）。

    敗者1本なら勝者は必ず2本。敗者0本のときだけ 2-0 と 3-0 が区別できない。
    全中の既存データ（本レポジトリ）では

      1回戦・2回戦   … (3,0) か (2,1) のみ ＝ 3試合すべて消化
      準々決勝以降   … (2,0) か (2,1) のみ ＝ 2勝先取

    が2018年度は48試合すべて、2021-2026年度は288試合中282試合で成立する。
    この規則を当てている。誤りが判明したらここだけ直せばよい。
    """
    if loser_score == 1:
        return 2
    return 3 if round_name in ("1回戦", "2回戦") else 2


def glyph_key(page_no, box):
    return f"p{page_no}:{box[0]}:{box[1]}"


def apply_glyphs(raw, page_no, glyphs, win_score):
    out = []
    for m in raw:
        k = glyph_key(page_no, m["loseGlyph"])
        assert k in glyphs, f"グリフ辞書に {k} が無い（--dump-glyphs で作り直す）"
        out.append({"round": m["round"], "entries": sorted([m["winner"], m["loser"]]),
                    "winner": m["winner"], "winnerScore": win_score,
                    "loserScore": glyphs[k], "retired": False})
    return out


# -------------------------------------------------------------------- 出力
def load_entries(d, kind):
    with open(os.path.join(d, f"{kind}.initialPlayers.json"), encoding="utf-8") as f:
        return json.load(f)


def emit(entries, matches, out_dir, kind, win_default=None):
    data = build(entries, matches, winner_score_default=win_default)
    problems = check(data)
    assert not problems, "\n".join(problems)
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{kind}.json")
    write(data, path)
    champ = [m for m in data["matches"] if m["round"] == "決勝"][0]["winnerEntryNo"]
    print(f"{path}: {len(data['matches'])}試合 / 優勝 entryNo={champ}")
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--year", type=int, required=True, choices=[2018, 2019])
    ap.add_argument("--entries", required=True, help="tools/secondaryschool-championship/<年>")
    ap.add_argument("--out", required=True)
    ap.add_argument("--kind", choices=KINDS, action="append",
                    help="省略時は4種目すべて")
    ap.add_argument("--no-verify", action="store_true", help="2018個人戦のブラケット照合を省く")
    ap.add_argument("--dump-glyphs", help="2019: 敗者スコア字を切り出して保存するディレクトリ")
    args = ap.parse_args()
    kinds = args.kind or KINDS

    if args.year == 2018:
        import pdfplumber
        with pdfplumber.open(args.pdf) as pdf:
            assert len(pdf.pages) == 8, f"2018は8ページのはず（{len(pdf.pages)}ページ）"
            for kind in kinds:
                girls = kind.endswith("girls")
                if kind.startswith("doubles"):
                    ms = read_result_list(pdf.pages[5 if girls else 4])
                    assert len(ms) == 63, f"{kind}: {len(ms)}試合（期待63）"
                    ip = load_entries(args.entries, kind)
                    for m in ms:
                        for no, (nm, inf) in m["names"].items():
                            e = [x for x in ip if x["id"] == no][0]
                            exp = "".join(p["lastName"] + p["firstName"] for p in e["information"])
                            got = nm.replace("・", "")
                            pref, team = inf.split("・")
                            assert e["information"][0]["team"] == team, \
                                f"{kind} No.{no}: 所属が {team} / {e['information'][0]['team']}"
                            assert e["information"][0]["prefecture"].rstrip("県府都道") == \
                                pref.rstrip("県府都道"), f"{kind} No.{no}: 都道府県が食い違う"
                            # 一部の字がフォントに無く私用領域(U+E003)で入るので、そこは飛ばす
                            if "" not in got:
                                assert got == exp, f"{kind} No.{no}: 氏名 {got} / {exp}"
                        del m["names"]
                    if not args.no_verify:
                        bad = verify_bracket_2018(pdf, ms, (2, 3) if girls else (0, 1))
                        assert bad == 0, f"{kind}: ブラケット表と結果一覧が {bad} 件食い違う"
                        print(f"{kind}: ブラケット表(p1-4)と結果一覧(p5/6)が全一致")
                else:
                    ms = read_team_page_2018(pdf.pages[7 if girls else 6])
                    assert len(ms) == 24, f"{kind}: {len(ms)}試合（期待24）"
                    ip = load_entries(args.entries, kind)
                emit(ip, ms, args.out, kind)
        return

    _lazy_2019()
    pages = render_2019(args.pdf)
    assert len(pages) == 6, f"2019は6ページのはず（{len(pages)}ページ）"
    glyphs = {}
    if os.path.exists(GLYPHS_2019):
        with open(GLYPHS_2019, encoding="utf-8") as f:
            glyphs = json.load(f)
    dumps = []
    for kind in kinds:
        girls = kind.endswith("girls")
        ip = load_entries(args.entries, kind)
        if kind.startswith("doubles"):
            pg = (3, 4) if girls else (1, 2)
            raw, tops, finals = [], {}, {}
            for i, p in enumerate(pg):
                dark, red = pages[p - 1]
                r, top = read_doubles_page_2019(dark, red, 1 + 32 * i)
                dumps += [(p, m["loseGlyph"]) for m in r]
                raw += apply_glyphs(r, p, glyphs, 4) if glyphs else []
                tops[p] = top
                box, circled = read_final_2019(dark, red)
                finals[p] = (box, circled)
                if not circled:
                    dumps.append((p, box))
            assert sum(1 for p in pg if finals[p][1]) == 1, "決勝の勝者ページが一意でない"
            wp = [p for p in pg if finals[p][1]][0]
            lp = [p for p in pg if p != wp][0]
            if glyphs:
                k = glyph_key(lp, finals[lp][0])
                assert k in glyphs, f"グリフ辞書に {k} が無い"
                raw.append({"round": "決勝", "entries": sorted([tops[wp], tops[lp]]),
                            "winner": tops[wp], "winnerScore": 4,
                            "loserScore": glyphs[k], "retired": False})
                assert len(raw) == 63, f"{kind}: {len(raw)}試合（期待63）"
        else:
            p = 6 if girls else 5
            dark, red = pages[p - 1]
            r = read_team_page_2019(dark, red)
            dumps += [(p, m["loseGlyph"]) for m in r]
            raw = apply_glyphs(r, p, glyphs, 0) if glyphs else []
            for m in raw:
                m["winnerScore"] = team_win_score(m["round"], m["loserScore"])
            if glyphs:
                assert len(raw) == 24, f"{kind}: {len(raw)}試合（期待24）"
        if glyphs:
            emit(ip, raw, args.out, kind)
    if args.dump_glyphs:
        os.makedirs(args.dump_glyphs, exist_ok=True)
        for p, box in dumps:
            x0, y0, x1, y1 = box
            im = Image.fromarray((pages[p - 1][1][y0:y1 + 1, x0:x1 + 1].astype("uint8")) * 255)
            im.save(os.path.join(args.dump_glyphs, f"p{p}_{x0}_{y0}.png"))
        print(f"{len(dumps)} 字を {args.dump_glyphs} に出力した")


if __name__ == "__main__":
    main()
