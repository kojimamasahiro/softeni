#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
data/tournaments/details/**/*.json（participants/entries形式）から、
tools/（ブラウザ入力ツール）に貼り付ける initialPlayers 形式のJSONを作る。

対象は「まだ結果が入っていない（matchesが空の）カテゴリ」を想定している。
そういうカテゴリは participants/entries だけが確定情報であり、それを
initialPlayers に変換すれば、PDFを見ながら tools/tournament3（個人戦）や
tools/roundrobin へ貼り付けてスコア入力を進められる。

出力フォーマット（tournament-pdf-to-players skill 準拠）:
  - 個人戦（category: "doubles"）:
      {"id": entryNo, "name": "姓・姓（学校名）",
       "information": [{"lastName","firstName","team","prefecture","playerId":null,"tempId":"姓_名_学校"} x2],
       "category": "doubles"}
    tempId は 姓_名_学校 の3項目（都道府県は含めない）。
  - 団体戦（category: "team"）:
      {"id": entryNo, "name": "学校名（都道府県）", "team": ..., "prefecture": ..., "category": "team"}

使い方:
  python3 scripts/pdf/details_to_initial_players.py \
      data/tournaments/details/highschool-championship/2019/doubles-none-boys.json \
      --out /tmp/initialPlayers.doubles-none-boys.json
"""
import argparse
import json


def build_doubles(data: dict, tempid_with_prefecture: bool = False) -> list:
    by_id = {p["id"]: p for p in data["participants"]}
    out = []
    for e in sorted(data["entries"], key=lambda e: e["entryNo"]):
        pid_a, pid_b = e["playerIds"]
        pa, pb = by_id[pid_a], by_id[pid_b]
        info = []
        for p in (pa, pb):
            temp_id = f"{p['lastName']}_{p['firstName']}_{p['team']}"
            if tempid_with_prefecture:
                temp_id += f"_{p['prefecture']}"
            info.append(
                {
                    "lastName": p["lastName"],
                    "firstName": p["firstName"],
                    "team": p["team"],
                    "prefecture": p["prefecture"],
                    "playerId": None,
                    "tempId": temp_id,
                }
            )
        out.append(
            {
                "id": e["entryNo"],
                "name": f"{pa['lastName']}・{pb['lastName']}（{pa['team']}）",
                "information": info,
                "category": "doubles",
            }
        )
    return out


def build_team(data: dict) -> list:
    by_id = {p["id"]: p for p in data["participants"]}
    out = []
    for e in sorted(data["entries"], key=lambda e: e["entryNo"]):
        p = by_id[e["playerIds"][0]]
        out.append(
            {
                "id": e["entryNo"],
                "name": f"{p['team']}（{p['prefecture']}）",
                "team": p["team"],
                "prefecture": p["prefecture"],
                "category": "team",
            }
        )
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("details_json", help="data/tournaments/details/**/*.json")
    ap.add_argument("--out", required=True)
    ap.add_argument(
        "--tempid-with-prefecture",
        action="store_true",
        help="tempIdを姓_名_学校_都道府県の4項目にする（既定は姓_名_学校の3項目）",
    )
    args = ap.parse_args()

    with open(args.details_json, encoding="utf-8") as f:
        data = json.load(f)

    is_team = all(p.get("lastName") is None for p in data["participants"]) if data["participants"] else False
    players = build_team(data) if is_team else build_doubles(data, args.tempid_with_prefecture)

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(players, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"wrote {args.out}  {len(players)} entries ({'team' if is_team else 'doubles'})")


if __name__ == "__main__":
    main()
