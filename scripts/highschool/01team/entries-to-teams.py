import json
import re
from pykakasi import kakasi
from collections import OrderedDict, defaultdict

# 都道府県変換マップ（略称 → 正式名称）
prefecture_map = {
    "北海道": "北海道",
    "青森": "青森県", "岩手": "岩手県", "宮城": "宮城県", "秋田": "秋田県", "山形": "山形県", "福島": "福島県",
    "茨城": "茨城県", "栃木": "栃木県", "群馬": "群馬県", "埼玉": "埼玉県", "千葉": "千葉県", "東京": "東京都", "神奈川": "神奈川県",
    "新潟": "新潟県", "富山": "富山県", "石川": "石川県", "福井": "福井県", "山梨": "山梨県", "長野": "長野県",
    "岐阜": "岐阜県", "静岡": "静岡県", "愛知": "愛知県", "三重": "三重県",
    "滋賀": "滋賀県", "京都": "京都府", "大阪": "大阪府", "兵庫": "兵庫県", "奈良": "奈良県", "和歌山": "和歌山県",
    "鳥取": "鳥取県", "島根": "島根県", "岡山": "岡山県", "広島": "広島県", "山口": "山口県",
    "徳島": "徳島県", "香川": "香川県", "愛媛": "愛媛県", "高知": "高知県",
    "福岡": "福岡県", "佐賀": "佐賀県", "長崎": "長崎県", "熊本": "熊本県", "大分": "大分県", "宮崎": "宮崎県", "鹿児島": "鹿児島県",
    "沖縄": "沖縄県"
}

# 都道府県 → IDマップ
prefecture_id_map = {
    "北海道": "hokkaido", "青森県": "aomori", "岩手県": "iwate", "宮城県": "miyagi", "秋田県": "akita",
    "山形県": "yamagata", "福島県": "fukushima", "茨城県": "ibaraki", "栃木県": "tochigi", "群馬県": "gunma",
    "埼玉県": "saitama", "千葉県": "chiba", "東京都": "tokyo", "神奈川県": "kanagawa", "新潟県": "niigata",
    "富山県": "toyama", "石川県": "ishikawa", "福井県": "fukui", "山梨県": "yamanashi", "長野県": "nagano",
    "岐阜県": "gifu", "静岡県": "shizuoka", "愛知県": "aichi", "三重県": "mie", "滋賀県": "shiga",
    "京都府": "kyoto", "大阪府": "osaka", "兵庫県": "hyogo", "奈良県": "nara", "和歌山県": "wakayama",
    "鳥取県": "tottori", "島根県": "shimane", "岡山県": "okayama", "広島県": "hiroshima", "山口県": "yamaguchi",
    "徳島県": "tokushima", "香川県": "kagawa", "愛媛県": "ehime", "高知県": "kochi", "福岡県": "fukuoka",
    "佐賀県": "saga", "長崎県": "nagasaki", "熊本県": "kumamoto", "大分県": "oita", "宮崎県": "miyazaki",
    "鹿児島県": "kagoshima", "沖縄県": "okinawa"
}

# ファイル読み込み
with open("players.json", encoding="utf-8") as f:
    players = json.load(f)

with open("team_id_map.json", encoding="utf-8") as f:
    manual_id_map = json.load(f)

# 既存の teams.json を読み込む
existing_ids = set()
try:
    with open("teams.json", encoding="utf-8") as f:
        existing_teams = json.load(f)
        for team in existing_teams:
            existing_ids.add(team["id"])
    print(f"📄 既存の teams.json から {len(existing_ids)} 件の id を読み込みました")
except FileNotFoundError:
    print("⚠️ teams.json が見つかりませんでした。全チームを対象とします。")

# pykakasi 設定
kks = kakasi()
kks.setMode("H", "a")
kks.setMode("K", "a")
kks.setMode("J", "a")
kks.setMode("r", "Hepburn")
conv = kks.getConverter()

# ローマ字ID変換
def to_romaji(team_name):
    name = re.sub(r"[（）()・\s]", "", team_name)
    name = name.replace("高等学校", "").replace("高校", "")
    if name in manual_id_map:
        return manual_id_map[name]
    return conv.do(name).lower().replace(" ", "-").replace("'", "")

# チームマップ（team名 → prefecture）
team_map = {}

# 個人データから抽出
for entry in players:
    for info in entry.get("information", []):
        team = info.get("team", "").strip()
        pref = info.get("prefecture", "").strip()
        if team and pref and team not in team_map:
            team_map[team] = pref

# 団体戦エントリー
for file_name in ["team_entries.json", "team_results.json"]:
    try:
        with open(file_name, encoding="utf-8") as f:
            team_entries = json.load(f)
            print(f"📄 {file_name} から {len(team_entries)} 件を読み込みました")
            for entry in team_entries:
                team = entry.get("team", "").strip()
                pref = entry.get("prefecture", "").strip()
                if team and pref and team not in team_map:
                    team_map[team] = pref
    except FileNotFoundError:
        print(f"ℹ️ {file_name} は見つかりませんでした")

# 重複IDチェック用
id_counter = defaultdict(list)

# 出力
with open("teams.ndjson", "w", encoding="utf-8") as f:
    for team, pref in sorted(team_map.items()):
        romaji_id = to_romaji(team)
        if romaji_id in existing_ids:
            continue  # 既存IDスキップ

        id_counter[romaji_id].append(team)

        obj = OrderedDict()
        obj["id"] = romaji_id
        obj["name"] = team
        full_pref = prefecture_map.get(pref, pref)
        obj["prefecture"] = full_pref
        obj["prefectureId"] = prefecture_id_map.get(full_pref, "unknown")
        json.dump(obj, f, ensure_ascii=False)
        f.write(",\n")

print(f"✅ 合計 {len(team_map)} チームの teams.ndjson を出力しました")

# 重複IDチェック
duplicates = {k: v for k, v in id_counter.items() if len(v) > 1}
if duplicates:
    print("⚠️ 重複IDがあります。確認してください：")
    for id_, teams in duplicates.items():
        print(f" - id: {id_} → teams: {teams}")
else:
    print("✅ ID重複はありません。")
