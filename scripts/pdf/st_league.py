# -*- coding: utf-8 -*-
"""
STリーグ/プレーオフ（団体戦・総当たり）PDF 解析スクリプト

対象: 「ＳＴリーグ/プレーオフ 対戦成績」のような団体戦リーグ表PDF。
  上部に順位表（5チームの総当たり）、下部に各対戦カードの
  D1(ダブルス①)→S(シングルス)→D2(ダブルス②) の選手名・スコアが
  2カード並びで掲載されている形式。

出力（アプリの data/st-league 実データと同じ形式 / output 配下）:
  1) st_league_participants.json … 登録用「参照元」。data/st-league/<year>/participants.json と同形式
                                    （teamId/division/name/players[lastName,firstName,id]）
  2) st_league_matches.json       … 試合結果。data/st-league/<year>/matches.json と同形式
                                    （id/division/date/status/teamA/teamB/winner/scoreA/scoreB/matches[D1,S,D2]）
  参考用CSVも併せて出力（teams / players / matches）。

ワークフロー（推奨）:
  STEP1: 本スクリプトを実行 → st_league_participants.json（登録ドラフト）が出る
  STEP2: teamId・選手ID・異体字などを手入力で補正し、PARTICIPANTS_REF に指定
  STEP3: 再実行 → 補正後IDで st_league_matches.json が生成される
         （PARTICIPANTS_REF 未指定時はドラフトの連番IDで暫定生成）

別大会で使う場合は ===設定=== の TEAMS / BLOCKS / 各種定数を調整する。
"""

import os
import re
import json
import csv
from collections import defaultdict

import pdfplumber

# ====================== 設定 ======================
PDF_PATH = "st_league.pdf"            # 入力PDF（このファイル名に固定）
OUTPUT_DIR = "output"
GENDER_KEY = "boys"                   # 男子=boys / 女子=girls
ID_BASE = 1                           # 選手IDの開始番号（大会ごとに独立した連番）
TIE_ID_BASE = 1                       # 試合(タイ)IDの開始番号
MATCH_DATE = "2025-12-20"             # 試合日（要確認・補正）
MATCH_DIVISION = "playoff"            # 試合のdivision値（入替戦。要確認）
STATUS = "finished"

# 補正済み参照元（任意）。存在すればここからID/teamIdを解決する。
# 例: "output/st_league_participants.fixed.json"
PARTICIPANTS_REF = ""

# 新規ID採番時に避ける予約ID（性別をまたいだ衝突回避用にmerge側が設定）
EXTRA_RESERVED_IDS = set()

# チーム番号 -> チーム名（順位表の縦並び順 = 行番号）
TEAMS = {
    1: "太平洋工業",
    2: "東ソー南陽",
    3: "日本信号",
    4: "ベスト",
    5: "東京ガス",
}

# チーム名 -> teamId（既存は実値、未登録は推測スラッグ。要補正）
TEAM_ID_MAP = {
    "太平洋工業": "pacific-ind",
    "東京ガス": "tokyo-gas",
    "東ソー南陽": "tosoh-nanyo",     # 未登録（推測）
    "日本信号": "nippon-signal",     # 未登録（推測）
    "ベスト": "best",                # 未登録（推測）
}

# 名前列のX座標バンド（左カード左/右、右カード左/右）。男女両テンプレ対応の汎用値。
COL_BANDS = {
    "L1": (55, 150), "R1": (200, 300), "L2": (305, 390), "R2": (455, 540),
}
SCORE_BANDS = {"M1": (135, 205), "M2": (388, 460)}

# 対戦ブロック: (page0始, y_top, y_bottom, (左カード左T,左カード右T,右カード左T,右カード右T))
BLOCKS = [
    (0, 260, 395, (1, 2, 3, 4)),  # 男子12 / 男子34
    (0, 430, 560, (1, 3, 2, 5)),  # 男子13 / 男子25
    (0, 600, 730, (2, 3, 4, 5)),  # 男子23 / 男子45
    (1, 48, 180, (1, 4, 3, 5)),   # 男子14 / 男子35
    (1, 218, 350, (1, 5, 2, 4)),  # 男子15 / 男子24
]

NAME_GAP = 14
ROW_TOL = 3
SCORE_CHARS = set("④③②①⓪0123456789-－/対=＝±＋")
SCORE_NUM = {"④": 4, "③": 3, "②": 2, "①": 1, "⓪": 0}

