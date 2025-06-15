import json

# === 読み込み ===
with open("matches.json", "r", encoding="utf-8") as f:
    a_list = json.load(f)

with open("entries.json", "r", encoding="utf-8") as f:
    b_list = json.load(f)

# === tempId, playerId の自動生成 ===
def build_temp_id(info):
    return f"{info.get('lastName', '')}_{info.get('firstName', '')}_{info.get('team', '')}".strip()

def build_player_id(info):
    last = info.get("lastName", "").strip().lower()
    first = info.get("firstName", "").strip().lower()
    return f"{last}-{first}" if last and first else None

# === 表示用名前生成 ===
def generate_name(infos):
    return "・".join(f"{i['lastName']}{i['firstName']}（{i['team']}）" for i in infos)

# === opponents から ID補正マップ作成 ===
def build_id_map(matches):
    id_map = {}
    for match in matches:
        for opponent in match.get("opponents", []):
            temp_id = opponent.get("tempId") or build_temp_id(opponent)
            player_id = opponent.get("playerId")
            if player_id:
                id_map[player_id] = temp_id  # 例: maruyama-kaito → 丸山_海斗_one team
    return id_map

# === entryNo を付与 ===
def attach_entry_numbers(a_list, b_list):
    id_map = build_id_map(a_list)
    unmatched = []

    for a_item in a_list:
        raw_pair = a_item.get("pair", [])
        # 変換マップに基づいて tempId に補正
        converted_pair = [id_map.get(pid, pid) for pid in raw_pair]
        matched = False

        for b_item in b_list:
            b_temp_ids = {build_temp_id(info) for info in b_item.get("information", [])}

            if set(converted_pair).issubset(b_temp_ids):
                a_item["entryNo"] = b_item.get("entryNo", b_item.get("id"))
                a_item["name"] = generate_name(b_item.get("information", []))
                matched = True
                break

        if not matched:
            unmatched.append(converted_pair)

    if unmatched:
        print("\n❌ 一致しなかったpair一覧:")
        for p in unmatched:
            print("  ", p)

    return a_list

# === 実行・保存 ===
updated = attach_entry_numbers(a_list, b_list)

with open("matches_with_entryNo.json", "w", encoding="utf-8") as f:
    json.dump(updated, f, ensure_ascii=False, indent=2)

print(json.dumps(updated, ensure_ascii=False, indent=2))
