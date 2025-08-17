import json
import re
from collections import defaultdict

# ...（既存の get_ids / normalize_pair / special_round_order / get_round_order / round_label はそのまま）...

def canonical_team_key(team: str = None, prefecture: str = None, temp_id: str = None):
    """
    チーム識別子を正規化。
    - tempId があれば最優先
    - team + '_' + prefecture があればそれを使用
    - 最後に team 単体
    """
    if temp_id:
        return temp_id
    if team and prefecture:
        return f"{team}_{prefecture}"
    return team or ""

def team_key_from_match(m, side="self"):
    """
    試合行から正規化キーを取得。
    self: m["team"], m["prefecture"], m.get("tempId")
    opponent: m["opponentTeam"]["team"], ["prefecture"], ["tempId"]
    """
    if side == "self":
        return canonical_team_key(
            temp_id=m.get("tempId"),
            team=m.get("team"),
            prefecture=m.get("prefecture"),
        )
    else:
        opp = m.get("opponentTeam", {}) or {}
        if isinstance(opp, dict):
            return canonical_team_key(
                temp_id=opp.get("tempId"),
                team=opp.get("team"),
                prefecture=opp.get("prefecture"),
            )
        # 念のため文字列だけのケース
        return canonical_team_key(team=str(opp))

# JSON読み込み
with open('input.json', 'r', encoding='utf-8') as f:
    matches = json.load(f)

# カテゴリごと
matches_by_category = defaultdict(list)
for match in matches:
    category = match.get("category", "unknown")
    matches_by_category[category].append(match)

final_results = {}

for category, match_list in matches_by_category.items():
    match_map = defaultdict(list)

    if category == "team":
        # 1) チーム→entryNo の辞書（逆側から entryNo を引き継ぐため）
        team_entryno_map = {}
        for m in match_list:
            self_key = team_key_from_match(m, "self")
            if self_key and "entryNo" in m:
                team_entryno_map[self_key] = m["entryNo"]

        # 2) 対戦カードのキーでグルーピング（正規化キーで突合）
        for m in match_list:
            a_key = team_key_from_match(m, "self")
            b_key = team_key_from_match(m, "opponent")
            key = tuple(sorted([a_key, b_key]))
            match_map[key].append(m)

        merged_results = []
        seen_pairs = set()

        for group in match_map.values():
            if len(group) == 2:
                a, b = group
                # 同一カード両視点
                entry_a = a["entryNo"]
                entry_b = b["entryNo"]
                merged_results.append({
                    "round": (a.get("round") or f"グループ{a.get('group', '?')}"),
                    "player1": {
                        "entryNo": entry_a,
                        "won": int(a["games"]["won"]),
                        "lost": int(a["games"]["lost"])
                    },
                    "player2": {
                        "entryNo": entry_b,
                        "won": int(b["games"]["won"]),
                        "lost": int(b["games"]["lost"])
                    },
                    "winner": entry_a if a["result"] == "win" else entry_b
                })
                seen_pairs.add(frozenset([entry_a, entry_b]))
            else:
                # 片側だけの行（相手側の entryNo を辞書から復元してみる）
                for m in group:
                    self_key = team_key_from_match(m, "self")
                    opp_key  = team_key_from_match(m, "opponent")

                    entry_a = m["entryNo"]
                    # 相手側のentryNoが既知ならそれを採用、無ければフォールバック
                    entry_b = team_entryno_map.get(opp_key, f"opponent-{hash(opp_key)}")
                    winner  = entry_a if m["result"] == "win" else entry_b

                    if frozenset([entry_a, entry_b]) in seen_pairs:
                        continue

                    merged_results.append({
                        "round": (m.get("round") or f"グループ{m.get('group', '?')}"),
                        "player1": {
                            "entryNo": entry_a,
                            "won": int(m["games"]["won"]),
                            "lost": int(m["games"]["lost"])
                        },
                        "player2": {
                            "entryNo": entry_b,
                            "won": int(m["games"]["lost"]),
                            "lost": int(m["games"]["won"])
                        },
                        "winner": winner
                    })
    else:
        # doubles等は従来どおり
        def get_ids(player_list):
            ids = []
            for p in player_list:
                if isinstance(p, str):
                    ids.append(p)
                else:
                    pid = p.get("tempId") or p.get("playerId")
                    ids.append(pid)
            return tuple(sorted(ids))

        def normalize_pair(pair):
            result = []
            for pid in pair:
                if isinstance(pid, str) and "_" in pid:
                    result.append({"playerId": None, "tempId": pid})
                else:
                    result.append({"playerId": pid})
            return result

        for match in match_list:
            pair_ids = get_ids(normalize_pair(match["pair"]))
            opponent_ids = get_ids(match["opponents"])
            key = tuple(sorted([pair_ids, opponent_ids]))
            match_map[key].append(match)

        merged_results = []
        seen_pairs = set()

        for group in match_map.values():
            if len(group) == 2:
                a, b = group
                entry_a = a["entryNo"]
                entry_b = b["entryNo"]
                merged_results.append({
                    "round": (a.get("round") or f"グループ{a.get('group', '?')}"),
                    "player1": {
                        "entryNo": entry_a,
                        "won": int(a["games"]["won"]),
                        "lost": int(a["games"]["lost"])
                    },
                    "player2": {
                        "entryNo": entry_b,
                        "won": int(b["games"]["won"]),
                        "lost": int(b["games"]["lost"])
                    },
                    "winner": entry_a if a["result"] == "win" else entry_b
                })
                seen_pairs.add(frozenset([entry_a, entry_b]))
            else:
                for m in group:
                    entry_a = m["entryNo"]
                    opponent_ids = get_ids(m["opponents"])
                    entry_b = f"opponent-{hash(opponent_ids)}"
                    winner = entry_a if m["result"] == "win" else entry_b
                    if frozenset([entry_a, entry_b]) in seen_pairs:
                        continue
                    merged_results.append({
                        "round": (m.get("round") or f"グループ{m.get('group', '?')}"),
                        "player1": {
                            "entryNo": entry_a,
                            "won": int(m["games"]["won"]),
                            "lost": int(m["games"]["lost"])
                        },
                            "player2": {
                            "entryNo": entry_b,
                            "won": int(m["games"]["lost"]),
                            "lost": int(m["games"]["won"])
                        },
                        "winner": winner
                    })

    # ソート規則は従来どおり
    def get_round_order(round_str):
        special_round_order = {"準々決勝":100, "準決勝":101, "決勝":102}
        if round_str in special_round_order:
            return special_round_order[round_str]
        m = re.search(r"(\d+)", round_str or "")
        return int(m.group(1)) if m else float("inf")

    merged_results.sort(
        key=lambda m: (
            get_round_order(m["round"]),
            min(
                m["player1"]["entryNo"] if isinstance(m["player1"]["entryNo"], int) else 9999,
                m["player2"]["entryNo"] if isinstance(m["player2"]["entryNo"], int) else 9999
            )
        )
    )
    final_results[category] = merged_results

# 出力
if len(final_results) == 1:
    print(json.dumps(next(iter(final_results.values())), ensure_ascii=False, indent=2))
else:
    print(json.dumps(final_results, ensure_ascii=False, indent=2))
