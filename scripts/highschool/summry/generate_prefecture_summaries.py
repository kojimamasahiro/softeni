import json
import os

# 入力ファイルパス（全体まとめファイル）
input_path = "../03list/prefecture-summary.json"

# 出力ディレクトリベース
output_base = "../../../data/highschool/prefectures"

# JSON読み込み
with open(input_path, "r", encoding="utf-8") as f:
    all_data = json.load(f)

# 都道府県ごとにグループ化
grouped = {}
for entry in all_data:
    pref_id = entry["prefectureId"]
    if pref_id not in grouped:
        grouped[pref_id] = []
    grouped[pref_id].append(entry)

# 書き出し
for pref_id, entries in grouped.items():
    output_dir = os.path.join(output_base, pref_id)
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, "summary.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    print(f"✅ {output_path} を出力しました")
