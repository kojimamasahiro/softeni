import json
import os
import string

# n件ごとに分割する関数
def chunk_array(arr, size):
    return [arr[i:i + size] for i in range(0, len(arr), size)]

# ラウンド番号をキーにして辞書化
def group_by_round(data, size, key_type="number"):
    chunks = chunk_array(data, size)
    if key_type == "alpha":
        # アルファベット（A, B, C...）
        return {string.ascii_uppercase[i]: chunk for i, chunk in enumerate(chunks)}
    else:
        # 数字（1, 2, 3...）
        return {i + 1: chunk for i, chunk in enumerate(chunks)}

def main():
    input_file = "input.json"
    output_file = "output.json"
    group_size = 4  # 1グループあたりのチーム数
    key_type = "alpha"  # "number" または "alpha"

    # 入力ファイルの存在確認
    if not os.path.exists(input_file):
        print(f"エラー: {input_file} が見つかりません")
        return

    # JSON読み込み
    with open(input_file, "r", encoding="utf-8") as f:
        players = json.load(f)

    # 分割処理
    grouped = group_by_round(players, group_size, key_type)

    # JSON保存
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(grouped, f, ensure_ascii=False, indent=2)

    print(f"変換が完了しました → {output_file}")

if __name__ == "__main__":
    main()
