# -*- coding: utf-8 -*-
"""
STリーグⅡ（順位決定戦・ノックアウト形式）PDF 解析スクリプト

対象: 「順位決定戦 個別対戦成績」のように、上位/下位トーナメントで順位を決める形式。
  - page1: 最終順位（チーム名＋都道府県）
  - page2: トーナメント表（本スクリプトでは未使用）
  - page3: 各対戦カードの個別成績（D1/S/D2のペア・スコア）。決着済みのD2は「－」のみ＝未実施。

プレーオフ（総当たり）の st_league.py とはレイアウトが全く異なるため別スクリプト。

出力（output/ 配下、アプリ実データ形式）:
  - st2_participants.json … チーム＋選手（参照元）
  - st2_matches.json      … 順位決定戦の各対戦（division="2", labelにラウンド名）
  - st2_standings.json    … 公式順位 [{rank, teamId, name, prefecture}]
  - 参考CSVも出力

統合は merge_st2.py で行う。
"""

import os
import re
import json
import csv

import pdfplumber

PDF_PATH = "st_league2_men.pdf"
OUTPUT_DIR = "output"
GENDER_KEY = "boys"
DIVISION = "2"

# 最終順位（page1）順のチーム定義（teamId/都道府県は確認・補正可）
TEAMS2 = [
    {"rank": 1, "name": "日本信号",        "pref": "埼玉県", "teamId": "nippon-signal"},
    {"rank": 2, "name": "ベスト",          "pref": "東京都", "teamId": "best"},
    {"rank": 3, "name": "東ソー南陽",      "pref": "山口県", "teamId": "tosoh-nanyo"},
    {"rank": 4, "name": "トヨタ自動車",    "pref": "愛知県", "teamId": "toyota"},
    {"rank": 5, "name": "十八親和銀行",    "pref": "長崎県", "teamId": "juhachi-shinwa"},
    {"rank": 6, "name": "川口市役所",      "pref": "埼玉県", "teamId": "kawaguchi-city"},
    {"rank": 7, "name": "京都第二赤十字病院", "pref": "京都府", "teamId": "kyoto-daini-rc"},
    {"rank": 8, "name": "ＥＮＥＯＳ",      "pref": "岡山県", "teamId": "eneos"},
]
NAME2ID = {t["name"]: t["teamId"] for t in TEAMS2}
NAME2ID_NS = {t["name"].replace(" ", ""): t["teamId"] for t in TEAMS2}

# page3 の対戦行（team名行top-4 〜 +54）と左右ラウンドラベル
TIE_ROWS = [
    (123, 181, "順位決定戦 1回戦", "順位決定戦 1回戦"),
    (201, 259, "順位決定戦 1回戦", "順位決定戦 1回戦"),
    (304, 362, "5・6位決定戦 1回戦", "5・6位決定戦 1回戦"),
    (407, 465, "順位決定戦 2回戦", "順位決定戦 2回戦"),
    (510, 568, "5・6位決定戦", "7・8位決定戦"),
    (613, 671, "1・2位決定戦", "3・4位決定戦"),
]
X_SPLIT = 300

SC = {"④": 4, "③": 3, "②": 2, "①": 1, "⓪": 0}


def score_val(tok):
    if tok in SC:
        return SC[tok]
    if tok.isdigit():
        return int(tok)
    return None


def is_score(tok):
    return tok in SC or (len(tok) == 1 and tok.isdigit())


def chunk_people(tokens):
    """[姓,名,姓,名,...] -> [(姓,名),...]"""
    toks = [t for t in tokens if t != "・"]
    people = []
    i = 0
    while i + 1 < len(toks) + 1 and i + 1 <= len(toks) - (len(toks) % 2):
        people.append((toks[i], toks[i + 1]))
        i += 2
    return people


# チーム名に「ー」を含む場合（東ソー南陽 等）に備え、スコアで挟まれた「ー」を区切りとする
HDR_RE = re.compile(r"^(.+?)\s*([④③②①⓪0-9])\s*ー\s*([④③②①⓪0-9])\s*(.+)$")


def parse_header(line):
    m = HDR_RE.search(line)
    if not m:
        return None
    teamA = m.group(1).strip()
    sA = score_val(m.group(2))
    sB = score_val(m.group(3))
    teamB = m.group(4).strip()
    return teamA, sA, sB, teamB


RETIRE = ("R", "Ｒ", "r")


