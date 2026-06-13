#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""対戦成績カード用のデータ（JSON）を過去データから抽出する。

2ペア（または2選手）の過去対戦を data/tournaments/details/** から姓ベースで検索し、
matchup-card-prompt.md の入力形式で出力する。

使い方:
  python tools/sns-images/h2h.py --pair-a "水木・松田" --pair-b "丸山・内田" \
      --event "全日本選手権2026" --round "準決勝" > matchup.json

  シングルスは --pair-a "船水" のように1人で指定。
  --tournament で対象大会を絞り込み可（複数指定可）。

注意: 姓のみで照合するため、同姓ペアが複数いる場合は誤マッチの可能性がある。
出力された matches を必ず目視確認すること。
"""
import argparse
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def name_key(names):
    return tuple(sorted(names))


def load_labels(root):
    labels = {}
    for f in ("index.json", "local_index.json"):
        p = os.path.join(root, "..", f)
        if os.path.exists(p):
            for t in json.load(open(p, encoding="utf-8")):
                labels[t["tournamentId"]] = t.get("label") or t["tournamentId"]
    return labels


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pair-a", required=True, help="姓を・区切りで（例: 水木・松田）")
    ap.add_argument("--pair-b", required=True)
    ap.add_argument("--event", default="", help="今回の大会名（カードに表示する文言）")
    ap.add_argument("--round", default="", help="今回の回戦（例: 準決勝）")
    ap.add_argument("--details-root", default="data/tournaments/details")
    ap.add_argument("--tournament", nargs="*", default=None)
    args = ap.parse_args()

    key_a = name_key(args.pair_a.split("・"))
    key_b = name_key(args.pair_b.split("・"))

    labels = load_labels(args.details_root)
    matches_found = []
    latest_info = {}  # key -> (year, players, team, pref)

    paths = sorted(glob.glob(os.path.join(args.details_root, "*", "*", "*.json")))
    for path in paths:
        parts = os.path.normpath(path).split(os.sep)
        tid, year, cat = parts[-3], parts[-2], os.path.splitext(parts[-1])[0]
        if args.tournament and tid not in args.tournament:
            continue
        if not year.isdigit():
            continue
        try:
            data = json.load(open(path, encoding="utf-8"))
        except Exception:
            continue
        pmap = {p["id"]: p for p in data.get("participants", [])}
        ekeys = {}
        einfo = {}
        for e in data.get("entries", []):
            ps = [pmap[p] for p in (e.get("playerIds") or []) if p in pmap]
            if not ps or not ps[0].get("lastName"):
                continue
            k = name_key([p["lastName"] or "" for p in ps])
            ekeys[e["entryNo"]] = k
            einfo[e["entryNo"]] = {
                "players": [f"{p.get('lastName','')} {p.get('firstName') or ''}".strip() for p in ps],
                "team": ps[0].get("team") or "",
                "prefecture": ps[0].get("prefecture") or "",
            }
        for no, k in ekeys.items():
            tag = "A" if k == key_a else "B" if k == key_b else None
            if tag:
                cur = latest_info.get(tag)
                if not cur or int(year) >= cur[0]:
                    latest_info[tag] = (int(year), einfo[no])
        for m in data.get("matches", []):
            if m.get("winnerEntryNo") is None:
                continue
            ents = m.get("entries") or []
            if len(ents) != 2:
                continue
            k0, k1 = ekeys.get(ents[0]), ekeys.get(ents[1])
            if {k0, k1} != {key_a, key_b} or key_a == key_b:
                continue
            wno = m["winnerEntryNo"]
            winner = "A" if ekeys.get(wno) == key_a else "B"
            sc = m.get("scores") or {}
            a_no = ents[0] if k0 == key_a else ents[1]
            b_no = ents[1] if a_no == ents[0] else ents[0]
            score = f"{sc.get(str(a_no), '?')}-{sc.get(str(b_no), '?')}"
            matches_found.append({
                "year": int(year),
                "tournament": labels.get(tid, tid),
                "category": cat,
                "round": m.get("round") or "",
                "score": score,
                "winner": winner,
                "retired": bool(m.get("retired")),
            })

    matches_found.sort(key=lambda x: x["year"])
    out = {
        "event": args.event,
        "round": args.round,
        "pairA": (latest_info.get("A") or (0, {"players": list(key_a), "team": "", "prefecture": ""}))[1],
        "pairB": (latest_info.get("B") or (0, {"players": list(key_b), "team": "", "prefecture": ""}))[1],
        "headToHead": {
            "aWins": sum(1 for m in matches_found if m["winner"] == "A"),
            "bWins": sum(1 for m in matches_found if m["winner"] == "B"),
            "matches": matches_found,
        },
    }
    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)
    print()


if __name__ == "__main__":
    main()
