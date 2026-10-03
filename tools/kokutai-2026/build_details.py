#!/usr/bin/env python3
"""第80回 国民スポーツ大会（2026・青森）ソフトテニス競技の組み合わせと結果を details JSON に書き出す。

入力:
  tools/kokutai-2026/team-<種別>.initialPlayers.json … エントリー（JSTA の組合せ PDF の番号順。チーム＝都道府県）
  tools/kokutai-2026/results.json                    … 試合の一覧。会期中は日ごとに書き足して作り直す（冪等）
出力:
  data/tournaments/details/kokutai/2026/team-<種別>.json

results.json の1行は1試合:
  {"round": "2回戦", "entries": [12, 13], "score": [2, 1]}
  - entries は entryNo（組合せ PDF の番号）。並びは PDF の上→下
  - score は団体戦の対戦の勝ち数（entries と同じ並び）。未実施なら null（組み合わせだけ出す）
  - 対戦ごとの記録（オーダー）を入れるときは rubbers（ADR-020。tools/asian-games-2026 と同じ形）
  - 棄権・不戦勝は "retired": true（score は読めたとおり）

ラウンド:
  本戦 … 1回戦 / 2回戦 / 3回戦 / 準々決勝 / 準決勝 / 決勝（種別の枠数で何回戦まであるかが決まる）
  順位決定 … 組合せ PDF の下段にある。準々決勝の敗者で 5〜8位決定戦（イ・ロ）→ 5・6位決定戦 / 7・8位決定戦、
            準決勝の敗者で 3位決定戦。**国スポは8位まで入賞**（得点が付く）なので4種別とも実施される

検査（食い違ったら止まる）:
  - 本戦の各試合の2者が、そのラウンドで当たりうる位置（ドローの同じ山の左右）にいること
  - 本戦の2回戦以降に出る者は、前のラウンドを勝っているか、そのラウンドが最初の試合（不戦勝の枠）であること
  - 順位決定戦の顔ぶれが、元になる試合の敗者・勝者と一致すること

成績（results）:
  未決着の者は ADR-007 の「進行中」（rank.kind: ongoing）。決着したら N回戦敗退 / ベスト8 / ベスト4 / 準優勝 / 優勝。
  順位決定戦の結果は label に順位を書く（rank は best のまま。placement に「N位」の型が無いため）。

実行: python3 tools/kokutai-2026/build_details.py
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
        if r.get("score") is not None and (len(r["score"]) != 2 or r["score"][0] == r["score"][1]):
            fail(f"{where} {r['round']} {r['entries']}: score は [勝ち数, 勝ち数] で同点にならない")

    def winner(r):
        s = r.get("score")
        return None if s is None else (r["entries"][0] if s[0] > s[1] else r["entries"][1])

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
        s = r.get("score")
        m = {
            "entries": [a, b],
            "scores": {str(a): s[0], str(b): s[1]} if s else {},
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
        if r.get("rubbers"):
            m["matches"] = r["rubbers"]
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


def main():
    with open(os.path.join(TOOLS, "results.json"), encoding="utf-8") as f:
        src = json.load(f)
    for cat in CATEGORIES:
        with open(os.path.join(TOOLS, f"{cat}.initialPlayers.json"), encoding="utf-8") as f:
            players = json.load(f)
        data = build(cat, players, src[cat])
        os.makedirs(OUT_DIR, exist_ok=True)
        path = os.path.join(OUT_DIR, f"{cat}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        done = sum(1 for m in data["matches"] if m["winnerEntryNo"] is not None)
        print(f"{cat}: エントリー {len(data['entries'])} / 試合 {len(data['matches'])}（決着 {done}）")


if __name__ == "__main__":
    main()
