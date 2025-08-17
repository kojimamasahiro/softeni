import json
from collections import OrderedDict

ENTRIES_PATH = 'entries/team-none-girls.json'
MATCHES_PATH = 'matches/team-none-girls.json'
OUTPUT_PATH  = 'og/team-none-girls.json'

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

# ---- 表示用ユーティリティ（doubles）----
def pair_name(info):
    names = [f"{p['lastName']}{p['firstName']}" for p in info]
    return '・'.join(names)

def pair_team(info):
    teams = list(dict.fromkeys(p['team'] for p in info))
    return teams[0] if len(teams) == 1 else '・'.join(teams)

# ---- 表示用ユーティリティ（team）----
def get_team_name(entry):
    return entry.get("team", "")

def get_team_prefecture(entry):
    return entry.get("prefecture", "")

# ---- カテゴリ自動判定 ----
def detect_category(entries_list, matches_list):
    # 1) entriesを優先
    if entries_list:
        e0 = entries_list[0]
        if 'category' in e0 and e0['category'] == 'team':
            return 'team'
        if 'team' in e0 and 'prefecture' in e0 and 'information' not in e0:
            return 'team'
        if 'information' in e0:
            return 'doubles'  # （singlesもinformation 1人で基本同様に扱える）
    # 2) matchesの形で推定（保険）
    if matches_list:
        m0 = matches_list[0]
        if 'team1' in m0 and 'team2' in m0:
            return 'team'
        if 'player1' in m0 and 'player2' in m0:
            return 'doubles'
    # 不明ならdoubles扱い（従来互換）
    return 'doubles'

def generate_og_data(entries_list, matches_list):
    category = detect_category(entries_list, matches_list)

    # ラウンド名 → 順位（大きいほど後の試合）
    round_order = {
        "準々決勝": 1,
        "準決勝":  2,
        "決勝":    3,
    }

    # 対象: 準々決勝・準決勝・決勝（グループは除外）
    matches = [m for m in matches_list if round_order.get(m.get('round'), 0) >= 1]

    # エントリーデータを辞書に
    if category == "team":
        # entries: [{ entryNo, team, prefecture, ... }]
        entries = {
            e['entryNo']: {
                "team": e.get('team', ''),
                "prefecture": e.get('prefecture', '')
            } for e in entries_list
        }
    else:
        # entries: [{ entryNo, information: [...] }]
        entries = {
            e['entryNo']: e['information'] for e in entries_list
        }

    top_scores = []
    bottom_scores = []
    entry_nos = []

    # matches の形が player1/player2 でも team1/team2 でもOKにする
    def get_sides(m):
        if 'team1' in m and 'team2' in m:
            return m['team1'], m['team2']
        else:
            return m['player1'], m['player2']

    for match in matches:
        side1, side2 = get_sides(match)
        p1 = side1['entryNo']
        p2 = side2['entryNo']

        top_scores.append(str(side1['won']))
        bottom_scores.append(str(side2['won']))
        entry_nos.extend([p1, p2])

    # 左右（ベスト8なら左4・右4）に分割
    unique_entry_nos = list(OrderedDict.fromkeys(entry_nos))
    half = len(unique_entry_nos) // 2
    left_entry_nos  = unique_entry_nos[:half]
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
        "leftPairs":  [format_entry(no) for no in left_entry_nos],
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
