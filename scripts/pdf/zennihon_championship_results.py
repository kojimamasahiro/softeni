#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
天皇賜杯・皇后賜杯 全日本ソフトテニス選手権（`zennihon-championship`）の結果PDFから
**勝敗とスコア**を抽出し、`tools/zennihon-championship-<year>/` にステージング済みの
`*.initialPlayers.json` と合わせて `data/tournaments/details` 形式のJSONを組み立てる。

エントリー抽出は `scripts/pdf/zennihon_championship_entries.py` の担当。本スクリプトは
その続きで、`matches` / `results` を作る。

読み取りの原理（2019年度＝第74回のレイアウトで検証）:
  - ドローページは**勝者に丸数字（⑤）、敗者に裸の数字**を印字する。
    インターハイのように「敗者のスコアだけ」ではないので、勝者スコアを規定値で
    補完する必要が無い（丸数字がそのまま勝者のゲーム数）。
  - スコアは競技者のブラケット線の高さ±7pt程度に、そのラウンドの列へ置かれる。
    上側の競技者は線の上、下側は線の下に置かれるが、**2つのスコアのy順序は
    競技者のy順序と一致する**ので、ラウンドごとにy昇順で2つずつ組めば対戦が決まる。
  - どのスコアが何回戦かは列のx座標…**では決められない**（ページ最終戦のスコアが
    1つ手前の列に置かれることがある）。代わりに枠数から各ラウンドのスコア個数を
    算出し、x順に切り分ける。ページ最終戦のぶん1個だけ余るので、
    「その1個を除いたときに全ラウンドが破綻なく組める」候補を総当たりで探し、
    左右で同じyのものが一意に決まることを使って確定する
    （ページ最終戦は左半分の勝者と右半分の勝者が同じ高さで突き合わされるため）。
  - `R` は棄権。敗者側にだけ現れ、勝者側は通常どおり丸数字が入る。
    出力では `retired: true` ＋ 敗者スコア0 とする（既存データの慣例）。
  - `matches` を組み立てたあとの details 形式への変換と自己検査は
    `scripts/pdf/tournament_results_common.py` が担当する（大会に依存しない部分）。
  - 準々決勝以降は別ページのスコア表。1ブロック＝1行で
    `No <n> <左スコア> …ゲームスコア… <右スコア> No <m>` の形をしており、
    その行の最も左と最も右のスコア字が両者の本数。
    **ドローページ側にも準々決勝の結果が入っている**ので、両者を突き合わせて検算できる。

使い方:
  python3 scripts/pdf/zennihon_championship_results.py <pdf> --year 2019 \
      --gender boys --draw-pages 1-4 --final-page 5 \
      --tools tools/zennihon-championship-2019 \
      --out data/tournaments/details/zennihon-championship

