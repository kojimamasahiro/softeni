# -*- coding: utf-8 -*-
"""1日目SNS投稿の共通ロジック＋描画部品。

データ仕様・方針は docs/wiki/sns-day1-images.md を参照。
- ダブルス本選進出: グループ1位（勝数→ゲーム差→総得ゲーム）。
- 前年実績proxy: 前年のみ・ベスト8以上・選手id単位。
- CTA: 会場は information JSON、2日目日付は呼び出し側から渡す。
"""
import collections
import json
import os

import snslib as S

W = 1200
# X投稿向け標準サイズ（W=1200固定）。16:9 / 1:1 / 4:5。
STD_HEIGHTS = [675, 1200, 1500]
CT = 156   # コンテンツ開始y（ヘッダー126+余白30）
CBM = 70   # 下マージン（フッター込み）


def pick_height(content_h):
    """ヘッダー下〜フッター上に content_h が収まる最小の標準高さを返す。"""
    need = CT + content_h + CBM
    for h in STD_HEIGHTS:
        if need <= h:
            return h
    return STD_HEIGHTS[-1]


def _voffset(H, content_h):
    """標準高さ内でコンテンツを縦中央寄せする開始yを返す。"""
    avail = (H - CBM) - CT
    return CT + max(0, (avail - content_h) // 2)


# ---------- データ読み込み ----------

def load_details(path):
    return json.load(open(path, encoding="utf-8"))


def maps(data):
    pmap = {p["id"]: p for p in data["participants"]}
    emap = {e["entryNo"]: e for e in data["entries"]}
    return pmap, emap


def knockout_matches(data):
    return [m for m in data["matches"] if m.get("stage", "knockout") == "knockout"]


def roundrobin_matches(data):
    return [m for m in data["matches"] if m.get("stage") == "roundrobin"]


# ---------- ダブルス予選リーグ：本選進出ペア ----------

def group_standings(data):
    """グループ -> 順位付けされた entryNo リスト（勝数→ゲーム差→総得ゲーム）。
    完了済み（winnerEntryNo!=null）の roundrobin 試合のみで集計。"""
    groups = collections.defaultdict(list)
    for m in roundrobin_matches(data):
        if m.get("winnerEntryNo") is None:
            continue
        groups[m["group"]].append(m)
    out = {}
    for g, ms in groups.items():
        stat = collections.defaultdict(lambda: [0, 0, 0])  # wins, gf, ga
        ents = set()
        for m in ms:
            a, b = m["entries"]
            ents |= {a, b}
            sc = m.get("scores") or {}
            fa, fb = sc.get(str(a), 0), sc.get(str(b), 0)
            w = m["winnerEntryNo"]
            stat[a][0] += (w == a); stat[b][0] += (w == b)
            stat[a][1] += fa; stat[a][2] += fb
            stat[b][1] += fb; stat[b][2] += fa
        order = sorted(ents, key=lambda e: (-stat[e][0], -(stat[e][1] - stat[e][2]), -stat[e][1]))
        out[g] = order
    return out


def advancers(data):
    """本選進出 entryNo の集合（各グループ1位）。"""
    st = group_standings(data)
    return {order[0] for order in st.values() if order}


def _group_sort_key(g):
    try:
        return (0, int(g))
    except (TypeError, ValueError):
        return (1, str(g))


# ---------- knockout：生存者・確定カード ----------

def losers(data):
    out = set()
    for m in knockout_matches(data):
        if m.get("winnerEntryNo") is None:
            continue
        w = m["winnerEntryNo"]
        for e in (m.get("entries") or []):
            if e != w:
                out.add(e)
    return out


def survivors(data):
    """knockout でまだ敗退していない entryNo（=勝ち残り）。"""
    lo = losers(data)
    ents = set()
    for m in knockout_matches(data):
        ents |= set(m.get("entries") or [])
    return ents - lo


def confirmed_next_cards(data):
    """両者確定済みで未消化の試合（2日目の確定カード）を round 付きで返す。

    堅牢化: 前段の試合（prevMatchIds）がすべて決着している場合のみ「確定」とみなす。
    これにより、入力途中JSONに古い entries が残っていても、まだ対戦相手が
    決まっていない上位ラウンド（例: 準決勝が未消化なのに決勝に旧データ）を誤検出しない。
    """
    mm = {m["matchId"]: m for m in knockout_matches(data)}
    cards = []
    for m in mm.values():
        if m.get("winnerEntryNo") is not None:
            continue
        prevs = [p for p in (m.get("prevMatchIds") or []) if p]
        if any((mm.get(p, {}).get("winnerEntryNo") is None) for p in prevs):
            continue  # 前段未決着 → まだ確定カードではない
        ents = [e for e in (m.get("entries") or []) if e is not None]
        if len(ents) == 2:
            cards.append((m.get("round") or "", ents))
    return cards


def decided_results(data, rounds=None):
    """完了済み knockout 試合を (round, winnerNo, loserNo, score, retired) で返す。"""
    rows = []
    for m in knockout_matches(data):
        if m.get("winnerEntryNo") is None:
            continue
        rnd = m.get("round") or "?"
        if rounds and rnd not in rounds:
            continue
        wno = m["winnerEntryNo"]
        ents = m.get("entries") or []
        lno = next((e for e in ents if e != wno), None)
        sc = m.get("scores") or {}
        ws, ls = sc.get(str(wno), ""), sc.get(str(lno), "")
        score = f"{ws}−{ls}" if ws != "" else ""
        rows.append((rnd, wno, lno, score, bool(m.get("retired"))))
    return rows


# ---------- 前年実績proxy ----------

def prev_year_path(details_path):
    """同カテゴリの前年ファイルパスを推定（.../<year>/<cat>.json）。"""
    d = os.path.dirname(details_path)
    base = os.path.basename(details_path)
    parent = os.path.dirname(d)
    try:
        year = int(os.path.basename(d))
    except ValueError:
        return None
    cand = os.path.join(parent, str(year - 1), base)
    return cand if os.path.exists(cand) else None


def prev_top_player_ids(details_path):
    """前年同カテゴリで『ベスト8以上』だった選手idの集合（winner/runnerup/best<=8）。"""
    p = prev_year_path(details_path)
    if not p:
        return set(), None
    pd = load_details(p)
    _, emap = maps(pd)
    ids = set()
    for r in pd.get("results", []):
        t = r.get("tournament")
        if not t:
            continue
        rk = t.get("rank") or {}
        kind = rk.get("kind")
        ok = kind in ("winner", "runnerup") or (kind == "best" and (rk.get("bestLevel") or 99) <= 8)
        if not ok:
            continue
        e = emap.get(r["entryNo"])
        if e:
            ids |= set(e.get("playerIds") or [])
    year = int(os.path.basename(os.path.dirname(p)))
    return ids, year


def proxy_highlights(data, details_path, alive_set):
    """前年ベスト8以上の選手について、今年の生存/敗退を判定。
    返り値: {'year':年, 'survived':[(label,)], 'eliminated':[(label,)]}（重複entry除去）。"""
    ids, year = prev_top_player_ids(details_path)
    if not ids:
        return None
    pmap, _ = maps(data)
    survived, eliminated, seen = [], [], set()
    for e in data["entries"]:
        if e["entryNo"] in seen:
            continue
        if not (ids & set(e.get("playerIds") or [])):
            continue
        seen.add(e["entryNo"])
        name, sub = S.entry_label(e, pmap)
        label = (name, sub)
        if e["entryNo"] in alive_set:
            survived.append(label)
        else:
            eliminated.append(label)
    return {"year": year, "survived": survived, "eliminated": eliminated}


# ---------- CTA（内部データ） ----------

def information_record(tournament, year, repo_root="."):
    path = os.path.join(repo_root, "data", "tournaments", "information", f"{tournament}.json")
    if not os.path.exists(path):
        return None
    arr = json.load(open(path, encoding="utf-8"))
    for e in arr:
        if e.get("year") == year:
            return e
    return None


def venue_of(tournament, year, repo_root="."):
    rec = information_record(tournament, year, repo_root)
    return (rec or {}).get("location")


# ---------- 集計（県別/校別） ----------

def by_pref_school(entries_no, data):
    pmap, emap = maps(data)
    pref = collections.Counter()
    school = collections.Counter()
    for no in entries_no:
        e = emap.get(no)
        if not e:
            continue
        pids = e.get("playerIds") or []
        ps = [pmap[p] for p in pids if p in pmap]
        if not ps:
            continue
        pr = ps[0].get("prefecture")
        tm = ps[0].get("team")
        if pr:
            pref[pr] += 1
        if tm:
            school[tm] += 1
    return pref, school


# ---------- 描画部品 ----------

def _cta_lines(next_date, venue):
    line = "2日目: "
    if next_date:
        line += next_date
    if venue:
        line += f"  @{venue}"
    return line.strip() if line.strip() != "2日目:" else ""


def render_cover(title, headline, sub_lines, out_path, badge=None):
    """表紙＋CTA。headlineを大きく、sub_linesを下に。"""
    H = 675  # 1200x675 ≒ 16:9
    img, d = S.new_canvas(W, H)
    S.draw_header(d, W, title, "")
    # 中央 headline
    hf = S.fit_font(d, headline, W - 120, 72, bold=True)
    hw = S.text_w(d, headline, hf)
    d.text(((W - hw) / 2, 250), headline, font=hf, fill=S.NAVY)
    d.rectangle([(W - hw) / 2, 250 + 88, (W + hw) / 2, 250 + 96], fill=S.YELLOW)
    y = 250 + 120
    for ln in sub_lines:
        if not ln:
            continue
        f = S.fit_font(d, ln, W - 160, 34)
        lw = S.text_w(d, ln, f)
        d.text(((W - lw) / 2, y), ln, font=f, fill=S.GRAY)
        y += 48
    if badge:
        f = S.font(24, bold=True)
        tw = S.text_w(d, badge, f)
        d.rectangle([W - tw - 70, 132, W - 26, 178], fill=S.YELLOW)
        d.text((W - tw - 48, 140), badge, font=f, fill=S.NAVY)
    S.draw_footer(d, W, H)
    img.save(out_path)
    return out_path


def render_entry_cards(title, subtitle, labels, out_path, cols=2):
    """name/sub のカードをグリッド表示（ベスト4一覧 等）。標準サイズ＋縦中央寄せ。"""
    n = len(labels)
    rows = (n + cols - 1) // cols
    card_h = 120
    gap = 20
    content_h = rows * card_h + (rows - 1) * gap
    H = pick_height(content_h)
    y0 = _voffset(H, content_h)
    img, d = S.new_canvas(W, H)
    S.draw_header(d, W, title, subtitle)
    cw = (W - 48 - gap * (cols - 1)) / cols
    for i, (name, sub) in enumerate(labels):
        r, c = divmod(i, cols)
        x = 24 + c * (cw + gap)
        y = y0 + r * (card_h + gap)
        d.rectangle([x, y, x + cw, y + card_h], fill=S.WHITE, outline=S.LINE, width=2)
        d.rectangle([x, y, x + 10, y + card_h], fill=S.YELLOW)
        nf = S.fit_font(d, name, cw - 50, 38, bold=True)
        d.text((x + 28, y + 24), name, font=nf, fill=S.NAVY)
        if sub:
            sf = S.fit_font(d, sub, cw - 50, 24)
            d.text((x + 28, y + 72), sub, font=sf, fill=S.GRAY)
    S.draw_footer(d, W, H)
    img.save(out_path)
    return out_path


def render_matchups(title, subtitle, cards, out_path):
    """確定カードのVS表示。標準サイズ＋縦中央寄せ。cards=[((nameA,subA),(nameB,subB),round),...]"""
    n = len(cards)
    card_h = 150
    gap = 22
    content_h = n * card_h + (n - 1) * gap
    H = pick_height(content_h)
    y0 = _voffset(H, content_h)
    img, d = S.new_canvas(W, H)
    S.draw_header(d, W, title, subtitle)
    for i, (a, b, rl) in enumerate(cards):
        y = y0 + i * (card_h + gap)
        d.rectangle([24, y, W - 24, y + card_h], fill=S.WHITE, outline=S.LINE, width=2)
        if rl:
            rf = S.font(20, bold=True)
            d.rectangle([24, y, 24 + S.text_w(d, rl, rf) + 36, y + 34], fill=S.NAVY)
            d.text((42, y + 6), rl, font=rf, fill=S.WHITE)
        mid = W / 2
        # VS
        vf = S.font(34, bold=True)
        vw = S.text_w(d, "VS", vf)
        d.text((mid - vw / 2, y + card_h / 2 - 22), "VS", font=vf, fill=S.YELLOW)

        def side(label, x_center):
            name, sub = label
            nf = S.fit_font(d, name, mid - 90, 34, bold=True)
            nw = S.text_w(d, name, nf)
            d.text((x_center - nw / 2, y + 52), name, font=nf, fill=S.NAVY)
            if sub:
                sf = S.fit_font(d, sub, mid - 90, 22)
                sw = S.text_w(d, sub, sf)
                d.text((x_center - sw / 2, y + 96), sub, font=sf, fill=S.GRAY)

        side(a, (24 + mid - 30) / 2 + 12)
        side(b, (mid + 30 + W - 24) / 2 - 12)
    S.draw_footer(d, W, H)
    img.save(out_path)
    return out_path


def render_list_pages(title, subtitle, rows, out_dir, prefix, sub_suffix=""):
    """汎用テキスト行リスト（複数ページ分割）。rows=[("HEAD",text)|("ROW",text)]"""
    H = 1500
    row_h = 42
    head_h = 54
    top = 126 + 18
    bottom = H - 70
    pages, page = [], []
    used = top
    last_head = object()
    for kind, text in rows:
        need = (head_h if kind == "HEAD" else row_h)
        if used + need > bottom:
            pages.append(page); page = []; used = top
        page.append((kind, text))
        used += need
    if page:
        pages.append(page)
    paths = []
    for i, pg in enumerate(pages, 1):
        img, d = S.new_canvas(W, H)
        sfx = sub_suffix + (f"（{i}/{len(pages)}）" if len(pages) > 1 else "")
        S.draw_header(d, W, title, subtitle + sfx)
        y = top
        for kind, text in pg:
            if kind == "HEAD":
                d.rectangle([24, y + 8, W - 24, y + head_h - 6], fill=S.NAVY)
                d.rectangle([24, y + 8, 32, y + head_h - 6], fill=S.YELLOW)
                d.text((46, y + 16), text, font=S.font(24, bold=True), fill=S.WHITE)
                y += head_h
            else:
                f = S.fit_font(d, text, W - 72, 23)
                d.text((46, y + 8), text, font=f, fill=S.NAVY)
                d.line([46, y + row_h - 2, W - 46, y + row_h - 2], fill=S.LINE, width=1)
                y += row_h
        S.draw_footer(d, W, H)
        p = os.path.join(out_dir, f"{prefix}_p{i}.png")
        img.save(p)
        paths.append(p)
    return paths


def strip_sub(sub):
    return sub.replace("（", "/").replace("）", "").strip("/")
