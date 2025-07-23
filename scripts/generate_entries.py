import json

INPUT_FILE = "input.json"
OUTPUT_FILE = "output.ndjson"

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        i = 0
        while i < len(data):
            current = data[i]

            if current.get("id") == "bye":
                i += 1
                continue

            is_seed = (i + 1 < len(data)) and (data[i + 1].get("id") == "bye")

            simplified_info = [
                {
                    "lastName": p.get("lastName"),
                    "firstName": p.get("firstName"),
                    "team": p.get("team")
                }
                for p in current.get("information", [])
            ]

            obj = {
                "entryNo": current.get("id"),
                "information": simplified_info,
                "seed": is_seed
            }

            f.write(json.dumps(obj, ensure_ascii=False) + ",\n")
            i += 1

if __name__ == "__main__":
    main()
