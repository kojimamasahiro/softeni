# -*- coding: utf-8 -*-
"""
st_league.py で解析したプレーオフ結果を、アプリ実データ
data/st-league/<YEAR>/{participants.json, matches.json} へ統合する。

方針:
  - 既存 participants.json を参照元にしてIDを解決
    （同一teamId内で氏名一致した選手は既存IDを継承、新規選手は既存最大+1から採番／
      男女横断の全IDを予約して衝突回避）
  - 既存チームには新規選手のみ追記、未登録チームは新規追加
  - 試合(タイ)は既存 matches に追記（id は既存最大+1 から連番）
  - 上書き前に output/backup_<YEAR>/ へ自動バックアップ
  - まず output/merged_*.json に書き出して検証 → APPLY=True で data/ へ反映

使い方:
  PROFILE を "boys" / "girls" で選び、
  1) DRY-RUN: python3 merge_into_data.py      （merged_*.json を出力、data は不変）
  2) 反映:    APPLY=True にして再実行           （バックアップ後 data/ を更新）
"""

import os
import json
import shutil

import st_league as S

# ====================== 設定 ======================
YEAR = "2025"
APPLY = False
PROFILE = "girls"                  # "boys" or "girls"

# 大会ごとのレイアウト/チーム定義
PROFILES = {
    "boys": {
        "pdf": "st_league_boys.pdf",
        "gender": "boys",
        "date": "2025-12-20",
        "standings_y": (55, 235),
        "teams": {1: "太平洋工業", 2: "東ソー南陽", 3: "日本信号", 4: "ベスト", 5: "東京ガス"},
        "team_id_map": {
            "太平洋工業": "pacific-ind", "東京ガス": "tokyo-gas",
            "東ソー南陽": "tosoh-nanyo", "日本信号": "nippon-signal", "ベスト": "best",
        },
        # (page, y_top, y_bottom, (左カード左,左カード右,右カード左,右カード右))
        "blocks": [
            (0, 260, 395, (1, 2, 3, 4)),
            (0, 430, 560, (1, 3, 2, 5)),
            (0, 600, 730, (2, 3, 4, 5)),
            (1, 48, 180, (1, 4, 3, 5)),
            (1, 218, 350, (1, 5, 2, 4)),
        ],
    },
    "girls": {
        "pdf": "st_league_girls.pdf",
        "gender": "girls",
        "date": "2025-12-20",
        "standings_y": (60, 185),
        "teams": {1: "東芝姫路", 2: "川口市役所", 3: "トヨタ自動車", 4: "太平洋工業"},
        "team_id_map": {
            "東芝姫路": "toshiba",           # 既存（女子Ⅰ部）
            "川口市役所": "kawaguchi-city",  # 未登録（推測）
            "トヨタ自動車": "toyota",        # 未登録（推測）
            "太平洋工業": "pacific-ind",     # 男子と同一団体のため共有
        },
        "blocks": [
            (0, 255, 395, (1, 2, 3, 4)),  # 女子12 / 女子34
            (0, 415, 555, (1, 3, 2, 4)),  # 女子13 / 女子24
            (0, 575, 705, (2, 3, 1, 4)),  # 女子23 / 女子14
        ],
    },
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def dump(obj, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=4)
        f.write("\n")


def main():
    cfg = PROFILES[PROFILE]
    data_dir = f"../../data/st-league/{YEAR}"
    part_path = f"{data_dir}/participants.json"
    match_path = f"{data_dir}/matches.json"
    existing_part = load(part_path)
    existing_match = load(match_path)

    # st_league にプロファイルを適用
    S.PDF_PATH = cfg["pdf"]
    S.GENDER_KEY = cfg["gender"]
    S.STANDINGS_Y = cfg["standings_y"]
    S.TEAMS = cfg["teams"]
    S.TEAM_ID_MAP = cfg["team_id_map"]
    S.BLOCKS = cfg["blocks"]
    S.MATCH_DATE = cfg["date"]
    S.MATCH_DIVISION = "playoff"
    S.PARTICIPANTS_REF = part_path

    import pdfplumber
    pdf = pdfplumber.open(S.PDF_PATH)
    standings = S.parse_standings(pdf.pages[0])
    roster, ties = S.parse_blocks(pdf)

    # 既存IDは性別をまたいで共通。全IDを予約し衝突しない番号から採番
    all_ids = [p["id"] for g in ("boys", "girls") for t in existing_part[g]
               for p in t.get("players", [])]
    S.EXTRA_RESERVED_IDS = set(all_ids)
    S.ID_BASE = (max(all_ids) + 1) if all_ids else 1
    max_tie = max((m["id"] for m in existing_match[S.GENDER_KEY]), default=0)
    S.TIE_ID_BASE = max_tie + 1

    player_id, team_id, _ = S.build_id_resolver(roster, standings)
    div_by_no = {s["team_no"]: s["division"] for s in standings}

    g = S.GENDER_KEY
    by_id = {t["teamId"]: t for t in existing_part[g]}
    added_players, added_teams = [], []
    for no in sorted(roster):
        tid = team_id[no]
        new_players = [
            {"lastName": sur, "firstName": given, "id": player_id[(no, (sur, given))]}
            for (sur, given), _ in sorted(roster[no].items(), key=lambda kv: kv[1])
        ]
        if tid in by_id:
            team = by_id[tid]
            have = {p["id"] for p in team.get("players", [])}
            for p in new_players:
                if p["id"] not in have:
                    team.setdefault("players", []).append(p)
                    added_players.append((tid, p))
        else:
            team_obj = {
                "teamId": tid,
                "division": div_by_no.get(no, "2"),
                "name": [S.TEAMS[no]],
                "players": new_players,
            }
            existing_part[g].append(team_obj)
            by_id[tid] = team_obj
            added_teams.append(tid)
            added_players += [(tid, p) for p in new_players]

    new_matches = S.build_matches(ties, player_id, team_id)[g]
    existing_ids = {m["id"] for m in existing_match[g]}
    appended = [m for m in new_matches if m["id"] not in existing_ids]
    existing_match[g].extend(appended)

    os.makedirs(S.OUTPUT_DIR, exist_ok=True)
    dump(existing_part, f"{S.OUTPUT_DIR}/merged_participants.json")
    dump(existing_match, f"{S.OUTPUT_DIR}/merged_matches.json")

    print(f"=== 統合サマリ (YEAR={YEAR}, PROFILE={PROFILE}, GENDER={g}) ===")
    print("順位:", " / ".join(f"{s['rank']}位{s['team']}({team_id[s['team_no']]})"
                            for s in sorted(standings, key=lambda s: (s['rank'] or 99))))
    print(f"新規チーム: {added_teams}")
    print(f"新規選手 {len(added_players)}名:")
    for tid, p in added_players:
        print(f"   {tid}: {p['lastName']}{p['firstName']} #{p['id']}")
    if appended:
        print(f"追加試合: {len(appended)} 件 (id {appended[0]['id']}〜{appended[-1]['id']})")
    print(f"検証用出力: {S.OUTPUT_DIR}/merged_participants.json, merged_matches.json")

    if APPLY:
        backup = f"{S.OUTPUT_DIR}/backup_{YEAR}"
        os.makedirs(backup, exist_ok=True)
        shutil.copy(part_path, f"{backup}/participants.json")
        shutil.copy(match_path, f"{backup}/matches.json")
        dump(existing_part, part_path)
        dump(existing_match, match_path)
        print(f"\n*** APPLIED: data/ を更新（バックアップ: {backup}/） ***")
    else:
        print("\n(DRY-RUN) data/ は未変更。APPLY=True で反映。")


if __name__ == "__main__":
    main()
