import json

INPUT_FILE = "initialPlayer-over35.json"

def is_bye(entry):
    return entry is not None and entry.get("id") == "bye"

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    output_items = []
    total = len(raw_data)
    i = 0
    seedCount = 0

    while i < total:
        entry = raw_data[i]
        if is_bye(entry):
            i += 1
            continue

        category = entry.get("category", "unknown")  # 出力には使わない
        next_entry = raw_data[i + 1] if i + 1 < total else None
        next3_entry = raw_data[i + 3] if i + 3 < total else None

        def make_obj(entry, type_):
            obj = {
                "entryNo": entry["id"]
            }
            if category in ("team", "versus"):
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

        if len(output_items) == 0:
            if is_bye(next_entry):
                output_items.append(make_obj(entry, "seed"))
                i += 1
                for _ in range(2):
                    if i < total:
                        e = raw_data[i]
                        if not is_bye(e):
                            output_items.append(make_obj(e, "packing"))
                        i += 1
                continue
            else:
                output_items.append(make_obj(entry, "packing"))
                i += 1
                seedCount += 1
                continue
        else:
            if is_bye(next_entry):
                if is_bye(next3_entry):
                    if seedCount >= 2:
                        output_items.append(make_obj(entry, "seed"))
                        seedCount = -2
                    else:
                        output_items.append(make_obj(entry, "extra"))
                        i += 1
                        for _ in range(2):
                            if i < total:
                                e = raw_data[i]
                                if not is_bye(e):
                                    output_items.append(make_obj(e, "extra"))
                                i += 1
                        seedCount = 0
                        continue
                    i += 1
                else:
                    output_items.append(make_obj(entry, "seed"))
                    i += 2
                    seedCount = -2
            else:
                output_items.append(make_obj(entry, "packing"))
                i += 1
                seedCount += 1

    print("[")
    for idx, item in enumerate(output_items):
        line = "  " + json.dumps(item, ensure_ascii=False)
        if idx < len(output_items) - 1:
            line += ","
        print(line)
    print("]")

if __name__ == "__main__":
    main()
