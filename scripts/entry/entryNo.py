import json

# JSON読み込み
with open("matches.json", "r", encoding="utf-8") as f:
    a_list = json.load(f)

with open("entries.json", "r", encoding="utf-8") as f:
    b_list = json.load(f)

# tempId を生成する関数
def build_temp_id(info):
    return f"{info.get('lastName', '')}_{info.get('firstName', '')}_{info.get('team', '')}"

# name生成
def generate_name(infos):
    if len(infos) == 1:
        i = infos[0]
        return f"{i.get('lastName', '')}{i.get('firstName', '')}（{i.get('team', '')}）"
    return "・".join(f"{i.get('lastName', '')}{i.get('firstName', '')}（{i.get('team', '')}）" for i in infos)

# entryNo と name を付ける処理
def attach_entry_numbers(a_list, b_list):
    for a_item in a_list:
        pair_ids = set(a_item.get("pair", []))
        for b_item in b_list:
            b_temp_ids = {build_temp_id(info) for info in b_item.get("information", [])}

            # pair 内の tempId がすべて含まれていればマッチ
            if pair_ids.issubset(b_temp_ids):
                a_item["entryNo"] = b_item.get("entryNo", b_item.get("id"))
                a_item["name"] = generate_name(b_item.get("information", []))
                break  # マッチしたら次へ
    return a_list

# 実行
updated = attach_entry_numbers(a_list, b_list)

# 保存
with open("matches_with_entryNo.json", "w", encoding="utf-8") as f:
    json.dump(updated, f, ensure_ascii=False, indent=2)

# 確認
print(json.dumps(updated, ensure_ascii=False, indent=2))
