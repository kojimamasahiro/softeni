# -*- coding: utf-8 -*-
"""
STリーグ/プレーオフ（団体戦・総当たり）PDF 解析スクリプト

対象PDF: 「ＳＴリーグ/プレーオフ 対戦成績」のような団体戦リーグ表。
上部に順位表（5チームの総当たり結果）、下部に各対戦カードの
ダブルス3番手の選手名・スコアが2カード並びで掲載されている形式。

既存の round_robin.py / secondary.py などはトーナメント/個人戦向けで
レイアウトが異なるため、本スクリプトを新設する。

出力 (output/ 配下):
  - st_league_teams.csv     : チーム番号・チーム名・最終順位・備考(STリーグ順位)
  - st_league_players.csv   : チーム別の出場選手（姓/名/フルネーム）
  - st_league_players.json  : 選手オブジェクト配列（既存players.jsonに寄せた形）
  - st_league_matches.csv   : 対戦カードごとの番手・スコア（ベストエフォート）
  - debug_st_league_pX.png  : 列範囲を可視化したデバッグ画像

使い方:
  1) PDF_PATH を対象ファイルに合わせる
  2) BLOCKS / TEAMS が異なるレイアウトの場合は座標を調整
  3) python3 st_league.py
"""

import os
import re
import json
import csv
from collections import defaultdict

import pdfplumber

# ====================== 設定 ======================
PDF_PATH = "st_league.pdf"  # 入力PDF（このファイル名に固定。対象PDFをこの名前で置く）
OUTPUT_DIR = "output"
GENDER = "男子"  # ラベル用

# チーム番号 -> チーム名（順位表の縦並び順 = 行番号）
# ※別大会で使う場合はここを書き換える
TEAMS = {
    1: "太平洋工業",
    2: "東ソー南陽",
    3: "日本信号",
    4: "ベスト",
    5: "東京ガス",
}

# 名前列のX座標バンド（左カード左/右、右カード左/右）
COL_BANDS = {
    "L1": (55, 150),    # 左カード・左チーム
    "R1": (200, 300),   # 左カード・右チーム
    "L2": (305, 410),   # 右カード・左チーム
    "R2": (470, 535),   # 右カード・右チーム
}
# スコア列のX座標バンド
SCORE_BANDS = {
    "M1": (135, 205),   # 左カードのスコア
    "M2": (398, 465),   # 右カードのスコア
}

# 対戦ブロック定義:
#   (ページidx0始まり, y_top, y_bottom, (左カード左T, 左カード右T, 右カード左T, 右カード右T))
# 男子NN ラベルは teamN 対 teamM を表す。
BLOCKS = [
    (0, 260, 395, (1, 2, 3, 4)),  # 男子12 / 男子34
    (0, 430, 560, (1, 3, 2, 5)),  # 男子13 / 男子25
    (0, 600, 730, (2, 3, 4, 5)),  # 男子23 / 男子45
    (1, 48, 180, (1, 4, 3, 5)),   # 男子14 / 男子35
    (1, 218, 350, (1, 5, 2, 4)),  # 男子15 / 男子24
]

NAME_GAP = 14          # 姓名を分割するX座標のしきい値
ROW_TOL = 3            # 同一行とみなすY許容
SCORE_CHARS = set("④③②①⓪0123456789-－/対=＝±＋")

# 順位表の領域（page1上部）
STANDINGS_PAGE = 0
STANDINGS_Y = (55, 235)


# ====================== 共通処理 ======================
def load_chars(page, y0, y1):
    return [c for c in page.chars if c["text"].strip() and y0 < c["top"] < y1]


def group_rows(chars):
    """Y座標で行ごとにまとめる -> {row_top: [chars...]}"""
    rows = {}
    for c in sorted(chars, key=lambda c: c["top"]):
        key = None
        for k in rows:
            if abs(k - c["top"]) <= ROW_TOL:
                key = k
                break
        rows.setdefault(c["top"] if key is None else key, []).append(c)
    return rows


def split_name(chars_in_cell):
    """セル内の文字（x0昇順）を姓と名に分割する。最大のX間隔で区切る。"""
    cs = sorted(chars_in_cell, key=lambda c: c["x0"])
    cs = [c for c in cs if c["text"] not in SCORE_CHARS]
    if not cs:
        return None
    if len(cs) == 1:
        return ("", cs[0]["text"])
    # 最大ギャップを探す
    best_i, best_gap = 1, -1
    for i in range(1, len(cs)):
        gap = cs[i]["x0"] - cs[i - 1]["x1"]
        if gap > best_gap:
            best_gap, best_i = gap, i
    if best_gap < NAME_GAP:
        # 区切りが弱い -> 2文字姓を既定
        best_i = min(2, len(cs) - 1)
    surname = "".join(c["text"] for c in cs[:best_i])
    given = "".join(c["text"] for c in cs[best_i:])
    return (surname, given)


