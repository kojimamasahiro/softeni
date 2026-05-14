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
        # 重複チェック用キーの生成
        # カテゴリ、大会、年度、性別、および (playerIds or team) で一意性を判断
        # prefer teamId when available to avoid mismatches between team name variations
        team_key = e.get("teamId") or e.get("team")
        player_ids = e.get("playerIds") or []
        # normalize playerIds ordering so pairs compare equal regardless of order
        try:
            pid_tuple = tuple(sorted(player_ids))
        except Exception:
            pid_tuple = tuple(player_ids)
        return (
            e.get("category"),
            e.get("tournamentId"),
            e.get("year"),
            e.get("gender"),
            pid_tuple,
            team_key,
        )

    # build index for existing entries so we can update (upsert) instead of only appending
    existing_index = {make_key(e): i for i, e in enumerate(existing_entries)}

    added = 0
    updated = 0
    for e in new_entries:
        key = make_key(e)
        if key in existing_index:
            idx = existing_index[key]
            # if the new entry differs, replace the existing one (treat new as authoritative)
            if existing_entries[idx] != e:
                existing_entries[idx] = e
                updated += 1
        else:
            existing_entries.append(e)
            existing_index[key] = len(existing_entries) - 1
            added += 1

    if added or updated:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(existing_entries, f, ensure_ascii=False, indent=2)
        print(f"✅ {output_path} を更新しました（追加: {added} 件、更新: {updated} 件）")
    else:
        print(f"⚠️ {output_path} に変更はありません（既に最新）")
