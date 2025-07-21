import json

ENTRIES_PATH = 'entries.json'
MATCHES_PATH = 'matches.json'
OUTPUT_PATH = 'og.json'

def load_entries(entries_path):
    with open(entries_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return {e['entryNo']: e['information'] for e in data['doubles']}

def pair_name(info):
    names = [f"{p['lastName']}{p['firstName']}" for p in info]
    return '・'.join(names)

def pair_team(info):
    teams = list({p['team'] for p in info})  # 重複除去
    return teams[0] if len(teams) == 1 else '・'.join(teams)

def generate_og_data(entries, matches_path):
    with open(matches_path, 'r', encoding='utf-8') as f:
        matches_data = json.load(f)

    matches = matches_data['doubles']
    matches = matches[-7:]  # 準々決勝以降を対象

    top_scores = []
    bottom_scores = []
    left_entry_nos = []
    right_entry_nos = []
    seen = set()

    total_matches = len(matches)
    half = total_matches // 2

    for i, match in enumerate(matches):
        p1 = match['player1']['entryNo']
        p2 = match['player2']['entryNo']

        top_scores.append(str(match['player1']['won']))
        bottom_scores.append(str(match['player2']['won']))

        if len(left_entry_nos) < 4:
            if p1 not in seen:
                left_entry_nos.append(p1)
                seen.add(p1)
            if p2 not in seen:
                left_entry_nos.append(p2)
                seen.add(p2)
        else:
            if p1 not in seen:
                right_entry_nos.append(p1)
                seen.add(p1)
            if p2 not in seen:
                right_entry_nos.append(p2)
                seen.add(p2)

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
    entries = load_entries(ENTRIES_PATH)
    og_data = generate_og_data(entries, MATCHES_PATH)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(og_data, f, ensure_ascii=False, indent=2)
    print(f"✅ og.json を生成しました → {OUTPUT_PATH}")

if __name__ == '__main__':
    main()
