import os
import json
from collections import defaultdict, Counter
from datetime import datetime
import pathlib

# inferred-team-aliases.json を読み込んでエイリアス->正規名マップを作る
aliases_path = pathlib.Path(__file__).resolve().parents[1] / '03list' / 'inferred-team-aliases.json'
alias_map = {}
alias_match_order = []
if aliases_path.exists():
    try:
        with open(aliases_path, 'r', encoding='utf-8') as f:
            alias_list = json.load(f)
        for item in alias_list:
            canonical = item.get('canonical')
            for a in item.get('aliases', []) or []:
                alias_map[a] = canonical
        # 長いエイリアスからマッチするようソート（部分一致の衝突を避ける）
        alias_match_order = sorted(alias_map.keys(), key=lambda s: -len(s))
    except Exception:
        alias_map = {}
        alias_match_order = []


def normalize_prefecture_suffix(suffix: str, canonical_prefecture: str) -> str:
    if not canonical_prefecture:
        return suffix
    if suffix == canonical_prefecture:
        return suffix

    def strip_suffix(name: str) -> str:
        return name.replace('県', '').replace('府', '').replace('都', '').replace('道', '')

    if strip_suffix(suffix) == strip_suffix(canonical_prefecture):
        return canonical_prefecture

    return suffix


def normalize_player_school(player_id: str, entry: dict) -> str:
    if not alias_map or '_' not in player_id:
        return player_id

    head, suffix = player_id.rsplit('_', 1)
    if '_' not in head:
        return player_id

    name_part, school_part = head.rsplit('_', 1)
    normalized_school = school_part
    for alias in alias_match_order:
        if alias == school_part:
            normalized_school = alias_map.get(alias, school_part)
            break

    normalized_prefecture = normalize_prefecture_suffix(
        suffix,
        entry.get('prefecture', '')
    )

    return f"{name_part}_{normalized_school}_{normalized_prefecture}"

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

def visible_genders(entry_gender):
    if entry_gender == 'mixed':
        return ['boys', 'girls']
    if entry_gender in ('boys', 'girls'):
        return [entry_gender]
    return []

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
    player_counter = Counter()

    this_year = datetime.now().year
    results_by_category = {}

    for cat in categories:
        entries_cat = [e for e in entries if e["category"] == cat]

        recently_entries = [e for e in entries_cat if e["year"] >= this_year - 2]
        past_entries = [e for e in entries_cat if e["year"] <= this_year]

        recently_best = get_best_result(recently_entries)
        historical_best = get_best_result(past_entries)

        results_by_category[cat] = {
            "recentlyResult": recently_best,
            "historicalBest": historical_best,
        }

    # その他処理
    for e in entries:
        cat = e['category']
        total += 1
        by_cat[cat] += 1

        if 'playerIds' in e:
            for pid in e['playerIds']:
                # playerId の中の学校名の揺れを吸収して正規化する
                normalized = normalize_player_school(pid, e)
                player_counter[normalized] += 1

    return {
        "totalAppearances": total,
        "byCategory": dict(by_cat),
        "resultsByCategory": results_by_category,
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

    # teamId と gender ごとにグループ化
    # mixed は boys / girls の両方に含める
    grouped = defaultdict(lambda: defaultdict(list))
    for item in summary:
        team_id = item['teamId']
        gender = item.get('gender', 'unknown')
        for visible_gender in visible_genders(gender):
            grouped[team_id][visible_gender].append(item)

    # 各チーム・性別に対して analysis.json を生成
    for team_id, gender_data in grouped.items():
        for gender, entries in gender_data.items():
            team_gender_dir = os.path.join(pref_dir, team_id, gender)
            os.makedirs(team_gender_dir, exist_ok=True)

            analysis = analyze_team(entries)
            analysis_path = os.path.join(team_gender_dir, 'analysis.json')
            with open(analysis_path, 'w', encoding='utf-8') as f:
                json.dump(analysis, f, ensure_ascii=False, indent=2)

            print(f"✅ {analysis_path} を生成しました")
