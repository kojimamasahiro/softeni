# コマンド
# % python3 scripts/generate_player_info.py

import os
import json

# 現在のディレクトリ（トップ）
base_dir = './data/players'

# 結果を格納するリスト
combined_data = []

# サブフォルダをループ
for folder in os.listdir(base_dir):
    folder_path = os.path.join(base_dir, folder)
    info_path = os.path.join(folder_path, 'information.json')

    # information.json が存在するか確認
    if os.path.isdir(folder_path) and os.path.isfile(info_path):
        with open(info_path, 'r', encoding='utf-8') as f:
            info_data = json.load(f)
            # フルネーム作成
            full_name = f"{info_data['lastName']}{info_data['firstName']}"
            combined_data.append({
                "id": folder,  # フォルダ名がID
                "name": full_name  # フルネーム
            })

# 出力（必要ならファイルに保存も可能）
print(json.dumps(combined_data, indent=2, ensure_ascii=False))
