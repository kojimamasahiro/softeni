import os
import json
from collections import defaultdict, Counter

# データベース
base_dir = '../../../data/highschool/prefectures'
categories = ['singles', 'doubles', 'team']
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

def get_best_result(entries):
    best_entry = None
    best_rank = default_rank
    for e in entries:
        rank = rank_order.get(e['result'], default_rank)
        if rank < best_rank:
            best_entry = e
            best_rank = rank
    return best_entry

def analyze_team(entries):
    total = 0
    by_cat = defaultdict(int)
    best_results = {}
    player_counter = Counter()

    for e in entries:
        cat = e['category']
        result = e['result']
        total += 1
        by_cat[cat] += 1

        # best result by category
        current_rank = rank_order.get(result, default_rank)
        previous_best = rank_order.get(best_results.get(cat, ''), default_rank)
        if current_rank < previous_best:
            best_results[cat] = result

        # player count（団体戦はスキップ）
        if 'playerIds' in e:
            for pid in e['playerIds']:
                player_counter[pid] += 1

    # 最新年度を判定
    latest_year = max(e["year"] for e in entries)
    latest_entries = [e for e in entries if e["year"] == latest_year]
    past_entries = [e for e in entries if e["year"] <= latest_year]

    latest_best = get_best_result(latest_entries)
    past_best = get_best_result(past_entries)

    return {
        "totalAppearances": total,
        "byCategory": dict(by_cat),
        "bestResults": best_results,
        "latestResult": latest_best,
        "historicalBest": past_best,
        "uniquePlayers": len(player_counter),
        "topPlayers": [
            {"id": pid, "appearances": count}
            for pid, count in player_counter.most_common(5)
        ]
    }

# メイン処理
for prefecture_id in os.listdir(base_dir):
    pref_dir = os.path.join(base_dir, prefecture_id)
    summary_path = os.path.join(pref_dir, 'summary.json')
    if not os.path.exists(summary_path):
        continue

    with open(summary_path, 'r', encoding='utf-8') as f:
        summary = json.load(f)

    # teamId ごとにグループ化
    grouped = defaultdict(list)
    for item in summary:
        grouped[item['teamId']].append(item)

    # 各チームに対して analysis.json を生成
    for team_id, entries in grouped.items():
        team_dir = os.path.join(pref_dir, team_id)
        os.makedirs(team_dir, exist_ok=True)

        analysis = analyze_team(entries)
        analysis_path = os.path.join(team_dir, 'analysis.json')
        with open(analysis_path, 'w', encoding='utf-8') as f:
            json.dump(analysis, f, ensure_ascii=False, indent=2)

        print(f"✅ {analysis_path} を生成しました")
