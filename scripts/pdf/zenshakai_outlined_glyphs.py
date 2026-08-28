#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
テキスト層を持たない（文字がアウトライン化されてベクターパスで埋め込まれた）
トーナメント表PDFから、エントリー（選手・所属情報）を抽出する。

2022年度 全日本社会人（2022_A06_40.pdf）の「一般男子」1〜8ページ専用。
このPDFのこの8ページだけ `page.get_text()` がほぼ空で、`page.get_drawings()` に
2140個の fill path が入っている。**1 path = 1文字**にきれいに対応するため、
OCR（画像化して読む）ではなく、ベクターパスをそのまま文字単位に扱える。

方針:
  1. `get_drawings()` の黒い fill path を「文字」として拾い、X座標で
     エントリー番号 / 氏名 / 都道府県 / 所属 の4フィールドに分ける。
     （括弧 "(" ")" の固定X座標を各エントリーのアンカーに使う）
  2. 同じ文字は同じベクター形状なので、レンダリングした画像の類似度で
     クラスタリングし、6858文字 → 約1240クラスに圧縮する。
  3. 9ページ目「男子＜ベスト64＞」は通常のテキスト層を持ち、エントリー番号つきで
     64組128名が読める。これを正解セットにしてクラスへ自動ラベル付けする
     （氏名欄の文字の77%がこれだけで確定する）。
  4. 残りのクラスだけを1文字ずつ大きく並べた画像にして、人間（またはVLM）が
     1回ずつ同定する。同定結果は本スクリプトと同じディレクトリの
     `zenshakai-2022-general-boys-glyphs.json`（グリフ座標→文字）に保存済み。
  5. 土/士・末/未のように字形が紛らわしい字は、目視ではなくベクターの実寸
     （上下の横棒の幅）を測って判定する。

精度（実測。詳細は docs/raw/2026-08-20-zennihon-workers-2022-general-boys-vector-glyph-import.md）:
  - 盲検（ベスト64のうち32エントリーの正解を辞書から外して予測）: 氏名 64/64、文字 252/252
  - 9ページ目の正解との照合: 氏名 128/128、都道府県 128/128、所属 128/128
  - 所属名225種すべてが本プロジェクトの既存データに実在する表記と一致

使い方:
  python3 scripts/pdf/zenshakai_outlined_glyphs.py <pdf> \
      --out data/tournaments/details/zennihon-workers/2022/doubles-none-boys.json
  # 未同定グリフの確認用画像を出す場合:
  python3 scripts/pdf/zenshakai_outlined_glyphs.py <pdf> --montage /tmp/glyphs
