# -*- coding: utf-8 -*-
"""
STリーグⅡ 1日目 予選リーグ（8ブロック×4チーム総当たり）PDF 解析。

  - page1-2（縦）: 各ブロックの順位表（番号/チーム名/順位/都道府県）
  - page3-4（横）: 個別対戦成績。1ブロック = 3列×2段 = 6試合（総当たり）。
                   左端に縦書きのブロック名。

各ブロック1位が2日目(順位決定戦, st_league2.py)へ進出。
出力はブロック情報付きの選手/チーム/試合（division="2", label="予選 Xブロック"）。

統合は merge_prelim.py。
"""

import os
import re
import json

import pdfplumber

import st_league2 as S2  # parse_header / parse_bante / chunk_people 流用

PDF_PATH = "st_league2_men_day1.pdf"
OUTPUT_DIR = "output"
GENDER_KEY = "boys"
DIVISION = "2"

# 32チームの teamId（既存8＝2日目進出、他24は推測スラッグ。要補正）
NAME2ID = {
    # A
    "ＵＢＥ": "ube", "北海道電力": "hokkaido-electric",
    "NTT東日本東京": "ntt-east-tokyo", "トヨタ自動車": "toyota",
    # B
    "ＥＮＥＯＳ": "eneos", "ノアインドアステージ": "noah-indoor-stage",
    "不二越": "fujikoshi", "プロテリアル": "proterial",
    # C
    "川口市役所": "kawaguchi-city", "トヨタ自動車東日本": "toyota-east",
    "JR北海道": "jr-hokkaido", "日本製鉄大分": "nipponsteel-oita",
    # D
    "ベスト": "best", "今治市役所": "imabari-city",
    "ＪＸ金属倉見": "jx-kurami", "マツダ": "mazda",
    # E
    "十八親和銀行": "juhachi-shinwa", "クラレ岡山": "kuraray-okayama",
    "JR東日本仙台": "jr-east-sendai", "厚木市役所": "atsugi-city",
    # F
    "日本信号": "nippon-signal", "四国ガス産業": "shikoku-gas",
    "八王子市役所": "hachioji-city", "明電舎": "meidensha",
    # G
    "CROSSTYHOLDINGS": "crossty-holdings", "京都第二赤十字病院": "kyoto-daini-rc",
    "JR東日本東京": "jr-east-tokyo", "福岡市役所": "fukuoka-city",
    # H
    "東ソー南陽": "tosoh-nanyo", "松本市役所": "matsumoto-city",
    "中部電力愛知": "chubu-electric-aichi", "市川市役所": "ichikawa-city",
}


def ns(s):
    return s.replace(" ", "").replace("　", "")


def resolve(raw):
    return NAME2ID.get(ns(raw))


# ---------- page1-2 ブロック順位表 ----------
def parse_standings(pages):
    teams = []  # {block, rank, name, pref, teamId}
    for p in pages:
        block = None
        pending = None
        for line in (p.extract_text() or "").split("\n"):
            s = ns(line)
            mb = re.match(r"^([Ａ-ＨA-H])ブロック", s)
            if mb:
                block = mb.group(1).translate(str.maketrans("ＡＢＣＤＥＦＧＨ", "ABCDEFGH"))
                pending = None
                continue
            if not s or "チーム名" in s or "番号" in s:
                continue
            mp = re.match(r"^（(.+?)）", s)
            if mp:
                if pending and block:
                    teams.append({"block": block, "name": pending[0],
                                  "rank": pending[1], "pref": mp.group(1),
                                  "teamId": resolve(pending[0])})
                    pending = None
                continue
            # 順位行: 先頭が全角/半角数字（番号）。最後のASCII数字が順位
            if re.match(r"^[０-９0-9]", s) and pending:
                digits = re.findall(r"[0-9]", line)
                pending = (pending[0] if isinstance(pending, tuple) else pending,
                           int(digits[-1]) if digits else None)
                continue
            # チーム名行（数字を含まない）
            if not any(ch.isdigit() for ch in line):
                pending = ns(line)
    return teams


# ---------- page3-4 個別対戦 ----------
COLS = [(40, 278), (285, 522), (529, 778)]
# 各ブロックのヘッダ行(ー)のtop。band = (h-7, h+47)
PAGE_BLOCKS = {
    2: [("A", 67), ("A", 129), ("B", 197), ("B", 259),
        ("C", 327), ("C", 389), ("D", 458), ("D", 520)],
    3: [("E", 67), ("E", 129), ("F", 197), ("F", 259),
        ("G", 327), ("G", 389), ("H", 458), ("H", 520)],
}
STRAY = set("ABCDEFGHブロッく ク・")


def crop_lines(page, x0, y0, x1, y1):
    txt = page.crop((x0, y0, x1, y1)).extract_text(layout=True, x_tolerance=1.5) or ""
    out = []
    for l in txt.split("\n"):
        l = l.strip()
        if l and l not in STRAY and l != "その１" and l != "その２":
            out.append(l)
    return out


def parse_ties(pages_map, pages):
    ties = []
    roster = {}
    order = {}

    def add(tid, ppl):
        if not tid:
            return
        roster.setdefault(tid, {})
        for p in ppl:
            if p not in roster[tid]:
                order[tid] = order.get(tid, 0) + 1
                roster[tid][p] = order[tid]

    for pi, blocks in pages_map.items():
        page = pages[pi]
        for (block, hy) in blocks:
            y0, y1 = hy - 7, hy + 47
            for (x0, x1) in COLS:
                lines = crop_lines(page, x0, y0, x1, y1)
                # ヘッダ = 最初の "ー" を含む行
                hi = next((i for i, l in enumerate(lines) if "ー" in l), None)
                if hi is None:
                    continue
                hdr = S2.parse_header(lines[hi])
                if not hdr:
                    continue
                teamA, sA, sB, teamB = hdr
                tidA, tidB = resolve(teamA), resolve(teamB)
                bantes = []
                for l in lines[hi + 1:]:
                    if "－" in l:
                        pb = S2.parse_bante(l)
                        if pb:
                            bantes.append(pb)
                    if len(bantes) >= 3:
                        break
                for (bsA, bsB, pA, pB) in bantes:
                    add(tidA, pA)
                    add(tidB, pB)
                ties.append({"block": block, "label": f"予選 {block}ブロック",
                             "teamA": tidA, "teamB": tidB,
                             "rawA": teamA, "rawB": teamB,
                             "scoreA": sA, "scoreB": sB, "bantes": bantes})
    return ties, roster


def main():
    if not os.path.exists(PDF_PATH):
        print(f"File not found: {PDF_PATH}")
        return
    with pdfplumber.open(PDF_PATH) as pdf:
        standings = parse_standings([pdf.pages[0], pdf.pages[1]])
        ties, roster = parse_ties(PAGE_BLOCKS, pdf.pages)

    print(f"=== ブロック順位表: {len(standings)}チーム ===")
    cur = None
    for t in sorted(standings, key=lambda x: (x["block"], x["rank"] or 9)):
        if t["block"] != cur:
            cur = t["block"]
            print(f"--- {cur}ブロック ---")
        print(f"  {t['rank']}位 {t['name']} ({t['pref']}) -> {t['teamId']}")
    unresolved = [t["name"] for t in standings if not t["teamId"]]
    print("未解決teamId:", unresolved)
    print(f"=== 対戦 {len(ties)} 件 / 選手保有チーム {len(roster)} ===")
    for tid, ppl in roster.items():
        print(f"  {tid}: {len(ppl)}名")


if __name__ == "__main__":
    main()
