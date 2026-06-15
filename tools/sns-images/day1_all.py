#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""4カテゴリ一括で1日目投稿素材（画像＋キャプション）を生成する。

種目で出力種別を自動切替:
  - シングルス: day1_singles
  - ダブルス  : day1_doubles
キャプションは captions/<カテゴリ>.txt に出力。

例:
  python tools/sns-images/day1_all.py --tournament highschool-japan-cup --year 2026 \
      --singles-next "6/27(土)9:00〜" --doubles-next "6/28(日)9:00〜" --out out/sns
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import day1lib as L
import day1_singles
import day1_doubles

CATS = ["doubles-none-boys", "doubles-none-girls", "singles-none-boys", "singles-none-girls"]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--tournament", required=True)
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--singles-next", default=None, help="シングルス2日目の日付（CTA）")
    ap.add_argument("--doubles-next", default=None, help="ダブルス2日目の日付（CTA）")
    ap.add_argument("--categories", nargs="*", default=None, help="対象カテゴリ（既定: 4種目）")
    ap.add_argument("--repo-root", default=".")
    ap.add_argument("--out", default="out/sns")
    args = ap.parse_args()

    base = os.path.join(args.repo_root, "data", "tournaments", "details", args.tournament, str(args.year))

    cats = args.categories or CATS
    for cat in cats:
        path = os.path.join(base, f"{cat}.json")
        if not os.path.exists(path):
            print(f"[skip] {cat}: ファイルなし ({path})")
            continue
        is_doubles = cat.startswith("doubles")
        next_date = args.doubles_next if is_doubles else args.singles_next

        argv = [path, "--out", args.out, "--tournament", args.tournament,
                "--year", str(args.year), "--repo-root", args.repo_root]
        if next_date:
            argv += ["--next-date", next_date]
        sys.argv = ["_"] + argv

        print(f"=== {cat} ({'ダブルス' if is_doubles else 'シングルス'}) ===")
        # 各スクリプトが画像＋キャプション(本文/スレッド)を out/captions に出力する
        (day1_doubles.main if is_doubles else day1_singles.main)()


if __name__ == "__main__":
    main()
