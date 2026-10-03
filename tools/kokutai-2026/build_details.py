#!/usr/bin/env python3
"""第80回 国民スポーツ大会（2026・青森）ソフトテニス競技の details に順位決定戦を足し、成績を付け直して検査する。

分担（2026-10-03 ユーザー決定）:
  本戦（1回戦〜決勝）… tools/tournament3 で手入力して details に書き出す（これまでどおり）
  順位決定戦         … tournament3 では表せないので tools/kokutai-2026/placements.json に書く
  このスクリプト     … details の本戦＋placements.json を読み、順位決定戦を足し、results を付け直し、全体を検査して書き戻す（冪等）

入力:
  data/tournaments/details/kokutai/2026/team-<種別>.json … 本戦の試合はここから読む（順位決定戦は placements.json で置き換える）
  tools/kokutai-2026/team-<種別>.initialPlayers.json   … エントリー（JSTA の組合せ PDF の番号順。チーム＝都道府県）
  tools/kokutai-2026/placements.json                    … 順位決定戦。1行は1試合:
    {"round": "5〜8位決定戦", "entries": [5, 23], "score": [2, 1]}
    - entries は entryNo（組合せ PDF の番号）、score は対戦の勝ち数（entries と同じ並び）。未実施なら null
出力:
  同じ details ファイル（変わったときだけ書く）

ラウンド:
  本戦 … 1回戦 / 2回戦 / 3回戦 / 準々決勝 / 準決勝 / 決勝（種別の枠数で何回戦まであるかが決まる）
  順位決定 … 組合せ PDF の下段にある。準々決勝の敗者で 5〜8位決定戦（イ・ロ）→ 5・6位決定戦 / 7・8位決定戦、
            準決勝の敗者で 3位決定戦。**国スポは8位まで入賞**（得点が付く）なので4種別とも実施される

検査（食い違ったら止まる）:
  - エントリーが tools/ のステージングと一致すること
  - 本戦の各試合の2者が、そのラウンドで当たりうる位置（ドローの同じ山の左右）にいること
  - 本戦の2回戦以降に出る者は、前のラウンドを勝っているか、そのラウンドが最初の試合（不戦勝の枠）であること
  - 順位決定戦の顔ぶれが、元になる試合の敗者・勝者と一致すること

成績（results）:
  未決着の者は ADR-007 の「進行中」（rank.kind: ongoing）。決着したら N回戦敗退 / ベスト8 / ベスト4 / 準優勝 / 優勝。
  順位決定戦が済んだら label を「3位」〜「8位」にする（ユーザー決定。rank は best 4 / best 8 のまま。
  placement に「N位」の型が無いため）。

実行: python3 tools/kokutai-2026/build_details.py   （tournament3 で書き出した後に毎回流す）
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "pdf"))
from tournament_results_common import entry_types  # noqa: E402

TOOLS = os.path.join(ROOT, "tools", "kokutai-2026")
OUT_DIR = os.path.join(ROOT, "data", "tournaments", "details", "kokutai", "2026")
CATEGORIES = ["team-adult-boys", "team-adult-girls", "team-youth-boys", "team-youth-girls"]

LATE = ["準々決勝", "準決勝", "決勝"]
PLACEMENT = ["5〜8位決定戦", "3位決定戦", "5・6位決定戦", "7・8位決定戦"]
# 順位決定戦の勝者・敗者の順位
PLACE_LABEL = {"3位決定戦": ("3位", "4位"), "5・6位決定戦": ("5位", "6位"), "7・8位決定戦": ("7位", "8位")}


def main_rounds(slots):
    """枠数 -> 本戦のラウンド名（1回戦から決勝まで）。"""
    n = slots.bit_length() - 1
    names = [f"{i}回戦" for i in range(1, n - 2)] + LATE
    return names[-n:]


def seat_of(entry_nos, types, r1_pairs):
    """entryNo -> ドロー上の席番号（0始まり）。entry_types と同じ規約で枠を並べる。"""
    pairs = {tuple(sorted(p)) for p in r1_pairs}
    nos = sorted(entry_nos)
    seats, i, slot = {}, 0, 0
    while i < len(nos):
        a = nos[i]
        b = nos[i + 1] if i + 1 < len(nos) else None
        if b is not None and (a, b) in pairs:
            seats[a], seats[b] = slot, slot + 1
            i += 2
        else:
            seats[a] = slot
            i += 1
        slot += 2
    return seats, slot


def fail(msg):
    raise SystemExit(f"[kokutai-2026] {msg}")


def build(category, players, rows):
    where = category
    entry_nos = [p["id"] for p in players]
    r1 = [r["entries"] for r in rows if r["round"] == "1回戦"]
    types = entry_types(entry_nos, r1)
    seats, slots = seat_of(entry_nos, types, r1)
    rounds = main_rounds(slots)
    order = rounds + PLACEMENT
    level = {name: i + 1 for i, name in enumerate(rounds)}  # 1回戦=1 … 決勝=log2(slots)

    # 不戦勝の枠は 2回戦（seed）以降が最初の試合
    first_round = {no: rounds[0] if types[no] == "packing" else rounds[1] for no in entry_nos}

    for r in rows:
        if r["round"] not in order:
            fail(f"{where}: 知らないラウンド名 {r['round']}（{order}）")
        a, b = r["entries"]
        if a not in seats or b not in seats or a == b:
            fail(f"{where} {r['round']}: entryNo が不正 {r['entries']}")
        if r.get("winner") is not None and r["winner"] not in r["entries"]:
            fail(f"{where} {r['round']} {r['entries']}: 勝者 {r['winner']} が対戦の2者に無い")

    def winner(r):
        return r.get("winner")

    def loser(r):
        w = winner(r)
        return None if w is None else [e for e in r["entries"] if e != w][0]

    by_round = {name: [r for r in rows if r["round"] == name] for name in order}
    seen = set()
    for name in order:
        for r in by_round[name]:
            for e in r["entries"]:
                if (name, e) in seen:
                    fail(f"{where} {name}: entryNo {e} が2試合に出ている")
                seen.add((name, e))

    # 本戦: 位置と勝ち上がり
    for name in rounds:
        k = level[name]
        for r in by_round[name]:
            a, b = r["entries"]
            if seats[a] >> k != seats[b] >> k or (seats[a] >> (k - 1)) == (seats[b] >> (k - 1)):
                fail(f"{where} {name} {r['entries']}: ドロー上この2者は{name}で当たらない")
            for e in r["entries"]:
                if name == first_round[e]:
                    continue
                if level[name] < level[first_round[e]]:
                    fail(f"{where} {name}: entryNo {e} は不戦勝の枠で {first_round[e]} からのはず")
                prev = [m for m in by_round[rounds[k - 2]] if e in m["entries"]]
                if not prev or winner(prev[0]) != e:
                    fail(f"{where} {name}: entryNo {e} が {rounds[k - 2]} を勝っていない")

    # 順位決定戦の顔ぶれ
    qf_losers = [loser(r) for r in sorted(by_round["準々決勝"], key=lambda r: min(seats[e] for e in r["entries"]))]
    sf_losers = {loser(r) for r in by_round["準決勝"]}
    for r in by_round["3位決定戦"]:
        if set(r["entries"]) != sf_losers:
            fail(f"{where} 3位決定戦 {r['entries']}: 準決勝の敗者 {sf_losers} と合わない")
    for r in by_round["5〜8位決定戦"]:
        # イ = 上半分の準々決勝2試合の敗者、ロ = 下半分の2試合の敗者
        if set(r["entries"]) not in ({*qf_losers[:2]}, {*qf_losers[2:]}):
            fail(f"{where} 5〜8位決定戦 {r['entries']}: 同じ半分の準々決勝の敗者どうしでない {qf_losers}")
    pre = by_round["5〜8位決定戦"]
    for name, pick in (("5・6位決定戦", winner), ("7・8位決定戦", loser)):
        for r in by_round[name]:
            if set(r["entries"]) != {pick(m) for m in pre}:
                fail(f"{where} {name} {r['entries']}: 5〜8位決定戦の結果と合わない")

    # 試合を並べて採番（ラウンド順 → ドローの上から）
    ordered = sorted(rows, key=lambda r: (order.index(r["round"]), min(seats[e] for e in r["entries"])))
    matches = []
    for i, r in enumerate(ordered):
        a, b = r["entries"]
        m = {
            "entries": [a, b],
            "scores": r["scores"],
            "round": r["round"],
            "winnerEntryNo": winner(r),
            "retired": bool(r.get("retired")),
            "stage": "knockout",
            "group": None,
            "matchId": f"match-{i + 1}",
            "nextMatchId": None,
            "prevMatchIds": [],
            "prevMatchId": None,
        }
        m.update(r.get("extra") or {})  # tournament3 側の項目（オーダー等）はそのまま残す
        matches.append(m)

    # 本戦の勝者の進む先。順位決定戦はブラケットに繋げない（既存の 3位決定戦 と同じ）
    for m in matches:
        if m["round"] not in rounds or m["winnerEntryNo"] is None:
            continue
        idx = rounds.index(m["round"])
        for later in rounds[idx + 1:]:
            nxt = next((x for x in matches if x["round"] == later and m["winnerEntryNo"] in x["entries"]), None)
            if nxt:
                m["nextMatchId"] = nxt["matchId"]
                nxt["prevMatchIds"].append(m["matchId"])
                break
    for m in matches:
        m["prevMatchId"] = m["prevMatchIds"][0] if len(m["prevMatchIds"]) == 1 else None

    results = [{"entryNo": no, "tournament": standing(no, matches, rounds, first_round), "roundrobin": None}
               for no in sorted(entry_nos)]

    participants, seen_p = [], set()
    for m in matches:
        for no in sorted(m["entries"], reverse=True):
            if no not in seen_p:
                seen_p.add(no)
                participants.append(team(players, no))
    for no in sorted(entry_nos):  # まだ試合の無い不戦勝の枠
        if no not in seen_p:
            participants.append(team(players, no))

    entries = [{"entryNo": no, "playerIds": [team(players, no)["id"]], "type": types[no]} for no in sorted(entry_nos)]
    return {"participants": participants, "entries": entries, "matches": matches, "results": results}


def team(players, no):
    p = next(x for x in players if x["id"] == no)
    return {"id": f"{p['team']}_{p['prefecture']}", "lastName": None, "firstName": None,
            "team": p["team"], "prefecture": p["prefecture"]}


ONGOING = {"準々決勝": "ベスト8進出", "準決勝": "ベスト4進出", "決勝": "決勝進出"}
LOST = {"準々決勝": ("ベスト8", {"kind": "best", "bestLevel": 8}),
        "準決勝": ("ベスト4", {"kind": "best", "bestLevel": 4}),
        "決勝": ("準優勝", {"kind": "runnerup"})}


def standing(no, matches, rounds, first_round):
    ongoing = {"kind": "ongoing"}
    main = sorted([m for m in matches if no in m["entries"] and m["round"] in rounds],
                  key=lambda m: rounds.index(m["round"]))
    place = [m for m in matches if no in m["entries"] and m["round"] in PLACE_LABEL]
    if not main:
        # 不戦勝の枠で、最初の試合の組み合わせがまだ入っていない
        return {"label": "出場", "rank": ongoing}
    last = main[-1]
    if last["winnerEntryNo"] is None:
        return {"label": ONGOING.get(last["round"], "出場"), "rank": ongoing}
    if last["winnerEntryNo"] == no:
        if last["round"] == "決勝":
            return {"label": "優勝", "rank": {"kind": "winner"}}
        nxt = rounds[rounds.index(last["round"]) + 1]
        return {"label": ONGOING.get(nxt, "出場"), "rank": ongoing}
    if last["round"] in LOST:
        label, rank = LOST[last["round"]]
        if last["round"] in ("準々決勝", "準決勝"):
            # 順位決定戦が済めば順位、まだなら進行中（5・6位／7・8位決定戦の前も「5〜8位決定戦」のまま）
            if place and place[0]["winnerEntryNo"] is not None:
                win, lose = PLACE_LABEL[place[0]["round"]]
                return {"label": win if place[0]["winnerEntryNo"] == no else lose, "rank": rank}
            return {"label": "5〜8位決定戦" if last["round"] == "準々決勝" else "3位決定戦", "rank": ongoing}
        return {"label": label, "rank": rank}
    n = int(last["round"][0])
    return {"label": f"{n}回戦敗退", "rank": {"kind": "round", "round": n}}


MATCH_KEYS = {"entries", "scores", "round", "winnerEntryNo", "retired", "stage", "group",
              "matchId", "nextMatchId", "prevMatchIds", "prevMatchId"}


def rows_from_details(data, where):
    """details の本戦の試合 -> 行。順位決定戦は placements.json が正なので捨てる。"""
    rows = []
    for m in data["matches"]:
        if m["round"] in PLACEMENT:
            continue
        if m.get("stage") != "knockout":
            fail(f"{where}: knockout でない試合がある {m.get('matchId')}")
        rows.append({"round": m["round"], "entries": m["entries"], "scores": m.get("scores") or {},
                     "winner": m.get("winnerEntryNo"), "retired": m.get("retired"),
                     "extra": {k: v for k, v in m.items() if k not in MATCH_KEYS}})
    return rows


def rows_from_placements(src, where):
    rows = []
    for r in src:
        if r["round"] not in PLACEMENT:
            fail(f"{where}: placements.json に本戦のラウンド {r['round']}（本戦は tournament3 で入れる）")
        a, b = r["entries"]
        sc = r.get("score")
        if sc is not None and (len(sc) != 2 or sc[0] == sc[1]):
            fail(f"{where} {r['round']} {r['entries']}: score は [勝ち数, 勝ち数] で同点にならない")
        rows.append({"round": r["round"], "entries": [a, b],
                     "scores": {str(a): sc[0], str(b): sc[1]} if sc else {},
                     "winner": None if sc is None else (a if sc[0] > sc[1] else b),
                     "retired": r.get("retired")})
    return rows


def main():
    with open(os.path.join(TOOLS, "placements.json"), encoding="utf-8") as f:
        placements = json.load(f)
    for cat in CATEGORIES:
        with open(os.path.join(TOOLS, f"{cat}.initialPlayers.json"), encoding="utf-8") as f:
            players = json.load(f)
        path = os.path.join(OUT_DIR, f"{cat}.json")
        with open(path, encoding="utf-8") as f:
            current = json.load(f)
        want = [f"{p['team']}_{p['prefecture']}" for p in players]
        got = [e["playerIds"][0] for e in sorted(current["entries"], key=lambda e: e["entryNo"])]
        if want != got:
            fail(f"{cat}: details のエントリーが tools/ のステージングと違う")
        rows = rows_from_details(current, cat) + rows_from_placements(placements.get(cat, []), cat)
        data = build(cat, players, rows)
        done = sum(1 for m in data["matches"] if m["winnerEntryNo"] is not None)
        if data == current:
            print(f"{cat}: 変更なし（試合 {len(data['matches'])}・決着 {done}）")
            continue
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{cat}: 書き直した（試合 {len(data['matches'])}・決着 {done}）→ npx prettier --write で整形")


if __name__ == "__main__":
    main()
