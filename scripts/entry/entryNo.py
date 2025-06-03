import json

# JSONファイルの読み込み
with open("matches.json", "r", encoding="utf-8") as f:
    a_list = json.load(f)

with open("entries.json", "r", encoding="utf-8") as f:
    b_list = json.load(f)

# entryNoとnameを追加する処理
def attach_entry_numbers(a_list, b_list):
    for a_item in a_list:
        for b_item in b_list:
            b_ids = set()
            for info in b_item.get("information", []):
                if info.get("playerId") is not None:
                    b_ids.add(info["playerId"])
                if info.get("tempId") is not None:
                    b_ids.add(info["tempId"])
            # 一致するIDがpair内に含まれているかチェック
            if any(p in b_ids for p in a_item.get("pair", [])):
                a_item["entryNo"] = b_item["id"]

                # nameを生成（informationが1人の場合）
                infos = b_item.get("information", [])
                if len(infos) == 1:
                    info = infos[0]
                    last = info.get("lastName", "")
                    first = info.get("firstName", "")
                    team = info.get("team", "")
                    a_item["name"] = f"{last}{first}（{team}）"
                else:
                    # 複数人の場合は・でつなぐ
                    names = [f"{i.get('lastName', '')}{i.get('firstName', '')}（{i.get('team', '')}）" for i in infos]
                    a_item["name"] = "・".join(names)

                break  # 一致が見つかったら次のa_itemへ
    return a_list

# 実行
updated_a = attach_entry_numbers(a_list, b_list)

# 出力
with open("matches_with_entryNo.json", "w", encoding="utf-8") as f:
    json.dump(updated_a, f, ensure_ascii=False, indent=2)

# 確認用出力
print(json.dumps(updated_a, ensure_ascii=False, indent=2))
