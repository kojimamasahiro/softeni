import csv
import json

INPUT_CSV = "output/softtennis_players_separated.csv"
# INPUT_CSV = "output/round_robin_results.csv"
OUTPUT_JSON = "output/players.json"

PREFECTURE_MAP = {
    "北海道": "北海道",
    "青森": "青森県",
    "岩手": "岩手県",
    "宮城": "宮城県",
    "秋田": "秋田県",
    "山形": "山形県",
    "福島": "福島県",
    "茨城": "茨城県",
    "栃木": "栃木県",
    "群馬": "群馬県",
    "埼玉": "埼玉県",
    "千葉": "千葉県",
    "東京": "東京都",
    "神奈川": "神奈川県",
    "新潟": "新潟県",
    "富山": "富山県",
    "石川": "石川県",
    "福井": "福井県",
    "山梨": "山梨県",
    "長野": "長野県",
    "岐阜": "岐阜県",
    "静岡": "静岡県",
    "愛知": "愛知県",
    "三重": "三重県",
    "滋賀": "滋賀県",
    "京都": "京都府",
    "大阪": "大阪府",
    "兵庫": "兵庫県",
    "奈良": "奈良県",
    "和歌山": "和歌山県",
    "鳥取": "鳥取県",
    "島根": "島根県",
    "岡山": "岡山県",
    "広島": "広島県",
    "山口": "山口県",
    "徳島": "徳島県",
    "香川": "香川県",
    "愛媛": "愛媛県",
    "高知": "高知県",
    "福岡": "福岡県",
    "佐賀": "佐賀県",
    "長崎": "長崎県",
    "熊本": "熊本県",
    "大分": "大分県",
    "宮崎": "宮崎県",
    "鹿児島": "鹿児島県",
    "沖縄": "沖縄県",
}

PREFECTURES = set(PREFECTURE_MAP.values())
def normalize_prefecture(prefecture):
    prefecture = prefecture.strip()

    # 「関東・茨城県」のような形式なら「・」より後ろを取得
    if "・" in prefecture:
        prefecture = prefecture.split("・")[-1]

    # すでに正式な都道府県名ならそのまま
    if prefecture in PREFECTURES:
        return prefecture

    # 「京都」→「京都府」など
    return PREFECTURE_MAP.get(prefecture, prefecture)

def split_name(name, split_index):
    """姓と名を split_index の位置で分割"""
    return name[:split_index], name[split_index:]

players_by_entry = {}

with open(INPUT_CSV, newline='', encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        entry_no = int(row["Entry_Number"])
        split_index = int(row["Split_Index"])
        team = row["Team_Name"]
        prefecture = row["Area_Name"]

        # 括弧を除去した文字列を使用
        cleaned_team = team.replace('(', '').replace(')', '').replace('（', '').replace('）', '')
        cleaned_prefecture = prefecture.replace('(', '').replace(')', '').replace('（', '').replace('）', '')
        normalized_prefecture = normalize_prefecture(cleaned_prefecture)

        if split_index == 0:
            # 団体戦の場合
            player_obj = {
                "lastName": "",
                "firstName": "",
                "team": cleaned_team,
                "prefecture": normalized_prefecture,
                "playerId": None,
                "tempId": f"{cleaned_team}_{normalized_prefecture}"
            }
        else:
            # 個人戦の場合
            last, first = split_name(row["Player_Name_Raw"], split_index)
            cleaned_last = last.replace('(', '').replace(')', '').replace('（', '').replace('）', '')
            cleaned_first = first.replace('(', '').replace(')', '').replace('（', '').replace('）', '')
            player_obj = {
                "lastName": cleaned_last,
                "firstName": cleaned_first,
                "team": cleaned_team,
                "prefecture": normalized_prefecture,
                "playerId": None,
                "tempId": f"{cleaned_last}_{cleaned_first}_{cleaned_team}_{normalized_prefecture}"
            }

        players_by_entry.setdefault(entry_no, []).append(player_obj)

# JSON 化
result = []
for entry_no, players in players_by_entry.items():
    if players and players[0]["lastName"] == "":
        # 団体戦の場合
        team = players[0]["team"]
        prefecture = players[0]["prefecture"]
        name = f"{team}（{prefecture}）"
        category = "team"
        result.append({
            "id": entry_no,
            "name": name,
            "team": team,
            "prefecture": prefecture,
            "category": category
        })
    else:
        # 個人戦の場合
        names = "・".join([p["lastName"] for p in players])
        team = players[0]["team"] if players else ""
        name = f"{names}（{team}）"
        category = "doubles"
        result.append({
            "id": entry_no,
            "name": name,
            "information": players,
            "category": category
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
