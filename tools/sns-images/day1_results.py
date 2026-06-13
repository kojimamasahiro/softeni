#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""二日制大会の「1日目終了時点」画像を生成する。

出力:
  1) 勝ち残りドロー画像（次ラウンド以降のブラケット。大きい場合は複数枚に分割）
  2) 回戦別結果一覧画像（終了済み試合を回戦ごとにリスト。複数枚に分割）

使い方:
  python tools/sns-images/day1_results.py data/tournaments/details/<大会>/<年>/<カテゴリ>.json \
      --title "ハイスクールジャパンカップ2026 男子ダブルス" \
      --subtitle "1日目終了時点" --out out/sns

オプション:
  --max-leaves N   ドロー1枚あたりの最大勝ち残り数（既定16）
  --rounds A,B     結果一覧に含める回戦を限定（既定: 終了済みすべて）

未消化の試合は winnerEntryNo が null であることを前提とする。
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import snslib as S

W = 1200


# ---------- ブラケット木の構築 ----------

def build_matches(data):
    return {m["matchId"]: m for m in data["matches"] if m.get("stage", "knockout") == "knockout"}


def find_final(matches):
    finals = [m for m in matches.values() if not m.get("nextMatchId")]
    if not finals:
        raise SystemExit("決勝（nextMatchId なし）の試合が見つかりません")
    return finals[0]


def leaf(entry_no):
    return {"kind": "leaf", "entry": entry_no}


def tbd():
    return {"kind": "leaf", "entry": None}


def build_tree(mid, matches):
    """未消化の試合を再帰的にたどり、勝者確定済みの枝は勝者の葉にする"""
    m = matches[mid]
    if m.get("winnerEntryNo") is not None:
        return leaf(m["winnerEntryNo"])
    prevs = [p for p in (m.get("prevMatchIds") or []) if p and p in matches]
    children = [build_tree(p, matches) for p in prevs]
    decided = {c["entry"] for c in children if c["kind"] == "leaf" and c["entry"] is not None}
    direct = [e for e in (m.get("entries") or []) if e not in decided]
    for e in direct[: max(0, 2 - len(children))]:
        children.append(leaf(e))
    while len(children) < 2:
        children.append(tbd())
    return {"kind": "node", "match": m, "children": children}


def leaves_of(t):
    if t["kind"] == "leaf":
        return [t]
    return [x for c in t["children"] for x in leaves_of(c)]


def split_tree(t, max_leaves):
    if t["kind"] == "leaf" or len(leaves_of(t)) <= max_leaves:
        return [t]
    if any(c["kind"] == "leaf" for c in t["children"]):
        return [t]  # 片側が確定済みの葉 → これ以上分割しない
    return [p for c in t["children"] for p in split_tree(c, max_leaves)]


# ---------- ブラケット描画 ----------

def layout(t):
    """各ノードに col(右ほど深い), y を割り当てる。葉は上から等間隔。"""
    leaves = leaves_of(t)
    idx = {id(l): i for i, l in enumerate(leaves)}

    def assign(n):
        if n["kind"] == "leaf":
            n["col"] = 0
            n["row"] = idx[id(n)]
            return 0
        c = max(assign(ch) for ch in n["children"]) + 1
        n["col"] = c
        return c

    maxcol = assign(t)

    def fix_y(n):
        if n["kind"] == "leaf":
            return n["row"]
        ys = [fix_y(c) for c in n["children"]]
        n["row"] = sum(ys) / len(ys)
        return n["row"]

    fix_y(t)
    return leaves, maxcol


def round_labels(t, maxcol):
    labels = {}
    def walk(n):
        if n["kind"] != "node":
            return
        labels.setdefault(n["col"], n["match"].get("round") or "")
        for c in n["children"]:
            walk(c)
    walk(t)
    return labels


