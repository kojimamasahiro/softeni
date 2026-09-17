#!/usr/bin/env python3
"""アジア競技大会2026 ソフトテニスの組み合わせ（予選リーグ）を details JSON に書き出す。

入力: tools/asian-games-2026/draw.json（公式リザルトサイトの日別日程から転記）
出力: data/tournaments/details/asian-games/2026/<種目>.json

取り込み範囲は「方式A＋組の例外」（docs/wiki/upcoming-tournaments-runbook.md S11）:
日本が入っている予選リーグの組だけを持ち、その組の中は日本が出ない試合も全部持つ。
日本がいない組・決勝トーナメントはまだ持たない（決勝Tの席順は公式に出ていない）。

表記:
- 日本選手は既存の選手ページにつながるよう、国内大会と同じ id（漢字・所属・都道府県）にする
- 外国選手は公式表記のローマ字（姓は大文字のまま）、所属＝国名（日本語）、都道府県なし
- 団体戦のチームは国名（日本語）

試合前なので勝者・スコアは空。成績は ADR-007 の「進行中」（rank.kind: ongoing）にする。

実行: python3 tools/asian-games-2026/build_details.py
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "tools", "asian-games-2026", "draw.json")
OUT_DIR = os.path.join(ROOT, "data", "tournaments", "details", "asian-games", "2026")

EVENT_TO_CATEGORY = {
    "Men's Team": "team-none-boys",
    "Women's Team": "team-none-girls",
    "Mixed Doubles": "doubles-none-mixed",
    "Men's Singles": "singles-none-boys",
    "Women's Singles": "singles-none-girls",
}

COUNTRY_JA = {
    "JPN": "日本",
    "CAM": "カンボジア",
    "INA": "インドネシア",
    "IND": "インド",
    "KOR": "韓国",
    "LAO": "ラオス",
    "MGL": "モンゴル",
    "NEP": "ネパール",
    "PAK": "パキスタン",
    "PHI": "フィリピン",
    "TPE": "チャイニーズ・タイペイ",
    "THA": "タイ",
    "PRK": "北朝鮮",
}

# 公式のローマ字 -> 国内大会で使っている id（2026年の全日本シングルスの表記に揃える）。
# 代表名簿（data/tournaments/delegations/asian-games-2026.json）の10人のうち、個人種目に出る6人。
JAPANESE_PLAYERS = {
    "UEMATSU/Toshiki": ("上松", "俊貴", "NTT西日本", "広島県"),
    "KUROSAKA/Takuya": ("黒坂", "卓矢", "日本体育大学", "日本学連"),
    "MARUYAMA/Kaito": ("丸山", "海斗", "one team", "大阪府"),
    "TEMMA/Rena": ("天間", "麗奈", "日本体育大学", "日本学連"),
    "MIYAMAE/Kiho": ("宮前", "希帆", "ワタキューセイモア", "京都府"),
    "MAEDA/Rio": ("前田", "梨緒", "明治大学", "日本学連"),
}


def participant_for(noc, romaji):
    if noc == "JPN":
        if romaji not in JAPANESE_PLAYERS:
            raise SystemExit(f"日本選手の対応が無い: {romaji}")
        last, first, team, pref = JAPANESE_PLAYERS[romaji]
        return {"id": f"{last}_{first}_{team}_{pref}", "lastName": last, "firstName": first, "team": team, "prefecture": pref}
    family, given = romaji.split("/")
    country = COUNTRY_JA[noc]
    return {"id": f"{family}_{given}_{country}", "lastName": family, "firstName": given, "team": country, "prefecture": None}


def team_participant(noc):
    name = COUNTRY_JA[noc]
    return {"id": name, "lastName": None, "firstName": None, "team": name, "prefecture": None}


def build(rows):
    participants = {}
    entry_by_key = {}
    entries = []
    matches = []

    def entry_no(side):
        noc, players = side[0], side[1:]
        if players:
            ps = [participant_for(noc, p) for p in players]
        else:
            ps = [team_participant(noc)]
        key = tuple(p["id"] for p in ps)
        if key not in entry_by_key:
            for p in ps:
                participants.setdefault(p["id"], p)
            entry_by_key[key] = len(entries) + 1
            entries.append({"entryNo": len(entries) + 1, "playerIds": list(key), "type": None})
        return entry_by_key[key]

    # 組 → 試合番号の順（公式の Match 番号）。entryNo は組の中の初出順
    for event, group, match_no, *_rest, sides in sorted(rows, key=lambda r: (r[1], int(r[2]))):
        a, b = (entry_no(s) for s in sides)
        matches.append(
            {
                "entries": [a, b],
                "scores": {},
                "round": None,
                "stage": "roundrobin",
                "group": group,
                "winnerEntryNo": None,
                "nextMatchId": None,
                "prevMatchIds": [],
                "prevMatchId": None,
                "matchId": f"match-{len(matches) + 1}",
            }
        )

    results = [
        {"entryNo": e["entryNo"], "tournament": {"label": "出場", "rank": {"kind": "ongoing"}}, "roundrobin": None} for e in entries
    ]
    return {"participants": list(participants.values()), "entries": entries, "matches": matches, "results": results}


def check(event, data, rows):
    problems = []
    ids = {p["id"] for p in data["participants"]}
    used = {pid for e in data["entries"] for pid in e["playerIds"]}
    if ids != used:
        problems.append(f"participants と entries の参照が一致しない: {ids ^ used}")
    per = 0 if "Team" in event else 2 if "Doubles" in event else 1
    for e in data["entries"]:
        if len(e["playerIds"]) != max(per, 1):
            problems.append(f"entry {e['entryNo']} の人数が {len(e['playerIds'])}")
    if len(data["matches"]) != len(rows):
        problems.append(f"試合数 {len(data['matches'])} != 入力 {len(rows)}")
    # 総当たりが完全か（組の全ペアが1回ずつ）
    by_group = {}
    for m in data["matches"]:
        by_group.setdefault(m["group"], []).append(tuple(sorted(m["entries"])))
    for g, pairs in by_group.items():
        members = {x for p in pairs for x in p}
        expected = len(members) * (len(members) - 1) // 2
        if len(pairs) != expected or len(set(pairs)) != len(pairs):
            problems.append(f"{g}組: {len(members)}エントリーで {len(pairs)}試合（総当たりなら {expected}）")
    # 日本がどの組にも居ること（方式Aの範囲）
    jp = {e["entryNo"] for e in data["entries"] if any(pid in ("日本",) or pid.split("_")[0] in {v[0] for v in JAPANESE_PLAYERS.values()} for pid in e["playerIds"])}
    for g, pairs in by_group.items():
        if not jp & {x for p in pairs for x in p}:
            problems.append(f"{g}組に日本が居ない（取り込み範囲外）")
    return problems


def main():
    src = json.load(open(SRC, encoding="utf-8"))
    by_event = {}
    for row in src["rows"]:
        by_event.setdefault(row[0], []).append(row)

    os.makedirs(OUT_DIR, exist_ok=True)
    for event, rows in by_event.items():
        data = build(rows)
        problems = check(event, data, rows)
        assert not problems, f"{event}: {problems}"
        path = os.path.join(OUT_DIR, f"{EVENT_TO_CATEGORY[event]}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        groups = sorted({m["group"] for m in data["matches"]})
        print(f"{EVENT_TO_CATEGORY[event]}: 組 {','.join(groups)} / エントリー {len(data['entries'])} / 試合 {len(data['matches'])}")


if __name__ == "__main__":
    main()
