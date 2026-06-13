# -*- coding: utf-8 -*-
"""
st_league2.py（Ⅱ部・順位決定戦）の解析結果を data/st-league/<YEAR>/ へ統合する。

  - participants.json: 既存チームには新規選手のみ追記、新規チームは追加（division="2", prefecture付き）
  - matches.json:      順位決定戦の各対戦を division="2" / label=ラウンド名 で追加
                       （実施された番手のみ matches[] に格納。未実施D2は除外）
  - league.json:       results["2"]["boys"] に champion と ranking（公式順位order）を反映
  - IDは既存を継承、新規は全ID(男女)最大+1から採番

使い方:
  1) DRY-RUN: python3 merge_st2.py        （merged_*.json 出力、data不変）
  2) 反映:    APPLY=True にして再実行
"""

import os
import json
import shutil

import st_league as S1          # norm() を流用
import st_league2 as S2

YEAR = "2025"
APPLY = False
MATCH_DATE = "2025-12-13"       # Ⅱ部順位決定戦（要確認）
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
    g = S2.GENDER_KEY

    import pdfplumber
    pdf = pdfplumber.open(S2.PDF_PATH)
    standings = S2.parse_standings(pdf.pages[0])
    ties, roster = S2.parse_ties(pdf.pages[2])

    # 参照元（既存boysチーム）: (teamId, normname) -> id
    ref = {}
    for t in P[g]:
        for p in t.get("players", []):
            ref[(t["teamId"], S1.norm(p["lastName"] + p["firstName"]))] = p["id"]
    all_ids = {p["id"] for gg in ("boys", "girls") for t in P[gg] for p in t.get("players", [])}
    next_id = max(all_ids) + 1

    # 選手ID解決
    player_id = {}   # (teamId,(sur,given)) -> id
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
    pref_by_tid = {t["teamId"]: t["prefecture"] for t in standings if t["teamId"]}
    by_id = {t["teamId"]: t for t in P[g]}
    added_teams, added_players = [], []
    for meta in S2.TEAMS2:
        tid = meta["teamId"]
        ppl = roster.get(tid, {})
        new_players = [
            {"lastName": s, "firstName": gv, "id": player_id[(tid, (s, gv))]}
            for (s, gv) in sorted(ppl, key=lambda k: ppl[k])
        ]
        if tid in by_id:
            team = by_id[tid]
            have = {p["id"] for p in team.get("players", [])}
            for p in new_players:
                if p["id"] not in have:
                    team.setdefault("players", []).append(p)
                    added_players.append((tid, p))
        else:
            obj = {
                "teamId": tid,
                "division": S2.DIVISION,
                "name": [meta["name"]],
                "prefecture": pref_by_tid.get(tid, ""),
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
                continue  # 未実施番手は除外
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
            "division": S2.DIVISION,
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

    # league.json 公式順位
    order = [s["teamId"] for s in sorted(standings, key=lambda s: s["rank"]) if s["teamId"]]
    L.setdefault("results", {}).setdefault(S2.DIVISION, {})[g] = {
        "champion": order[0] if order else None,
        "ranking": order,
    }

    os.makedirs(S2.OUTPUT_DIR, exist_ok=True)
    dump(P, f"{S2.OUTPUT_DIR}/merged_participants.json")
    dump(M, f"{S2.OUTPUT_DIR}/merged_matches.json")
    dump(L, f"{S2.OUTPUT_DIR}/merged_league.json")

    print(f"=== Ⅱ部統合 (YEAR={YEAR}, {g}) ===")
    print("公式順位:", " > ".join(order))
    print(f"新規チーム {len(added_teams)}: {added_teams}")
    print(f"新規選手 {len(added_players)}名:")
    for tid, p in added_players:
        print(f"   {tid}: {p['lastName']}{p['firstName']} #{p['id']}")
    print(f"追加試合 {len(appended)} 件 (id {appended[0]['id']}〜{appended[-1]['id']})")

    if APPLY:
        backup = f"{S2.OUTPUT_DIR}/backup_{YEAR}_st2"
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
