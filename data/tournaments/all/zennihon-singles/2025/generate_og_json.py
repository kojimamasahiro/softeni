import json
from collections import OrderedDict

ENTRIES_PATH = 'entries/singles-none-girls.json'
MATCHES_PATH = 'matches/singles-none-girls.json'
OUTPUT_PATH = 'og/singles-none-girls.json'

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def pair_name(info):
    names = [f"{p['lastName']}{p['firstName']}" for p in info]
    return '・'.join(names)

def pair_team(info):
    teams = list(dict.fromkeys(p['team'] for p in info))
    return teams[0] if len(teams) == 1 else '・'.join(teams)

def get_team_name(entry):
    return entry.get("team", "")

def get_team_prefecture(entry):
    return entry.get("prefecture", "")

def detect_category(matches):
    sample = matches[0]
    if "player1" in sample:
        return "doubles"  # または "singles"
    elif "team1" in sample:
        return "team"
    else:
        raise ValueError("未知のカテゴリ形式")

def generate_og_data(entries_list, matches_list):
    category = "doubles"

    # ラウンド名 → 順位のマッピング（大きいほど後の試合）
    round_order = {
        "準々決勝": 1,
        "準決勝": 2,
        "決勝": 3
    }

    # 対象ラウンド（準々決勝・準決勝・決勝）
    matches = [m for m in matches_list if round_order.get(m['round'], 0) >= 1]

    # エントリーデータを辞書に変換
    if category == "team":
        entries = {
            e['entryNo']: {
                "team": e.get('team', ''),
                "prefecture": e.get('prefecture', '')
            } for e in entries_list
        }
    else:
        entries = {
            e['entryNo']: e['information'] for e in entries_list
        }

    top_scores = []
    bottom_scores = []
    entry_nos = []

    for match in matches:
        if category == "team":
            p1 = match['team1']['entryNo']
            p2 = match['team2']['entryNo']
            top_scores.append(str(match['team1']['won']))
            bottom_scores.append(str(match['team2']['won']))
        else:
            p1 = match['player1']['entryNo']
            p2 = match['player2']['entryNo']
            top_scores.append(str(match['player1']['won']))
            bottom_scores.append(str(match['player2']['won']))
        entry_nos.extend([p1, p2])

    unique_entry_nos = list(OrderedDict.fromkeys(entry_nos))
    half = len(unique_entry_nos) // 2
    left_entry_nos = unique_entry_nos[:half]
    right_entry_nos = unique_entry_nos[half:]

    if category == "team":
        def format_entry(no):
            return {
                "name": get_team_name(entries[no]),
                "team": get_team_prefecture(entries[no])
            }
    else:
        def format_entry(no):
            return {
                "name": pair_name(entries[no]),
                "team": pair_team(entries[no])
            }

    return {
        "leftPairs": [format_entry(no) for no in left_entry_nos],
        "rightPairs": [format_entry(no) for no in right_entry_nos],
        "topScores": top_scores,
        "bottomScores": bottom_scores
    }

def main():
    entries_list = load_json(ENTRIES_PATH)
    matches_list = load_json(MATCHES_PATH)
    og_data = generate_og_data(entries_list, matches_list)

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(og_data, f, ensure_ascii=False, indent=2)

    print(f"✅ og.json を生成しました → {OUTPUT_PATH}")

if __name__ == '__main__':
    main()
