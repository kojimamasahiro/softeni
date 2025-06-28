import json

# ファイルパス
results_path = "../result/results.json"
teams_path = "../team/teams.json"
prefecture_path = "../prefectures.json"
output_path = "prefecture-summary.json"

# 成績の優劣順位
rank_order = {
    "優勝": 1,
    "準優勝": 2,
    "ベスト4": 3,
    "ベスト8": 4,
    "6回戦敗退": 5,
    "5回戦敗退": 6,
    "4回戦敗退": 7,
    "3回戦敗退": 8,
    "2回戦敗退": 9,
    "1回戦敗退": 10,
    "予選敗退": 11,
    "未出場": 12,
}
default_rank = 999

# データ読み込み
with open(results_path, "r", encoding="utf-8") as f:
    results_data = json.load(f)

with open(teams_path, "r", encoding="utf-8") as f:
    teams_data = json.load(f)

with open(prefecture_path, "r", encoding="utf-8") as f:
    prefecture_data = json.load(f)

# 都道府県名 → id マップ
pref_name_to_id = {p["name"]: p["id"] for p in prefecture_data}

# チーム名 → {teamId, prefectureId} マップ
team_map = {}
for team in teams_data:
    team_name = team["name"]
    pref_name = team["prefecture"]
    pref_id = pref_name_to_id.get(pref_name)
    if pref_id:
        team_map[team_name] = {
            "teamId": team["id"],
            "prefectureId": pref_id,
            "prefecture": pref_name
        }

# 中間リスト
summary_list = []
best_ranks = {}

# 各結果ごとに最上位記録を更新
for item in results_data["results"]:
    player_ids = item["playerIds"]
    result = item["result"]
    category = item["category"]

    team_names = {pid.split("_")[2] for pid in player_ids}

    for team_name in team_names:
        team_info = team_map.get(team_name)
        if not team_info:
            continue

        team_id = team_info["teamId"]
        prefecture = team_info["prefecture"]
        prefecture_id = team_info["prefectureId"]

        current_rank = rank_order.get(result, default_rank)
        best_rank = best_ranks.get((team_id, category), default_rank)

        entry_obj = {
            "team": team_name,
            "teamId": team_id,
            "prefecture": prefecture,
            "prefectureId": prefecture_id,
            "result": result,
            "category": category,
            "tournamentId": "highschool-japan-cup",
            "year": 2025
        }

        if current_rank < best_rank:
            best_ranks[(team_id, category)] = current_rank
            summary_list = [e for e in summary_list if not (e["teamId"] == team_id and e["category"] == category)]
            summary_list.append(entry_obj)
        elif current_rank == best_rank:
            if not any(e["teamId"] == team_id and e["category"] == category for e in summary_list):
                summary_list.append(entry_obj)

# ✅ 都道府県 × カテゴリごとに最上位のチームだけを抽出
prefecture_order = [p["id"] for p in prefecture_data]
final_list = []

for pref_id in prefecture_order:
    for category in ["singles", "doubles", "team"]:
        teams = [e for e in summary_list if e["prefectureId"] == pref_id and e["category"] == category]
        if not teams:
            continue

        min_rank = min(rank_order.get(t["result"], default_rank) for t in teams)
        top_teams = [t for t in teams if rank_order.get(t["result"], default_rank) == min_rank]
        final_list.extend(top_teams)

# ✅ 並び替え
category_order = {"team": 0, "doubles": 1, "singles": 2}
final_list.sort(
    key=lambda x: (
        prefecture_order.index(x["prefectureId"]) if x["prefectureId"] in prefecture_order else 999,
        category_order.get(x["category"], 9),
        x["teamId"]
    )
)

# 保存
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(final_list, f, ensure_ascii=False, indent=2)

print(f"✅ '{output_path}' を生成しました（都道府県 × 種目ごと最上位のみ）。")
