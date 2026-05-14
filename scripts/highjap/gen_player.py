# python gen_player.py |sed s/$/,/ |pbcopy 

import json
import re


# ファイルからデータを読み込む
def read_file_text(path):
    with open(path, encoding="utf-8") as f:
        return f.read().strip()

player_lines = read_file_text("data/players.txt")
tournament_lines = read_file_text("data/tournament.txt")

# 空白と半角数字を除去
def normalize_tournament_lines(raw_text):
    return "\n".join([re.sub(r'[ 　0-9]+', '', line) for line in raw_text.strip().splitlines()])

# トーナメント行をパース
def parse_tournament_lines(tournament_lines):
    entries = []
    for line in tournament_lines.strip().splitlines():
        name_part = line.split("(")[0].strip()
        match = re.search(r'（?\s*([^\s：()]+?[都道府県])\s*：\s*([^)）]+)', line)
        if not match:
            continue
        prefecture = match.group(1)
        team = match.group(2)
        last_names = [name.strip() for name in name_part.split("・")]
        entries.append({
            "lastNames": last_names,
            "team": team,
            "prefecture": prefecture
        })
    return entries

# 選手データを辞書化
def build_fullname_dict(player_lines):
    player_map = {}
    for line in player_lines.strip().splitlines():
        cols = line.split("\t")
        if len(cols) != 4:
            continue
        prefecture, school, p1, p2 = cols
        prefecture = prefecture.strip()
        for name in [p1, p2]:
            name = name.strip()
            if "　" not in name:
                continue  # 姓名の区切りがない場合はスキップ
            last, first = name.split("　", 1)
            key = prefecture + last + first
            player_map[key] = {
                "lastName": last,
                "firstName": first,
                "team": school.strip(),  # 正式名称
                "prefecture": prefecture,
                "playerId": None,
                "tempId": f"{last}_{first}_{school.strip()}"
            }
    return player_map

# 出力生成（シングルス対応）
def generate_output_with_original_team(player_lines, tournament_lines):
    tournament_data = parse_tournament_lines(tournament_lines)
    player_map = build_fullname_dict(player_lines)
    output = []

    def normalize_prefecture(pref):
        return re.sub(r'[都府県]$', '', pref)

    for idx, entry in enumerate(tournament_data, 1):
        abbrev_team = entry["team"]
        full_prefecture = entry["prefecture"]
        norm_prefecture = normalize_prefecture(full_prefecture)
        info_list = []

        for last_name in entry["lastNames"]:
            match = None
            # 正規化した都道府県＋姓で判定
            for key, value in player_map.items():
                if key.startswith(norm_prefecture + last_name):
                    match = {
                        **value,
                        "originalTeam": value["team"],
                        "team": abbrev_team,
                        "tempId": f"{value['lastName']}_{value['firstName']}_{abbrev_team}"
                    }
                    break
            if match:
                info_list.append({
                    "lastName": match["lastName"],
                    "firstName": match["firstName"],
                    "team": match["team"],
                    "originalTeam": match["originalTeam"],
                    "prefecture": full_prefecture,
                    "playerId": match["playerId"],
                    "tempId": match["tempId"]
                })
            else:
                print(f"Warning: No match found for {norm_prefecture} from {last_name} ")
                info_list.append({
                    "lastName": last_name,
                    "firstName": "",
                    "team": abbrev_team,
                    "originalTeam": None,
                    "prefecture": full_prefecture,
                    "playerId": None,
                    "tempId": f"{last_name}_不明_{abbrev_team}"
                })

        output.append({
            "id": idx,
            "name": "・".join(entry["lastNames"]) + f"（{abbrev_team}）",
            "information": info_list,
            "category": "doubles" if len(info_list) > 1 else "singles"
        })

    return output

normalized = normalize_tournament_lines(tournament_lines)
final_output = generate_output_with_original_team(player_lines, normalized)

# オブジェクトごとに改行してJSON出力
with open("data/output.json", "w", encoding="utf-8") as f:
    f.write('[\n')
    for i, item in enumerate(final_output):
        if i > 0:
            f.write(',\n')
        f.write(json.dumps(item, ensure_ascii=False, separators=(',', ':')))
    f.write('\n]')
