#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全国高等学校総合体育大会（インターハイ）の結果PDF（JSSTA/都道府県高体連の公式レイアウト）から、
**勝敗とスコア**（matches）を抽出する。

`highschool_championship_entries.py` はエントリー（参加者・ペア/チーム）だけを抽出し、
「予選ラウンドは勝者側に何も印字されないため勝敗を安全に確定できない」として matches を
生成しない方針だった。本スクリプトはその制約を、**テキストではなくPDFのベクター図形
（ブラケット線）を追跡する**ことで解消する。

読み取りの原理:
  - ドローの実線（勝ち上がり線）は塗りつぶし矩形（rects）として入っている。
    水平＝各競技者のライン、垂直＝2本のラインの合流（＝1試合）。
  - 垂直線は「出力ライン（勝者の新しいライン）が始まる高さ」で分割されて描かれるので、
    連続する垂直片をつなぐと {上の入力ライン, 下の入力ライン, 出力ライン} が確定する。
  - 各試合の**敗者のスコアだけ**が、敗者のラインの高さに、そのラウンドの列に印字される
    （左半分は合流点の右、右半分は合流点の左）。勝者のスコアは印字されない。
  - よって「数字が乗っている側＝敗者」。勝者のスコアは種目ごとの規定値を補完する
    （個人戦ダブルス=4本先取。団体戦は下記 TEAM_WINNER_SCORE を参照）。
  - ページ最終戦（左半分の勝者 vs 右半分の勝者）だけは両者のラインが同じ高さで中央に
    突き合わされるため、数字のy座標では敗者を決められない。中央より左に数字があれば
    左の勝者が、右にあれば右の勝者が敗れたと判定する（2014年男女で検証済み）。

対応ページ:
  - 個人戦ダブルス ドローページ（1ページ=約40エントリー、1〜6回戦）
  - 個人戦「ベスト８」ページ（準々決勝〜決勝）
  - 団体戦 概況ドローページ（48チーム、1回戦〜決勝。点線はダッシュの矩形群なので連結してから追跡）

団体戦の勝者スコアについて（Assumption）:
  PDFには敗者の勝ち数しか印字されない。2014年の男女96試合を既存データと突き合わせた結果、
  1・2回戦は3試合すべて消化（3-0 / 2-1）、3回戦以降は2勝先取（2-0 / 2-1）で矛盾がなかった。
  ここではその規定を仮定して勝者スコアを補完する。年度によって異なる可能性があるため、
  --team-all-three で「全消化」とみなすラウンド数を変更できる。

使い方:
  # 抽出して既存データと突き合わせる（書き込まない）
  python3 scripts/pdf/highschool_championship_results.py 2014_C05_40.pdf \
      --kind doubles --pages 1-8 --final-page 9 \
      --compare data/tournaments/details/highschool-championship/2014/doubles-none-boys.json

  python3 scripts/pdf/highschool_championship_results.py 2014_C05_40.pdf \
      --kind team --pages 10 \
      --compare data/tournaments/details/highschool-championship/2014/team-none-boys.json

`matches` を組み立てたあとの details 形式への変換と自己検査は
`scripts/pdf/tournament_results_common.py` が担当する（大会に依存しない部分）。

