import json

ENTRIES_PATH = "entries.json"
MATCHES_PATH = "matches.json"
RESULTS_PATH = "results.json"

ROUND_TO_RESULT = {
    "決勝": "準優勝",
    "準決勝": "ベスト4",
    "準々決勝": "ベスト8",
    "6回戦": "6回戦敗退",
    "5回戦": "5回戦敗退",
    "4回戦": "4回戦敗退",
    "3回戦": "3回戦敗退",
    "2回戦": "2回戦敗退",
    "1回戦": "1回戦敗退",
}

def is_tournament_round(round_name: str) -> bool:
    return round_name in ROUND_TO_RESULT or round_name == "決勝"

def determine_results(entries, matches):
    results = []

    # カテゴリ形式でなければ "default" カテゴリに包む
    if isinstance(entries, list):
        entries = { "default": entries }
    if isinstance(matches, list):
        matches = { "default": matches }

    for category in entries.keys():
        entry_map = {
            entry["entryNo"]: entry["information"]
            for entry in entries.get(category, [])
        }

        last_round_played = {}
        lost_flag = set()
        tournament_participants = set()
        all_played_entries = set()

        for match in matches.get(category, []):
            round_name = match["round"]
            p1 = match["player1"]["entryNo"]
            p2 = match["player2"]["entryNo"]
            winner = match["winner"]
            loser = p2 if winner == p1 else p1

            all_played_entries.update([p1, p2])

            if not is_tournament_round(round_name):
                continue

            tournament_participants.update([p1, p2])
            last_round_played[p1] = round_name
            last_round_played[p2] = round_name
            lost_flag.add(loser)

        for entry_no, info in entry_map.items():
            player_ids = [
                f"{p['lastName']}_{p['firstName']}_{p['team']}"
                for p in info
            ]

            if entry_no in tournament_participants:
                round_played = last_round_played.get(entry_no)
                if round_played == "決勝" and entry_no not in lost_flag:
                    result = "優勝"
                else:
                    result = ROUND_TO_RESULT.get(round_played, "不明")
            elif entry_no in all_played_entries:
                result = "予選敗退"
            else:
                result = "未出場"

            result_entry = {
                "playerIds": player_ids,
                "result": result,
            }
            if category != "default":
                result_entry["category"] = category

            results.append(result_entry)

    return results

def main():
    with open(ENTRIES_PATH, "r", encoding="utf-8") as f:
        entries = json.load(f)
    with open(MATCHES_PATH, "r", encoding="utf-8") as f:
        matches = json.load(f)

    output = {
        "results": determine_results(entries, matches)
    }

    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"✅ {RESULTS_PATH} を生成しました。")

if __name__ == "__main__":
    main()
