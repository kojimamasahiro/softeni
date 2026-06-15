#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""シングルス完結報告（優勝〜ベスト4）のX投稿画像を生成する。

画像:
  1) 優勝（大きく）
  2) 準優勝・ベスト4一覧
テキスト（out/captions/）:
  本文（優勝者・決勝スコア）+ スレッド（都道府県別ベスト8・準決勝スコア）

仕様: docs/wiki/sns-day1-images.md
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import day1lib as L
import snslib as S
import captions as C


def _rank_entries(data):
    """tournament.rank から 優勝/準優勝/ベスト4/ベスト8 の entryNo を取り出す。"""
    champ = runner = None
    best4, best8 = [], []
    for r in data.get("results", []):
        t = r.get("tournament")
        if not t:
            continue
        rk = t.get("rank") or {}
        k = rk.get("kind")
        if k == "winner":
            champ = r["entryNo"]
        elif k == "runnerup":
            runner = r["entryNo"]
        elif k == "best" and rk.get("bestLevel") == 4:
            best4.append(r["entryNo"])
        elif k == "best" and rk.get("bestLevel") == 8:
            best8.append(r["entryNo"])
    return champ, runner, best4, best8


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("details_json")
    ap.add_argument("--title", default=None)
    ap.add_argument("--out", default="out/sns")
    args = ap.parse_args()

    data = L.load_details(args.details_json)
    pmap, emap = L.maps(data)
    os.makedirs(args.out, exist_ok=True)
    prefix = os.path.splitext(os.path.basename(args.details_json))[0]
    from day1_doubles import _title_from_path
    title = args.title or _title_from_path(args.details_json)

    champ, runner, best4, best8 = _rank_entries(data)
    paths = []

    # 1) 優勝
    if champ is not None:
        name, sub = S.entry_label(emap[champ], pmap)
        p = os.path.join(args.out, f"{prefix}_01_champion.png")
        L.render_cover(title, name, [sub, "優勝"], p, badge="優勝")
        paths.append(p)

    # 2) 準優勝・ベスト4
    labels = []
    if runner is not None:
        n, s = S.entry_label(emap[runner], pmap)
        labels.append((f"準優勝　{n}", s))
    for no in best4:
        n, s = S.entry_label(emap[no], pmap)
        labels.append((f"ベスト4　{n}", s))
    if labels:
        p = os.path.join(args.out, f"{prefix}_02_podium.png")
        L.render_entry_cards(title, "準優勝・ベスト4", labels, p, cols=1)
        paths.append(p)

    # 本文＋スレッド（スコア・県別はテキストへ）
    final_rows = [r for r in L.decided_results(data) if r[0] == "決勝"]
    top8 = [e for e in ([champ, runner] + best4 + best8) if e is not None]
    cap_dir = os.path.join(args.out, "captions")
    os.makedirs(cap_dir, exist_ok=True)
    open(os.path.join(cap_dir, f"{prefix}_result.txt"), "w", encoding="utf-8").write(
        C.result_caption(data, args.details_json, champ, runner, final_rows))
    if top8:
        open(os.path.join(cap_dir, f"{prefix}_result_thread.txt"), "w", encoding="utf-8").write(
            C.result_thread(data, top8))

    print("生成しました:")
    for p in paths:
        print(" ", p)
    print("  caption:", os.path.join(cap_dir, f"{prefix}_result.txt"))
    return paths


if __name__ == "__main__":
    main()
