import json
import os

def replace_playerid_with_tempid(data):
    # playerId → tempId の対応表を作成
    id_map = {}

    for match in data.get("matches", []):
        for player in match.get("opponents", []):
            if player.get("playerId") and player.get("tempId"):
                id_map[player["playerId"]] = player["tempId"]

    # pair の playerId を tempId に置き換え
    for match in data.get("matches", []):
        new_pair = []
        for p in match.get("pair", []):
            if p in id_map:
                new_pair.append(id_map[p])
            else:
                new_pair.append(p)  # 既に tempId の場合はそのまま
        match["pair"] = new_pair

    return data

def main():
    input_file = "input.json"
    output_file = "roundrobin.json"

    if not os.path.exists(input_file):
        print(f"エラー: {input_file} が見つかりません")
        return

    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    updated_data = replace_playerid_with_tempid(data)

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(updated_data, f, ensure_ascii=False, indent=2)

    print(f"変換が完了しました → {output_file}")

if __name__ == "__main__":
    main()