依存: pdfplumber
"""
from __future__ import annotations

import argparse
import collections
import itertools
import json
import logging
import os
import re
import sys

import pdfplumber

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tournament_results_common import build, check, write  # noqa: E402

logging.getLogger("pdfminer").setLevel(logging.ERROR)

CIRC = "①②③④⑤⑥⑦⑧⑨"
SCORE = re.compile(r"[0-9①-⑨]|\d?[RＲ]")  # 「4R」= 4ゲーム時点で棄権
ROUND_NAMES = {1: "1回戦", 2: "2回戦", 3: "3回戦", 4: "4回戦", 5: "5回戦", 6: "準々決勝"}
LATE = ("準々決勝", "準決勝", "決勝")


class Bad(Exception):
    """このスコアの切り分け方では組めない、の意。総当たりの枝刈りに使う。"""


def _ret(text):
    return text[-1] in "RＲ"


def _val(text):
    if _ret(text):
        return int(text[:-1]) if text[:-1] else None
    return CIRC.index(text) + 1 if text in CIRC else int(text)


# ---------------------------------------------------------------- draw page

def band_of(page):
    """ブラケット帯 = 左ブロックの閉じ括弧の右端 〜 その左右対称位置。"""
    xs = [w["x1"] for w in page.extract_words() if w["text"] == ")" and w["x1"] < page.width / 2]
    assert xs, "左ブロックに閉じ括弧が見つからない"
    rp = max(xs)
    return (rp + 3, page.width - rp - 3)


def rows_and_scores(page, band, drop_last_row=False):
    left, right, scores = [], [], []
    for w in page.extract_words():
        cy = (w["top"] + w["bottom"]) / 2
        t = w["text"]
        # エントリー番号は左右いちばん外側の桁列。所属名に数字が入る例
        # （`ｔｅａｍ 87 ｔａｂａ`）があるので、帯の外側というだけでは足りない。
        if re.fullmatch(r"\d+", t) and w["x0"] < 62:
            left.append((cy, int(t)))
        elif re.fullmatch(r"\d+", t) and w["x1"] > page.width - 55:
            right.append((cy, int(t)))
        elif band[0] < w["x0"] and w["x1"] < band[1] and SCORE.fullmatch(t):
            scores.append({"cx": (w["x0"] + w["x1"]) / 2, "cy": cy, "val": _val(t),
                           "win": t in CIRC, "ret": _ret(t)})
    left, right = sorted(left), sorted(right)
    # 年度によってはページ勝者のその後（準決勝など）の本数がドローの下端に印字される。
    # エントリー行の範囲から外れたスコアは本ページの試合ではないので落とす。
    if left or right:
        lo = min(r[0] for r in left + right) - 15
        hi = max(r[0] for r in left + right) + 15
        scores = [d for d in scores if lo < d["cy"] < hi]
    if drop_last_row:
        # 年度によってはドローの下に「そのページの勝者」の小箱と、続けて準々決勝の別ボックスが
        # 置かれる。小箱の番号（帯の中央にある複数桁の数字）より下はドロー本体ではないので切る。
        top = min(r[0] for r in left + right)
        mid = page.width / 2
        boxes = [(w["top"] + w["bottom"]) / 2 for w in page.extract_words()
                 if abs((w["x0"] + w["x1"]) / 2 - mid) < 12
                 and re.fullmatch(r"\d+", w["text"])
                 and (w["top"] + w["bottom"]) / 2 > top + 100]
        assert boxes, "ページ勝者の小箱が見つからない"
        cut = min(boxes) - 8
        left = [r for r in left if r[0] < cut]
        right = [r for r in right if r[0] < cut]
        scores = [d for d in scores if d["cy"] < cut]
    return left, right, scores


def _slots(n):
    s = 1
    while s * 2 <= n:
        s *= 2
    return s


def _counts(n):
    s = _slots(n)
    out = [2 * (n - s)] if n > s else []
    k = s
    while k >= 2:
        out.append(k)
        k //= 2
    return out


class _Comp:
    __slots__ = ("lo", "hi", "entry")

    def __init__(self, lo, hi, entry):
        self.lo, self.hi, self.entry = lo, hi, entry


def _simulate(side, rows, scores, last_round, pad):
    counts = _counts(len(rows))
    if len(scores) != sum(counts):
        raise Bad("count")
    order = sorted(scores, key=lambda d: d["cx"], reverse=(side == "R"))
    active = [_Comp(y, y, n) for y, n in rows]
    out, i, last_cys = [], 0, []
    for j, c in enumerate(counts):
        rnd = last_round - (len(counts) - 1 - j)
        group = sorted(order[i:i + c], key=lambda d: d["cy"])
        i += c
        for k in range(0, len(group), 2):
            a, b = group[k], group[k + 1]
            ca = [x for x in active if x.lo - pad <= a["cy"] <= x.hi + pad]
            cb = [x for x in active if x.lo - pad <= b["cy"] <= x.hi + pad]
            if len(ca) != 1 or len(cb) != 1 or ca[0] is cb[0]:
                raise Bad("owner")
            ca, cb = ca[0], cb[0]
            if a["win"] == b["win"]:
                raise Bad("winners")
            out.append(_match(rnd, a, b, ca, cb))
            if j == len(counts) - 1:
                last_cys += [a["cy"], b["cy"]]
            win = ca if a["win"] else cb
            merged = _Comp(min(ca.lo, cb.lo), max(ca.hi, cb.hi), win.entry)
            active = [x for x in active if x is not ca and x is not cb] + [merged]
            active.sort(key=lambda x: x.lo)
    if len(active) != 1:
        raise Bad("leftover")
    return out, active[0], last_cys


def _match(rnd, a, b, ca, cb):
    wd, ld = (a, b) if a["win"] else (b, a)
    cw, cl = (ca, cb) if a["win"] else (cb, ca)
    return {"round": rnd, "entries": sorted([ca.entry, cb.entry]), "winner": cw.entry,
            "winnerScore": wd["val"], "loserScore": ld["val"],
            "retired": bool(ld["ret"] or wd["ret"])}


def parse_draw_page(page, last_round=6, pad=20, drop_last_row=False):
    band = band_of(page)
    left, right, scores = rows_and_scores(page, band, drop_last_row)
    mid = (band[0] + band[1]) / 2

    def solve(side, rows, sc):
        res = []
        for i in range(len(sc)):
            rest = [x for j, x in enumerate(sc) if j != i]
            try:
                out, win, last_cys = _simulate(side, rows, rest, last_round - 1, pad)
            except Bad:
                continue
            # ページ最終戦のスコアは、その半分の最後の試合の2つのスコアの「間」の高さに置かれる
            # （勝者の合流後のラインがその2本の間に来るため）。ここで候補を絞る。
            if last_cys and not (min(last_cys) < sc[i]["cy"] < max(last_cys)):
                continue
            res.append((sc[i], out, win))
        return res

    cl = solve("L", left, [d for d in scores if d["cx"] < mid])
    cr = solve("R", right, [d for d in scores if d["cx"] >= mid])
    pairs = [(a, b) for a in cl for b in cr if abs(a[0]["cy"] - b[0]["cy"]) < 1.5]
    assert len(pairs) == 1, f"ページ最終戦のスコアを一意に決められない (候補 {len(pairs)})"
    (nl, ml, al), (nr, mr, ar) = pairs[0]
    fin = _match(last_round, nl, nr, al, ar)
    return ml + mr + [fin], left, right


# ------------------------------------------------- draw page (loser score only)

def _own_lines(page, rows, band, side):
    """各エントリーの「自分のライン」が最初に合流する列のxを返す。

    2017年度の様式は勝者のスコアを印字しないので、1回戦の組を数字だけでは決められない
    （敗者の行は分かるが相手が上か下かが決まらない）。ラインは自分が負ける合流まで点線、
    勝ち上がる区間は太い実線で引かれており、**どちらであれ最初の合流点で終わる**ので、
    帯の左端（右ブロックは右端）から始まる線分の反対側の端を見れば合流列が確定する。"""
    # 点線のダッシュはほぼ正方形（0.9x0.96 等）で、幅と高さの大小では横/縦を判定できない。
    # 「y方向に薄い」ものを横線の候補として拾い、x方向の連結だけで自分のラインを辿る。
    segs = [{"y": (r["top"] + r["bottom"]) / 2, "x0": r["x0"], "x1": r["x1"]}
            for r in page.rects if r["bottom"] - r["top"] <= 2.5]
    out = {}
    for y, no in rows:
        row = [s for s in segs if abs(s["y"] - y) < 6
               and band[0] - 6 < s["x0"] and s["x1"] < band[1] + 6]
        if not row:
            continue
        if side == "L":
            row.sort(key=lambda s: s["x0"])
            if row[0]["x0"] > band[0] + 4:
                continue
            cur = row[0]["x0"]
            for _ in range(len(row) + 1):
                nxt = max((s["x1"] for s in row if s["x0"] <= cur + 2.5 and s["x1"] > cur),
                          default=None)
                if nxt is None:
                    break
                cur = nxt
        else:
            row.sort(key=lambda s: -s["x1"])
            if row[0]["x1"] < band[1] - 4:
                continue
            cur = row[0]["x1"]
            for _ in range(len(row) + 1):
                nxt = min((s["x0"] for s in row if s["x1"] >= cur - 2.5 and s["x0"] < cur),
                          default=None)
                if nxt is None:
                    break
                cur = nxt
        out[no] = cur
    return out


def _frames(rows, ends, side):
    """最初の合流が1回戦の列にある行を、隣どうしで組にする。"""
    if not ends:
        return None
    vals = sorted(ends.values(), reverse=(side == "R"))
    group = [vals[0]]
    for v in vals[1:]:
        if abs(v - group[-1]) <= 5:
            group.append(v)
        else:
            break
    lo, hi = min(group), max(group)
    plays = [no for _, no in rows if no in ends and lo - 1 <= ends[no] <= hi + 1]
    order = [no for _, no in rows]
    frames, i, ps = [], 0, set(plays)
    while i < len(order):
        a = order[i]
        b = order[i + 1] if i + 1 < len(order) else None
        if a in ps and b in ps:
            frames.append((a, b))
            i += 2
        else:
            frames.append((a, None))
            i += 1
    return frames


def _simulate_loser_only(side, rows, frames, scores, last_round, pad):
    counts = [sum(1 for f in frames if f[1] is not None)]
    k = len(frames)
    while k >= 2:
        counts.append(k // 2)
        k //= 2
    if counts[0] == 0:
        counts = counts[1:]
    if len(scores) != sum(counts):
        raise Bad("count")
    ypos = {no: y for y, no in rows}
    order = sorted(scores, key=lambda d: d["cx"], reverse=(side == "R"))
    out, i, last_cys = [], 0, []
    # 1回戦
    active = []
    r1 = order[:counts[0]] if frames and any(f[1] for f in frames) else []
    i = len(r1)
    for f in frames:
        if f[1] is None:
            active.append(_Comp(ypos[f[0]], ypos[f[0]], f[0]))
            continue
        ya, yb = ypos[f[0]], ypos[f[1]]
        hit = [d for d in r1 if abs(d["cy"] - ya) <= pad or abs(d["cy"] - yb) <= pad]
        if len(hit) != 1:
            raise Bad("r1 digit")
        d = hit[0]
        loser = f[0] if abs(d["cy"] - ya) <= pad else f[1]
        winner = f[1] if loser == f[0] else f[0]
        out.append({"round": last_round - (len(counts) - 1), "entries": sorted([f[0], f[1]]),
                    "winner": winner, "winnerScore": None, "loserScore": d["val"],
                    "retired": d["ret"]})
        active.append(_Comp(min(ya, yb), max(ya, yb), winner))
    active.sort(key=lambda c: c.lo)
    # 2回戦以降
    for j, c in enumerate(counts[1:], start=1):
        rnd = last_round - (len(counts) - 1 - j)
        group = order[i:i + c]
        i += c
        if len(active) != c * 2:
            raise Bad("pairing")
        nxt = []
        for k2 in range(0, len(active), 2):
            A, B = active[k2], active[k2 + 1]
            hit = [d for d in group
                   if A.lo - pad <= d["cy"] <= A.hi + pad or B.lo - pad <= d["cy"] <= B.hi + pad]
            if len(hit) != 1:
                raise Bad("digit")
            d = hit[0]
            loser = A if A.lo - pad <= d["cy"] <= A.hi + pad else B
            winner = B if loser is A else A
            out.append({"round": rnd, "entries": sorted([A.entry, B.entry]),
                        "winner": winner.entry, "winnerScore": None,
                        "loserScore": d["val"], "retired": d["ret"]})
            if j == len(counts) - 1:
                last_cys += [A.lo, A.hi, B.lo, B.hi]
            nxt.append(_Comp(min(A.lo, B.lo), max(A.hi, B.hi), winner.entry))
        active = nxt
    if len(active) != 1:
        raise Bad("leftover")
    return out, active[0], last_cys


def parse_draw_page_loser_only(page, last_round=6, pad=20, drop_last_row=False,
                               winner_score=5):
    band = band_of(page)
    left, right, scores = rows_and_scores(page, band, drop_last_row)
    mid = (band[0] + band[1]) / 2
    # ページ勝者の準決勝・決勝の本数が、ドローの下（最終行より下）の抜け線の脇に印字される。
    # 本ページの試合ではないので落とす。
    tail = []
    if left or right:
        ybot = max(r[0] for r in left + right)
        tail = [d for d in scores if ybot + 2 < d["cy"] <= ybot + 12]
        scores = [d for d in scores if d["cy"] <= ybot + 2]
    # ページ最終戦は左半分の勝者の線がページ中央まで来て突き合わさる。その線のyを取っておき、
    # 「余った1つ」の候補をその高さの近くに絞る（内側の列に複数の候補が残るため）。
    junctions = [(r["top"] + r["bottom"]) / 2 for r in page.rects
                 if r["bottom"] - r["top"] >= 1.5 and r["x1"] - r["x0"] > 4
                 and (abs(r["x1"] - mid) < 4 or abs(r["x0"] - mid) < 4)]
    sides = {}
    for side, rows in (("L", left), ("R", right)):
        ends = _own_lines(page, rows, band, side)
        frames = _frames(rows, ends, side)
        assert frames, f"{side}側の1回戦の組を決められない"
        size = len(frames) * 2
        assert size and (size & (size - 1)) == 0, f"{side}側の枠数 {size} が2の冪でない"
        sc = [d for d in scores if (d["cx"] < mid) == (side == "L")]
        sides[side] = (rows, frames, sc)

    # 敗者のスコアしか印字されないので、ページ最終戦のスコアは負けた側に1つだけ余る。
    # そのスコアは左右の勝者が突き合わさる高さ（junction）の中央寄りに置かれるので、
    # 先にそれを特定し、負けた側を決める。
    if left or right:
        ylo = min(r[0] for r in left + right)
        yhi = max(r[0] for r in left + right)
        junctions = [y for y in junctions if ylo < y < yhi]  # 下端の「勝者の抜け線」は除く
    finals = [d for d in scores
              if abs(d["cx"] - mid) < 20 and any(abs(d["cy"] - y) < 15 for y in junctions)]
    assert len(finals) == 1, f"ページ最終戦のスコアを一意に決められない ({len(finals)})"
    fin = finals[0]
    lose_side = "L" if fin["cx"] < mid else "R"

    results = {}
    for side, (rows, frames, sc) in sides.items():
        counts = [sum(1 for f in frames if f[1] is not None)]
        k = len(frames)
        while k >= 2:
            counts.append(k // 2)
            k //= 2
        if counts[0] == 0:
            counts = counts[1:]
        if side == lose_side:
            sc = [d for d in sc if d is not fin]
        extra = len(sc) - sum(counts)
        if extra < 0:
            # 最終行の試合のスコアが、その行より下へずれて印字されることがある
            # （2016年度 男子p3・女子p8 は4.1pt下）。ページ勝者の「その後」の本数も同じく
            # 最終行の下に出るため（同ページで7.7pt下）、**下にあるという条件だけでは
            # 区別できない**。足りないぶんだけ、最終行に近いものから順に戻す。
            # 総当たりに委ねると「その後」の本数を試合のスコアとして消費する解が選ばれ、
            # 敗者5本という有り得ない試合ができた（2016年度 男子p3で実際に発生）。
            near = sorted((d for d in tail if (d["cx"] < mid) == (side == "L")),
                          key=lambda d: d["cy"])
            sc = sc + near[:sum(counts) - len(sc)]
            extra = len(sc) - sum(counts)
        assert extra >= 0, f"{side}側のスコアが足りない ({len(sc)} < {sum(counts)})"
        sols = []
        for combo in itertools.combinations(range(len(sc)), extra):
            rest = [x for j, x in enumerate(sc) if j not in combo]
            try:
                out, win, _ = _simulate_loser_only(side, rows, frames, rest, last_round - 1, pad)
            except Bad:
                continue
            sols.append((out, win))
        winners = {w.entry for _, w in sols}
        assert len(winners) == 1, f"{side}側の勝ち上がりを一意に決められない ({sorted(winners)})"
        results[side] = (sols[0][0], sols[0][1], None)
    extra_side = (lose_side, fin)
    assert extra_side, "ページ最終戦のスコアが見つからない"
    side, d = extra_side
    winner = results["R" if side == "L" else "L"][1]
    loser = results[side][1]
    ms = results["L"][0] + results["R"][0]
    ms.append({"round": last_round, "entries": sorted([winner.entry, loser.entry]),
               "winner": winner.entry, "winnerScore": None,
               "loserScore": d["val"], "retired": d["ret"]})
    for m in ms:
        if m["winnerScore"] is None:
            m["winnerScore"] = winner_score
    return ms, left, right


# ---------------------------------------------------------------- final page

def parse_final_page(page):
    """準々決勝〜決勝のスコア表ページ。

    1ブロック=1行で、その行の左端と右端のエントリー番号、左端と右端のスコア字が両者の本数。
    エントリー番号の書き方は年度で違い、`No 1` 形式（2019年度）と、
    番号だけを左右の余白に置く形式（2018年度）がある。両方に対応する。"""
    ws = page.extract_words()
    W = page.width

    lines = collections.defaultdict(list)
    for w in ws:
        lines[round((w["top"] + w["bottom"]) / 2)].append((w["x0"], w["text"]))
    heads = []
    def _norm(t):
        # 見出しの書き方は年度で違う。2017-2019年度は `【準々決勝】`、
        # 2016年度は `男子準々決勝` と性別が前置きされる。
        t = t.replace(" ", "").replace("\u3000", "").replace("【", "").replace("】", "")
        return t.removeprefix("男子").removeprefix("女子")
    for cy, items in lines.items():
        if _norm("".join(t for _, t in sorted(items))) in LATE:
            heads.append((cy, _norm("".join(t for _, t in sorted(items)))))
    for w in ws:
        if _norm(w["text"]) in LATE:
            heads.append((round((w["top"] + w["bottom"]) / 2), _norm(w["text"])))
    heads = sorted(set(heads))
    assert heads, "準々決勝/準決勝/決勝の見出しが見つからない"

    def _put(store, cy, item):
        for k in store:
            if abs(k - cy) <= 2.5:
                store[k].append(item)
                return
        store[round(cy, 1)].append(item)

    nos = collections.defaultdict(list)
    for w in ws:
        cy = (w["top"] + w["bottom"]) / 2
        m = re.fullmatch(r"No\s*(\d+)", w["text"])
        if m:
            _put(nos, cy, (w["x0"], int(m.group(1))))
            continue
        if w["text"] == "No":
            nxt = [x for x in ws if abs((x["top"] + x["bottom"]) / 2 - cy) < 2
                   and 0 < x["x0"] - w["x1"] < 14 and re.fullmatch(r"\d+", x["text"])]
            if nxt:
                _put(nos, cy, (w["x0"], int(nxt[0]["text"])))
    if not any(len(v) == 2 for v in nos.values()):
        nos = collections.defaultdict(list)
        for w in ws:
            if re.fullmatch(r"\d+", w["text"]) and (w["x0"] < 150 or w["x1"] > W - 90):
                _put(nos, (w["top"] + w["bottom"]) / 2, (w["x0"], int(w["text"])))

    out = []
    for cy, pair in sorted(nos.items()):
        if len(pair) != 2:
            continue
        pair.sort()
        (lx, ln), (rx, rn) = pair
        row = sorted([w for w in ws if abs((w["top"] + w["bottom"]) / 2 - cy) < 2.5
                      and lx + 28 < w["x0"] and w["x1"] < rx - 4 and SCORE.fullmatch(w["text"])],
                     key=lambda w: w["x0"])
        assert len(row) >= 2, f"スコアが2つ見つからない (y={cy})"
        a, b = row[0], row[-1]
        aw, bw = a["text"] in CIRC, b["text"] in CIRC
        assert aw != bw, f"勝者が一意でない (y={cy}: {a['text']} / {b['text']})"
        rnd = [n for y, n in heads if y <= cy + 2]
        out.append({"round": rnd[-1] if rnd else None, "entries": sorted([ln, rn]),
                    "winner": ln if aw else rn,
                    "winnerScore": _val(a["text"] if aw else b["text"]),
                    "loserScore": _val(b["text"] if aw else a["text"]),
                    "retired": _ret(a["text"]) or _ret(b["text"])})
    return out


# ---------------------------------------------------------------- assembly

def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--gender", choices=["boys", "girls"], required=True)
    ap.add_argument("--draw-pages", required=True, help="例: 1-4")
    ap.add_argument("--final-page", type=int, required=True)
    ap.add_argument("--page-final-round", type=int, default=6,
                    help="ドローページの最終戦のラウンド番号（2019年度=6=準々決勝、2018年度=5=5回戦）")
    ap.add_argument("--drop-last-row", action="store_true",
                    help="ページ最下部の別ボックス（そのページの勝者＋準々決勝）を無視する")
    ap.add_argument("--pad", type=float, default=20.0)
    ap.add_argument("--loser-only", action="store_true",
                    help="敗者のスコアだけを印字する様式（2017年度）")
    ap.add_argument("--winner-score", type=int, default=5,
                    help="--loser-only のとき勝者に入れる本数")
    ap.add_argument("--tools", required=True)
    ap.add_argument("--out")
    a = ap.parse_args(argv)

    lo, hi = (a.draw_pages.split("-") + [a.draw_pages])[:2]
    pages = list(range(int(lo), int(hi) + 1))

    matches, n_entries, page_winners = [], 0, []
    with pdfplumber.open(a.pdf) as pdf:
        for pno in pages:
            if a.loser_only:
                ms, L, R = parse_draw_page_loser_only(
                    pdf.pages[pno - 1], a.page_final_round, a.pad, a.drop_last_row,
                    a.winner_score)
            else:
                ms, L, R = parse_draw_page(pdf.pages[pno - 1], a.page_final_round,
                                           a.pad, a.drop_last_row)
            for m in ms:
                m["round"] = ROUND_NAMES[m["round"]]
            print(f"  p{pno}: エントリー {len(L) + len(R)} / 試合 {len(ms)} / "
                  f"{ms[-1]['round']} {ms[-1]['entries']} → {ms[-1]['winner']}")
            matches += ms
            page_winners.append(ms[-1]["winner"])
            n_entries += len(L) + len(R)
        late = parse_final_page(pdf.pages[a.final_page - 1])

    qf_draw = {tuple(m["entries"]): (m["winner"], m["winnerScore"], m["loserScore"])
               for m in matches if m["round"] == "準々決勝"}
    qf_late = {tuple(m["entries"]): (m["winner"], m["winnerScore"], m["loserScore"])
               for m in late if m["round"] == "準々決勝"}
    if qf_draw:
        assert qf_draw == qf_late, (f"準々決勝がドローページとスコア表で食い違う\n"
                                    f"  draw={qf_draw}\n  late={qf_late}")
        print(f"  準々決勝 {len(qf_draw)} 件がドローページとスコア表で一致")
        matches += [m for m in late if m["round"] in ("準決勝", "決勝")]
    else:
        qf_players = sorted({e for m in late if m["round"] == "準々決勝" for e in m["entries"]})
        assert qf_players == sorted(page_winners), (
            f"ページ勝者と準々決勝の顔ぶれが食い違う\n"
            f"  pages={sorted(page_winners)}\n  qf={qf_players}")
        print(f"  ページ勝者 {len(page_winners)} 組が準々決勝の顔ぶれと一致")
        matches += late

    tools = os.path.join(a.tools, f"doubles-none-{a.gender}.initialPlayers.json")
    initial = json.load(open(tools, encoding="utf-8"))
    assert len(initial) == n_entries, f"エントリー数が合わない: PDF {n_entries} / tools {len(initial)}"
    data = build(initial, matches)
    problems = check(data)
    assert not problems, "組み上がったデータに矛盾がある:\n  " + "\n  ".join(problems)

    print(f"  エントリー {len(data['entries'])} / 試合 {len(data['matches'])}")
    for r, n in collections.Counter(m["round"] for m in data["matches"]).items():
        print(f"    {r}: {n}")
    ret = [m["matchId"] for m in data["matches"] if m["retired"]]
    if ret:
        print(f"    棄権(R): {len(ret)} 件 {ret}")

    if a.out:
        d = os.path.join(a.out, str(a.year))
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, f"doubles-none-{a.gender}.json")
        write(data, path)
        print(f"  → {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
