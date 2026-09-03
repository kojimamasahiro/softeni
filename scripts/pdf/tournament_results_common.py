#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
大会結果PDFから読み取った「試合の一覧」を `data/tournaments/details` 形式のJSONに組み立てる
共通処理と、その健全性チェック。

**PDFの読み方は大会・年度ごとに違うが、読み終わったあとの組み立ては全大会で同じ**なので、
ここに切り出してある。各大会のパーサ（`*_results.py`）は「試合の一覧」を作るところまでを
担当し、`build()` に渡す。

試合の一覧は次の形の dict のリスト:

    {"round": "3回戦", "entries": [12, 35], "winner": 12,
     "winnerScore": 5, "loserScore": 3, "retired": False}

`build()` が面倒を見るもの（＝各パーサで書き直さなくていいもの）:

  - `matchId` の採番（ラウンド順 → 若いエントリー番号順）
  - `nextMatchId` / `prevMatchIds` / `prevMatchId` の張り替え
  - `entries[].type`（seed / packing / extra）の逆算
  - `results[]` のラベルと rank（N回戦敗退 / ベスト8 / ベスト4 / 準優勝 / 優勝）
  - `participants[]` の生成と並び順

依存: なし（標準ライブラリのみ）
"""
from __future__ import annotations

import json

# 既存データのラウンド表記。予選リーグを持つ大会はこのモジュールの対象外
# （決勝トーナメントの枠がリーグ順位で決まり、entryNo のドロー順と対応しないため）。
ROUND_ORDER = ["1回戦", "2回戦", "3回戦", "4回戦", "5回戦", "6回戦", "7回戦",
               "準々決勝", "準決勝", "決勝"]
LATE_LABELS = {"決勝": ("準優勝", {"kind": "runnerup"}),
               "準決勝": ("ベスト4", {"kind": "best", "bestLevel": 4}),
               "準々決勝": ("ベスト8", {"kind": "best", "bestLevel": 8})}


def entry_types(entry_nos, r1_pairs):
    """`tools/tournament3` の buildEntriesMeta と同じ規約で seed / packing / extra を決める。

    エントリー番号を昇順に見て、隣どうしが1回戦で当たっていれば実試合の枠（2枠消費）、
    そうでなければ不戦勝の枠（本人＋bye で2枠消費）。実試合の枠の両者は packing。
    不戦勝の枠は、同じ2回戦へ合流する隣の枠が実試合なら seed、そちらも不戦勝なら extra。

    ブラケット表（BracketSheets）はこの type から席順を復元するので、ここがずれると
    描画が従来方式へフォールバックする。枠数が2の冪にならなければ1回戦の読みが誤っている。
    """
    nos = sorted(entry_nos)
    pairs = {tuple(sorted(p)) for p in r1_pairs}
    frames, i = [], 0
    while i < len(nos):
        a = nos[i]
        b = nos[i + 1] if i + 1 < len(nos) else None
        if b is not None and (a, b) in pairs:
            frames.append([a, b])
            i += 2
        else:
            frames.append([a, None])
            i += 1
    size = len(frames) * 2
    assert size and (size & (size - 1)) == 0, f"枠数 {size} が2の冪でない（1回戦の読みを疑う）"
    types = {}
    for m, f in enumerate(frames):
        if f[1] is not None:
            types[f[0]] = types[f[1]] = "packing"
        else:
            nb = frames[m ^ 1] if (m ^ 1) < len(frames) else None
            types[f[0]] = "seed" if nb and nb[1] is not None else "extra"
    return types


def link_matches(matches):
    """matchId を採番し、勝者の進む先で next/prev を張る。matches を破壊的に更新する。"""
    ms = sorted(matches, key=lambda m: (ROUND_ORDER.index(m["round"]), min(m["entries"])))
    for i, m in enumerate(ms):
        m["matchId"] = f"match-{i + 1}"
    by_entry_round = {(e, m["round"]): m for m in ms for e in m["entries"]}
    for m in ms:
        m["nextMatchId"] = None
        m["prevMatchIds"] = []
    for m in ms:
        idx = ROUND_ORDER.index(m["round"])
        for later in ROUND_ORDER[idx + 1:]:
            nxt = by_entry_round.get((m["winner"], later))
            if nxt:
                m["nextMatchId"] = nxt["matchId"]
                nxt["prevMatchIds"].append(m["matchId"])
                break
    for m in ms:
        m["prevMatchIds"].sort(key=lambda x: int(x.split("-")[1]))
        m["prevMatchId"] = m["prevMatchIds"][0] if len(m["prevMatchIds"]) == 1 else None
    return ms


def build(initial_players, matches, winner_score_default=None):
    """initialPlayers（tools/ のステージング）と試合一覧から details 形式の dict を作る。

    initial_players は `[{"id": 1, "information": [{lastName, firstName, team, prefecture}, ...]}]`
    （個人戦）または `[{"id": 1, "team": ..., "prefecture": ...}]`（団体戦）。
    """
    ms = link_matches(matches)

    pid, ids_by_no = {}, {}
    for e in initial_players:
        ids = []
        for p in e.get("information") or [e]:
            if p.get("lastName"):
                i = f"{p['lastName']}_{p['firstName']}_{p['team']}_{p['prefecture']}"
                rec = {"id": i, "lastName": p["lastName"], "firstName": p["firstName"],
                       "team": p["team"], "prefecture": p["prefecture"]}
            else:  # 団体戦は選手名を持たない
                i = f"{p['team']}_{p['prefecture']}"
                rec = {"id": i, "lastName": None, "firstName": None,
                       "team": p["team"], "prefecture": p["prefecture"]}
            ids.append(i)
            pid[i] = rec
        ids_by_no[e["id"]] = ids

    # participants は「試合順に、対戦の番号が大きいほうから」初出のものを並べる
    # （tools/tournament3 が書き出す順序に合わせてある）。
    seen, participants = set(), []
    for m in ms:
        for no in sorted(m["entries"], reverse=True):
            if no in seen:
                continue
            seen.add(no)
            participants += [pid[i] for i in ids_by_no[no]]

    r1 = [m["entries"] for m in ms if m["round"] == "1回戦"]
    types = entry_types(ids_by_no, r1)
    entries = [{"entryNo": no, "playerIds": ids_by_no[no], "type": types[no]}
               for no in sorted(ids_by_no)]

    out_matches = []
    for m in ms:
        w = m["winner"]
        l = [e for e in m["entries"] if e != w][0]
        ws = m.get("winnerScore")
        if ws is None:
            assert winner_score_default is not None, \
                f"{m['matchId']}: 勝者スコアがPDFに無い。winner_score_default を指定する"
            ws = winner_score_default
        out_matches.append({"entries": m["entries"], "scores": {str(w): ws, str(l): m["loserScore"] or 0},
                            "round": m["round"], "winnerEntryNo": w,
                            "retired": bool(m.get("retired")), "stage": "knockout", "group": None,
                            "matchId": m["matchId"], "nextMatchId": m["nextMatchId"],
                            "prevMatchIds": m["prevMatchIds"], "prevMatchId": m["prevMatchId"]})

    champion = [m for m in ms if m["round"] == "決勝"][0]["winner"]
    lost = {[e for e in m["entries"] if e != m["winner"]][0]: m["round"] for m in ms}
    results = []
    for no in sorted(ids_by_no):
        if no == champion:
            t = {"label": "優勝", "rank": {"kind": "winner"}}
        else:
            r = lost[no]
            if r in LATE_LABELS:
                label, rank = LATE_LABELS[r]
                t = {"label": label, "rank": rank}
            else:
                n = int(r[0])
                t = {"label": f"{n}回戦敗退", "rank": {"kind": "round", "round": n}}
        results.append({"entryNo": no, "tournament": t, "roundrobin": None})

    return {"participants": participants, "entries": entries,
            "matches": out_matches, "results": results}


def check(data):
    """組み上がった details を自己検査する。読み取り誤りはここで大半が捕まる。

    返り値は問題の一覧（空なら健全）。"""
    ms = data["matches"]
    by_id = {m["matchId"]: m for m in ms}
    problems = []

    for m in ms:
        if m["nextMatchId"] and m["nextMatchId"] not in by_id:
            problems.append(f"{m['matchId']}: nextMatchId {m['nextMatchId']} が存在しない")
        elif m["nextMatchId"] and m["winnerEntryNo"] not in by_id[m["nextMatchId"]]["entries"]:
            problems.append(f"{m['matchId']}: 勝者が次戦に現れない")
        if not m["nextMatchId"] and m["round"] != "決勝":
            problems.append(f"{m['matchId']}: 決勝でないのに次戦が無い")
        for p in m["prevMatchIds"]:
            if by_id[p]["winnerEntryNo"] not in m["entries"]:
                problems.append(f"{m['matchId']}: prev {p} の勝者が出場していない")

    seen = {}
    for m in ms:
        for e in m["entries"]:
            k = (m["round"], e)
            if k in seen:
                problems.append(f"{m['round']}: entryNo {e} が複数の試合に出ている")
            seen[k] = m["matchId"]

    if len(ms) != len(data["entries"]) - 1:
        problems.append(f"試合数 {len(ms)} がエントリー数-1 ({len(data['entries']) - 1}) と合わない")

    pl = {p["id"] for p in data["participants"]}
    for e in data["entries"]:
        for i in e["playerIds"]:
            if i not in pl:
                problems.append(f"entryNo {e['entryNo']}: participants に {i} が無い")

    champion = [m for m in ms if m["round"] == "決勝"][0]["winnerEntryNo"]
    lost = {[e for e in m["entries"] if e != m["winnerEntryNo"]][0]: m["round"] for m in ms}
    for r in data["results"]:
        no = r["entryNo"]
        if no == champion:
            exp = "優勝"
        else:
            rd = lost.get(no)
            exp = LATE_LABELS[rd][0] if rd in LATE_LABELS else f"{rd}敗退"
        if r["tournament"]["label"] != exp:
            problems.append(f"entryNo {no}: results が {r['tournament']['label']}、試合からは {exp}")

    return problems


def write(data, path, indent=2):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write("\n")