# ====================== 順位表 ======================
def parse_standings(page):
    """チーム番号・名称・最終順位・STリーグ順位（備考）を抽出"""
    chars = load_chars(page, *STANDINGS_Y)
    rows = group_rows(chars)
    ordered = sorted(rows.items())  # (top, chars)

    results = []
    # 各チームのチーム名行 → 続く行に 勝率/得失差/順位、さらに（STリーグ順位）
    team_no = 0
    for top, cs in ordered:
        line = "".join(c["text"] for c in sorted(cs, key=lambda c: c["x0"]))
        # チーム名行（左端 x<200 に2文字以上、数字を含まない）
        name_chars = [c for c in cs if c["x0"] < 205 and not c["text"].isdigit()]
        name = "".join(c["text"] for c in sorted(name_chars, key=lambda c: c["x0"]))
        if name in TEAMS.values():
            team_no = [k for k, v in TEAMS.items() if v == name][0]
            results.append({"team_no": team_no, "team": name, "rank": None, "note": ""})
        elif "（" in line and "リーグ" in line and results:
            results[-1]["note"] = line.strip("（）()")
        else:
            # 順位（最右端の数字）を拾う: 行右側 x>520 の数字
            digits = [c for c in cs if c["x0"] > 520 and c["text"].isdigit()]
            if digits and results and results[-1]["rank"] is None:
                results[-1]["rank"] = int(digits[-1]["text"])
            # 太平洋工業のみ順位が '±03' のように末尾に付くケースを補助
            if results and results[-1]["rank"] is None:
                m = re.search(r"(?:±|＋|－|\+|-)\d+(\d)$", line)
                if m:
                    results[-1]["rank"] = int(m.group(1))
    return results


# ====================== 選手・試合 ======================
def parse_blocks(pdf):
    roster = defaultdict(dict)   # team_no -> {fullname: (surname, given)}
    matches = []                 # 試合（ベストエフォート）

    for pi, y0, y1, (ta, tb, tc, td) in BLOCKS:
        page = pdf.pages[pi]
        chars = load_chars(page, y0, y1)
        rows = group_rows(chars)

        cards = [
            ("L1", "R1", "M1", ta, tb),
            ("L2", "R2", "M2", tc, td),
        ]
        for lcol, rcol, mcol, t_left, t_right in cards:
            lb, rb, mb = COL_BANDS[lcol], COL_BANDS[rcol], SCORE_BANDS[mcol]
            name_rows = []   # (top, side, (surname,given))
            score_rows = []  # (top, text)
            for top in sorted(rows):
                cs = rows[top]
                for side, band, tno in (("L", lb, t_left), ("R", rb, t_right)):
                    cell = [c for c in cs if band[0] <= c["x0"] < band[1]]
                    nm = split_name(cell)
                    if nm and (nm[0] or nm[1]) and not all(
                        ch in SCORE_CHARS for ch in (nm[0] + nm[1])
                    ):
                        full = nm[0] + nm[1]
                        roster[tno][full] = nm
                        name_rows.append((top, side, nm, tno))
                # スコア
                sc = [c for c in cs if mb[0] <= c["x0"] < mb[1]]
                sc.sort(key=lambda c: c["x0"])
                txt = "".join(c["text"] for c in sc)
                if txt and re.search(r"[④③②①0-9]", txt):
                    score_rows.append((top, txt))

            matches.append(
                build_match(t_left, t_right, name_rows, score_rows)
            )
    return roster, matches


def build_match(t_left, t_right, name_rows, score_rows):
    """名前行とスコア行から番手ごとのペア/スコアをベストエフォートで構成。"""
    # チーム結果（〇対〇）を分離
    team_result = ""
    games = []
    for top, txt in score_rows:
        if "対" in txt:
            team_result = txt
        else:
            games.append((top, txt))
    games.sort()

    left_names = [(t, nm) for (t, s, nm, tno) in name_rows if s == "L"]
    right_names = [(t, nm) for (t, s, nm, tno) in name_rows if s == "R"]
    left_names.sort()
    right_names.sort()

    def cluster(names):
        """近接する名前行をペア(番手)単位にまとめる"""
        clusters = []
        for t, nm in names:
            if clusters and t - clusters[-1][-1][0] <= 22:
                clusters[-1].append((t, nm))
            else:
                clusters.append([(t, nm)])
        return clusters

    lc, rc = cluster(left_names), cluster(right_names)

    rows_out = []
    n = max(len(lc), len(rc), len(games))
    for i in range(n):
        lpair = ["".join(nm) for _, nm in lc[i]] if i < len(lc) else []
        rpair = ["".join(nm) for _, nm in rc[i]] if i < len(rc) else []
        score = games[i][1] if i < len(games) else ""
        rows_out.append(
            {
                "ban": i + 1,
                "left_pair": "・".join(lpair),
                "right_pair": "・".join(rpair),
                "score": score,
            }
        )
    return {
        "left_team": TEAMS[t_left],
        "right_team": TEAMS[t_right],
        "team_result": team_result,
        "games": rows_out,
    }