STANDINGS_PAGE = 0
STANDINGS_Y = (55, 235)

# 異体字の正規化（参照元との突合用）
KANJI_NORMAL = str.maketrans({
    "濵": "濱", "髙": "高", "﨑": "崎", "邊": "辺", "邉": "辺",
    "齋": "斎", "齊": "斎", "槗": "橋",
})


# ====================== 抽出共通 ======================
def load_chars(page, y0, y1):
    return [c for c in page.chars if c["text"].strip() and y0 < c["top"] < y1]


def group_rows(chars):
    rows = {}
    for c in sorted(chars, key=lambda c: c["top"]):
        key = next((k for k in rows if abs(k - c["top"]) <= ROW_TOL), None)
        rows.setdefault(c["top"] if key is None else key, []).append(c)
    return rows


def split_name(cell):
    cs = sorted([c for c in cell if c["text"] not in SCORE_CHARS], key=lambda c: c["x0"])
    if not cs:
        return None
    if len(cs) == 1:
        return ("", cs[0]["text"])
    best_i, best_gap = 1, -1
    for i in range(1, len(cs)):
        gap = cs[i]["x0"] - cs[i - 1]["x1"]
        if gap > best_gap:
            best_gap, best_i = gap, i
    if best_gap < NAME_GAP:
        best_i = min(2, len(cs) - 1)
    return ("".join(c["text"] for c in cs[:best_i]),
            "".join(c["text"] for c in cs[best_i:]))


def parse_score(text):
    """'④-0' / '0-④' / '④-3' -> (a, b)。取れなければ (None, None)"""
    t = text.replace("－", "-")
    parts = t.split("-")
    if len(parts) != 2:
        return None, None

    def val(s):
        s = s.strip()
        for k, v in SCORE_NUM.items():
            if k in s:
                return v
        m = re.search(r"\d", s)
        return int(m.group()) if m else None

    return val(parts[0]), val(parts[1])


# ====================== 順位表 ======================
def parse_standings(page):
    chars = load_chars(page, *STANDINGS_Y)
    rows = group_rows(chars)
    results = []
    for top, cs in sorted(rows.items()):
        line = "".join(c["text"] for c in sorted(cs, key=lambda c: c["x0"]))
        name_chars = [c for c in cs if c["x0"] < 240 and not c["text"].isdigit()]
        name = "".join(c["text"] for c in sorted(name_chars, key=lambda c: c["x0"]))
        if name in TEAMS.values():
            no = [k for k, v in TEAMS.items() if v == name][0]
            results.append({"team_no": no, "team": name, "rank": None, "note": ""})
        elif "（" in line and "リーグ" in line and results:
            results[-1]["note"] = line.strip("（）()")
        else:
            # 順位列はその行で最も右にあるASCII数字（得失差の数字より右）
            digits = [c for c in cs if c["text"].isdigit() and c["x0"] > 480]
            if digits and results and results[-1]["rank"] is None:
                results[-1]["rank"] = int(max(digits, key=lambda c: c["x0"])["text"])
    # division を note から推定（Ⅱを含めば2部、それ以外1部）
    for r in results:
        r["division"] = "2" if "Ⅱ" in r["note"] else "1"
    return results


# ====================== 選手・試合 ======================
def parse_blocks(pdf):
    roster = defaultdict(dict)   # team_no -> {(surname,given): order}
    order_seq = defaultdict(int)
    ties = []                    # 各対戦カード

    for pi, y0, y1, (ta, tb, tc, td) in BLOCKS:
        page = pdf.pages[pi]
        rows = group_rows(load_chars(page, y0, y1))
        for lcol, rcol, mcol, t_left, t_right in (
            ("L1", "R1", "M1", ta, tb),
            ("L2", "R2", "M2", tc, td),
        ):
            lb, rb, mb = COL_BANDS[lcol], COL_BANDS[rcol], SCORE_BANDS[mcol]
            name_rows, score_rows = [], []
            for top in sorted(rows):
                cs = rows[top]
                for side, band, tno in (("L", lb, t_left), ("R", rb, t_right)):
                    nm = split_name([c for c in cs if band[0] <= c["x0"] < band[1]])
                    if nm and (nm[0] or nm[1]) and not all(ch in SCORE_CHARS for ch in nm[0] + nm[1]):
                        if nm not in roster[tno]:
                            order_seq[tno] += 1
                            roster[tno][nm] = order_seq[tno]
                        name_rows.append((top, side, nm))
                sc = sorted([c for c in cs if mb[0] <= c["x0"] < mb[1]], key=lambda c: c["x0"])
                txt = "".join(c["text"] for c in sc)
                if txt and re.search(r"[④③②①0-9]", txt):
                    score_rows.append((top, txt))
            ties.append(build_tie(t_left, t_right, name_rows, score_rows))
    return roster, ties