def render_bracket(t, pmap, title, subtitle, part_label, out_path):
    leaves, maxcol = layout(t)
    n = len(leaves)
    row_h = 66
    name_col = 380
    top = 126 + 6 + 44  # ヘッダー + ラウンドラベル行
    H = max(700, top + n * row_h + 80)
    img, d = S.new_canvas(W, H)
    S.draw_header(d, W, title, subtitle)
    if part_label:
        f = S.font(22, bold=True)
        tw = S.text_w(d, part_label, f)
        d.rectangle([W - tw - 70, 30, W - 26, 70], fill=S.YELLOW)
        d.text((W - tw - 48, 36), part_label, font=f, fill=S.NAVY)

    x0 = name_col
    col_w = (W - name_col - 50) / max(1, maxcol)

    def pt(node):
        return (x0 + node["col"] * col_w, top + node["row"] * row_h + row_h // 2)

    # ラウンドラベル
    labels = round_labels(t, maxcol)
    lf = S.font(19, bold=True)
    for col, lab in labels.items():
        if not lab:
            continue
        x = x0 + col * col_w
        tw = S.text_w(d, lab, lf)
        d.text((x - tw / 2, top - 34), lab, font=lf, fill=S.GRAY)

    # 線
    def draw_lines(node):
        if node["kind"] != "node":
            return
        nx, ny = pt(node)
        ys = []
        for c in node["children"]:
            cx, cy = pt(c)
            d.line([cx, cy, nx, cy], fill=S.NAVY, width=3)
            ys.append(cy)
            draw_lines(c)
        d.line([nx, min(ys), nx, max(ys)], fill=S.NAVY, width=3)

    draw_lines(t)

    # 葉（勝ち残り）のテキスト
    for l in leaves:
        lx, ly = pt(l)
        if l["entry"] is None:
            f = S.font(22)
            d.text((28, ly - 14), "（未定）", font=f, fill=S.GRAY)
            continue
        name, sub = l["label"]
        nf = S.fit_font(d, name, lx - 40, 27, bold=True)
        d.text((28, ly - 28), name, font=nf, fill=S.NAVY)
        if sub:
            sf = S.fit_font(d, sub, lx - 40, 19)
            d.text((28, ly + 4), sub, font=sf, fill=S.GRAY)
        d.line([28, ly + 30, lx, ly + 30], fill=S.LINE, width=1)

    S.draw_footer(d, W, H)
    img.save(out_path)
    return out_path


# ---------- 回戦別結果一覧 ----------

def collect_results_rows(data, matches, pmap, only_rounds=None):
    rows = []  # (round, text_w_winner_first)
    emap = {e["entryNo"]: e for e in data["entries"]}
    order = {}
    for m in data["matches"]:
        if m.get("stage", "knockout") != "knockout":
            continue
        if m.get("winnerEntryNo") is None:
            continue
        rnd = m.get("round") or "?"
        if only_rounds and rnd not in only_rounds:
            continue
        order.setdefault(rnd, len(order))
        wno = m["winnerEntryNo"]
        ents = m.get("entries") or []
        lno = next((e for e in ents if e != wno), None)
        wname, wsub = S.entry_label(emap[wno], pmap)
        if lno is None:
            rows.append((rnd, f"○ {wname}（{strip_sub(wsub)}）  不戦勝"))
            continue
        lname, lsub = S.entry_label(emap[lno], pmap)
        sc = m.get("scores") or {}
        ws, ls = sc.get(str(wno), ""), sc.get(str(lno), "")
        score = f"{ws}−{ls}" if ws != "" else ""
        if m.get("retired"):
            score += " 棄権"
        rows.append((rnd, f"○ {wname}（{strip_sub(wsub)}）  {score}  {lname}（{strip_sub(lsub)}）"))
    rows.sort(key=lambda r: order.get(r[0], 99))
    return rows


def strip_sub(sub):
    return sub.replace("（", "/").replace("）", "").strip("/")


def render_results_pages(rows, title, subtitle, out_dir, prefix):
    H = 1500
    row_h = 42
    head_h = 54
    top = 126 + 6 + 18
    bottom = H - 70
    paths = []
    page_rows = []
    pages = []
    used = top
    last_round = None
    for rnd, text in rows:
        need = row_h + (head_h if rnd != last_round else 0)
        if used + need > bottom:
            pages.append(page_rows)
            page_rows = []
            used = top
            last_round = None
            need = row_h + head_h
        if rnd != last_round:
            page_rows.append(("HEAD", rnd))
            used += head_h
            last_round = rnd
        page_rows.append(("ROW", text))
        used += row_h
    if page_rows:
        pages.append(page_rows)

    for i, pg in enumerate(pages, 1):
        img, d = S.new_canvas(W, H)
        sub = subtitle + (f"（{i}/{len(pages)}）" if len(pages) > 1 else "")
        S.draw_header(d, W, title, sub)
        y = top
        for kind, val in pg:
            if kind == "HEAD":
                d.rectangle([24, y + 8, W - 24, y + head_h - 6], fill=S.NAVY)
                d.rectangle([24, y + 8, 32, y + head_h - 6], fill=S.YELLOW)
                d.text((46, y + 16), val, font=S.font(24, bold=True), fill=S.WHITE)
                y += head_h
            else:
                f = S.fit_font(d, val, W - 72, 23)
                d.text((46, y + 8), val, font=f, fill=S.NAVY)
                d.line([46, y + row_h - 2, W - 46, y + row_h - 2], fill=S.LINE, width=1)
                y += row_h
        S.draw_footer(d, W, H)
        p = os.path.join(out_dir, f"{prefix}_results_p{i}.png")
        img.save(p)
        paths.append(p)
    return paths


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("details_json")
    ap.add_argument("--title", default=None, help="大会名（既定: パスから推測）")
    ap.add_argument("--subtitle", default="1日目終了時点", help="サブタイトル")
    ap.add_argument("--out", default="out/sns", help="出力ディレクトリ")
    ap.add_argument("--max-leaves", type=int, default=16)
    ap.add_argument("--rounds", default=None, help="結果一覧の対象回戦（カンマ区切り）")
    args = ap.parse_args()

    data = json.load(open(args.details_json, encoding="utf-8"))
    pmap = S.participants_map(data)
    emap = {e["entryNo"]: e for e in data["entries"]}
    matches = build_matches(data)

    title = args.title
    if not title:
        parts = os.path.normpath(args.details_json).split(os.sep)
        title = " ".join(parts[-3:-1]) if len(parts) >= 3 else "大会結果"

    os.makedirs(args.out, exist_ok=True)
    prefix = os.path.splitext(os.path.basename(args.details_json))[0]

    # 勝ち残りドロー
    root = build_tree(find_final(matches)["matchId"], matches)
    for l in leaves_of(root):
        l["label"] = S.entry_label(emap[l["entry"]], pmap) if l["entry"] is not None else ("", "")
    n_alive = sum(1 for l in leaves_of(root) if l["entry"] is not None)
    parts = split_tree(root, args.max_leaves)
    part_names = {2: ["上半分", "下半分"]}.get(len(parts), [f"第{i}ブロック" for i in range(1, len(parts) + 1)])
    draw_paths = []
    for i, p in enumerate(parts):
        label = part_names[i] if len(parts) > 1 else ""
        out = os.path.join(args.out, f"{prefix}_draw_p{i+1}.png")
        draw_paths.append(render_bracket(p, pmap, title, f"{args.subtitle}・勝ち残りドロー（ベスト{n_alive}）", label, out))

    # 回戦別結果
    only = set(args.rounds.split(",")) if args.rounds else None
    rows = collect_results_rows(data, matches, pmap, only)
    res_paths = render_results_pages(rows, title, f"{args.subtitle}・結果一覧", args.out, prefix)

    print("生成しました:")
    for p in draw_paths + res_paths:
        print(" ", p)


if __name__ == "__main__":
    main()
