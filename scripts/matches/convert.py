import json
import re
from collections import defaultdict

def get_ids(player_list):
    ids = []
    for p in player_list:
        pid = p.get("playerId") or p.get("tempId")
        ids.append(pid)
    return tuple(sorted(ids))

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

def normalize_pair(pair):
    result = []
    for pid in pair:
        if isinstance(pid, str) and "_" in pid:
            # おそらく tempId（tempId は名字_名前_所属の形式）
            result.append({"playerId": None, "tempId": pid})
        else:
            # playerId 形式（例: ueda-rio など）
            result.append({"playerId": pid})
    return result

# JSONデータ読み込み
with open('input.json', 'r', encoding='utf-8') as f:
    matches = json.load(f)

# categoryごとに分割
matches_by_category = defaultdict(list)
for match in matches:
    category = match.get("category", "unknown")
    matches_by_category[category].append(match)

# 結果出力用ディクショナリ
final_results = {}

# 各カテゴリごとに処理
for category, match_list in matches_by_category.items():
    match_map = defaultdict(list)

    for match in match_list:
        pair_ids = get_ids(normalize_pair(match["pair"]))
        opponent_ids = get_ids(match["opponents"])
        key = tuple(sorted([pair_ids, opponent_ids]))
        match_map[key].append(match)

    merged_results = []

    for group in match_map.values():
        if len(group) != 2:
            continue

        a, b = group

        entry_a = a["entryNo"]
        entry_b = b["entryNo"]

        merged = {
            "round": a["round"],
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
        }

        merged_results.append(merged)

    merged_results.sort(
        key=lambda m: (
            get_round_order(m["round"]),
            min(m["player1"]["entryNo"], m["player2"]["entryNo"])
        )
    )

    final_results[category] = merged_results

# 結果出力
print(json.dumps(final_results, ensure_ascii=False, indent=2))