def build_tie(t_left, t_right, name_rows, score_rows):
    team_result, games = "", []
    for top, txt in score_rows:
        (team_result := txt) if "対" in txt else games.append((top, txt))
    games.sort()

    def cluster(side):
        items = sorted([(t, nm) for (t, s, nm) in name_rows if s == side])
        out = []
        for t, nm in items:
            if out and t - out[-1][-1][0] <= 22:
                out[-1].append((t, nm))
            else:
                out.append([(t, nm)])
        return out

    lc, rc = cluster("L"), cluster("R")
    types = ["D1", "S", "D2"]
    sub = []
    for i in range(max(len(lc), len(rc), len(games))):
        lpair = [nm for _, nm in lc[i]] if i < len(lc) else []
        rpair = [nm for _, nm in rc[i]] if i < len(rc) else []
        a, b = parse_score(games[i][1]) if i < len(games) else (None, None)
        sub.append({
            "type": types[i] if i < len(types) else f"G{i+1}",
            "scoreA": a, "scoreB": b,
            "winner": "A" if (a or 0) > (b or 0) else ("B" if (b or 0) > (a or 0) else ""),
            "playersA": lpair, "playersB": rpair,
        })
    return {"team_left": t_left, "team_right": t_right, "team_result": team_result, "sub": sub}


# ====================== ID解決 ======================
def norm(s):
    return s.translate(KANJI_NORMAL)


def build_id_resolver(roster, standings):
    """選手(team_no,(sur,given))->id、team_no->teamId を決定。
    PARTICIPANTS_REF があれば名前一致で既存IDを優先採用、無ければ連番付与。"""
    rank_div = {s["team_no"]: s["division"] for s in standings}
    ref_players = {}   # norm(team)+norm(name) -> id  /  norm(name)->id
    ref_team = {}      # norm(team名) -> teamId
    if PARTICIPANTS_REF and os.path.exists(PARTICIPANTS_REF):
        ref = json.load(open(PARTICIPANTS_REF, encoding="utf-8"))
        for t in ref.get(GENDER_KEY, []):
            for nm in t.get("name", []):
                ref_team[norm(nm)] = t["teamId"]
            for p in t.get("players", []):
                key = norm(p["lastName"] + p["firstName"])
                ref_players[(t["teamId"], key)] = p["id"]
                ref_players[(None, key)] = p["id"]

    player_id = {}     # (team_no,(sur,given)) -> id
    team_id = {}       # team_no -> teamId
    used = set(ref_players.values()) | set(EXTRA_RESERVED_IDS)
    # 新規IDは既存最大の続きから（衝突回避）。参照元が無ければ ID_BASE から。
    next_id = (max(used) + 1) if used else ID_BASE

    for no in sorted(roster):
        tname = TEAMS[no]
        tid = ref_team.get(norm(tname)) or TEAM_ID_MAP.get(tname, tname)
        team_id[no] = tid
        for (sur, given), _ in sorted(roster[no].items(), key=lambda kv: kv[1]):
            key = norm(sur + given)
            # 誤マッピング防止のため「同一teamId内の氏名一致」のみ既存IDを採用
            rid = ref_players.get((tid, key))
            if rid is None:
                rid = next_id
                next_id += 1
                while next_id in used:
                    next_id += 1
            player_id[(no, (sur, given))] = rid
    return player_id, team_id, rank_div


# ====================== 出力組み立て ======================
def build_participants(roster, standings, player_id, team_id):
    teams = []
    div_by_no = {s["team_no"]: s["division"] for s in standings}
    for no in sorted(roster):
        teams.append({
            "teamId": team_id[no],
            "division": div_by_no.get(no, "1"),
            "name": [TEAMS[no]],
            "players": [
                {"lastName": sur, "firstName": given, "id": player_id[(no, (sur, given))]}
                for (sur, given), _ in sorted(roster[no].items(), key=lambda kv: kv[1])
            ],
        })
    return {GENDER_KEY: teams}


