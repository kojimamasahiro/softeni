#!/usr/bin/env python3
import sys
import json
import math


def read_input():
    """標準入力またはファイル指定のいずれかでJSONを読み込む"""
    if not sys.stdin.isatty():  # 標準入力がパイプやリダイレクトされている場合
        return json.load(sys.stdin)
    elif len(sys.argv) > 1:  # 引数でファイル名が指定されている場合
        with open(sys.argv[1]) as f:
            return json.load(f)
    else:
        sys.exit("❌ 標準入力またはファイル名を指定してください。")


def is_valid_tournament(entries):
    """トーナメント構成が正しいかを判定"""
    players = [e for e in entries if e["id"] != "bye"]
    byes = [e for e in entries if e["id"] == "bye"]

    total_players = len(players)
    total_byes = len(byes)
    total = total_players + total_byes

    # 次の2のべき乗を求める
    next_power = 2 ** math.ceil(math.log2(total_players)) if total_players > 0 else 0
    expected_byes = next_power - total_players

    # 構成判定
    structure_ok = total == next_power
    bye_ok = total_byes == expected_byes

    # 重複選手チェック
    all_ids = [
        info["tempId"]
        for e in players
        for info in e.get("information", [])
    ]
    duplicate_players = sorted({x for x in all_ids if all_ids.count(x) > 1})

    # カテゴリー統一チェック
    categories = {e.get("category") for e in players}
    category_ok = len(categories) == 1

    return {
        "structure_ok": structure_ok,
        "bye_ok": bye_ok,
        "duplicate_players": duplicate_players,
        "category_ok": category_ok,
        "total_players": total_players,
        "total_byes": total_byes,
        "total_slots": total,
        "expected_slots": next_power,
    }


def main():
    entries = read_input()
    result = is_valid_tournament(entries)

    print("=== トーナメント構成チェック結果 ===")
    print(f"参加チーム数: {result['total_players']}")
    print(f"BYE（不戦勝）数: {result['total_byes']}")
    print(f"スロット数: {result['total_slots']}（期待値: {result['expected_slots']}）")
    print(f"カテゴリ統一: {'OK' if result['category_ok'] else 'NG'}")
    print(f"構成: {'OK' if result['structure_ok'] else 'NG'}")
    print(f"BYE配置: {'OK' if result['bye_ok'] else 'NG'}")

    if result["duplicate_players"]:
        print("❌ 重複選手があります:")
        for name in result["duplicate_players"]:
            print("  -", name)
    else:
        print("重複選手: なし")

    if all([
        result["structure_ok"],
        result["bye_ok"],
        result["category_ok"],
        not result["duplicate_players"]
    ]):
        print("\n✅ トーナメント構成として妥当です。")
    else:
        print("\n❌ トーナメント構成に問題があります。")


if __name__ == "__main__":
    main()
