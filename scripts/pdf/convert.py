import csv
import json

INPUT_CSV = "output/softtennis_players_separated.csv"
OUTPUT_JSON = "output/players.json"

def split_name(name, split_index):
    """姓と名を split_index の位置で分割"""
    return name[:split_index], name[split_index:]

players_by_entry = {}

with open(INPUT_CSV, newline='', encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        entry_no = int(row["Entry_Number"])
        last, first = split_name(row["Player_Name_Raw"], int(row["Split_Index"]))
        team = row["Team_Name"]
        prefecture = row["Area_Name"]

        # 括弧を除去した文字列を使用
        cleaned_last = last.replace('(', '').replace(')', '').replace('（', '').replace('）', '')
        cleaned_first = first.replace('(', '').replace(')', '').replace('（', '').replace('）', '')
        cleaned_team = team.replace('(', '').replace(')', '').replace('（', '').replace('）', '')
        cleaned_prefecture = prefecture.replace('(', '').replace(')', '').replace('（', '').replace('）', '')
        player_obj = {
            "lastName": cleaned_last,
            "firstName": cleaned_first,
            "team": cleaned_team,
            "prefecture": cleaned_prefecture,
            "playerId": None,
            "tempId": f"{cleaned_last}_{cleaned_first}_{cleaned_team}"
        }


        players_by_entry.setdefault(entry_no, []).append(player_obj)

# JSON 化
result = []
for entry_no, players in players_by_entry.items():
    names = "・".join([p["lastName"] for p in players])
    team = players[0]["team"] if players else ""
    result.append({
        "id": entry_no,
        "name": f"{names}（{team}）",
        "information": players,
        "category": "doubles"
    })

# 配列形式で出力（各オブジェクトを1行）
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    f.write("[\n")
    for i, obj in enumerate(result):
        line = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
        if i < len(result) - 1:
            f.write(line + ",\n")
        else:
            f.write(line + "\n")
    f.write("]")