def build_matches(ties, player_id, team_id):
    out = []
    for i, tie in enumerate(ties):
        nl, nr = tie["team_left"], tie["team_right"]
        details, a_wins, b_wins = [], 0, 0
        for s in tie["sub"]:
            pa = [player_id[(nl, nm)] for nm in s["playersA"]]
            pb = [player_id[(nr, nm)] for nm in s["playersB"]]
            if s["winner"] == "A":
                a_wins += 1
            elif s["winner"] == "B":
                b_wins += 1
            details.append({
                "type": s["type"], "winner": s["winner"],
                "scoreA": s["scoreA"], "scoreB": s["scoreB"],
                "playersA": pa, "playersB": pb,
            })
        winner = team_id[nl] if a_wins > b_wins else (team_id[nr] if b_wins > a_wins else "")
        out.append({
            "id": TIE_ID_BASE + i,
            "division": MATCH_DIVISION,
            "date": MATCH_DATE,
            "status": STATUS,
            "teamA": team_id[nl],
            "teamB": team_id[nr],
            "winner": winner,
            "scoreA": a_wins,
            "scoreB": b_wins,
            "matches": details,
        })
    return {GENDER_KEY: out}


# ====================== 書き出し ======================
def dump_json(obj, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=4)
        f.write("\n")


def write_csv_refs(standings, roster, ties, player_id, team_id):
    rank_by = {s["team_no"]: s["rank"] for s in standings}
    with open(f"{OUTPUT_DIR}/st_league_teams.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["Team_No", "Team_Name", "Team_Id", "Division", "Final_Rank", "Note"])
        for s in sorted(standings, key=lambda s: (s["rank"] or 99)):
            w.writerow([s["team_no"], s["team"], team_id[s["team_no"]],
                        s["division"], s["rank"], s["note"]])
    with open(f"{OUTPUT_DIR}/st_league_players.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["Player_Id", "Team_Id", "Team_Name", "Surname", "First_Name", "Full_Name"])
        for no in sorted(roster):
            for (sur, given), _ in sorted(roster[no].items(), key=lambda kv: kv[1]):
                w.writerow([player_id[(no, (sur, given))], team_id[no], TEAMS[no],
                            sur, given, sur + given])
    with open(f"{OUTPUT_DIR}/st_league_matches.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["Tie_Id", "Team_A", "Team_B", "Type", "ScoreA", "ScoreB",
                    "Winner", "PlayersA", "PlayersB"])
        for i, tie in enumerate(ties):
            for s in tie["sub"]:
                w.writerow([
                    TIE_ID_BASE + i, TEAMS[tie["team_left"]], TEAMS[tie["team_right"]],
                    s["type"], s["scoreA"], s["scoreB"], s["winner"],
                    "・".join("".join(nm) for nm in s["playersA"]),
                    "・".join("".join(nm) for nm in s["playersB"]),
                ])


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
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with pdfplumber.open(PDF_PATH) as pdf:
        standings = parse_standings(pdf.pages[STANDINGS_PAGE])
        roster, ties = parse_blocks(pdf)
        player_id, team_id, _ = build_id_resolver(roster, standings)

        participants = build_participants(roster, standings, player_id, team_id)
        matches = build_matches(ties, player_id, team_id)

        dump_json(participants, f"{OUTPUT_DIR}/st_league_participants.json")
        dump_json(matches, f"{OUTPUT_DIR}/st_league_matches.json")
        write_csv_refs(standings, roster, ties, player_id, team_id)
        draw_debug(pdf)

    ref_note = f"参照元: {PARTICIPANTS_REF}" if PARTICIPANTS_REF and os.path.exists(PARTICIPANTS_REF) else "参照元なし（連番ID自動付与）"
    print("=== 順位表 ===")
    for s in sorted(standings, key=lambda s: (s["rank"] or 99)):
        print(f"  {s['rank']}位 {s['team']} (No.{s['team_no']} / div{s['division']} / {team_id[s['team_no']]}) {s['note']}")
    print("=== チーム別選手（ID） ===")
    for no in sorted(roster):
        names = "／".join(f"{sur}{given}#{player_id[(no,(sur,given))]}"
                          for (sur, given), _ in sorted(roster[no].items(), key=lambda kv: kv[1]))
        print(f"  {team_id[no]}({TEAMS[no]}): {len(roster[no])}名  {names}")
    print(f"=== 対戦カード: {len(ties)} / {ref_note} ===")
    print(f"出力: {OUTPUT_DIR}/ st_league_participants.json, st_league_matches.json, *.csv")


if __name__ == "__main__":
    main()
