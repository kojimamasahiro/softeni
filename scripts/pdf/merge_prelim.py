# -*- coding: utf-8 -*-
"""
st_league2_prelim.py（Ⅱ部 1日目 予選リーグ）の結果を data/st-league/<YEAR>/ へ統合。

  - participants: 既存8チームに block を付与＋新規予選選手を追記。新規24チームを追加
                  （division="2", block, prefecture, players）
  - matches:      予選48試合を division="2" / block / label="予選 Xブロック" で追加
                  （実施番手のみ matches[] に格納）
  - IDは既存継承、新規は全ID(男女)最大+1から採番

使い方: DRY-RUN→APPLY=True
"""

import os
import json
import shutil

import st_league as S1
import st_league2_prelim as PP

YEAR = "2025"
APPLY = False
MATCH_DATE = "2025-12-11"   # 予選（1日目）
DATA_DIR = f"../../data/st-league/{YEAR}"
BANTE_TYPES = ["D1", "S", "D2"]


def load(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def dump(o, p):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(o, f, ensure_ascii=False, indent=4)
        f.write("\n")


def main():
    part_path = f"{DATA_DIR}/participants.json"
    match_path = f"{DATA_DIR}/matches.json"
    league_path = f"{DATA_DIR}/league.json"
    P = load(part_path)
    M = load(match_path)
    L = load(league_path)
    g = PP.GENDER_KEY

    import pdfplumber
    pdf = pdfplumber.open(PP.PDF_PATH)
    standings = PP.parse_standings([pdf.pages[0], pdf.pages[1]])
    ties, roster = PP.parse_ties(PP.PAGE_BLOCKS, pdf.pages)

    meta_by_tid = {t["teamId"]: t for t in standings}

    # 参照元: (teamId, normname) -> id
    ref = {}
    for t in P[g]:
        for p in t.get("players", []):
            ref[(t["teamId"], S1.norm(p["lastName"] + p["firstName"]))] = p["id"]
    all_ids = {p["id"] for gg in ("boys", "girls") for t in P[gg] for p in t.get("players", [])}
    next_id = max(all_ids) + 1

    player_id = {}
    for tid, ppl in roster.items():
        for (sur, given) in sorted(ppl, key=lambda k: ppl[k]):
            key = S1.norm(sur + given)
            rid = ref.get((tid, key))
            if rid is None:
                rid = next_id
                next_id += 1
                while rid in all_ids:
                    rid = next_id
                    next_id += 1
                all_ids.add(rid)
            player_id[(tid, (sur, given))] = rid

    # participants 統合
    by_id = {t["teamId"]: t for t in P[g]}
    added_teams, added_players = [], []
    for tid, ppl in roster.items():
        meta = meta_by_tid.get(tid, {})
        new_players = [
            {"lastName": s, "firstName": gv, "id": player_id[(tid, (s, gv))]}
            for (s, gv) in sorted(ppl, key=lambda k: ppl[k])
        ]
        if tid in by_id:
            team = by_id[tid]
            team["block"] = meta.get("block")  # 予選ブロックを付与
            have = {p["id"] for p in team.get("players", [])}
            for p in new_players:
                if p["id"] not in have:
                    team.setdefault("players", []).append(p)
                    added_players.append((tid, p))
        else:
            obj = {
                "teamId": tid,
                "division": PP.DIVISION,
                "block": meta.get("block"),
                "name": [meta.get("name", tid)],
                "prefecture": meta.get("pref", ""),
                "players": new_players,
            }
            P[g].append(obj)
            by_id[tid] = obj
            added_teams.append(tid)
            added_players += [(tid, p) for p in new_players]

    # matches 統合
    next_mid = max((m["id"] for m in M[g]), default=0) + 1
    appended = []
    for tie in ties:
        tidA, tidB = tie["teamA"], tie["teamB"]
        details = []
        for i, (bsA, bsB, pplA, pplB) in enumerate(tie["bantes"]):
            if bsA is None or bsB is None:
                continue
            details.append({
                "type": BANTE_TYPES[i] if i < len(BANTE_TYPES) else f"G{i+1}",
                "winner": "A" if bsA > bsB else "B",
                "scoreA": bsA, "scoreB": bsB,
                "playersA": [player_id[(tidA, p)] for p in pplA],
                "playersB": [player_id[(tidB, p)] for p in pplB],
            })
        sA, sB = tie["scoreA"], tie["scoreB"]
        winner = tidA if (sA or 0) > (sB or 0) else (tidB if (sB or 0) > (sA or 0) else "")
        appended.append({
            "id": next_mid,
            "division": PP.DIVISION,
            "block": tie["block"],
            "label": tie["label"],
            "date": MATCH_DATE,
            "status": "finished",
            "teamA": tidA, "teamB": tidB,
            "winner": winner,
            "scoreA": sA, "scoreB": sB,
            "matches": details,
        })
        next_mid += 1
    M[g].extend(appended)

    # league.json: 予選ブロック別の公式順位を保持
    blocks_order = {}
    for s in sorted(standings, key=lambda x: (x["block"], x["rank"] or 9)):
        blocks_order.setdefault(s["block"], []).append(s["teamId"])
    L.setdefault("results", {}).setdefault(PP.DIVISION, {}).setdefault(g, {})["blocks"] = blocks_order

    os.makedirs(PP.OUTPUT_DIR, exist_ok=True)
    dump(P, f"{PP.OUTPUT_DIR}/merged_participants.json")
    dump(M, f"{PP.OUTPUT_DIR}/merged_matches.json")
    dump(L, f"{PP.OUTPUT_DIR}/merged_league.json")

    print(f"=== 予選統合 (YEAR={YEAR}, {g}) ===")
    print(f"新規チーム {len(added_teams)}: {added_teams}")
    print(f"新規選手 {len(added_players)}名 (id {min(p['id'] for _,p in added_players)}〜{max(p['id'] for _,p in added_players)})")
    print(f"追加試合 {len(appended)} 件 (id {appended[0]['id']}〜{appended[-1]['id']})")

    if APPLY:
        backup = f"{PP.OUTPUT_DIR}/backup_{YEAR}_prelim"
        os.makedirs(backup, exist_ok=True)
        for src in (part_path, match_path, league_path):
            shutil.copy(src, f"{backup}/{os.path.basename(src)}")
        dump(P, part_path)
        dump(M, match_path)
        dump(L, league_path)
        print(f"\n*** APPLIED （バックアップ: {backup}/） ***")
    else:
        print("\n(DRY-RUN) data/ は未変更。APPLY=True で反映。")


if __name__ == "__main__":
    main()
