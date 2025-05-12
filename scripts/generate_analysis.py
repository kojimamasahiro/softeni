import json
from collections import defaultdict
from pathlib import Path

# 勝敗判定関数
def is_win(result):
    return result.strip() == "勝ち"

# プレイヤーのIDリスト
player_ids = [
    "uematsu-toshiki"
]

# 各選手のデータに対して処理を行う
for player_id in player_ids:
    input_file = Path(f"data/players/{player_id}/results.json")
    output_file = Path(f"data/players/{player_id}/analysis.json")

    # データ読み込み
    with input_file.open(encoding="utf-8") as f:
        data = json.load(f)

    # 分析用データ構造の初期化
    total_matches = 0
    wins = 0
    losses = 0
    partner_stats = defaultdict(lambda: {"matches": {"total": 0, "wins": 0, "losses": 0, "winRate": 0.0}, "games": {"total": 0, "won": 0, "lost": 0, "gameRate": 0.0}})
    year_stats = defaultdict(lambda: {"matches": {"total": 0, "wins": 0, "losses": 0, "winRate": 0.0}, "games": {"total": 0, "won": 0, "lost": 0, "gameRate": 0.0}})

    # 各試合の処理
    for match in data.get("matches", []):
        year = match.get("year", "不明")
        partner = match.get("partner") or "シングルス"

        # groupStage, finalStage, top-level results に対応
        results_sources = []

        # それぞれのステージ（groupStage, finalStage）での結果を集める
        for stage_name in ["groupStage", "finalStage"]:
            stage = match.get(stage_name)
            if stage and "results" in stage:
                results_sources.append(stage["results"])

        # top-level results の処理
        if "results" in match:
            results_sources.append(match["results"])

        for results in results_sources:
            for game in results:
                result = game.get("result")
                if result not in ["勝ち", "負け"]:
                    continue

                total_matches += 1
                win_flag = is_win(result)
                if win_flag:
                    wins += 1
                else:
                    losses += 1

                # パートナーごとの集計
                partner_stats[partner]["matches"]["total"] += 1
                partner_stats[partner]["games"]["total"] += 1
                if win_flag:
                    partner_stats[partner]["matches"]["wins"] += 1
                    partner_stats[partner]["games"]["won"] += 1
                else:
                    partner_stats[partner]["matches"]["losses"] += 1
                    partner_stats[partner]["games"]["lost"] += 1

                # 年度ごとの集計
                year_stats[year]["matches"]["total"] += 1
                year_stats[year]["games"]["total"] += 1
                if win_flag:
                    year_stats[year]["matches"]["wins"] += 1
                    year_stats[year]["games"]["won"] += 1
                else:
                    year_stats[year]["matches"]["losses"] += 1
                    year_stats[year]["games"]["lost"] += 1

    # totalWinRate を計算
    total_win_rate = round(wins / total_matches, 3) if total_matches else 0.0

    # partner_stats と year_stats の各項目で winRate と gameRate を計算
    for partner, stats in partner_stats.items():
        stats["matches"]["winRate"] = round(stats["matches"]["wins"] / stats["matches"]["total"], 3) if stats["matches"]["total"] else 0.0
        stats["games"]["gameRate"] = round(stats["games"]["won"] / stats["games"]["total"], 3) if stats["games"]["total"] else 0.0

    for year, stats in year_stats.items():
        stats["matches"]["winRate"] = round(stats["matches"]["wins"] / stats["matches"]["total"], 3) if stats["matches"]["total"] else 0.0
        stats["games"]["gameRate"] = round(stats["games"]["won"] / stats["games"]["total"], 3) if stats["games"]["total"] else 0.0

    # 出力データ構築
    analysis_data = {
        "totalMatches": total_matches,
        "wins": wins,
        "losses": losses,
        "totalWinRate": total_win_rate,  # totalWinRate を追加
        "byPartner": partner_stats,
        "byYear": year_stats,
    }

    # デフォルト辞書を通常の辞書に変換して保存
    def dictify(d):
        return {k: dict(v) for k, v in d.items()}

    analysis_data["byPartner"] = dictify(analysis_data["byPartner"])
    analysis_data["byYear"] = dictify(analysis_data["byYear"])

    # 保存
    with output_file.open("w", encoding="utf-8") as f:
        json.dump(analysis_data, f, ensure_ascii=False, indent=2)

    print(f"{player_id} の分析結果が {output_file} に保存されました。")
