import json
import math
import sys

def next_power_of_two(n):
    return 1 if n == 0 else 2 ** math.ceil(math.log2(n))

def check_bye_binding(entries):
    non_bye_entries = [e for e in entries if e["id"] != "bye"]
    total = len(entries)
    non_bye_count = len(non_bye_entries)
    required = next_power_of_two(non_bye_count)

    print(f"実チーム数: {non_bye_count}, 期待枠数: {required}")

    if total != required:
        print(f"⚠️ 枠数が2のべき乗に合いません ({total}枠中 {required}枠必要)")
    
    invalid_byes = []
    for i, e in enumerate(entries):
        if e["id"] == "bye":
            if i == 0 or entries[i-1]["id"] == "bye":
                invalid_byes.append(i)

    if not invalid_byes:
        print("✅ 全てのBYEは直前の選手に正しく紐づいています。")
    else:
        print("⚠️ BYEの不正な位置を検出:")
        for idx in invalid_byes:
            before = entries[idx-1]["id"] if idx > 0 else "なし"
            after = entries[idx+1]["id"] if idx+1 < len(entries) else "なし"
            print(f" （前: {before}, 後: {after}）")
        
        # 修正候補を推定
        print("\n🧭 修正候補（推定）:")
        for idx in invalid_byes:
            # 1つ前の「非BYE」エントリを探して紐づけ候補を提案
            insert_pos = None
            for j in range(idx-1, -1, -1):
                if entries[j]["id"] != "bye":
                    insert_pos = j + 1
                    break
            if insert_pos is not None:
                print(f"  - BYEを位置 {insert_pos}（{entries[insert_pos-1]['id']} の直後）に移動推奨")
            else:
                print(f"  - BYE {idx+1} の位置を特定できません（先頭にある可能性）")

if __name__ == "__main__":
    entries = json.load(sys.stdin)
    check_bye_binding(entries)
