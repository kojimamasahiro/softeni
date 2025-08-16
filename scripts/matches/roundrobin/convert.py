import json
import re
from collections import defaultdict

def get_ids(player_list):
    ids = []
    for p in player_list:
        if isinstance(p, str):
            ids.append(p)
        else:
            pid = p.get("tempId") or p.get("playerId")
            ids.append(pid)
    return tuple(sorted(ids))

def normalize_pair(pair):
    result = []
    for pid in pair:
        if isinstance(pid, str) and "_" in pid:
            result.append({"playerId": None, "tempId": pid})
        else:
            result.append({"playerId": pid})
    return result

# カスタムラウンド順マップ
special_round_order = {
    "準々決勝": 100,
    "準決勝": 101,
    "決勝": 102
}
def get_round_order(round_str):
    if round_str in special_round_order:
        return special_round_order[round_str]
    match = re.search(r"(\d+)", round_str)
    return int(match.group(1)) if match else float('inf')

# JSON読み込み
with open('input.json', 'r', encoding='utf-8') as f:
    matches = json.load(f)

# カテゴリごとに分類
matches_by_category = defaultdict(list)
for match in matches:
    category = match.get("category", "unknown")
    matches_by_category[category].append(match)

# 結果格納
final_results = {}

for category, match_list in matches_by_category.items():
    match_map = defaultdict(list)

    for match in match_list:
        pair_ids = get_ids(normalize_pair(match["pair"]))
        opponent_ids = get_ids(match["opponents"])
        key = tuple(sorted([pair_ids, opponent_ids]))
        match_map[key].append(match)

    merged_results = []
    seen_keys = set()

    for group in match_map.values():
        if len(group) == 2:
            a, b = group
            entry_a = a["entryNo"]
            entry_b = b["entryNo"]

            merged_results.append({
                "round": a.get("round") or f"グループ{a.get('group', '?')}",
                "player1": {
                    "entryNo": entry_a,
                    "won": int(a["games"]["won"]),
                    "lost": int(a["games"]["lost"])
                },
                "player2": {
                    "entryNo": entry_b,
                    "won": int(b["games"]["won"]),
                    "lost": int(b["games"]["lost"])
                },
                "winner": entry_a if a["result"] == "win" else entry_b
            })

            seen_keys.add(frozenset([entry_a, entry_b]))
        else:
            for m in group:
                entry_a = m["entryNo"]
                opponent_ids = get_ids(m["opponents"])
                entry_b = f"opponent-{hash(opponent_ids)}"
                winner = entry_a if m["result"] == "win" else entry_b

                if frozenset([entry_a, entry_b]) in seen_keys:
                    continue

                merged_results.append({
                    "round": m.get("round") or f"グループ{m.get('group', '?')}",
                    "player1": {
                        "entryNo": entry_a,
                        "won": int(m["games"]["won"]),
                        "lost": int(m["games"]["lost"])
                    },
                    "player2": {
                        "entryNo": entry_b,
                        "won": int(m["games"]["lost"]),
                        "lost": int(m["games"]["won"])
                    },
                    "winner": winner
                })

    # ラウンド順 + entryNoでソート（トーナメントでも自然順になる）
    merged_results.sort(
        key=lambda m: (
            get_round_order(m["round"]),
            min(
                m["player1"]["entryNo"]
                if isinstance(m["player1"]["entryNo"], int) else 9999,
                m["player2"]["entryNo"]
                if isinstance(m["player2"]["entryNo"], int) else 9999
            )
        )
    )

    final_results[category] = merged_results

# 出力
print(json.dumps(merged_results, ensure_ascii=False, indent=2))
