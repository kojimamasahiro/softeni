#!/usr/bin/env python3
"""第19回アジア競技大会（杭州。2023年10月開催）ソフトテニスの結果を details JSON に書き出す。

入力: tools/asian-games-2023/draw.json（ASTF が公開している大会公式の結果PDFから転記）
出力: data/tournaments/details/asian-games/2023/<種目>.json

組み立ては 2026年大会の tools/asian-games-2026/build_details.py をそのまま使い、
年度ごとに違う部分だけを差し替える:

- 日本代表10人の id（2023年度の国内大会の表記）と、2026年大会に出ていない国（中国・ベトナム）
- 組内順位は**公式の順位表（draw.json の standings）を正とする**。女子シングルスH組が3人とも1勝1敗で、
  公式は得点の得失まで見て並べているが、PDFの予選リーグは本数しか無く再計算できないため。
  あわせて勝ち数・取った数・取られた数を転記した試合から数え直し、公式と食い違えば止める
- 予選リーグの不戦勝・途中棄権（男子シングルスE組）を `retired: true` で持つ

実行: python3 tools/asian-games-2023/build_details.py
"""

import importlib.util
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))

spec = importlib.util.spec_from_file_location("ag2026", os.path.join(ROOT, "tools", "asian-games-2026", "build_details.py"))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

base.SRC = os.path.join(HERE, "draw.json")
base.OUT_DIR = os.path.join(ROOT, "data", "tournaments", "details", "asian-games", "2023")
base.COUNTRY_JA = {**base.COUNTRY_JA, "CHN": "中国", "VIE": "ベトナム"}

# 公式のローマ字 -> 国内大会で使っている id（2023年度の全日本選手権・全日本シングルスの表記に揃える）
base.JAPANESE_PLAYERS = {
    "UEMATSU/Toshiki": ("上松", "俊貴", "NTT西日本", "広島県"),
    "FUNEMIZU/Hayato": ("船水", "颯人", "稲門クラブ", "東京都"),
    "HIROOKA/Sora": ("広岡", "宙", "NTT西日本", "広島県"),
    "UCHIDA/Riku": ("内田", "理久", "NTT西日本", "広島県"),
    "UCHIMOTO/Takafumi": ("内本", "隆文", "NTT西日本", "広島県"),
    "TAKAHASHI/Noa": ("高橋", "乃綾", "どんぐり北広島", "広島県"),
    "SHIMUTA/Tomomi": ("志牟田", "智美", "東芝姫路", "兵庫県"),
    "ONOUE/Kurumi": ("尾上", "胡桃", "日体桜友会", "東京都"),
    "KUBO/Haruka": ("久保", "晴華", "ナガセケンコー", "東京都"),
    "WATANABE/Emina": ("渡邉", "絵美菜", "ヨネックス", "東京都"),
}

SRC_DATA = json.load(open(base.SRC, encoding="utf-8"))


def side_key(side):
    return tuple(side)


def official_standings(event):
    return SRC_DATA["standings"][event]


_build = base.build


def build(event, rows, individual_keys, draw_slots):
    data = _build(event, rows, individual_keys, draw_slots)
    # 予選リーグの不戦勝・途中棄権。build は rows を sort_key 順に試合へ変換している
    for row, match in zip(sorted(rows, key=base.sort_key), data["matches"]):
        if row.get("retired"):
            match["retired"] = True
    # 組内順位を公式の順位表で置き換え、転記した試合から数え直して検算する
    entry_of = {}
    for row, match in zip(sorted(rows, key=base.sort_key), data["matches"]):
        for side, no in zip(row["sides"], match["entries"]):
            entry_of[side_key(side)] = no
    tally = {}
    for row, match in zip(sorted(rows, key=base.sort_key), data["matches"]):
        if row["stage"] != "roundrobin":
            continue
        a, b = row["score"]
        if row.get("retired") == "walkover":
            a, b = 0, 0  # 公式の順位表は不戦勝を 0-0 で数える
        for me, got, lost, won in ((row["sides"][0], a, b, match["winnerEntryNo"] == match["entries"][0]),
                                    (row["sides"][1], b, a, match["winnerEntryNo"] == match["entries"][1])):
            t = tally.setdefault(side_key(me), [0, 0, 0])
            t[0] += 1 if won else 0
            t[1] += got
            t[2] += lost
    ranks = {}
    for group, table in official_standings(event).items():
        for i, row in enumerate(table):
            key = side_key(row["side"])
            got = tally.get(key)
            if got != [row["wins"], row["won"], row["lost"]]:
                raise SystemExit(f"{event} {group}組 {key}: 転記から数えた {got} が公式 {[row['wins'], row['won'], row['lost']]} と合わない")
            ranks[entry_of[key]] = {"group": group, "rank": i + 1}
    for r in data["results"]:
        r["roundrobin"] = ranks.get(r["entryNo"])
    if set(ranks) != {e["entryNo"] for e in data["entries"]}:
        raise SystemExit(f"{event}: 公式の順位表に無いエントリーがある")
    # 決勝Tの席の解決と成績は組内順位に依存するので、公式の順位で作り直す
    base_standings = base.roundrobin_standings
    base.roundrobin_standings = lambda matches: ranks
    try:
        data["results"] = base.build_results(data["matches"], data["entries"], draw_slots)
    finally:
        base.roundrobin_standings = base_standings
    return data


base.build = build

if __name__ == "__main__":
    base.main()