依存: pdfplumber
"""
from __future__ import annotations

import argparse
import collections
import json
import logging
import os
import re
import sys

import pdfplumber

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tournament_results_common import build, check, write  # noqa: E402

logging.getLogger("pdfminer").setLevel(logging.ERROR)

TOL = 3.0
DOUBLES_WINNER_SCORE = 4
TEAM_ALL_THREE_ROUNDS = 2  # 1・2回戦は3試合とも消化する前提

ROUND_NAMES_DOUBLES = ["1回戦", "2回戦", "3回戦", "4回戦", "5回戦", "6回戦"]
LATE_ROUNDS = ["準々決勝", "準決勝", "決勝"]
ROUND_NAMES_TEAM = ["1回戦", "2回戦", "3回戦", "準々決勝", "準決勝", "決勝"]


# ---------------------------------------------------------------- geometry

def _segments(page, dashed):
    """矩形を水平／垂直の線分に分ける。dashed=True なら点線のダッシュを連結する。"""
    H, V = [], []
    for r in page.rects:
        w = r["x1"] - r["x0"]
        h = r["bottom"] - r["top"]
        if w >= h:
            H.append({"y": (r["top"] + r["bottom"]) / 2, "x0": r["x0"], "x1": r["x1"]})
        else:
            V.append({"x": (r["x0"] + r["x1"]) / 2, "y0": r["top"], "y1": r["bottom"]})
    if not dashed:
        return H, V
    return _join(H, "y", "x0", "x1"), _join(V, "x", "y0", "y1")


def _join(items, key, lo, hi, tol=2.2, gap=3.5):
    vals = sorted({round(i[key], 1) for i in items})
    snap = {}
    for v in vals:
        k = next((k for k in snap.values() if abs(k - v) <= tol), None)
        snap[v] = k if k is not None else v
    buckets = collections.defaultdict(list)
    for i in items:
        buckets[snap[round(i[key], 1)]].append(i)
    out = []
    for k, group in buckets.items():
        group.sort(key=lambda i: i[lo])
        cur = dict(group[0])
        cur[key] = k
        for s in group[1:]:
            if s[lo] - cur[hi] <= gap:
                cur[hi] = max(cur[hi], s[hi])
            else:
                out.append(cur)
                cur = dict(s)
                cur[key] = k
        out.append(cur)
    return out


def _merges(H, V):
    """垂直片を連結して {入力2本, 出力1本} の合流点を取り出す。"""
    xs = sorted({v["x"] for v in V})
    snap = {}
    for v in xs:
        k = next((k for k in snap.values() if abs(k - v) <= TOL), None)
        snap[v] = k if k is not None else v
    buckets = collections.defaultdict(list)
    for v in V:
        buckets[snap[v["x"]]].append(v)

    def evaluate(x, chain):
        yt, yb = chain[0]["y0"], chain[-1]["y1"]
        touch = lambda h: h["x0"] <= x + 2.5 and h["x1"] >= x - 2.5
        ins = sorted({round(h["y"], 1) for h in H
                      if touch(h) and (abs(h["y"] - yt) <= TOL or abs(h["y"] - yb) <= TOL)})
        outs = [h for h in H if touch(h) and yt + TOL < h["y"] < yb - TOL]
        return {"x": x, "yt": yt, "yb": yb, "ins": ins, "outs": outs, "chain": chain}

    ok = lambda c: len(c["ins"]) == 2 and len(c["outs"]) == 1
    res = []
    for x, segs in sorted(buckets.items()):
        segs.sort(key=lambda s: s["y0"])
        chains = [[segs[0]]]
        for s in segs[1:]:
            if s["y0"] - chains[-1][-1]["y1"] <= 4.0:
                chains[-1].append(s)
            else:
                chains.append([s])
        cands = [evaluate(x, c) for c in chains]
        changed = True
        while changed and len(cands) > 1:
            changed = False
            for i in range(len(cands) - 1):
                a, b = cands[i], cands[i + 1]
                if ok(a) and ok(b):
                    continue
                if b["chain"][0]["y0"] - a["chain"][-1]["y1"] > 30:
                    continue
                m = evaluate(x, a["chain"] + b["chain"])
                if ok(m):
                    cands[i:i + 2] = [m]
                    changed = True
                    break
        res += cands
    return res


# ---------------------------------------------------------------- bracket page

def parse_bracket_page(page, dashed=False, entry_x=(30, 100, 500, 570), digit_x=None):
    """1ページ分のドローを解く。戻り値: [{'round':int,'entries':[a,b],'winner':n,'loserScore':s}]"""
    H, V = _segments(page, dashed)
    chains = _merges(H, V)

    lx0, lx1, rx0, rx1 = entry_x
    rows = {}
    for h in H:
        rows.setdefault(round(h["y"], 1), None)
    ys = sorted(rows)

    def entries(lo, hi):
        out = []
        for w in page.extract_words():
            if lo < w["x0"] < hi and w["top"] > 110 and re.fullmatch(r"\d+", w["text"]):
                y = (w["top"] + w["bottom"]) / 2
                ny = min(ys, key=lambda v: abs(v - y))
                if abs(ny - y) < 4:
                    out.append((ny, int(w["text"])))
        return sorted(out)

    L, R = entries(lx0, lx1), entries(rx0, rx1)
    assert L and R, "エントリー番号列が見つからない"

    merges = []
    for c in chains:
        if len(c["ins"]) != 2 or len(c["outs"]) != 1:
            continue
        o = c["outs"][0]
        side = "L" if abs(o["x0"] - c["x"]) < abs(o["x1"] - c["x"]) else "R"
        merges.append({"x": c["x"], "side": side, "ins": c["ins"], "out": round(o["y"], 1)})

    dx0, dx1 = digit_x or (min(m["x"] for m in merges) - 25, max(m["x"] for m in merges) + 25)
    ymin = min(y for y, _ in L + R) - 15
    ymax = max(y for y, _ in L + R) + 15
    digits = [{"y": (w["top"] + w["bottom"]) / 2, "x0": w["x0"], "x1": w["x1"], "v": int(w["text"])}
              for w in page.extract_words()
              if dx0 < w["x0"] < dx1 and re.fullmatch(r"\d", w["text"])
              and ymin < (w["top"] + w["bottom"]) / 2 < ymax]

    cur = {"L": {round(y, 1): n for y, n in L}, "R": {round(y, 1): n for y, n in R}}
    order = {"L": sorted({m["x"] for m in merges if m["side"] == "L"}),
             "R": sorted({m["x"] for m in merges if m["side"] == "R"}, reverse=True)}
    todo = sorted(merges, key=lambda m: (order[m["side"]].index(m["x"]), m["ins"][0]))

    used, out, rounds = set(), [], {"L": [], "R": []}
    for m in todo:
        side = m["side"]
        find = lambda y: next((k for k in cur[side] if abs(k - y) <= TOL), None)
        k1, k2 = find(m["ins"][0]), find(m["ins"][1])
        if k1 is None or k2 is None:
            continue  # 選手名を囲む枠など、試合ではない合流
        if m["x"] not in rounds[side]:
            rounds[side].append(m["x"])
        rnd = rounds[side].index(m["x"]) + 1
        e1, e2 = cur[side][k1], cur[side][k2]
        cands = []
        for i, d in enumerate(digits):
            if i in used:
                continue
            if side == "L" and not (m["x"] - 1.0 <= d["x0"] <= m["x"] + 10):
                continue
            if side == "R" and not (m["x"] - 10 <= d["x1"] <= m["x"] + 1.0):
                continue
            for y in m["ins"]:
                if abs(d["y"] - y) <= TOL:
                    cands.append((i, y))
                    break
        assert len(cands) == 1, f"スコアの数字を一意に決められない: round={rnd} x={m['x']:.1f} {e1}vs{e2}"
        di, ly = cands[0]
        used.add(di)
        loser = e1 if abs(ly - m["ins"][0]) <= TOL else e2
        winner = e2 if loser == e1 else e1
        out.append({"round": rnd, "entries": sorted([e1, e2]),
                    "winner": winner, "loserScore": digits[di]["v"]})
        del cur[side][k1], cur[side][k2]
        cur[side][m["out"]] = winner

    assert len(cur["L"]) == 1 and len(cur["R"]) == 1, f"勝ち残りが1組にならない: {cur}"
    yl, eL = next(iter(cur["L"].items()))
    eR = next(iter(cur["R"].values()))
    rest = [i for i in range(len(digits)) if i not in used]
    assert len(rest) == 1, f"最終戦のスコアが特定できない: {rest}"
    d = digits[rest[0]]
    cx = min((c["x"] for c in chains
              if any(abs(y - yl) <= TOL for y in c["ins"]) and c["x"] > max(rounds["L"])),
             default=page.width / 2)
    loser = eL if (d["x0"] + d["x1"]) / 2 < cx else eR
    out.append({"round": len(rounds["L"]) + 1, "entries": sorted([eL, eR]),
                "winner": eR if loser == eL else eL, "loserScore": d["v"]})
    return out


# ---------------------------------------------------------------- assembly

def doubles_matches(pdf, pages, final_page):
    out = []
    for i, pno in enumerate(pages):
        ms = parse_bracket_page(pdf.pages[pno - 1])
        for m in ms:
            m["roundName"] = ROUND_NAMES_DOUBLES[m["round"] - 1]
            m["winnerScore"] = DOUBLES_WINNER_SCORE
        out += ms
    ms = parse_bracket_page(pdf.pages[final_page - 1])
    for m in ms:
        m["roundName"] = LATE_ROUNDS[m["round"] - 1]
        m["winnerScore"] = DOUBLES_WINNER_SCORE
    return out + ms


def team_matches(pdf, page, all_three_rounds=TEAM_ALL_THREE_ROUNDS):
    ms = parse_bracket_page(pdf.pages[page - 1], dashed=True, entry_x=(30, 60, 525, 570))
    for m in ms:
        m["roundName"] = ROUND_NAMES_TEAM[m["round"] - 1]
        m["winnerScore"] = 3 if (m["round"] <= all_three_rounds and m["loserScore"] == 0) else 2
    return ms


def compare(matches, path):
    data = json.load(open(path))
    P = {tuple(m["entries"]): (m["roundName"], m["winner"], m["loserScore"], m["winnerScore"])
         for m in matches}
    G = {}
    for m in data["matches"]:
        w = m["winnerEntryNo"]
        scores = m["scores"]
        G[tuple(sorted(m["entries"]))] = (
            m["round"], w, min(scores.values()), scores[str(w)])
    only_g = sorted(set(G) - set(P))
    only_p = sorted(set(P) - set(G))
    diff = [(k, G[k], P[k]) for k in sorted(set(G) & set(P)) if G[k] != P[k]]
    print(f"PDF {len(P)} 件 / 既存 {len(G)} 件")
    if only_g:
        print(f"  既存のみ: {only_g}")
    if only_p:
        print(f"  PDFのみ : {only_p}")
    for k, g, p in diff:
        print(f"  差分 {k}: 既存={g} PDF={p}")
    if not (only_g or only_p or diff):
        print("  完全一致")
    return len(only_g) + len(only_p) + len(diff)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--kind", choices=["doubles", "team"], required=True)
    ap.add_argument("--pages", required=True, help="例: 1-8（doubles のドロー）/ 10（team）")
    ap.add_argument("--final-page", type=int, help="doubles のベスト８ページ")
    ap.add_argument("--team-all-three", type=int, default=TEAM_ALL_THREE_ROUNDS,
                    help="団体戦で3試合すべて消化するラウンド数（既定2＝1・2回戦）")
    ap.add_argument("--compare", help="既存 details JSON と突き合わせる（書き込まない）")
    ap.add_argument("--out", help="抽出した試合一覧を JSON で書き出す")
    ap.add_argument("--tools", help="initialPlayers のあるディレクトリ")
    ap.add_argument("--details-out", help="details 形式で書き出す先（大会ディレクトリ）")
    ap.add_argument("--year", type=int)
    ap.add_argument("--gender", choices=["boys", "girls"])
    a = ap.parse_args(argv)

    if "-" in a.pages:
        lo, hi = a.pages.split("-")
        pages = list(range(int(lo), int(hi) + 1))
    else:
        pages = [int(a.pages)]

    with pdfplumber.open(a.pdf) as pdf:
        if a.kind == "doubles":
            assert a.final_page, "--final-page が必要"
            ms = doubles_matches(pdf, pages, a.final_page)
        else:
            ms = team_matches(pdf, pages[0], a.team_all_three)

    print(f"{len(ms)} 試合を抽出")
    for r, n in sorted(collections.Counter(m["roundName"] for m in ms).items()):
        print(f"  {r}: {n}")
    if a.out:
        json.dump(ms, open(a.out, "w"), ensure_ascii=False, indent=1)
    if a.details_out:
        assert a.tools and a.year and a.gender, "--details-out には --tools/--year/--gender が必要"
        name = f"{a.kind}-none-{a.gender}"
        initial = json.load(open(os.path.join(a.tools, f"{name}.initialPlayers.json"),
                                 encoding="utf-8"))
        matches = [{"round": m["roundName"], "entries": m["entries"], "winner": m["winner"],
                    "winnerScore": m["winnerScore"], "loserScore": m["loserScore"],
                    "retired": False} for m in ms]
        assert len(initial) == len({e for m in matches for e in m["entries"]}), \
            "エントリー数が initialPlayers と合わない"
        data = build(initial, matches)
        problems = check(data)
        assert not problems, "組み上がったデータに矛盾がある:\n  " + "\n  ".join(problems)
        d = os.path.join(a.details_out, str(a.year))
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, f"{name}.json")
        write(data, path)
        print(f"  → {path}")
    if a.compare:
        return 1 if compare(ms, a.compare) else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
