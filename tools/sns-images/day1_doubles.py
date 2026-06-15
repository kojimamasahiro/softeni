#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ダブルス1日目（予選リーグ終了）のX投稿画像を生成する。

画像:
  1) 表紙＋CTA（決勝トーナメント進出ペア決定）
  2) 本選進出ペア一覧（1〜2枚）
テキスト（out/captions/）:
  本文（進出ペア数・県別上位・CTA）+ スレッド（前年ベスト8以上の予選敗退/通過・複数進出校）
  ※進出サマリ画像・リーグ星取表は出さない（仕様書の確定事項）

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
    ap.add_argument("--title", default=None, help="大会・カテゴリ名（既定: パス推測）")
    ap.add_argument("--next-date", default=None, help="2日目の日付文字列（CTA用）例: 6/28(日)9:00〜")
    ap.add_argument("--tournament", default=None, help="information参照用の大会ID")
    ap.add_argument("--year", type=int, default=None, help="information参照用の年")
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--out", default="out/sns")
    args = ap.parse_args()

    data = L.load_details(args.details_json)
    pmap, emap = L.maps(data)
    os.makedirs(args.out, exist_ok=True)
    prefix = os.path.splitext(os.path.basename(args.details_json))[0]
    title = args.title or _title_from_path(args.details_json)

    venue = L.venue_of(args.tournament, args.year, args.repo_root) if args.tournament and args.year else None
    cta = L._cta_lines(args.next_date, venue)

    adv = sorted(L.advancers(data))
    n_adv = len(adv)
    paths = []

    # 1) 表紙＋CTA
    p = os.path.join(args.out, f"{prefix}_01_cover.png")
    L.render_cover(title, "予選リーグ終了", [
        f"決勝トーナメント進出 {n_adv}ペア決定",
        cta,
    ], p, badge="1日目終了")
    paths.append(p)

    # 2) 進出ペア一覧（グループ順）
    st = L.group_standings(data)
    rows = []
    for g in sorted(st.keys(), key=L._group_sort_key):
        no = st[g][0]
        name, sub = S.entry_label(emap[no], pmap)
        rows.append(("ROW", f"[{g}組] {name}（{L.strip_sub(sub)}）"))
    list_paths = L.render_list_pages(title, "決勝トーナメント進出ペア", rows, args.out, f"{prefix}_02_advancers")
    paths += list_paths

    # 本文＋スレッド（サマリ・番狂わせはテキストへ）
    cap_dir = os.path.join(args.out, "captions")
    os.makedirs(cap_dir, exist_ok=True)
    open(os.path.join(cap_dir, f"{prefix}.txt"), "w", encoding="utf-8").write(
        C.doubles_caption(data, args.details_json, args.next_date, venue))
    thread = C.doubles_thread(data, args.details_json)
    if thread:
        open(os.path.join(cap_dir, f"{prefix}_thread.txt"), "w", encoding="utf-8").write(thread)

    print("生成しました:")
    for p in paths:
        print(" ", p)
    print("  caption:", os.path.join(cap_dir, f"{prefix}.txt"))
    return paths


def _title_from_path(path):
    parts = os.path.normpath(path).split(os.sep)
    cat = os.path.splitext(parts[-1])[0]
    label = {
        "doubles-none-boys": "男子ダブルス", "doubles-none-girls": "女子ダブルス",
        "singles-none-boys": "男子シングルス", "singles-none-girls": "女子シングルス",
    }.get(cat, cat)
    return f"ハイスクールジャパンカップ {label}" if "japan-cup" in path else label


if __name__ == "__main__":
    main()
