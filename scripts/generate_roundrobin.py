# python generate_roundrobin.py -i initialPlayer-roundrobin-over50.json -o output.json --default-size 3 --label-type numeric --overrides "4=4,15=4"

import json
import argparse
import os
import string

def excel_labels():
    """A..Z, AA..ZZ, AAA.. を無限に生成"""
    letters = string.ascii_uppercase
    n = 1
    while True:
        for i in range(26 ** n):
            label = ""
            x = i
            for _ in range(n):
                label = letters[x % 26] + label
                x //= 26
            yield label
        n += 1

def numeric_labels():
    """1, 2, 3, ... を無限に生成"""
    n = 1
    while True:
        yield str(n)
        n += 1

def parse_overrides(text):
    """例: 'B=5,I=5' -> {'B':5,'I':5}"""
    if not text:
        return {}
    result = {}
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        if "=" not in part:
            raise ValueError(f"サイズ指定の形式が不正です: {part}（例: B=5）")
        k, v = part.split("=", 1)
        k = k.strip().upper()
        v = int(v.strip())
        if v <= 0:
            raise ValueError(f"{k} のサイズは正の整数にしてください")
        result[k] = v
    return result

def assign_groups(items, default_size=4, overrides=None, label_type="alpha"):
    """
    items を A, B, C... または 1, 2, 3... のキーでグループ化。
    overrides: 例 {'B':5,'I':5} または {'2':5}
    """
    if overrides is None:
        overrides = {}

    out = {}
    idx = 0
    labels = excel_labels() if label_type == "alpha" else numeric_labels()

    while idx < len(items):
        label = next(labels)
        size = overrides.get(label, default_size)
        group = items[idx: idx + size]
        if not group:
            break
        out[label] = group
        idx += len(group)

    return out

def main():
    p = argparse.ArgumentParser(description="配列をラウンドロビン用のグループに分割")
    p.add_argument("-i", "--input", default="input.json", help="入力ファイル（配列JSON）")
    p.add_argument("-o", "--output", default="output.json", help="出力ファイル")
    p.add_argument("--default-size", type=int, default=4, help="標準のグループサイズ（既定: 4）")
    p.add_argument("--overrides", default="", help="特定グループのサイズ上書き（例: 'B=5,I=5' または '2=5'）")
    p.add_argument("--label-type", choices=["alpha", "numeric"], default="alpha", help="グループラベルの種類（alpha または numeric）")
    args = p.parse_args()

    if not os.path.exists(args.input):
        raise FileNotFoundError(f"{args.input} が見つかりません")

    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)
        if not isinstance(data, list):
            raise ValueError("入力JSONは配列である必要があります")

    overrides = parse_overrides(args.overrides)
    grouped = assign_groups(data, default_size=args.default_size, overrides=overrides, label_type=args.label_type)

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(grouped, f, ensure_ascii=False, indent=2)

    # 進捗表示
    counts = {k: len(v) for k, v in grouped.items()}
    print(f"グループ数: {len(grouped)}")
    print("各グループの件数:", counts)
    print(f"出力しました → {args.output}")

if __name__ == "__main__":
    main()
