#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""シングルス1日目（ベスト4確定）のX投稿画像を生成する。

画像（最大3枚）:
  1) 表紙＋CTA（ベスト4決定）
  2) ベスト4一覧
  3) 準決勝 確定カード（確定カードがある場合のみ）
テキスト（out/captions/）:
  本文 + スレッド（準々決勝結果＋前年ベスト8以上の敗退/生存）

仕様: docs/wiki/sns-day1-images.md
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import day1lib as L
import snslib as S
import captions as C


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("details_json")
    ap.add_argument("--title", default=None)
    ap.add_argument("--next-date", default=None, help="2日目の日付文字列（CTA用）例: 6/27(土)9:00〜")
    ap.add_argument("--tournament", default=None)
    ap.add_argument("--year", type=int, default=None)
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--out", default="out/sns")
    args = ap.parse_args()

    data = L.load_details(args.details_json)
    pmap, emap = L.maps(data)
    os.makedirs(args.out, exist_ok=True)
    prefix = os.path.splitext(os.path.basename(args.details_json))[0]
    from day1_doubles import _title_from_path
    title = args.title or _title_from_path(args.details_json)

    venue = L.venue_of(args.tournament, args.year, args.repo_root) if args.tournament and args.year else None
    cta = L._cta_lines(args.next_date, venue)

    alive = L.survivors(data)
    n_alive = len(alive)
    headline = "ベスト4決定" if n_alive == 4 else f"ベスト{n_alive}決定"
    paths = []

    # 1) 表紙＋CTA
    p = os.path.join(args.out, f"{prefix}_01_cover.png")
    L.render_cover(title, headline, [f"準々決勝が終了し残り{n_alive}名", cta], p, badge="1日目終了")
    paths.append(p)

    # 2) 残存一覧
    labels = [S.entry_label(emap[no], pmap) for no in sorted(alive)]
    p = os.path.join(args.out, f"{prefix}_02_survivors.png")
    L.render_entry_cards(title, f"勝ち残り（ベスト{n_alive}）", labels, p, cols=2)
    paths.append(p)

    # 3) 準決勝 確定カード
    cards = []
    for rnd, ents in L.confirmed_next_cards(data):
        a = S.entry_label(emap[ents[0]], pmap)
        b = S.entry_label(emap[ents[1]], pmap)
        cards.append((a, b, rnd))
    if cards:
        p = os.path.join(args.out, f"{prefix}_03_matchups.png")
        L.render_matchups(title, "2日目の確定カード", cards, p)
        paths.append(p)

    # 本文＋スレッド（番狂わせ・準々決勝結果はテキストへ）
    cap_dir = os.path.join(args.out, "captions")
    os.makedirs(cap_dir, exist_ok=True)
    open(os.path.join(cap_dir, f"{prefix}.txt"), "w", encoding="utf-8").write(
        C.singles_caption(data, args.details_json, args.next_date, venue))
    thread = C.singles_thread(data, args.details_json)
    if thread:
        open(os.path.join(cap_dir, f"{prefix}_thread.txt"), "w", encoding="utf-8").write(thread)

    print("生成しました:")
    for p in paths:
        print(" ", p)
    print("  caption:", os.path.join(cap_dir, f"{prefix}.txt"))
    return paths


if __name__ == "__main__":
    main()
