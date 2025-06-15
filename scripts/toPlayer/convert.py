import json
import os

# 設定値
TOURNAMENT_ID = "zennihon-mix-doubles"
YEAR = 2025
TOURNAMENT_NAME = "第6回 全日本ミックスダブルス選手権大会"
DATE_RANGE = "2025年6月14日(土)〜15日(日)"
LOCATION = "広島県"
LINK = ""
FORMAT = "tournament"

# パス
tournament_path = f"../../data/tournaments/{TOURNAMENT_ID}/{YEAR}/results.json"
players_dir = "../../data/players"

# ラウンド順位定義
def round_rank(round_name):
    round_order = [
        "1回戦", "2回戦", "3回戦", "4回戦", "5回戦",
        "6回戦", "7回戦", "8回戦", "9回戦",
        "準々決勝", "準決勝", "決勝"
    ]
    return round_order.index(round_name) if round_name in round_order else -1

# finalResult 自動決定
def determine_final_result(results):
    sorted_results = sorted(results, key=lambda r: round_rank(r["round"]), reverse=True)
    top_result = sorted_results[0] if sorted_results else None
    if not top_result:
        return None
    if top_result["round"] == "決勝":
        return "優勝" if top_result["result"] == "勝ち" else "準優勝"
    elif top_result["round"] == "準決勝" and top_result["result"] == "負け":
        return "ベスト4"
    elif top_result["round"] == "準々決勝" and top_result["result"] == "負け":
        return "ベスト8"
    elif "回戦" in top_result["round"] and top_result["result"] == "負け":
        return top_result["round"] + "敗退"
    else:
        return None

# トーナメントデータ読み込み
if not os.path.exists(tournament_path):
    print(f"[ERROR] ファイルが存在しません: {tournament_path}")
    exit(1)

with open(tournament_path, "r", encoding="utf-8") as f:
    tournament_data = json.load(f)

# 各試合を処理
for match in tournament_data["matches"]:
    pair_ids = match["pair"]
    opponent_display = "・".join([
        f'{op["lastName"]}（{op["team"]}）' for op in match["opponents"]
    ])
    score_str = f'{match["games"]["won"]}-{match["games"]["lost"]}'
    result_str = "勝ち" if match["result"] == "win" else "負け"

    for i, player_id in enumerate(pair_ids):
        if not player_id:
            continue

        player_dir = os.path.join(players_dir, player_id)
        if not os.path.isdir(player_dir):
            continue

        player_path = os.path.join(player_dir, "results.json")
        if os.path.exists(player_path):
            with open(player_path, "r", encoding="utf-8") as f:
                player_data = json.load(f)
        else:
            player_data = {"matches": []}

        raw_partner = pair_ids[1 - i]
        if os.path.isdir(os.path.join(players_dir, raw_partner)):
            partner = raw_partner  # playerId として存在
        else:
            parts = raw_partner.split("_")
            partner = f"{parts[0]} {parts[1]}" if len(parts) >= 2 else raw_partner

        match_result = {
            "round": match["round"],
            "opponent": opponent_display,
            "opponents": [
                {
                    "name": op["lastName"],
                    "team": op["team"],
                    "playerId": op.get("playerId")
                }
                for op in match["opponents"]
            ],
            "result": result_str,
            "score": score_str,
            "games": {
                "won": int(match["games"]["won"]),
                "lost": int(match["games"]["lost"])
            }
        }

        # 大会エントリを探す or 作成
        existing_match = next((m for m in player_data["matches"] if m["tournament"] == TOURNAMENT_NAME), None)
        if existing_match:
            existing_match["results"].append(match_result)
            # 昇順ソート
            existing_match["results"].sort(key=lambda r: round_rank(r["round"]))
            existing_match["finalResult"] = determine_final_result(existing_match["results"])
        else:
            new_entry = {
                "tournament": TOURNAMENT_NAME,
                "dateRange": DATE_RANGE,
                "location": LOCATION,
                "link": LINK,
                "format": FORMAT,
                "finalResult": None,
                "partner": partner,
                "groupStage": None,
                "finalStage": None,
                "results": [match_result]
            }
            new_entry["finalResult"] = determine_final_result(new_entry["results"])
            player_data["matches"].insert(0, new_entry)

        # 保存
        with open(player_path, "w", encoding="utf-8") as f:
            json.dump(player_data, f, ensure_ascii=False, indent=2)
