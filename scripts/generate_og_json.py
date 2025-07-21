import json
from collections import OrderedDict

ENTRIES_PATH = 'entries.json'
MATCHES_PATH = 'matches.json'
OUTPUT_PATH = 'og.json'

def detect_category(matches_path):
    with open(matches_path, 'r', encoding='utf-8') as f:
        matches_data = json.load(f)
    return next(iter(matches_data.keys()))  # 'singles' or 'doubles'

def load_entries(entries_path, category):
    with open(entries_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return {e['entryNo']: e['information'] for e in data[category]}

def pair_name(info):
    names = [f"{p['lastName']}{p['firstName']}" for p in info]
    return '・'.join(names)

def pair_team(info):
    teams = list(dict.fromkeys(p['team'] for p in info))  # 順序保持＋重複除去
    return teams[0] if len(teams) == 1 else '・'.join(teams)

def generate_og_data(entries, matches_path, category):
    with open(matches_path, 'r', encoding='utf-8') as f:
        matches_data = json.load(f)

    matches = matches_data[category][-7:]  # 準々決勝以降

    top_scores = []
    bottom_scores = []
    entry_nos = []

    for match in matches:
        p1 = match['player1']['entryNo']
        p2 = match['player2']['entryNo']

        top_scores.append(str(match['player1']['won']))
        bottom_scores.append(str(match['player2']['won']))

        entry_nos.extend([p1, p2])

    unique_entry_nos = list(OrderedDict.fromkeys(entry_nos))
    half = len(unique_entry_nos) // 2
    left_entry_nos = unique_entry_nos[:half]
    right_entry_nos = unique_entry_nos[half:]

    return {
        "leftPairs": [
            {
                "name": pair_name(entries[no]),
                "team": pair_team(entries[no])
            } for no in left_entry_nos
        ],
        "rightPairs": [
            {
                "name": pair_name(entries[no]),
                "team": pair_team(entries[no])
            } for no in right_entry_nos
        ],
        "topScores": top_scores,
        "bottomScores": bottom_scores
    }

def main():
    category = detect_category(MATCHES_PATH)
    entries = load_entries(ENTRIES_PATH, category)
    og_data = generate_og_data(entries, MATCHES_PATH, category)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(og_data, f, ensure_ascii=False, indent=2)
    print(f"✅ og.json を生成しました → {OUTPUT_PATH}")

if __name__ == '__main__':
    main()
