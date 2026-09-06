#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""文部科学大臣杯 全日本大学対抗選手権（インカレ 対抗戦）のドローPDF → details JSON。

## この様式の見極め（2025年度 男子 p1-2 で検証）

- **テキストレイヤーあり。ブラケットはベクター矩形（1pt幅）で描かれている。**
- **勝ち上がりの経路が赤 `(1,0,0)`、敗退後は黒。** ただし水平線の色は
  「1つでも勝った競技者の経路」を敗退まで塗るので**勝敗の判定には使えない**
  （1回戦だけ正しく出て2回戦以降が静かに壊れる）。**合流の縦線を見る**こと。
  縦線は出力ラインの高さで分割されて描かれ、**勝者側の脚だけが赤**。
- **スコアは敗者のぶんだけ**、敗者のラインの**合流と反対側**（敗者が上なら線の上、
  下なら線の下）に、その合流列のすぐ脇に印字される。勝者の本数は印字されない。
- **1ページ＝ドローの半分**（左ブロック＋右ブロック）。ページ最終戦は左右の勝者が
  **同じ高さ**で突き合わされるため縦線が1本（分割なし）になり、勝敗は
  合流点に入る水平線の色で決まる。ページ勝者の線はページ下端まで伸び、
  **次の試合（決勝）で喫した本数が下端に印字される**。

## 使い方

    python3 scripts/pdf/zennihon_university_results.py PDF --pages 1-2 \
        --players tools/incare-2025/team-none-boys.initialPlayers.json \
        --out data/tournaments/details/zennihon-university/2025/versus-none-boys.json \
        --winner-score 3

`--winner-score` は敗者スコアしか印字されない様式なので必須。**根拠を必ず確かめること**
（2025年度は敗者スコアに 2 が出るので3勝先取＝勝者は常に3。2026年度の既存データも
3-0 / 3-1 / 3-2 の3種類しか無い）。