"""
import argparse
import collections
import json
import os
import re
import unicodedata

import pymupdf

PAGES = range(0, 8)  # 一般男子（0-indexed）
GT_PAGE = 8          # 男子<ベスト64>（テキスト層あり）

# 括弧の固定X座標。各エントリーはこの "(" の位置で1つに決まる。
ZONES = {
    "L": dict(paren=145.5, close=236.3, no=(40, 79), name=(80, 144.5),
              pref=(147, 176), team=(176, 236)),
    "R": dict(paren=419.8, close=510.6, no=(514, 545), name=(355, 419),
              pref=(422, 450), team=(450, 509.5)),
}
PAREN_X = [145.5, 236.3, 419.8, 510.6]
# 姓/名の境界（氏名スロット2と3の間）。氏名は4スロットに割り付けられ、
# スロット1-2が姓、3-4が名。「大城戸 秀 治」のような3文字姓も正しく割れる。
NAME_MID = {"L": 108.4, "R": 382.9}

VARIANT_MAP = str.maketrans(
    {"黑": "黒", "髙": "高", "﨑": "崎", "學": "学", "戶": "戸", "⻄": "西", "⻘": "青", "⾕": "谷"}
)
PREF_FULL = {"北海道": "北海道", "東京": "東京都", "京都": "京都府", "大阪": "大阪府"}

AMBIGUOUS_CASE = set("cosuvwxzkCOSUVWXZK")
SMALL_KANA = {"ア": "ァ", "イ": "ィ", "ウ": "ゥ", "エ": "ェ", "オ": "ォ", "ヤ": "ャ",
              "ユ": "ュ", "ヨ": "ョ", "ツ": "ッ", "ワ": "ヮ", "カ": "ヵ", "ケ": "ヶ"}
# カタカナ主体のフィールドでだけ漢字→同形カタカナへ寄せる（フェニックス の ェ/ニ 等）
KATAKANA_HOMOGLYPH = {"工": "エ", "二": "ニ", "力": "カ", "口": "ロ", "夕": "タ",
                      "卜": "ト", "一": "ー", "三": "ミ", "十": "ナ"}
# 英字に挟まれた同形漢字（ZERO の Z 等）
LATIN_HOMOGLYPH = {"乙": "Z"}
# 字形が紛らわしく、クラスタリングでは分離しきれない字。横棒の実寸で1文字ずつ判定する。
#   土: 下の棒が長い / 士: 上の棒が長い
#   末: 1本目の棒が長い / 未: 2本目の棒が長い
CONFUSABLE = {"土", "士", "末", "未"}


def norm(text):
    if not text:
        return ""
    t = unicodedata.normalize("NFKC", text).translate(VARIANT_MAP)
    return re.sub(r"[\s　]+", "", t)


def prefecture_full(p):
    p = norm(p)
    if p in PREF_FULL:
        return PREF_FULL[p]
    return p if p.endswith(("都", "道", "府", "県")) else p + "県"


def is_kata(ch):
    return 0x30A0 <= ord(ch) <= 0x30FF or ch == "ー"


def is_ideo(ch):
    return 0x4E00 <= ord(ch) <= 0x9FFF or 0xF900 <= ord(ch) <= 0xFAFF


def is_latin(ch):
    return len(ch) == 1 and (("a" <= ch <= "z") or ("A" <= ch <= "Z"))


# ----------------------------- グリフの抽出 -----------------------------
def page_glyphs(page, pno):
    """黒い fill path を1文字として拾う。トーナメントの罫線は赤、点線は
    0.8pt角の黒い小片なので、色とサイズで落とす（ゾーン外なので実害はないが）。"""
    out = []
    for d in page.get_drawings():
        r = d["rect"]
        f = d.get("fill")
        if f is None or max(f) > 0.35:
            continue
        if r.height > 16 or r.width > 16:
            continue
        if r.height < 0.15 or r.width < 0.15:
            continue
        out.append(dict(page=pno, x0=r.x0, y0=r.y0, x1=r.x1, y1=r.y1,
                        w=r.width, h=r.height,
                        xm=(r.x0 + r.x1) / 2, ym=(r.y0 + r.y1) / 2))
    return out


def is_paren(g):
    return any(abs(g["x0"] - p) < 1.2 for p in PAREN_X) and g["w"] < 3.0


def extract_entries(doc):
    """ページ順 → 左半分→右半分 → 上から下 の順で並ぶ（=エントリー番号の昇順）。
    エントリー番号の桁数が連番の期待値と全件一致することで検算できる。"""
    entries = []
    for pno in PAGES:
        gs = page_glyphs(doc[pno], pno)
        for half, Z in ZONES.items():
            opens = sorted([g for g in gs if abs(g["x0"] - Z["paren"]) < 1.2 and g["w"] < 3.0],
                           key=lambda g: g["ym"])
            for o in opens:
                ym = o["ym"]

                def band(lo, hi, zone):
                    return sorted([g for g in gs
                                   if lo <= g["ym"] - ym < hi
                                   and Z[zone][0] <= g["x0"] < Z[zone][1]
                                   and not is_paren(g)],
                                  key=lambda g: g["x0"])

                n1, n2 = band(-8.5, -2.6, "name"), band(2.6, 8.5, "name")
                # 所属は「2人共通なら中央の1行」「別々なら上下2行」。アポストロフィ等
                # 背の低い記号は帯の境界をまたぐので、氏名行との距離で振り分ける。
                tall = sorted([g for g in gs
                               if -8.5 <= g["ym"] - ym < 8.5
                               and Z["team"][0] <= g["x0"] < Z["team"][1]
                               and not is_paren(g)],
                              key=lambda g: g["x0"])
                t1, t0, t2 = [], [], []
                if tall:
                    y1 = sum(g["ym"] for g in n1) / len(n1) if n1 else ym - 5.1
                    y2 = sum(g["ym"] for g in n2) / len(n2) if n2 else ym + 5.1
                    ymid = (y1 + y2) / 2
                    if sum(abs(g["ym"] - ymid) for g in tall) / len(tall) < 1.8:
                        t0 = tall
                    else:
                        for g in tall:
                            (t1 if abs(g["ym"] - y1) <= abs(g["ym"] - y2) else t2).append(g)
                entries.append(dict(page=pno, half=half, ym=ym,
                                    no=band(-2.6, 2.6, "no"), n1=n1, n2=n2,
                                    p1=band(-8.5, -2.6, "pref"), p0=band(-2.6, 2.6, "pref"),
                                    p2=band(2.6, 8.5, "pref"),
                                    t1=t1, t0=t0, t2=t2))
    entries.sort(key=lambda e: (e["page"], 0 if e["half"] == "L" else 1, e["ym"]))
    for i, e in enumerate(entries, 1):
        e["entryNo"] = i
    return entries


def check_entry_numbering(entries):
    """エントリー番号の桁数が連番の期待値と一致するか。構造抽出の検算。"""
    bad = [e["entryNo"] for e in entries if len(e["no"]) != len(str(e["entryNo"]))]
    return bad


# ----------------------------- 文字の割り当て -----------------------------
def load_labels(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def key(g):
    return "%d:%.2f:%.2f" % (g["page"], g["x0"], g["y0"])


def field_text(glyphs, labels, spaces=False, disambiguate=None):
    L = glyphs
    if not L:
        return ""
    base = [labels.get(key(g), "□") for g in L]
    adv = [(L[k + 1]["x0"] - L[k]["x0"]) if k + 1 < len(L) else None for k in range(len(L))]
    cjk = [adv[k] for k, ch in enumerate(base) if ch != "□" and is_kata(ch) or
           (ch != "□" and is_ideo(ch))]
    cjk = [a for a in (adv[k] for k, ch in enumerate(base)
                       if ch != "□" and (is_kata(ch) or is_ideo(ch))) if a]
    tallest = max(g["h"] for g in L)
    hmax = max([g["h"] for g in L if g["h"] > 0.3 * tallest])
    em = sorted(cjk)[len(cjk) // 2] if cjk else hmax / 0.72
    # ベースラインは「下端の中央値」。最大値だと g/y のディセンダに引っ張られる。
    ys = sorted(g["y1"] for g in L)
    baseline = ys[len(ys) // 2]

    # 紛らわしい字は、クラス代表ではなく1文字ずつ実寸で決める
    if disambiguate is not None:
        base = [disambiguate(g, ch) if ch in CONFUSABLE else ch for g, ch in zip(L, base)]

    # 同形の漢字/カタカナ・英字（ホトニクスのニ、ZEROのZ 等）を文脈で寄せる。
    # 候補文字は「中立」として読み飛ばし、実在の隣接文字だけを見る。
    def resolved_neighbours(i):
        out = []
        for step in (-1, 1):
            j = i + step
            while 0 <= j < len(base) and (base[j] in KATAKANA_HOMOGLYPH or base[j] in LATIN_HOMOGLYPH):
                j += step
            if 0 <= j < len(base):
                out.append(base[j])
        return out

    fixed = list(base)
    for i, ch in enumerate(base):
        if ch not in KATAKANA_HOMOGLYPH and ch not in LATIN_HOMOGLYPH:
            continue
        nb = resolved_neighbours(i)
        if not nb or any(is_ideo(c) for c in nb):
            continue
        if all(is_kata(c) or c in KATAKANA_HOMOGLYPH for c in nb) and ch in KATAKANA_HOMOGLYPH:
            fixed[i] = KATAKANA_HOMOGLYPH[ch]
        elif all(is_latin(c) for c in nb) and ch in LATIN_HOMOGLYPH:
            fixed[i] = LATIN_HOMOGLYPH[ch]
    base = fixed

    res = []
    for k, (g, ch) in enumerate(zip(L, base)):
        if spaces and ch in SMALL_KANA and g["h"] < 0.78 * hmax:
            ch = SMALL_KANA[ch]
        if ch in ("・", ".", "●"):
            # 中黒か句点かは、ベースラインからの高さで決まる
            ch = "." if g["y1"] > baseline - 0.18 * em else "・"
        elif ch in AMBIGUOUS_CASE:
            # C/c O/o のように大小で字形が同じ英字は、行の最大字高との比で決める
            ch = ch.lower() if g["h"] < 0.85 * hmax else ch.upper()
        res.append(ch)
        if spaces and k + 1 < len(L) and (L[k + 1]["x0"] - g["x1"]) > 0.30 * em:
            res.append(" ")
    return "".join(res)


def split_name(glyphs, labels, half, disambiguate=None):
    mid = NAME_MID[half]

    def ch_of(g):
        c = labels.get(key(g), "□")
        return disambiguate(g, c) if (disambiguate and c in CONFUSABLE) else c

    sur = "".join(ch_of(g) for g in glyphs if g["x0"] < mid)
    giv = "".join(ch_of(g) for g in glyphs if g["x0"] >= mid)
    if not sur or not giv:  # 保険（実データでは発生しない）
        full = sur + giv
        if len(full) == 2:
            sur, giv = full[0], full[1]
        elif len(full) <= 1:
            sur, giv = full, ""
        else:
            sur, giv = full[:2], full[2:]
    return norm(sur), norm(giv)


def build_json(entries, labels, disambiguate=None):
    participants, seen, out_entries = [], set(), []
    for e in entries:
        ids = []
        for f, pk, tk in (("n1", "p1", "t1"), ("n2", "p2", "t2")):
            sur, giv = split_name(e[f], labels, e["half"], disambiguate)
            pref = prefecture_full(field_text(e[pk] or e["p0"], labels, disambiguate=disambiguate))
            team = norm(field_text(e[tk] or e["t0"], labels, spaces=True, disambiguate=disambiguate))
            pid = "%s_%s_%s_%s" % (sur, giv, team, pref)
            ids.append(pid)
            if pid not in seen:
                seen.add(pid)
                participants.append(dict(id=pid, lastName=sur, firstName=giv,
                                         team=team, prefecture=pref))
        out_entries.append(dict(entryNo=e["entryNo"], playerIds=ids, type=None))
    return dict(participants=participants, entries=out_entries, matches=[], results=[])


# --------------------- 9ページ目（正解セット）の読み取り ---------------------
def parse_ground_truth(doc):
    """男子<ベスト64>。エントリー番号つきで64組の氏名・都道府県・所属が取れる。"""
    p = doc[GT_PAGE]
    ws = [dict(x0=w[0], y0=w[1], x1=w[2], y1=w[3], t=w[4], ym=(w[1] + w[3]) / 2)
          for w in p.get_text("words")]
    Z = {"L": dict(no=(40, 60), name=(60, 132), pref=(132, 168), team=(168, 232), paren=131.9),
         "R": dict(name=(360, 428), pref=(432, 464), team=(464, 528), no=(532, 560), paren=429.0)}
    res = {}
    for half, z in Z.items():
        for o in sorted([w for w in ws if abs(w["x0"] - z["paren"]) < 1.0 and w["t"] == "("],
                        key=lambda w: w["ym"]):
            ym = o["ym"]

            def band(lo, hi, k):
                return "".join(w["t"] for w in sorted(
                    [w for w in ws if lo <= w["ym"] - ym < hi and z[k][0] <= w["x0"] < z[k][1]],
                    key=lambda w: w["x0"]))

            no = band(-3, 3, "no")
            if not no:
                continue
            res[no] = dict(n1=band(-9, -3, "name"), n2=band(3, 9, "name"),
                           pref1=band(-9, -3, "pref") or band(-3, 3, "pref"),
                           pref2=band(3, 9, "pref") or band(-3, 3, "pref"),
                           team1=(band(-9, -3, "team") or band(-3, 3, "team")).rstrip(")"),
                           team2=(band(3, 9, "team") or band(-3, 3, "team")).rstrip(")"))
    return res


def verify(entries, labels, gt, disambiguate=None):
    by = {e["entryNo"]: e for e in entries}
    ok = collections.Counter()
    bad = []
    for k, g in gt.items():
        e = by.get(int(k))
        if not e:
            continue
        for f, gk in (("n1", "n1"), ("n2", "n2")):
            got = field_text(e[f], labels, disambiguate=disambiguate)
            want = g[gk].replace("　", "")
            ok["name_ok" if got == want else "name_ng"] += 1
            if got != want:
                bad.append(("NAME", k, want, got))
        for pk, gk in (("p1", "pref1"), ("p2", "pref2")):
            got = field_text(e[pk] or e["p0"], labels, disambiguate=disambiguate)
            ok["pref_ok" if got == g[gk] else "pref_ng"] += 1
        for tk, gk in (("t1", "team1"), ("t2", "team2")):
            got = norm(field_text(e[tk] or e["t0"], labels, spaces=True, disambiguate=disambiguate))
            ok["team_ok" if got == norm(g[gk]) else "team_ng"] += 1
            if got != norm(g[gk]):
                bad.append(("TEAM", k, g[gk], got))
    return ok, bad


# ----------------- 未同定グリフの確認用モンタージュ（再利用用） -----------------
def write_montages(doc, entries, labels, outdir, cell=150, cols=6, rows=6):
    """ラベルの無いグリフを大きく並べた画像を出す。1セル=1文字。
    高さで正規化して描く（幅で正規化すると 土/士 の見分けが付かなくなる）。"""
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont
    os.makedirs(outdir, exist_ok=True)
    dl = {p: doc[p].get_displaylist() for p in PAGES}
    todo, seen = [], set()
    for e in entries:
        for f in ("no", "n1", "n2", "p1", "p0", "p2", "t1", "t0", "t2"):
            for g in e[f]:
                k = key(g)
                if k in labels or k in seen:
                    continue
                seen.add(k)
                todo.append(g)
    try:
        fnt = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    except Exception:
        fnt = ImageFont.load_default()
    per, pad = cols * rows, 34
    for i in range(0, len(todo), per):
        chunk = todo[i:i + per]
        im = Image.new("L", (cols * cell, rows * (cell + pad)), 255)
        dr = ImageDraw.Draw(im)
        for j, g in enumerate(chunk):
            r, c = divmod(j, cols)
            x, y = c * cell, r * (cell + pad)
            px = cell - 24
            z = px / (max(g["h"], g["w"] * 0.75) * 1.06)
            pm = dl[g["page"]].get_pixmap(
                matrix=pymupdf.Matrix(z, z),
                clip=pymupdf.Rect(g["x0"] - 0.15, g["y0"] - 0.15, g["x1"] + 0.15, g["y1"] + 0.15),
                colorspace=pymupdf.csGRAY, alpha=False)
            a = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width)
            gi = Image.fromarray(a)
            im.paste(gi, (x + (cell - gi.width) // 2, y + pad + (px - gi.height) // 2))
            dr.text((x + 6, y + 4), key(g), font=fnt, fill=0)
        im.save(os.path.join(outdir, "glyphs_%02d.png" % (i // per)))
    return len(todo)


def make_disambiguator(doc):
    """土/士・末/未 は同じ字形クラスに混ざりうるので、クラスの代表ラベルを信用せず
    1文字ずつ横棒の実寸を測って決める。実測例:
      土 = 上の棒381 / 下の棒436、士 = 上432 / 下398（60倍描画時のピクセル幅）
      末 = 437/396/437（1本目が長い）、未 = 401/445/436（2本目が長い）
    9ページ目のテキスト層（正解セット）にも誤記があり（entry 36「畑本理土」は
    ドロー表では「理士」、本プロジェクトの選手辞書も「理士」）、実寸判定のほうが
    ドロー表の実際の印字に忠実。"""
    cache = {}

    def f(g, ch):
        k = key(g)
        if k in cache:
            return cache[k]
        b = horizontal_bars(doc, g)
        if ch in ("土", "士") and len(b) >= 2:
            r = "士" if b[0][2] > b[-1][2] else "土"
        elif ch in ("末", "未") and len(b) >= 2:
            r = "末" if b[0][2] > b[1][2] else "未"
        else:
            r = ch
        cache[k] = r
        return r

    return f


def horizontal_bars(doc, g, zoom=60.0):
    """横棒の実寸を測る。土/士（上下どちらの棒が長いか）、末/未 の判定用。"""
    import numpy as np
    pm = doc[g["page"]].get_displaylist().get_pixmap(
        matrix=pymupdf.Matrix(zoom, zoom),
        clip=pymupdf.Rect(g["x0"], g["y0"], g["x1"], g["y1"]),
        colorspace=pymupdf.csGRAY, alpha=False)
    a = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width) < 128
    widths = []
    for row in a:
        nz = np.nonzero(row)[0]
        widths.append(int(nz[-1] - nz[0] + 1) if len(nz) else 0)
    mx = max(widths) or 1
    bands, cur = [], None
    for i, v in enumerate(widths):
        if v > 0.55 * mx:
            cur = [i, i, v] if cur is None else [cur[0], i, max(cur[2], v)]
        elif cur:
            bands.append(tuple(cur))
            cur = None
    if cur:
        bands.append(tuple(cur))
    return bands


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--labels", default=os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "zenshakai-2022-general-boys-glyphs.json"))
    ap.add_argument("--out")
    ap.add_argument("--montage")
    args = ap.parse_args()

    doc = pymupdf.open(args.pdf)
    entries = extract_entries(doc)
    print("entries: %d" % len(entries))
    bad = check_entry_numbering(entries)
    print("エントリー番号の桁数不一致: %d件 %s" % (len(bad), bad[:10]))

    labels = load_labels(args.labels) if os.path.exists(args.labels) else {}
    if args.montage:
        n = write_montages(doc, entries, labels, args.montage)
        print("未同定グリフ %d 個の確認用画像を %s に出力" % (n, args.montage))
        return

    disambiguate = make_disambiguator(doc)
    gt = parse_ground_truth(doc)
    ok, diffs = verify(entries, labels, gt, disambiguate)
    print("9ページ目の正解との照合: 氏名 %d/%d  都道府県 %d/%d  所属 %d/%d" % (
        ok["name_ok"], ok["name_ok"] + ok["name_ng"],
        ok["pref_ok"], ok["pref_ok"] + ok["pref_ng"],
        ok["team_ok"], ok["team_ok"] + ok["team_ng"]))
    for d in diffs:
        print("  ", d)

    data = build_json(entries, labels, disambiguate)
    unresolved = [p["id"] for p in data["participants"] if "□" in p["id"]]
    print("未解決グリフを含む選手: %d" % len(unresolved))
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=1)
        print("wrote %s  participants=%d entries=%d" % (
            args.out, len(data["participants"]), len(data["entries"])))


if __name__ == "__main__":
    main()
