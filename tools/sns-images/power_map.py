#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""大会前投稿用「学校・都道府県の勢力図」画像を生成する。

過去の details データを集計し、都道府県タイルマップ＋都道府県/学校ランキングを1枚に描画。

使い方:
  python tools/sns-images/power_map.py \
      --tournament highschool-championship \
      --category doubles-none-boys \
      --years 2021-2025 \
      --metric points \
      --title "インターハイ男子ダブルス 勢力図（過去5年）" \
      --out out/sns

  --tournament / --category は複数指定可（スペース区切り）。
  --metric points : 勝利数 + 上位進出ボーナス（優勝10/準優勝6/ベスト4 4/ベスト8 2）
  --metric titles : タイトルポイント（優勝3/準優勝2/ベスト4 1）
"""
import argparse
import glob
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import snslib as S

W, H = 1200, 1500

BONUS_POINTS = {"winner": 10, "runnerup": 6, "best4": 4, "best8": 2}
TITLE_POINTS = {"winner": 3, "runnerup": 2, "best4": 1}

# 都道府県タイルマップ座標 (col, row)
TILE = {
    "北海道": (14, 0),
    "青森県": (14, 2),
    "秋田県": (13, 3), "岩手県": (14, 3),
    "山形県": (13, 4), "宮城県": (14, 4),
    "石川県": (9, 5), "富山県": (10, 5), "新潟県": (12, 5), "福島県": (13, 5),
    "福井県": (9, 6), "岐阜県": (10, 6), "長野県": (11, 6), "群馬県": (12, 6), "栃木県": (13, 6), "茨城県": (14, 6),
    "島根県": (4, 7), "鳥取県": (5, 7), "兵庫県": (6, 7), "京都府": (7, 7), "滋賀県": (8, 7),
    "山梨県": (11, 7), "埼玉県": (12, 7), "東京都": (13, 7), "千葉県": (14, 7),
    "山口県": (3, 8), "広島県": (4, 8), "岡山県": (5, 8), "大阪府": (6, 8), "奈良県": (7, 8), "三重県": (8, 8),
    "愛知県": (10, 8), "静岡県": (11, 8), "神奈川県": (12, 8),
    "和歌山県": (7, 9),
    "愛媛県": (4, 9), "香川県": (5, 9), "徳島県": (6, 9),
    "高知県": (5, 10),
    "佐賀県": (0, 9), "福岡県": (1, 9), "大分県": (2, 9),
    "長崎県": (0, 10), "熊本県": (1, 10), "宮崎県": (2, 10),
    "鹿児島県": (1, 11),
    "沖縄県": (0, 13),
}


def short_pref(p):
    if not p or p == "北海道":
        return p or ""
    return p[:-1] if p[-1] in "県府都" else p


def rank_key(result):
    t = result.get("tournament")
    if not t or not t.get("rank"):
        return None
    r = t["rank"]
    if r["kind"] == "winner":
        return "winner"
    if r["kind"] == "runnerup":
        return "runnerup"
    if r["kind"] == "best" and r.get("bestLevel") == 4:
        return "best4"
    if r["kind"] == "best" and r.get("bestLevel") == 8:
        return "best8"
    return None


def iter_files(root, tournaments, categories, years):
    for t in tournaments:
        for path in sorted(glob.glob(os.path.join(root, t, "*", "*.json"))):
            year = os.path.basename(os.path.dirname(path))
            if not year.isdigit() or int(year) not in years:
                continue
            name = os.path.splitext(os.path.basename(path))[0]
            if categories and name not in categories:
                continue
            yield path


def aggregate(files, metric):
    pref_score = defaultdict(float)
    team_score = defaultdict(float)
    pref_titles = defaultdict(lambda: defaultdict(int))
    team_titles = defaultdict(lambda: defaultdict(int))
    team_pref = {}

    for path in files:
        data = json.load(open(path, encoding="utf-8"))
        pmap = S.participants_map(data)
        emap = {e["entryNo"]: e for e in data["entries"]}

        def entry_info(no):
            pids = emap[no].get("playerIds") or []
            if not pids or pids[0] not in pmap:
                return None, None
            p = pmap[pids[0]]
            return p.get("prefecture"), p.get("team")

        if metric == "points":
            for m in data["matches"]:
                if m.get("winnerEntryNo") is None:
                    continue
                pref, team = entry_info(m["winnerEntryNo"])
                if pref:
                    pref_score[pref] += 1
                if team:
                    team_score[(team, pref)] += 1
                    team_pref[(team, pref)] = pref

        for r in data["results"]:
            k = rank_key(r)
            if not k:
                continue
            pref, team = entry_info(r["entryNo"])
            pts = (BONUS_POINTS if metric == "points" else TITLE_POINTS).get(k, 0)
            if pref:
                pref_score[pref] += pts
                pref_titles[pref][k] += 1
            if team:
                team_score[(team, pref)] += pts
                team_titles[(team, pref)][k] += 1
                team_pref[(team, pref)] = pref

    return pref_score, team_score, pref_titles, team_titles


def heat_color(v, vmax):
    if v <= 0:
        return S.HEAT[0]
    import math
    ratio = math.sqrt(v / vmax) if vmax > 0 else 0
    i = min(len(S.HEAT) - 1, 1 + int(ratio * (len(S.HEAT) - 1 - 0.001)))
    return S.HEAT[i]


def titles_note(tcounts):
    parts = []
    for k, lab in [("winner", "優勝"), ("runnerup", "準V"), ("best4", "B4×")]:
        if tcounts.get(k):
            parts.append(f"{lab}{tcounts[k]}")
    return "・".join(parts)


def render(pref_score, team_score, pref_titles, team_titles, title, subtitle, metric, out_path,
           units="both"):
    img, d = S.new_canvas(W, H)
    S.draw_header(d, W, title, subtitle)

    # ---- タイルマップ ----
    cell, gap = 60, 6
    grid_w = 15 * (cell + gap)
    ox = (W - grid_w) // 2 + gap
    oy = 160
    vmax = max(pref_score.values()) if pref_score else 1
    top_pref = max(pref_score, key=pref_score.get) if pref_score else None

    nf = S.font(17, bold=True)
    vf = S.font(15)
    for pref, (cx, cy) in TILE.items():
        v = pref_score.get(pref, 0)
        x = ox + cx * (cell + gap)
        y = oy + cy * (cell + gap)
        color = heat_color(v, vmax)
        d.rounded_rectangle([x, y, x + cell, y + cell], radius=8, fill=color)
        if pref == top_pref:
            d.rounded_rectangle([x, y, x + cell, y + cell], radius=8, outline=S.YELLOW, width=4)
        dark = sum(color) < 380
        name = short_pref(pref)
        f2 = S.fit_font(d, name, cell - 8, 17, bold=True)
        tw = S.text_w(d, name, f2)
        d.text((x + (cell - tw) / 2, y + 12), name, font=f2, fill=S.WHITE if dark else S.NAVY)
        if v > 0:
            vs = str(int(v))
            tw = S.text_w(d, vs, vf)
            d.text((x + (cell - tw) / 2, y + 34), vs, font=vf, fill=S.WHITE if dark else S.GRAY)

    # ---- ランキング（下段2カラム） ----
    list_top = oy + 14 * (cell + gap) + 16
    col_w = (W - 72) // 2
    row_h = 36
    metric_label = "ポイント" if metric == "points" else "タイトルpt"

    def draw_ranking(x, label, items, titles_map, is_team, start=1, maxv=None):
        d.rectangle([x, list_top, x + col_w, list_top + 42], fill=S.NAVY)
        d.rectangle([x, list_top, x + 8, list_top + 42], fill=S.YELLOW)
        d.text((x + 20, list_top + 8), label, font=S.font(21, bold=True), fill=S.WHITE)
        y = list_top + 50
        if maxv is None:
            maxv = items[0][1] if items else 1
        for i, (key, v) in enumerate(items, start):
            name = f"{key[0]}（{short_pref(key[1] or '')}）" if is_team else short_pref(key)
            note = titles_note(titles_map.get(key, {}))
            bar_w = int((col_w - 200) * (v / maxv)) if maxv else 0
            d.rectangle([x + 32, y + 5, x + 32 + bar_w, y + row_h - 7], fill=S.YELLOW if i == 1 else (222, 228, 240))
            d.text((x + 4, y + 6), f"{i}", font=S.font(19, bold=True), fill=S.NAVY)
            nf2 = S.fit_font(d, name, col_w - 250, 19, bold=True)
            d.text((x + 38, y + 7), name, font=nf2, fill=S.NAVY)
            right = f"{int(v)}" + (f"  {note}" if note else "")
            rf = S.fit_font(d, right, 205, 17, bold=True)
            tw = S.text_w(d, right, rf)
            d.text((x + col_w - 6 - tw, y + 8), right, font=rf, fill=S.NAVY)
            y += row_h
        return y

    prefs_all = sorted(pref_score.items(), key=lambda kv: -kv[1])
    teams_all = sorted(team_score.items(), key=lambda kv: -kv[1])
    x_left = 36
    x_right = 36 + col_w + 12
    if units == "school":
        # 学校ランキングのみを2カラム（1〜7 / 8〜14）に分割表示
        rows = teams_all[:14]
        left, right = rows[:7], rows[7:14]
        shared = rows[0][1] if rows else 1
        draw_ranking(x_left, f"学校 TOP{len(rows)}（{metric_label}）", left, team_titles, True, maxv=shared)
        if right:
            draw_ranking(x_right, "　", right, team_titles, True, start=8, maxv=shared)
    elif units == "pref":
        rows = prefs_all[:14]
        left, right = rows[:7], rows[7:14]
        shared = rows[0][1] if rows else 1
        draw_ranking(x_left, f"都道府県 TOP{len(rows)}（{metric_label}）", left, pref_titles, False, maxv=shared)
        if right:
            draw_ranking(x_right, "　", right, pref_titles, False, start=8, maxv=shared)
    else:
        prefs = prefs_all[:8]
        teams = teams_all[:8]
        draw_ranking(x_left, f"都道府県 TOP{len(prefs)}（{metric_label}）", prefs, pref_titles, False)
        draw_ranking(x_right, f"学校 TOP{len(teams)}（{metric_label}）", teams, team_titles, True)

    S.draw_footer(d, W, H)
    img.save(out_path)
    return out_path


def parse_years(s):
    if "-" in s:
        a, b = s.split("-")
        return set(range(int(a), int(b) + 1))
    return {int(x) for x in s.split(",")}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--details-root", default="data/tournaments/details")
    ap.add_argument("--tournament", nargs="+", required=True)
    ap.add_argument("--category", nargs="+", default=None, help="例: doubles-none-boys（省略時は全カテゴリ）")
    ap.add_argument("--years", default="2021-2025")
    ap.add_argument("--metric", choices=["points", "titles"], default="points")
    ap.add_argument("--units", choices=["both", "school", "pref"], default="both",
                    help="下段ランキングの単位。school=学校のみ / pref=都道府県のみ / both=両方（既定）")
    ap.add_argument("--title", required=True)
    ap.add_argument("--subtitle", default=None)
    ap.add_argument("--out", default="out/sns")
    args = ap.parse_args()

    years = parse_years(args.years)
    files = list(iter_files(args.details_root, args.tournament, args.category, years))
    if not files:
        raise SystemExit("対象データが見つかりません。--tournament/--category/--years を確認してください。")

    pref_score, team_score, pref_titles, team_titles = aggregate(files, args.metric)
    sub = args.subtitle or (
        f"{min(years)}〜{max(years)}年 "
        + ("勝利数＋上位進出ポイントで集計" if args.metric == "points" else "優勝3pt・準優勝2pt・ベスト4 1ptで集計")
    )
    os.makedirs(args.out, exist_ok=True)
    cat_tag = "-".join(args.category) if args.category else "all"
    name = f"powermap_{args.tournament[0]}_{cat_tag}_{args.units}_{args.metric}.png"
    out = render(pref_score, team_score, pref_titles, team_titles, args.title, sub, args.metric,
                 os.path.join(args.out, name), units=args.units)
    print("生成しました:", out, f"（対象 {len(files)} ファイル）")


if __name__ == "__main__":
    main()
