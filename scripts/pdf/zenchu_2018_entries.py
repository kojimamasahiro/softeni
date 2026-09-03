#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全国中学校ソフトテニス大会 2018年度（第49回, `2018_C10_40.pdf`）のドロー表PDFから
エントリー（選手・チーム情報）のみを抽出し、`initialPlayers` 形式JSONを書き出す。
`scripts/pdf/highschool_championship_entries.py` と同じ「捏造しない」方針で
matches/results は作らない（スコアは tools/tournament3 で人が入力する）。

このPDF固有の事情（詳細は docs/raw/2026-08-30-zenchu-2018-pdf-entries-import.md）:
  - 8ページ構成。p1/p2=男子個人, p3/p4=女子個人, p5/p6=結果一覧, p7=男子団体, p8=女子団体。
    同じ大会でも2019年度はテキスト層なしの6ページで、ページ割りも違う。
  - `scripts/pdf-to-players/extract_tournament.py` は3文字の都道府県
    （北海道・和歌山・鹿児島・神奈川）を列の端で落とすため、このPDFには使えない。
  - 列は座標定数ではなく `（` `）` のX座標から毎回検出する。左ブロックのX座標は
    男子ページと女子ページで約10ptずれる。
  - 姓名は全角空白で分かれる（唯一の例外 `北川アンナ璃咲` は FIX_NAME で補正）。
  - フォントに無い字が豆腐(□)で入っており U+E003 として取れる。個人戦の5箇所は
    `data/players/index.json` と照合して「辻」と確定。女子団体10 の `□妻` は
    愛知県刈谷市立逢妻中学校とみなす（Assumption）。
  - 団体戦ページ(p8)と各ページの見出しは同じ文字が二重に印字されるので重複除去する。

使い方:
  python3 scripts/pdf/zenchu_2018_entries.py <pdf> --out tools/secondaryschool-championship/2018
