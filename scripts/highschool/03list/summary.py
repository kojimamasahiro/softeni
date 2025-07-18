import json

# ファイルパス
results_path = "../02result/results.json"
teams_path = "../01team/teams.json"
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

# 各結果ごとにすべての記録を追加
for item in results_data["results"]:
    result = item["result"]
    category = item.get("category", "default")

    # 団体戦: teamキーから
    if category == "team":
        team_name = item["team"]
        team_info = team_map.get(team_name)
        if not team_info:
            continue

        entry_obj = {
            "team": team_name,
            "teamId": team_info["teamId"],
            "prefecture": team_info["prefecture"],
            "prefectureId": team_info["prefectureId"],
            "result": result,
            "category": category,
            "tournamentId": "highschool-championship",  # 固定値
            "year": 2021
        }

    # 個人戦: playerIds → team名を抽出
    else:
        player_ids = item["playerIds"]
        team_names = {pid.split("_")[2] for pid in player_ids}

        for team_name in team_names:
            team_info = team_map.get(team_name)
            if not team_info:
                continue

            entry_obj = {
                "team": team_name,
                "teamId": team_info["teamId"],
                "prefecture": team_info["prefecture"],
                "prefectureId": team_info["prefectureId"],
                "result": result,
                "category": category,
                "tournamentId": "highschool-japan-cup",  # 固定値
                "year": 2023,
                "playerIds": player_ids
            }

            summary_list.append(entry_obj)

        continue  # 次のループへ

    # 団体戦エントリを追加
    summary_list.append(entry_obj)

# ✅ 都道府県 × カテゴリごとにすべてのチームを抽出
prefecture_order = [p["id"] for p in prefecture_data]
final_list = []

for pref_id in prefecture_order:
    for category in ["singles", "doubles", "team"]:
        teams = [e for e in summary_list if e["prefectureId"] == pref_id and e["category"] == category]
        if not teams:
            continue
        final_list.extend(teams)

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

print(f"✅ '{output_path}' を生成しました（都道府県 × 種目ごと、playerIds付き）。")
