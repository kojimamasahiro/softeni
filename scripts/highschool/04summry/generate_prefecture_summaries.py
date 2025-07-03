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

# 書き出し（重複チェックあり）
for pref_id, new_entries in grouped.items():
    output_dir = os.path.join(output_base, pref_id)
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, "summary.json")

    # 既存ファイルの読み込み（あれば）
    if os.path.exists(output_path):
        with open(output_path, "r", encoding="utf-8") as f:
            try:
                existing_entries = json.load(f)
            except json.JSONDecodeError:
                existing_entries = []
    else:
        existing_entries = []

    # ✅ 重複判定用のキーセット（団体戦は team を使う）
    def make_key(e):
        category = e.get("category")
        tournament_id = e.get("tournamentId")
        year = e.get("year")

        if category == "team":
            return (category, tournament_id, year, e.get("team"))
        else:
            return (
                category,
                tournament_id,
                year,
                tuple(sorted(e.get("playerIds", [])))
            )

    existing_keys = {make_key(e) for e in existing_entries}

    # まだ存在しない新規エントリのみ抽出
    filtered_new_entries = [e for e in new_entries if make_key(e) not in existing_keys]

    if filtered_new_entries:
        combined = existing_entries + filtered_new_entries
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(combined, f, ensure_ascii=False, indent=2)
        print(f"✅ {output_path} に {len(filtered_new_entries)} 件を追記しました")
    else:
        print(f"⚠️ {output_path} に追記すべきデータはありません（すでに存在）")