"""
import os, json, collections
import pdfplumber


YMIN = 60.0
BLOCKS = ["北海道", "北信越", "開催地", "東北", "関東", "東海", "近畿", "中国", "四国", "九州"]
# フォントに無く豆腐（□）で印字されている文字。data/players/index.json の実在選手名で確定。
PUA = ""
PUA_FIX = "辻"

def cluster(vals, tol=8.0):
    out = []
    for v in sorted(vals):
        if out and v - out[-1][-1] <= tol:
            out[-1].append(v)
        else:
            out.append([v])
    return [sum(g) / len(g) for g in out]

def detect_bands(page):
    op = cluster([c["x0"] for c in page.chars if c["text"] == "（" and c["top"] > YMIN])
    cl = cluster([c["x0"] for c in page.chars if c["text"] == "）" and c["top"] > YMIN])
    assert len(op) == 2 and len(cl) == 2, (op, cl)
    return {
        "left":  dict(name=(op[0] - 72, op[0] - 3), info=(op[0] + 3, cl[0] - 1),
                      num=(op[0] - 95, op[0] - 73)),
        "right": dict(name=(op[1] - 74, op[1] - 3), info=(op[1] + 3, cl[1] - 1),
                      num=(cl[1] + 6, cl[1] + 40)),
    }

def band(chars, rng, y, ytol=4.0):
    lo, hi = rng
    got = [c for c in chars if lo <= c["x0"] < hi and abs(c["top"] - y) <= ytol]
    return "".join(c["text"] for c in sorted(got, key=lambda c: c["x0"])).replace(PUA, PUA_FIX)

def split_name(s):
    s = s.replace("　", " ").strip()
    parts = [p for p in s.split(" ") if p]
    if len(parts) >= 2:
        return parts[0], "".join(parts[1:])
    if len(parts) == 1 and len(parts[0]) == 2:
        return parts[0][0], parts[0][1]
    return (parts[0] if parts else ""), ""

def split_pref(s):
    s = s.replace("・", "").replace(" ", "").replace("　", "")
    for b in sorted(BLOCKS, key=len, reverse=True):
        if s.startswith(b):
            return b, s[len(b):]
    return None, s

def parse_page(page, ycut=690.0):
    bands = detect_bands(page)
    ch = page.chars
    out = []
    for side in ("left", "right"):
        b = bands[side]
        tops = sorted(set(round(c["top"], 0) for c in ch
                          if b["name"][0] <= c["x0"] < b["name"][1] and YMIN < c["top"] < ycut))
        ys = []
        for t in tops:
            if ys and t - ys[-1] <= 2:
                continue
            ys.append(t)
        if len(ys) % 2:
            print("!! %s: 氏名行が奇数 (%d)" % (side, len(ys)), file=sys.stderr)
        for i in range(0, len(ys) - 1, 2):
            y1, y2 = ys[i], ys[i + 1]
            blk, pref = split_pref(band(ch, b["info"], y1))
            out.append({
                "no": band(ch, b["num"], (y1 + y2) / 2.0, ytol=(y2 - y1) / 2.0 + 2),
                "y": y1, "side": side,
                "p1": split_name(band(ch, b["name"], y1)),
                "p2": split_name(band(ch, b["name"], y2)),
                "block": blk, "pref": pref,
                "team": band(ch, b["info"], y2).replace(" ", "").replace("　", ""),
            })
    return out



TEAM_PUA_FIX = "逢"   # 原典が豆腐(□)で印字。愛知の「逢妻」と判断（Assumption）。

def dedup_chars(chars):
    seen, out = set(), []
    for c in sorted(chars, key=lambda c: (round(c["top"], 1), c["x0"])):
        k = (round(c["top"], 1), round(c["x0"], 1), c["text"])
        if k in seen:
            continue
        seen.add(k)
        out.append(c)
    return out


def parse_team_page(page):
    ch = dedup_chars(page.chars)
    opens = cluster([c["x0"] for c in ch if c["text"] == "(" and c["top"] > 60])
    closes = cluster([c["x0"] for c in ch if c["text"] == ")" and c["top"] > 60])
    assert len(opens) == 2 and len(closes) == 2, (opens, closes)
    out = []
    for side in (0, 1):
        ox, cx = opens[side], closes[side]
        prows = sorted(set(round(c["top"], 0) for c in ch
                           if c["text"] == "(" and abs(c["x0"] - ox) < 6))
        for py in prows:
            inner = [c for c in ch if ox + 4 < c["x0"] < cx - 2 and abs(c["top"] - py) <= 3]
            txt = "".join(c["text"] for c in sorted(inner, key=lambda c: c["x0"]))
            blk, _, pref = txt.replace(" ", "").partition("・")
            name = [c for c in ch if ox - 6 < c["x0"] < cx + 6 and -18 <= c["top"] - py <= -5]
            team = "".join(c["text"] for c in sorted(name, key=lambda c: c["x0"])).replace(PUA, TEAM_PUA_FIX)
            nlo, nhi = (ox - 26, ox - 2) if side == 0 else (cx + 2, cx + 26)
            num = [c for c in ch if nlo < c["x0"] < nhi and abs(c["top"] - py) <= 8]
            numtxt = "".join(c["text"] for c in sorted(num, key=lambda c: c["x0"]))
            numtxt = numtxt.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
            out.append({"no": numtxt, "team": team.strip(), "block": blk, "pref": pref, "y": py})
    return out


PREF = ["北海道","青森","岩手","宮城","秋田","山形","福島","茨城","栃木","群馬","埼玉","千葉","東京","神奈川","新潟","富山","石川","福井","山梨","長野","岐阜","静岡","愛知","三重","滋賀","京都","大阪","兵庫","奈良","和歌山","鳥取","島根","岡山","広島","山口","徳島","香川","愛媛","高知","福岡","佐賀","長崎","熊本","大分","宮崎","鹿児島","沖縄"]

def full_pref(s):
    s = s.strip()
    if s == "北海道": return "北海道"
    if s == "東京": return "東京都"
    if s in ("大阪", "京都"): return s + "府"
    if s.endswith(("都","道","府","県")): return s
    if s in PREF: return s + "県"
    raise ValueError("unknown prefecture: %r" % s)

FIX_NAME = {("北川アンナ璃咲", ""): ("北川", "アンナ璃咲")}

def doubles(pdf, pages):
    out = []
    for pg in pages:
        for e in parse_page(pdf.pages[pg - 1]):
            eid = int(e["no"])
            team = e["team"]; pref = full_pref(e["pref"])
            info = []
            for who in ("p1", "p2"):
                last, first = FIX_NAME.get(e[who], e[who])
                info.append({"lastName": last, "firstName": first, "team": team,
                             "prefecture": pref, "playerId": None,
                             "tempId": "%s_%s_%s" % (last, first, team)})
            out.append({"id": eid,
                        "name": "%s・%s（%s）" % (info[0]["lastName"], info[1]["lastName"], team),
                        "information": info, "category": "doubles"})
    out.sort(key=lambda x: x["id"])
    return out

def teams(pdf, page):
    out = []
    for e in parse_team_page(pdf.pages[page - 1]):
        pref = full_pref(e["pref"])
        out.append({"id": int(e["no"]), "name": "%s（%s）" % (e["team"], pref),
                    "team": e["team"], "prefecture": pref, "category": "team"})
    out.sort(key=lambda x: x["id"])
    return out


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--out", required=True, help="出力ディレクトリ")
    args = ap.parse_args()
    pdf = pdfplumber.open(args.pdf)
    os.makedirs(args.out, exist_ok=True)
    data = {
        "doubles-none-boys": doubles(pdf, [1, 2]),
        "doubles-none-girls": doubles(pdf, [3, 4]),
        "team-none-boys": teams(pdf, 7),
        "team-none-girls": teams(pdf, 8),
    }
    for k, v in data.items():
        p = os.path.join(args.out, k + ".initialPlayers.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(v, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("wrote", p, len(v))


if __name__ == "__main__":
    main()
