import json
from pathlib import Path

# プレイヤーID一覧
player_ids = [
    "kurosaka-takuya",
    "kataoka-aki",
    # 必要に応じて追加
]

def validate_analysis(player_id):
    analysis_path = Path(f"data/players/{player_id}/analysis.json")
    results_path = Path(f"data/players/{player_id}/results.json")

    if not analysis_path.exists() or not results_path.exists():
        print(f"[!] {player_id} のファイルが存在しません")
        return False

    with analysis_path.open(encoding="utf-8") as f:
        analysis = json.load(f)

    with results_path.open(encoding="utf-8") as f:
        matches = json.load(f).get("matches", [])

    # カウント再集計
    match_count = 0
    win_count = 0
    game_total = 0
    game_won = 0

    def count_from(results):
        nonlocal match_count, win_count, game_total, game_won
        for result in results:
            match_count += 1
            if result.get("result") == "勝ち":
                win_count += 1
            games = result.get("games", {})
            game_total += games.get("won", 0) + games.get("lost", 0)
            game_won += games.get("won", 0)

    for m in matches:
        if m.get("results"):
            count_from(m["results"])
        if m.get("groupStage") and m["groupStage"].get("results"):
            count_from(m["groupStage"]["results"])
        if m.get("finalStage") and m["finalStage"].get("results"):
            count_from(m["finalStage"]["results"])

    errors = []

    if match_count != analysis["totalMatches"]:
        errors.append(f"totalMatches: expected {match_count}, found {analysis['totalMatches']}")
    if win_count != analysis["wins"]:
        errors.append(f"wins: expected {win_count}, found {analysis['wins']}")
    expected_win_rate = round(win_count / match_count, 3) if match_count > 0 else 0
    if abs(analysis["totalWinRate"] - expected_win_rate) > 0.001:
        errors.append(f"totalWinRate: expected {expected_win_rate}, found {analysis['totalWinRate']}")

    if errors:
        print(f"[✗] {player_id} にエラーがあります:")
        for e in errors:
            print("    -", e)
        return False
    else:
        print(f"[✓] {player_id} は正常です")
        return True

if __name__ == "__main__":
    all_passed = True
    for pid in player_ids:
        ok = validate_analysis(pid)
        all_passed = all_passed and ok

    if all_passed:
        print("\n✅ すべてのプレイヤーの analysis.json は正しく集計されています。")
    else:
        print("\n⚠️ 一部にエラーがあります。詳細をご確認ください。")