# ====================== 出力 ======================
def write_outputs(standings, roster, matches):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    rank_by_team = {s["team"]: s["rank"] for s in standings}

    # teams.csv
    with open(f"{OUTPUT_DIR}/st_league_teams.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["Team_No", "Team_Name", "Final_Rank", "Note"])
        for s in sorted(standings, key=lambda s: (s["rank"] or 99)):
            w.writerow([s["team_no"], s["team"], s["rank"], s["note"]])

    # players.csv
    with open(f"{OUTPUT_DIR}/st_league_players.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["Team_No", "Team_Name", "Final_Rank", "Surname", "First_Name", "Full_Name"])
        for tno in sorted(roster):
            tname = TEAMS[tno]
            for full, (sur, given) in sorted(roster[tno].items()):
                w.writerow([tno, tname, rank_by_team.get(tname), sur, given, full])

    # players.json（既存players.jsonに寄せた個人選手オブジェクト）
    players = []
    for tno in sorted(roster):
        tname = TEAMS[tno]
        for full, (sur, given) in sorted(roster[tno].items()):
            players.append({
                "lastName": sur,
                "firstName": given,
                "team": tname,
                "prefecture": "",
                "playerId": None,
                "tempId": f"{sur}_{given}_{tname}",
            })
    with open(f"{OUTPUT_DIR}/st_league_players.json", "w", encoding="utf-8") as f:
        f.write("[\n")
        for i, o in enumerate(players):
            line = json.dumps(o, ensure_ascii=False, separators=(",", ":"))
            f.write(line + (",\n" if i < len(players) - 1 else "\n"))
        f.write("]")

    # matches.csv（ベストエフォート）
    with open(f"{OUTPUT_DIR}/st_league_matches.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["Left_Team", "Right_Team", "Team_Result", "Ban", "Left_Pair", "Right_Pair", "Score"])
        for m in matches:
            for g in m["games"]:
                w.writerow([m["left_team"], m["right_team"], m["team_result"],
                            g["ban"], g["left_pair"], g["right_pair"], g["score"]])

    return players


def draw_debug(pdf):
    for pi in {b[0] for b in BLOCKS}:
        page = pdf.pages[pi]
        im = page.to_image(resolution=120)
        h = page.height
        for band in COL_BANDS.values():
            im.draw_rect((band[0], 0, band[1], h), stroke=(0, 0, 255), stroke_width=1)
        for band in SCORE_BANDS.values():
            im.draw_rect((band[0], 0, band[1], h), stroke=(255, 0, 0), stroke_width=1)
        for b in BLOCKS:
            if b[0] == pi:
                im.draw_line([(0, b[1]), (page.width, b[1])], stroke=(0, 180, 0), stroke_width=1)
                im.draw_line([(0, b[2]), (page.width, b[2])], stroke=(0, 180, 0), stroke_width=1)
        im.save(f"{OUTPUT_DIR}/debug_st_league_p{pi + 1}.png")


def main():
    if not os.path.exists(PDF_PATH):
        print(f"File not found: {PDF_PATH}")
        return
    with pdfplumber.open(PDF_PATH) as pdf:
        standings = parse_standings(pdf.pages[STANDINGS_PAGE])
        roster, matches = parse_blocks(pdf)
        players = write_outputs(standings, roster, matches)
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        draw_debug(pdf)

    print("=== 順位表 ===")
    for s in sorted(standings, key=lambda s: (s["rank"] or 99)):
        print(f"  {s['rank']}位 {s['team']} (No.{s['team_no']}) {s['note']}")
    print("=== チーム別選手 ===")
    for tno in sorted(roster):
        print(f"  {TEAMS[tno]}: {len(roster[tno])}名 ", "／".join(roster[tno].keys()))
    print(f"=== 合計選手数: {len(players)} / 対戦カード: {len(matches)} ===")
    print(f"出力先: {OUTPUT_DIR}/ (teams.csv, players.csv, players.json, matches.csv)")


if __name__ == "__main__":
    main()
