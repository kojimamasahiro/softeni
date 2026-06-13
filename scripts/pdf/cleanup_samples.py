# -*- coding: utf-8 -*-
"""
data/st-league/<YEAR>/{participants.json, matches.json} から
サンプルデータ（teamId が "sample-" で始まるチームと、その対戦）を削除する。

使い方:
  1) DRY-RUN: python3 cleanup_samples.py        （削除対象を表示、data は不変）
  2) 反映:    APPLY=True にして再実行             （バックアップ後 data/ を更新）
"""

import os
import json
import shutil

YEAR = "2025"
APPLY = False
DATA_DIR = f"../../data/st-league/{YEAR}"
PREFIX = "sample-"


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def dump(o, p):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=4)
        f.write("\n")


def is_sample(tid):
    return str(tid).startswith(PREFIX)


def main():
    part_path = f"{DATA_DIR}/participants.json"
    match_path = f"{DATA_DIR}/matches.json"
    P = load(part_path)
    M = load(match_path)

    removed_teams, removed_matches = {}, {}
    for g in ("boys", "girls"):
        rt = [t["teamId"] for t in P[g] if is_sample(t["teamId"])]
        P[g] = [t for t in P[g] if not is_sample(t["teamId"])]
        rm = [m["id"] for m in M[g]
              if is_sample(m["teamA"]) or is_sample(m["teamB"])]
        M[g] = [m for m in M[g]
                if not (is_sample(m["teamA"]) or is_sample(m["teamB"]))]
        removed_teams[g] = rt
        removed_matches[g] = rm

    for g in ("boys", "girls"):
        print(f"[{g}] 削除チーム {len(removed_teams[g])}: {removed_teams[g]}")
        print(f"[{g}] 削除試合 {len(removed_matches[g])}")
        print(f"[{g}] 残存チーム: {[t['teamId'] for t in P[g]]}")

    if APPLY:
        backup = f"output/backup_{YEAR}_precleanup"
        os.makedirs(backup, exist_ok=True)
        shutil.copy(part_path, f"{backup}/participants.json")
        shutil.copy(match_path, f"{backup}/matches.json")
        dump(P, part_path)
        dump(M, match_path)
        print(f"\n*** APPLIED: サンプル削除（バックアップ: {backup}/） ***")
    else:
        print("\n(DRY-RUN) data/ は未変更。APPLY=True で反映。")


if __name__ == "__main__":
    main()