def parse_bante(line):
    if "－" not in line:
        return None
    L, R = line.split("－", 1)
    lt, rt = L.split(), R.split()
    sA = None
    if lt and (is_score(lt[-1]) or lt[-1] in RETIRE):
        sA = score_val(lt[-1])  # R はスコアなし(None)として消費
        lt = lt[:-1]
    sB = None
    if rt and (is_score(rt[0]) or rt[0] in RETIRE):
        sB = score_val(rt[0])
        rt = rt[1:]
    return sA, sB, chunk_people(lt), chunk_people(rt)


def crop_lines(page, x0, y0, x1, y1):
    crop = page.crop((x0, y0, x1, y1))
    txt = crop.extract_text(layout=True, x_tolerance=1.5) or ""
    return [l.strip() for l in txt.split("\n") if l.strip()]


def resolve_team(raw):
    ns = raw.replace(" ", "")
    return NAME2ID_NS.get(ns), ns


def parse_standings(page):
    """page1 から rank/name/pref を抽出（TEAMS2 と突合）。"""
    text = page.extract_text() or ""
    out = []
    for line in text.split("\n"):
        m = re.match(r"^([０-９0-9]+)位\s*(.+?)\s*（(.+?)）", line.replace(" ", ""))
        if m:
            name = m.group(2)
            tid = NAME2ID_NS.get(name)
            out.append({"rank": int(m.group(1).translate(str.maketrans("０１２３４５６７８９", "0123456789"))),
                        "name": name, "prefecture": m.group(3), "teamId": tid})
    return out


def parse_ties(page):
    ties = []
    roster = {}  # teamId -> dict[(sur,given)] = order
    order = {}
    for (y0, y1, labL, labR) in TIE_ROWS:
        for side, xr, label in (("L", (0, X_SPLIT), labL), ("R", (X_SPLIT, 595), labR)):
            lines = crop_lines(page, xr[0], y0, xr[1], y1)
            if not lines:
                continue
            hdr = parse_header(lines[0])
            if not hdr:
                continue
            teamA, sA, sB, teamB = hdr
            tidA, _ = resolve_team(teamA)
            tidB, _ = resolve_team(teamB)
            bantes = []
            for ln in lines[1:]:
                pb = parse_bante(ln)
                if pb:
                    bantes.append(pb)
            # 選手をロスターへ（未実施番手も含め採取）
            for (bsA, bsB, pplA, pplB) in bantes:
                for p in pplA:
                    if tidA:
                        roster.setdefault(tidA, {})
                        if p not in roster[tidA]:
                            order[tidA] = order.get(tidA, 0) + 1
                            roster[tidA][p] = order[tidA]
                for p in pplB:
                    if tidB:
                        roster.setdefault(tidB, {})
                        if p not in roster[tidB]:
                            order[tidB] = order.get(tidB, 0) + 1
                            roster[tidB][p] = order[tidB]
            ties.append({
                "label": label, "teamA": tidA, "teamB": tidB,
                "rawA": teamA, "rawB": teamB,
                "scoreA": sA, "scoreB": sB, "bantes": bantes,
            })
    return ties, roster


def main():
    if not os.path.exists(PDF_PATH):
        print(f"File not found: {PDF_PATH}")
        return
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with pdfplumber.open(PDF_PATH) as pdf:
        standings = parse_standings(pdf.pages[0])
        ties, roster = parse_ties(pdf.pages[2])

    print("=== 公式順位 (page1) ===")
    for s in standings:
        print(f"  {s['rank']}位 {s['name']} ({s['prefecture']}) -> {s['teamId']}")
    print("=== チーム別選手 (page3) ===")
    for t in TEAMS2:
        tid = t["teamId"]
        ppl = roster.get(tid, {})
        names = "／".join(f"{s}{g}" for (s, g) in ppl)
        print(f"  {tid}({t['name']}): {len(ppl)}名  {names}")
    print(f"=== 対戦 {len(ties)} 件 ===")
    for ti in ties:
        types = ["D1", "S", "D2"]
        detail = " | ".join(
            f"{types[i] if i < 3 else '?'}:{b[0]}-{b[1]}" for i, b in enumerate(ti["bantes"])
        )
        print(f"  [{ti['label']}] {ti['rawA']} {ti['scoreA']}-{ti['scoreB']} {ti['rawB']}  {detail}")


if __name__ == "__main__":
    main()
