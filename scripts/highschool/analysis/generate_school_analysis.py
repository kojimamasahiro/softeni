import os
import json
from collections import defaultdict, Counter
from datetime import datetime

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
    best_year = -1

    for e in entries:
        rank = rank_order.get(e['result'], default_rank)
        year = e.get('year', 0)
        if (
            rank < best_rank or
            (rank == best_rank and year > best_year)
        ):
            best_entry = e
            best_rank = rank
            best_year = year

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

        # best result by category（rankが同じなら year が新しい方）
        current_rank = rank_order.get(result, default_rank)
        prev_result = best_results.get(cat)
        prev_rank = rank_order.get(prev_result, default_rank)
        prev_year = next(
            (en["year"] for en in entries if en["result"] == prev_result and en["category"] == cat),
            -1,
        )
        if (
            current_rank < prev_rank or
            (current_rank == prev_rank and e["year"] > prev_year)
        ):
            best_results[cat] = result

        # player count（団体戦はスキップ）
        if 'playerIds' in e:
            for pid in e['playerIds']:
                player_counter[pid] += 1

    this_year = datetime.now().year
    recently_entries = [e for e in entries if e["year"] >= this_year - 2]
    past_entries = [e for e in entries if e["year"] <= this_year]

    recently_best = get_best_result(recently_entries)
    past_best = get_best_result(past_entries)

    return {
        "totalAppearances": total,
        "byCategory": dict(by_cat),
        "bestResults": best_results,
        "recentlyResult": recently_best,
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
