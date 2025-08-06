import json
from collections import defaultdict

INPUT_FILE = "input.json"
OUTPUT_FILE = "output.json"

def is_bye(entry):
    return entry is not None and entry.get("id") == "bye"

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    result = defaultdict(list)
    total = len(raw_data)
    i = 0
    seedCount = 0

    while i < total:
        entry = raw_data[i]
        if is_bye(entry):
            i += 1
            continue

        category = entry.get("category", "unknown")
        output_items = result[category]

        next_entry = raw_data[i + 1] if i + 1 < total else None
        next3_entry = raw_data[i + 3] if i + 3 < total else None

        def make_obj(entry, type_):
            obj = {
                "entryNo": entry["id"]
            }
            if category == "team" or category == "versus":
                obj["team"] = entry.get("team") or entry.get("name")
                obj["prefecture"] = entry.get("prefecture")
            else:
                obj["information"] = [
                    {
                        "lastName": p.get("lastName"),
                        "firstName": p.get("firstName"),
                        "team": p.get("team"),
                    }
                    for p in entry.get("information", [])
                ]
            obj["type"] = type_
            return obj

        # --- 判定ロジック ---
        if len(output_items) == 0:
            # 先頭の場合
            if is_bye(next_entry):
                # 自分: seed, 次2つ: packing
                result[category].append(make_obj(entry, "seed"))
                i += 1
                for j in range(2):
                    if i < total:
                        e = raw_data[i]
                        if not is_bye(e):
                            result[category].append(make_obj(e, "packing"))
                        i += 1
                continue
            else:
                # bye じゃない → packing
                result[category].append(make_obj(entry, "packing"))
                i += 1
                seedCount += 1
                continue
        else:
            if is_bye(next_entry):
                if is_bye(next3_entry):
                    if seedCount >= 2:
                        result[category].append(make_obj(entry, "seed"))
                        seedCount = -2
                    else:
                        result[category].append(make_obj(entry, "extra"))
                        i += 1
                        for j in range(2):
                            if i < total:
                                e = raw_data[i]
                                if not is_bye(e):
                                    result[category].append(make_obj(e, "extra"))
                                i += 1
                        seedCount = 0
                        continue
                    i += 1
                else:
                    result[category].append(make_obj(entry, "seed"))
                    i += 2  # seed の次は bye を飛ばす
                    seedCount = -2
            else:
                result[category].append(make_obj(entry, "packing"))
                i += 1
                seedCount += 1

    # 出力処理（整形 + 各行に1エントリ）
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("{\n")
        for idx, (category, items) in enumerate(result.items()):
            f.write(f'  "{category}": [\n')
            for i, item in enumerate(items):
                line = "    " + json.dumps(item, ensure_ascii=False)
                if i < len(items) - 1:
                    line += ","
                f.write(line + "\n")
            f.write("  ]" + ("," if idx < len(result) - 1 else "") + "\n")
        f.write("}\n")

if __name__ == "__main__":
    main()
