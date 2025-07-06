#  % python3 scripts/generate_analysis.py
import json
from collections import defaultdict
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def parse_date(date_str):
    for fmt in ("%Y年%m月%d日", "%Y/%m/%d"):
        try:
            return datetime.strptime(date_str, fmt)
        except:
            continue
    return None

def extract_fiscal_year(date_range):
    if not date_range:
        return None
    try:
        date_str = date_range.split("~")[0].split("(")[0].strip()
        date = parse_date(date_str)
        if not date:
            return None
        fiscal_year = date.year if date.month >= 4 else date.year - 1
        return fiscal_year
    except:
        return None

def analyze_matches(matches_data):
    total_matches = 0
    total_wins = 0
    total_losses = 0
    total_games = 0
    total_games_won = 0
    total_games_lost = 0

    by_partner = defaultdict(lambda: {
        "matches": {"total": 0, "wins": 0, "losses": 0, "winRate": 0},
        "games": {"total": 0, "won": 0, "lost": 0, "gameRate": 0}
    })

    by_year = defaultdict(lambda: {
        "matches": {"total": 0, "wins": 0, "losses": 0, "winRate": 0},
        "games": {"total": 0, "won": 0, "lost": 0, "gameRate": 0}
    })

    for match in matches_data:
        partner = match.get("partner") or "シングルス"
        year = extract_fiscal_year(match.get("dateRange")) or "不明"

        def process_result(result):
            nonlocal total_matches, total_wins, total_losses, total_games, total_games_won, total_games_lost

            total_matches += 1
            by_partner[partner]["matches"]["total"] += 1
            by_year[year]["matches"]["total"] += 1

            result_str = result.get("result")
            if result_str == "勝ち":
                total_wins += 1
                by_partner[partner]["matches"]["wins"] += 1
                by_year[year]["matches"]["wins"] += 1
            elif result_str == "負け":
                total_losses += 1
                by_partner[partner]["matches"]["losses"] += 1
                by_year[year]["matches"]["losses"] += 1

            games = result.get("games", {})
            won = int(games.get("won", 0))  # 数値型に変換
            lost = int(games.get("lost", 0))  # 数値型に変換
            total_game = won + lost

            total_games += total_game
            total_games_won += won
            total_games_lost += lost

            by_partner[partner]["games"]["total"] += total_game
            by_partner[partner]["games"]["won"] += won
            by_partner[partner]["games"]["lost"] += lost

            by_year[year]["games"]["total"] += total_game
            by_year[year]["games"]["won"] += won
            by_year[year]["games"]["lost"] += lost

        # results（通常のトーナメント）
        if match.get("results"):
            for result in match["results"]:
                process_result(result)

        # ラウンドロビン形式
        if match.get("groupStage") and match["groupStage"].get("results"):
            for result in match["groupStage"]["results"]:
                process_result(result)

        # 決勝トーナメント
        if match.get("finalStage") and match["finalStage"].get("results"):
            for result in match["finalStage"]["results"]:
                process_result(result)

    def calc_rate(wins, total):
        return round(wins / total, 3) if total > 0 else 0

    overall = {
        "totalMatches": total_matches,
        "wins": total_wins,
        "losses": total_losses,
        "totalWinRate": calc_rate(total_wins, total_matches),
        "games": {
            "total": total_games,
            "won": total_games_won,
            "lost": total_games_lost,
            "gameRate": calc_rate(total_games_won, total_games)
        },
        "byPartner": {},
        "byYear": {}
    }

    for partner, stats in by_partner.items():
        stats["matches"]["winRate"] = calc_rate(stats["matches"]["wins"], stats["matches"]["total"])
        stats["games"]["gameRate"] = calc_rate(stats["games"]["won"], stats["games"]["total"])
        overall["byPartner"][partner] = stats

    for year, stats in by_year.items():
        stats["matches"]["winRate"] = calc_rate(stats["matches"]["wins"], stats["matches"]["total"])
        stats["games"]["gameRate"] = calc_rate(stats["games"]["won"], stats["games"]["total"])
        overall["byYear"][str(year)] = stats

    return overall


if __name__ == "__main__":
    # プレイヤーのIDリスト
    player_ids = [
        "yano-soto",
        "kawasaki-kohei",
        "kataoka-aki",
        "marunaka-taimei",
        "hashimoto-asahi",
        "uchimoto-takafumi",
        "kurosaka-takuya",
        "hashiba-toichiro",
        "funemizu-hayato",
        "hirooka-sora",
        "nagae-koichi",
        "maruyama-kaito",
        "ando-yusaku",
        "uematsu-toshiki",
        "yonekawa-yuto",
        "motokura-kentaro",
        "uchida-riku",
        "ueoka-shunsuke",
        "ando-kesuke",
        "ueda-rio",
        "iwata-kohei",
        "shimizu-shun",
    ]

    # 各選手のデータに対して処理
    for player_id in player_ids:
        input_file = BASE_DIR / "../data" / "players" / player_id / "results.json"
        output_file = BASE_DIR / "../data" / "players" / player_id / "analysis.json"

        if not input_file.exists():
            print(f"[!] {input_file} が見つかりません")
            continue

        with input_file.open(encoding="utf-8") as f:
            data = json.load(f)

        result = analyze_matches(data.get("matches", []))

        latest_match = data.get("matches", [])[0] if data.get("matches") else None
        if latest_match:
            result["latestMatch"] = {
                "tournament": latest_match.get("tournament"),
                "date": latest_match.get("dateRange"),
                "location": latest_match.get("location"),
                "partner": latest_match.get("partner"),
                "result": latest_match.get("finalResult"),
                "summary": data.get("highlight") or f"{latest_match.get('tournament')}で{latest_match.get('finalResult')}を記録",
                "link": latest_match.get("link"),
            }

        with output_file.open("w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        print(f"[✓] {player_id} の analysis.json を出力しました")
