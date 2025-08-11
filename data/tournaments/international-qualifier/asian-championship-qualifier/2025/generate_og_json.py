import json
from collections import OrderedDict

ENTRIES_PATH = 'entries/doubles-none-boys.json'
MATCHES_PATH = 'matches/doubles-none-boys.json'
OUTPUT_PATH = 'og/doubles-none-boys.json'

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

def winner_entry_no(match, category="doubles"):
    if category == "team":
        w1 = int(match['team1'].get('won', 0) or 0)
        w2 = int(match['team2'].get('won', 0) or 0)
        return match['team1']['entryNo'] if w1 >= w2 else match['team2']['entryNo']
    else:
        w1 = int(match['player1'].get('won', 0) or 0)
        w2 = int(match['player2'].get('won', 0) or 0)
        return match['player1']['entryNo'] if w1 >= w2 else match['player2']['entryNo']

def participants_entry_nos(match, category="doubles"):
    if category == "team":
        return [match['team1']['entryNo'], match['team2']['entryNo']]
    else:
        return [match['player1']['entryNo'], match['player2']['entryNo']]

def match_scores(match, category="doubles"):
    if category == "team":
        return str(match['team1'].get('won', '')), str(match['team2'].get('won', ''))
    else:
        return str(match['player1'].get('won', '')), str(match['player2'].get('won', ''))

def generate_og_data(entries_list, matches_list):
    category = "doubles"  # 必要なら引数化 or detect

    # ラウンド名 → 段階（大きいほど後）
    round_order = {"準々決勝": 1, "準決勝": 2, "決勝": 3}

    # ラウンド別に抽出（元の配列順を保持）
    qf = [m for m in matches_list if m.get('round') == '準々決勝']
    sf = [m for m in matches_list if m.get('round') == '準決勝']
    f  = [m for m in matches_list if m.get('round') == '決勝']

    # エントリーマップ
    if category == "team":
        entries = {e['entryNo']: {"team": e.get('team', ''), "prefecture": e.get('prefecture', '')} for e in entries_list}
    else:
        entries = {e['entryNo']: e['information'] for e in entries_list}

    # SFの出場者セットを取得（順序も保持）
    # 左右の決め方は「SFの出現順で左→右」にする（入力順が安定している前提）
    if len(sf) != 2 or len(f) != 1 or len(qf) != 4:
        # 想定と異なる場合はフォールバック：元実装に近い順序で処理
        matches = [m for m in matches_list if round_order.get(m.get('round'), 0) >= 1]
        top_scores, bottom_scores, entry_nos = [], [], []
        for m in matches:
            ts, bs = match_scores(m, category)
            top_scores.append(ts); bottom_scores.append(bs)
            entry_nos.extend(participants_entry_nos(m, category))
        unique_entry_nos = list(OrderedDict.fromkeys(entry_nos))
        half = len(unique_entry_nos) // 2
        left_entry_nos = unique_entry_nos[:half]
        right_entry_nos = unique_entry_nos[half:]
    else:
        # 勝者で QF→SF の対応を推定
        sf1, sf2 = sf[0], sf[1]
        sf1_participants = set(participants_entry_nos(sf1, category))
        sf2_participants = set(participants_entry_nos(sf2, category))

        # 各QFの勝者
        qf_winners = {id(m): winner_entry_no(m, category) for m in qf}

        # 左右にQFを振り分け
        left_qfs, right_qfs = [], []
        for m in qf:
            w = qf_winners[id(m)]
            if w in sf1_participants:
                left_qfs.append(m)
            elif w in sf2_participants:
                right_qfs.append(m)
            else:
                # 安全策：どちらにも一致しない場合は左へ
                left_qfs.append(m)

        # 左右のQFは、SFの player1 / player2 の勝者順に並べる
        def order_qfs_by_sf(sf_match, qf_list):
            p1, p2 = participants_entry_nos(sf_match, category)
            # p1 勝者のQFを先、次に p2 勝者のQF
            qf_by_winner = {qf_winners[id(m)]: m for m in qf_list}
            ordered = []
            if p1 in qf_by_winner: ordered.append(qf_by_winner[p1])
            if p2 in qf_by_winner: ordered.append(qf_by_winner[p2])
            # 万一不足あれば残りを追加
            for m in qf_list:
                if m not in ordered:
                    ordered.append(m)
            return ordered

        left_qfs  = order_qfs_by_sf(sf1, left_qfs)
        right_qfs = order_qfs_by_sf(sf2, right_qfs)

        # OG 画像用にマッチの並びを確定：QF(左2→右2) → SF(左→右) → F
        ordered_matches = left_qfs + right_qfs + [sf1, sf2] + f

        # スコア配列
        top_scores, bottom_scores = [], []
        for m in ordered_matches:
            ts, bs = match_scores(m, category)
            top_scores.append(ts); bottom_scores.append(bs)

        # 左右のペア（QF2試合 x 各2組 = 4組ずつ）
        left_entry_nos = []
        for m in left_qfs:
            left_entry_nos.extend(participants_entry_nos(m, category))  # 表示は player1→player2 順

        right_entry_nos = []
        for m in right_qfs:
            right_entry_nos.extend(participants_entry_nos(m, category))

    # 出力のフォーマット
    if category == "team":
        def format_entry(no):
            return {"name": get_team_name(entries[no]), "team": get_team_prefecture(entries[no])}
    else:
        def format_entry(no):
            return {"name": pair_name(entries[no]), "team": pair_team(entries[no])}

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