PDFにスコアが印字されていない試合があれば `--loser-score 勝者No:敗者No=本数` で補う
（2025年度男子の4回戦 明治23-同志社12 が実際に未印字だった）。補った値は出典を
docs/raw に必ず書き残すこと。
"""
from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

import pdfplumber

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tournament_results_common import build, check, write  # noqa: E402

NAME_SIZE = (9.5, 12.5)   # 学校名。長い校名だけ 10pt に落とされる
SCORE_SIZE = 9.5          # これ未満はスコア（7pt / 8pt）
LINE_OFFSET = 5.5         # 学校名の top からブラケット線の y までの距離
DIGIT_DY = (-9.5, 2.5)    # 敗者ラインに対するスコアの top（上に置く / 下に置く）
DIGIT_MAX_DIST = 6.0      # 割り当てを認める最大距離（pt）


def _red(o):
    return bool(o.get("non_stroking_color"))


def _round_names(n_rounds):
    """総ラウンド数から既存データと同じ表記を作る（末尾3つは常に準々/準決/決勝）。"""
    assert n_rounds >= 4, n_rounds
    return [f"{i}回戦" for i in range(1, n_rounds - 2)] + ["準々決勝", "準決勝", "決勝"]


def parse_entries(page, center_x):
    """行ごとに「エントリー番号（ASCII数字）＋学校名（それ以外）」を左右に分けて拾う。

    番号は必ず左右いちばん外側の桁列なので、数字か否かで切ると座標の決め打ちが要らない。
    """
    rows = collections.defaultdict(list)
    for c in page.chars:
        if NAME_SIZE[0] <= c["size"] <= NAME_SIZE[1]:
            rows[round(c["top"])].append(c)
    out = []
    for top in sorted(rows):
        cs = sorted(rows[top], key=lambda c: c["x0"])
        digits, names = [c for c in cs if c["text"].isdigit()], [c for c in cs if not c["text"].isdigit()]
        runs = []
        for c in digits:
            if runs and c["x0"] - runs[-1][-1]["x1"] < 8:
                runs[-1].append(c)
            else:
                runs.append([c])
        for side in ("L", "R"):
            nm = [c for c in names if (c["x0"] < center_x) == (side == "L")]
            if not nm:
                continue
            cand = [r for r in runs if (r[0]["x0"] < center_x) == (side == "L")]
            assert len(cand) == 1, (top, side, [c["text"] for c in digits])
            out.append(dict(no=int("".join(c["text"] for c in cand[0])),
                            team="".join(c["text"] for c in nm).replace(" ", "").replace("　", ""),
                            y=top + LINE_OFFSET, side=side))
    return out


def _columns(verts):
    """縦線を列ごとにまとめ、接する断片を1本の合流線に連結する。"""
    cols = collections.defaultdict(list)
    for v in verts:
        cols[round(v["x0"])].append(v)
    out = {}
    for x, vs in cols.items():
        vs.sort(key=lambda v: v["top"])
        groups, cur = [], [vs[0]]
        for v in vs[1:]:
            if v["top"] - cur[-1]["bottom"] <= 1.5:
                cur.append(v)
            else:
                groups.append(cur)
                cur = [v]
        groups.append(cur)
        out[x + 0.5] = groups
    return out


def parse_page(page, pageno):
    verts = [r for r in page.rects if r["width"] < r["height"]]
    hors = [r for r in page.rects if r["width"] >= r["height"]]
    digits = [c for c in page.chars if c["size"] < SCORE_SIZE]
    cols = _columns(verts)

    center = [x for x, gs in cols.items() if len(gs) == 1 and len(gs[0]) == 1]
    assert len(center) == 1, f"p{pageno}: ページ最終戦の列が特定できない {center}"
    center_x = center[0]
    ents = parse_entries(page, center_x)

    order = {"L": sorted(x for x in cols if x < center_x),
             "R": sorted((x for x in cols if x > center_x), reverse=True)}
    n_rounds = len(order["L"]) + 2          # 半分の列数 ＋ ページ最終戦 ＋ 決勝
    assert len(order["R"]) == len(order["L"]), f"p{pageno}: 左右で列数が違う"
    names = _round_names(n_rounds)

    active = {"L": {}, "R": {}}
    for e in ents:
        active[e["side"]][e["y"]] = e["no"]
    matches, counts = [], {}
    for side in ("L", "R"):
        for ri, x in enumerate(order[side]):
            gs = sorted(cols[x], key=lambda g: g[0]["top"])
            for g in gs:
                reds = [_red(p) for p in g]
                ch = [i for i in range(1, len(g)) if reds[i] != reds[i - 1]]
                assert len(ch) == 1, f"p{pageno} col={x}: 縦線の色の切り替わりが{len(ch)}箇所"
                i = ch[0]
                y_out = (g[i]["top"] + g[i - 1]["bottom"]) / 2 - 0.5
                A = active[side]

                def find(y):
                    c = [k for k in A if abs(k - y) <= 2.0]
                    assert len(c) == 1, f"p{pageno} col={x} y={y}: 入力ラインが{len(c)}本"
                    return c[0]

                ku, kd = find(g[0]["top"] - 0.5), find(g[-1]["bottom"] - 0.5)
                up, dn = A.pop(ku), A.pop(kd)
                up_win = reds[0]
                matches.append(dict(round=names[ri], col=x, side=side,
                                    winner=up if up_win else dn, loser=dn if up_win else up,
                                    loser_y=kd if up_win else ku))
                A[y_out] = up if up_win else dn
            counts.setdefault(side, []).append(len(gs))

    # ラウンドごとの試合数が枠数の理屈と合うか。1回戦の読みを間違えるとここで止まる。
    for side, cs in counts.items():
        n_ent = sum(1 for e in ents if e["side"] == side)
        rest = n_ent - cs[0]
        assert rest and (rest & (rest - 1)) == 0, \
            f"p{pageno} {side}: 1回戦が{cs[0]}試合だと2回戦の出場が{rest}で2の冪でない"
        want = [cs[0]] + [rest >> (i + 1) for i in range(len(cs) - 1)]
        assert cs == want, f"p{pageno} {side}: 各ラウンドの試合数 {cs}（枠数からは {want}）"

    # ページ最終戦: 左右の勝者は同じ高さで突き合わされるので縦線では決まらない。
    # 合流点に入る水平線のうち、中央に最も近いものの色で決める。
    g = cols[center_x][0]
    y_in, y_out = g[0]["top"] - 0.5, g[-1]["bottom"] - 0.5
    (yl, ul), = active["L"].items()
    (yr, ur), = active["R"].items()
    assert abs(yl - y_in) < 2 and abs(yr - y_in) < 2, f"p{pageno}: ページ最終戦の入力が合わない"
    at_y = [h for h in hors if abs(h["top"] + 0.5 - y_in) < 1.5]
    hl = max((h for h in at_y if h["x1"] <= center_x + 1), key=lambda h: h["x1"])
    hr = min((h for h in at_y if h["x0"] >= center_x - 1), key=lambda h: h["x0"])
    assert _red(hl) != _red(hr), f"p{pageno}: ページ最終戦の勝者が決まらない"
    matches.append(dict(round=names[-2], col=center_x, side="C",
                        winner=ul if _red(hl) else ur, loser=ur if _red(hl) else ul,
                        loser_y=y_in))

    out_line = [h for h in hors if abs(h["top"] + 0.5 - y_out) < 1.5]
    assert len(out_line) == 1, f"p{pageno}: ページ勝者の下端の線が{len(out_line)}本"
    return dict(pageno=pageno, entries=ents, matches=matches, digits=digits,
                center_x=center_x, page_winner=matches[-1]["winner"],
                won_final=_red(out_line[0]), round_names=names)


def assign_scores(page):
    """スコアの数字を「敗者のライン脇」という位置関係だけで試合に割り当てる。

    候補位置は敗者側にしか作らないので、**全部が数pt以内で収まること自体が
    合流の色から出した勝敗の独立検算**になる（勝敗が逆なら相手のラインまで
    12pt以上ずれて DIGIT_MAX_DIST を超える）。
    """
    ms, ds, cx = page["matches"], page["digits"], page["center_x"]
    pairs = []
    for mi, m in enumerate(ms):
        dxs = (2.5,) if m["side"] == "L" else (-7.5,) if m["side"] == "R" else (2.5, -7.5, -27.5, 22.5)
        for dx in dxs:
            for dy in DIGIT_DY:
                ex, ey = m["col"] + dx, m["loser_y"] + dy
                for di, d in enumerate(ds):
                    pairs.append((abs(d["x0"] - ex) + abs(d["top"] - ey), mi, di))
    pairs.sort()
    am, ad = {}, {}
    for dist, mi, di in pairs:
        if mi in am or di in ad:
            continue
        am[mi], ad[di] = (di, dist), mi
    worst = 0.0
    for mi, m in enumerate(ms):
        di, dist = am[mi]
        if dist <= DIGIT_MAX_DIST:
            m["loser_score"] = int(ds[di]["text"])
            worst = max(worst, dist)
        else:
            m["loser_score"] = None
            del ad[di]
    page["worst_dist"] = worst
    page["spare_digits"] = [ds[i] for i in range(len(ds)) if i not in ad]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--pages", default="1-2")
    ap.add_argument("--players", required=True, help="tools/<大会>-<年>/<種目>.initialPlayers.json")
    ap.add_argument("--out", required=True)
    ap.add_argument("--winner-score", type=int, required=True)
    ap.add_argument("--loser-score", action="append", default=[],
                    help="PDFに未印字の試合を補う。書式 勝者No:敗者No=本数")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    a, _, b = args.pages.partition("-")
    page_nos = list(range(int(a), int(b or a) + 1))
    assert len(page_nos) == 2, "この様式は2ページで1つのドロー"

    with pdfplumber.open(args.pdf) as pdf:
        pages = [parse_page(pdf.pages[n - 1], n) for n in page_nos]
    for p in pages:
        assign_scores(p)

    names = pages[0]["round_names"]
    assert pages[1]["round_names"] == names, "左右のページで総ラウンド数が違う"

    champ = [p for p in pages if p["won_final"]]
    runner = [p for p in pages if not p["won_final"]]
    assert len(champ) == 1 and len(runner) == 1, "決勝の勝者が決まらない"
    assert not champ[0]["spare_digits"], "優勝側のページに余ったスコアがある"
    assert len(runner[0]["spare_digits"]) == 1, \
        f"準優勝側のページの余りスコアが{len(runner[0]['spare_digits'])}個（決勝の本数のはず）"

    allm = [m for p in pages for m in p["matches"]]
    allm.append(dict(round=names[-1], winner=champ[0]["page_winner"], loser=runner[0]["page_winner"],
                     loser_score=int(runner[0]["spare_digits"][0]["text"])))

    fills = {}
    for s in args.loser_score:
        key, _, v = s.partition("=")
        w, _, l = key.partition(":")
        fills[(int(w), int(l))] = int(v)
    filled = []
    for m in allm:
        if m["loser_score"] is None:
            k = (m["winner"], m["loser"])
            assert k in fills, (f"{m['round']} {m['winner']}-{m['loser']}: PDFにスコアが無い。"
                               f"--loser-score {k[0]}:{k[1]}=N で補うこと")
            m["loser_score"] = fills.pop(k)
            filled.append((m["round"], k, m["loser_score"]))
    assert not fills, f"--loser-score が使われなかった: {sorted(fills)}"

    players = json.loads(Path(args.players).read_text(encoding="utf-8"))
    teams = {e["id"]: e.get("team") or e["name"] for e in players}
    by_round = collections.Counter(m["round"] for m in allm)
    print(f"エントリー {len(players)} / 試合 {len(allm)}")
    for r in names:
        print(f"  {r}: {by_round[r]}")
    print(f"  スコア割り当ての最大ずれ: {max(p['worst_dist'] for p in pages):.1f}pt")
    for r, (w, l), v in filled:
        print(f"  補完: {r} {teams[w]} {args.winner_score}-{v} {teams[l]}（PDF未印字）")
    print(f"  優勝: {teams[champ[0]['page_winner']]} / 準優勝: {teams[runner[0]['page_winner']]}")

    data = build(players,
                 [dict(round=m["round"], entries=sorted([m["winner"], m["loser"]]),
                       winner=m["winner"], winnerScore=args.winner_score,
                       loserScore=m["loser_score"], retired=False) for m in allm],
                 winner_score_default=args.winner_score)
    problems = check(data)
    for p in problems:
        print("  NG  :", p)
    assert not problems, "検査に失敗した"
    print("  OK  : tournament_results_common.check() を通過")

    if args.dry_run:
        return
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    write(data, out)
    print("wrote", out)


if __name__ == "__main__":
    main()
