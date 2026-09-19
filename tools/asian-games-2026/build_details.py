#!/usr/bin/env python3
"""アジア競技大会2026 ソフトテニスの組み合わせと結果を details JSON に書き出す。

入力: tools/asian-games-2026/draw.json（公式リザルトサイトから転記）
出力: data/tournaments/details/asian-games/2026/<種目>.json

取り込む範囲（docs/wiki/upcoming-tournaments-runbook.md S11）:
- **5種目すべて全組・全試合**。決勝トーナメントの席は (組, 組内順位) で決まる（ADR-015）ので、
  日本の組だけでは席を実体に解決できず、ブラケットが描けないため。
- 入力の取りこぼし（組を1つ転記し忘れる等）は draw.json の `expected` で止める。

表記:
- 日本選手は既存の選手ページにつながるよう、国内大会と同じ id（漢字・所属・都道府県）にする
- 外国選手は公式表記のローマ字（姓は大文字のまま）、所属＝国名（日本語）、都道府県なし
- 団体戦のチームは国名（日本語）

団体戦の対戦ごとの記録（オーダー）は ADR-020 の `matches` として試合の中に持つ。
選手は、個人種目の出場記録がある人だけ姓・名で持ち、それ以外は名前だけ（participants には足さない）。
途中棄権は `status: 'retired'`、不戦勝（片側がペアを出さない）は `status: 'walkover'`。

未実施の試合は勝者・スコアを持たない。成績は ADR-007 の「進行中」（rank.kind: ongoing）。

実行: python3 tools/asian-games-2026/build_details.py
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "tools", "asian-games-2026", "draw.json")
OUT_DIR = os.path.join(ROOT, "data", "tournaments", "details", "asian-games", "2026")

EVENT_TO_CATEGORY = {
    "Men's Team": "team-none-boys",
    "Women's Team": "team-none-girls",
    "Mixed Doubles": "doubles-none-mixed",
    "Men's Singles": "singles-none-boys",
    "Women's Singles": "singles-none-girls",
}

COUNTRY_JA = {
    "JPN": "日本",
    "CAM": "カンボジア",
    "INA": "インドネシア",
    "IND": "インド",
    "KOR": "韓国",
    "LAO": "ラオス",
    "MGL": "モンゴル",
    "NEP": "ネパール",
    "PAK": "パキスタン",
    "PHI": "フィリピン",
    "TPE": "チャイニーズ・タイペイ",
    "THA": "タイ",
    "PRK": "北朝鮮",
}

# 公式のローマ字 -> 国内大会で使っている id（2026年の全日本シングルスの表記に揃える）。
# 代表名簿（data/tournaments/delegations/asian-games-2026.json）の10人。
# 個人種目に出る6人は participants に、残る4人は団体戦のオーダーにだけ現れる。
JAPANESE_PLAYERS = {
    "UEMATSU/Toshiki": ("上松", "俊貴", "NTT西日本", "広島県"),
    "UCHIMOTO/Takafumi": ("内本", "隆文", "NTT西日本", "広島県"),
    "KUROSAKA/Takuya": ("黒坂", "卓矢", "日本体育大学", "日本学連"),
    "HIROOKA/Sora": ("広岡", "宙", "NTT西日本", "広島県"),
    "MARUYAMA/Kaito": ("丸山", "海斗", "one team", "大阪府"),
    "TEMMA/Rena": ("天間", "麗奈", "日本体育大学", "日本学連"),
    "MIYAMAE/Kiho": ("宮前", "希帆", "ワタキューセイモア", "京都府"),
    "IWAKURA/Ayaka": ("岩倉", "彩佳", "どんぐり北広島", "広島県"),
    "NAKATANI/Sakura": ("中谷", "さくら", "明治大学", "日本学連"),
    "MAEDA/Rio": ("前田", "梨緒", "明治大学", "日本学連"),
}

ROUND_ORDER = {"準々決勝": 1, "準決勝": 2, "3位決定戦": 3, "決勝": 4}
# 敗退したラウンド -> 成績
ROUND_TO_RANK = {
    "準々決勝": ("ベスト8", {"kind": "best", "bestLevel": 8}),
    "準決勝": ("ベスト4", {"kind": "best", "bestLevel": 4}),
    "決勝": ("準優勝", {"kind": "runnerup"}),
}
ROUND_TO_ONGOING = {"準々決勝": "ベスト8進出", "準決勝": "ベスト4進出", "決勝": "決勝進出"}


def participant_for(noc, romaji):
    if noc == "JPN":
        if romaji not in JAPANESE_PLAYERS:
            raise SystemExit(f"日本選手の対応が無い: {romaji}")
        last, first, team, pref = JAPANESE_PLAYERS[romaji]
        return {"id": f"{last}_{first}_{team}_{pref}", "lastName": last, "firstName": first, "team": team, "prefecture": pref}
    family, given = romaji.split("/")
    country = COUNTRY_JA[noc]
    return {"id": f"{family}_{given}_{country}", "lastName": family, "firstName": given, "team": country, "prefecture": None}


def team_participant(noc):
    name = COUNTRY_JA[noc]
    return {"id": name, "lastName": None, "firstName": None, "team": name, "prefecture": None}


def rubber_player(romaji, noc, individual_keys):
    """オーダーの選手。個人種目の出場記録があれば姓・名、無ければ名前だけ（ADR-020）。"""
    if noc == "JPN":
        if romaji not in JAPANESE_PLAYERS:
            raise SystemExit(f"日本選手の対応が無い: {romaji}")
        last, first, _team, _pref = JAPANESE_PLAYERS[romaji]
        return {"lastName": last, "firstName": first}
    family, given = romaji.split("/")
    if (noc, family, given) in individual_keys:
        return {"lastName": family, "firstName": given}
    return {"name": f"{family} {given}"}


def build_rubbers(row, individual_keys):
    """draw.json の rubbers -> ADR-020 の matches。

    行は [type, Aのペア, Bのペア, games] か、途中棄権なら [..., 棄権した側("A"|"B")]。
    棄権した対戦は**決着したゲームだけ**を games に持つので、本数の多いほうが勝ちとは限らない。

    games が null のとき、**片側のペアが空なら不戦勝**（walkover。出さなかった側が負け）、
    両側にペアがあれば未実施（not_played。オーダーだけ出ている）。
    """
    nocs = [row["sides"][0][0], row["sides"][1][0]]
    where = f"{row['event']} {row.get('group') or row.get('round')} {row['matchNo']}"
    out = []
    for rubber in row["rubbers"]:
        kind, a, b, games = rubber[:4]
        retired_side = rubber[4] if len(rubber) > 4 else None
        if retired_side not in (None, "A", "B"):
            raise SystemExit(f"棄権した側が A/B でない: {where} {kind} {retired_side}")
        if retired_side and games is None:
            raise SystemExit(f"未実施なのに棄権が付いている: {where} {kind}")
        if not a and not b:
            raise SystemExit(f"両側ともペアが空: {where} {kind}")
        walkover = games is None and not (a and b)
        if walkover:
            status = "walkover"
        elif games is None:
            status = "not_played"
        elif retired_side:
            status = "retired"
        else:
            status = "completed"
        entry = {
            "type": kind,
            "status": status,
            # 不戦勝はペアを出したほうの勝ち
            "winner": ("A" if a else "B") if walkover else None,
            "scoreA": None,
            "scoreB": None,
            "playersA": [rubber_player(p, nocs[0], individual_keys) for p in a],
            "playersB": [rubber_player(p, nocs[1], individual_keys) for p in b],
        }
        if games is not None:
            won_a = sum(1 for g in games if g[0] > g[1])
            won_b = sum(1 for g in games if g[1] > g[0])
            if won_a + won_b != len(games):
                raise SystemExit(f"同点のゲームがある: {where} {kind}")
            # 途中棄権は棄権しなかった側の勝ち。本数からは決まらない
            entry["winner"] = ("B" if retired_side == "A" else "A") if retired_side else ("A" if won_a > won_b else "B")
            entry["scoreA"] = won_a
            entry["scoreB"] = won_b
            entry["games"] = [list(g) for g in games]
        out.append(entry)
    return out


def sort_key(row):
    if row["stage"] == "roundrobin":
        return (0, row["group"], 0, row["matchNo"])
    return (1, "", ROUND_ORDER[row["round"]], row["matchNo"])


def build(event, rows, individual_keys, draw_slots):
    participants = {}
    entry_by_key = {}
    entries = []
    matches = []
    id_to_match = {}

    def entry_no(side):
        noc, players = side[0], side[1:]
        ps = [participant_for(noc, p) for p in players] if players else [team_participant(noc)]
        key = tuple(p["id"] for p in ps)
        if key not in entry_by_key:
            for p in ps:
                participants.setdefault(p["id"], p)
            entry_by_key[key] = len(entries) + 1
            entries.append({"entryNo": len(entries) + 1, "playerIds": list(key), "type": None})
        return entry_by_key[key]

    for row in sorted(rows, key=sort_key):
        a, b = (entry_no(s) for s in row["sides"])
        score = row.get("score")
        match = {
            "entries": [a, b],
            "scores": {str(a): score[0], str(b): score[1]} if score else {},
            "round": row.get("round"),
            "stage": row["stage"],
            "group": row.get("group"),
            "winnerEntryNo": (a if score[0] > score[1] else b) if score else None,
            "nextMatchId": None,
            "prevMatchIds": [],
            "prevMatchId": None,
            "matchId": f"match-{len(matches) + 1}",
        }
        if row.get("rubbers"):
            match["matches"] = build_rubbers(row, individual_keys)
        matches.append(match)
        if row.get("id"):
            id_to_match[row["id"]] = match
            match["_next"] = row.get("next")

    # 決勝トーナメントの繋がり（draw.json の id / next）
    for match in matches:
        nxt = match.pop("_next", None)
        if not nxt:
            continue
        parent = id_to_match[nxt]
        match["nextMatchId"] = parent["matchId"]
        parent["prevMatchIds"].append(match["matchId"])
        parent["prevMatchId"] = parent["prevMatchIds"][0]

    results = build_results(matches, entries)
    data = {"participants": list(participants.values()), "entries": entries}
    if draw_slots:
        data["knockoutDraw"] = {"slots": draw_slots}
    data["matches"] = matches
    data["results"] = results
    return data


def roundrobin_standings(matches):
    """組ごとの順位。勝ち数 → 本数の得失 → 取得本数。並びきらなければ止める。"""
    by_group = {}
    for m in matches:
        if m["stage"] != "roundrobin":
            continue
        by_group.setdefault(m["group"], []).append(m)
    ranks = {}
    for group, ms in by_group.items():
        if any(not m["scores"] for m in ms):
            continue  # 組が終わっていないので順位を付けない
        stats = {}
        for m in ms:
            a, b = m["entries"]
            for me, opp in ((a, b), (b, a)):
                s = stats.setdefault(me, {"win": 0, "got": 0, "lost": 0})
                s["got"] += m["scores"][str(me)]
                s["lost"] += m["scores"][str(opp)]
                if m["winnerEntryNo"] == me:
                    s["win"] += 1
        order = sorted(stats, key=lambda e: (-stats[e]["win"], -(stats[e]["got"] - stats[e]["lost"]), -stats[e]["got"]))
        for i in range(1, len(order)):
            prev, cur = stats[order[i - 1]], stats[order[i]]
            if (prev["win"], prev["got"] - prev["lost"], prev["got"]) == (cur["win"], cur["got"] - cur["lost"], cur["got"]):
                raise SystemExit(f"{group}組: 順位が並びきらない（勝ち数・本数が同じ）。公式の順位を見て決めること")
        for i, entry_no in enumerate(order):
            ranks[entry_no] = {"group": group, "rank": i + 1}
    return ranks


def build_results(matches, entries):
    ranks = roundrobin_standings(matches)
    finals = [m for m in matches if m["stage"] == "knockout" and m["round"] == "決勝"]
    results = []
    for e in entries:
        no = e["entryNo"]
        mine = [m for m in matches if no in m["entries"]]
        ko = sorted([m for m in mine if m["stage"] == "knockout"], key=lambda m: ROUND_ORDER[m["round"]])
        if ko:
            last = ko[-1]
            if last["winnerEntryNo"] is None:
                label, rank = ROUND_TO_ONGOING[last["round"]], {"kind": "ongoing"}
            elif last["winnerEntryNo"] == no and last in finals:
                label, rank = "優勝", {"kind": "winner"}
            elif last["winnerEntryNo"] == no:
                label, rank = ROUND_TO_ONGOING[last["round"]], {"kind": "ongoing"}
            else:
                label, rank = ROUND_TO_RANK[last["round"]]
            tournament = {"label": label, "rank": rank}
        elif mine and all(m["winnerEntryNo"] is not None for m in mine):
            # 予選リーグで敗退（決勝Tに進んでいない）。最終成績は持たない
            tournament = None
        else:
            tournament = {"label": "出場", "rank": {"kind": "ongoing"}}
        results.append({"entryNo": no, "tournament": tournament, "roundrobin": ranks.get(no)})
    return results


def check(event, data, rows, expected):
    problems = []
    ids = {p["id"] for p in data["participants"]}
    used = {pid for e in data["entries"] for pid in e["playerIds"]}
    if ids != used:
        problems.append(f"participants と entries の参照が一致しない: {ids ^ used}")
    per = 0 if "Team" in event else 2 if "Doubles" in event else 1
    for e in data["entries"]:
        if len(e["playerIds"]) != max(per, 1):
            problems.append(f"entry {e['entryNo']} の人数が {len(e['playerIds'])}")
    if len(data["matches"]) != len(rows):
        problems.append(f"試合数 {len(data['matches'])} != 入力 {len(rows)}")

    # 予選リーグの総当たりが完全か（組の全ペアが1回ずつ）
    by_group = {}
    for m in data["matches"]:
        if m["stage"] == "roundrobin":
            by_group.setdefault(m["group"], []).append(tuple(sorted(m["entries"])))
    for g, pairs in by_group.items():
        members = {x for p in pairs for x in p}
        expected_pairs = len(members) * (len(members) - 1) // 2
        if len(pairs) != expected_pairs or len(set(pairs)) != len(pairs):
            problems.append(f"{g}組: {len(members)}エントリーで {len(pairs)}試合（総当たりなら {expected_pairs}）")

    # 全組を持つので、組と出場数が公式と一致しているかを見る（転記の取りこぼしを止める）。
    # 期待値は draw.json の `expected` が正。
    if expected:
        got_groups = sorted(by_group)
        if got_groups != list(expected["groups"]):
            problems.append(f"組が合わない: {got_groups} != {expected['groups']}")
        if len(data["entries"]) != expected["entries"]:
            problems.append(f"エントリー数が合わない: {len(data['entries'])} != {expected['entries']}")

    # オーダー: 勝った対戦の数が親の本数と一致するか
    for m in data["matches"]:
        if "matches" not in m:
            continue
        a, b = m["entries"]
        won_a = sum(1 for s in m["matches"] if s["winner"] == "A")
        won_b = sum(1 for s in m["matches"] if s["winner"] == "B")
        if (won_a, won_b) != (m["scores"].get(str(a)), m["scores"].get(str(b))):
            problems.append(f"{m['matchId']}: オーダーの勝ち数 {won_a}-{won_b} が本数 {m['scores']} と合わない")

    # 決勝Tの席が参照する予選リーグの順位が results にあるか
    slots = (data.get("knockoutDraw") or {}).get("slots") or []
    known = {(r["roundrobin"]["group"], r["roundrobin"]["rank"]) for r in data["results"] if r["roundrobin"]}
    for s in slots:
        if s and (s["group"], s["rank"]) not in known:
            problems.append(f"決勝Tの席 {s} に対応する予選リーグの順位が無い")
    if slots and len(slots) & (len(slots) - 1):
        problems.append(f"決勝Tの席が {len(slots)}（2の冪でない）")
    return problems


def main():
    src = json.load(open(SRC, encoding="utf-8"))
    by_event = {}
    for row in src["rows"]:
        by_event.setdefault(row["event"], []).append(row)

    # オーダーの選手を姓・名で持てるか（＝個人種目の出場記録があるか）の判定に使う
    individual_keys = set()
    for event, rows in by_event.items():
        if "Team" in event:
            continue
        for row in rows:
            for side in row["sides"]:
                for romaji in side[1:]:
                    family, given = romaji.split("/")
                    individual_keys.add((side[0], family, given))

    os.makedirs(OUT_DIR, exist_ok=True)
    for event, rows in by_event.items():
        data = build(event, rows, individual_keys, src.get("knockoutDraw", {}).get(event))
        problems = check(event, data, rows, src.get("expected", {}).get(event))
        assert not problems, f"{event}: {problems}"
        path = os.path.join(OUT_DIR, f"{EVENT_TO_CATEGORY[event]}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        groups = sorted({m["group"] for m in data["matches"] if m["group"]})
        decided = sum(1 for m in data["matches"] if m["winnerEntryNo"] is not None)
        subs = sum(len(m.get("matches", [])) for m in data["matches"])
        print(
            f"{EVENT_TO_CATEGORY[event]}: 組 {','.join(groups)} / エントリー {len(data['entries'])}"
            f" / 試合 {len(data['matches'])}（確定 {decided}）/ 対戦記録 {subs}"
        )


if __name__ == "__main__":
    main()
