# -*- coding: utf-8 -*-
"""大会の年度別結果ページ向け OGP 画像（summary_large_image / 1200x630）を生成する。

内容は**ベスト16のトーナメント表**。ベスト16→8→4→決勝の4ラウンドを、公開ページの
トーナメント表と同じ「両端に名前・内側は線だけ・勝者の線が太い」描き方で 1 枚にする。

なぜベスト16までなのか:
  OGカードはタイムライン上で幅350〜600px程度に縮小される。1200x630 にベスト64（縦32行）を
  入れると元画像で文字が約10px、縮小後は約4pxで読めない。ベスト16なら縦8行取れるので、
  縮小後も判読できる（2026-07-31 ユーザー決定）。

なぜ matches から直接組むのか（ブラケット復元を使わない）:
  終盤3ラウンドは完了済み大会なら必ず matches にある。決勝から「その選手が直前に勝った試合」を
  辿るだけで木が作れるので、`entries[].type` による席順復元が要らない。おかげで**予選リーグを
  含む大会でも生成できる**（復元は予選リーグ大会に使えない）。ラウンド名の表記ゆれ
  （決勝を「4回戦」と書く大会がある）にも影響されない。

方針は news_og.py と同じ:
  - ローカル生成して public/og/tournaments/ に PNG をコミットする（本番ビルドに依存を増やさない）。
  - ファイル名に内容ハッシュを付けてキャッシュを確実に無効化する。
  - 生成した一覧を data/tournaments/og-images.json に書き出し、ページ側はそれを読む
    （details JSON は matches の忠実な記録のままにしたいので、そこには書き戻さない）。

設計の親: docs/raw/2026-06-22-news-ogp-image-design.md
トーナメント表の描き方: lib/bracketDrawing.ts / docs/wiki/public-pages.md

使い方:
  python tools/sns-images/tournament_og.py                 # 生成対象を一覧（書き込まない）
  python tools/sns-images/tournament_og.py --apply         # 生成して書き込む
  python tools/sns-images/tournament_og.py --apply --only highschool-championship
"""
import argparse
import glob
import hashlib
import io
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from snslib import (  # noqa: E402
    GRAY, LINE, NAVY, WHITE, YELLOW,
    draw_footer, entry_label, font, fit_font, new_canvas, participants_map, text_w,
)

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
DETAILS = os.path.join(ROOT, 'data', 'tournaments', 'details')
OUT_DIR = os.path.join(ROOT, 'public', 'og', 'tournaments')
INDEX_PATH = os.path.join(ROOT, 'data', 'tournaments', 'og-images.json')

W, H = 1200, 630


def round_order(name):
    """ラウンドの進行順。大きいほど後。表記ゆれ（決勝を「4回戦」と書く大会）に耐える。"""
    if not name:
        return -1
    if '準々決勝' in name:
        return 8000
    if '準決勝' in name:
        return 9000
    if '決勝' in name:
        return 10000
    m = re.search(r'(\d+)', name)
    return int(m.group(1)) if m else 0


# 決勝から何ラウンド遡るか。DEPTH=3 で決勝・準決勝・準々決勝・ベスト16 の4ラウンド＝縦8行。
DEPTH = 3


def build_tree(matches):
    """決勝から遡って終盤のトーナメント木を組む。

    各枠について「その組が直前に勝った試合」を 1 つ前のラウンドとする。ラウンド名ではなく
    **実際の勝ち上がり**で辿るので、表記ゆれ（決勝を「4回戦」と書く大会）や予選リーグの
    有無に依存しない。不戦勝などで前の試合が無ければ None（その枠は名前だけ出す）。

    戻り値: {'m': 決勝, 'kids': [{'m':準決勝, 'kids':[...]}, ...]} の再帰構造。
    """
    ko = [m for m in matches if m.get('stage') == 'knockout' and m.get('winnerEntryNo')]
    if not ko:
        return None
    ko.sort(key=lambda m: round_order(m.get('round')))
    final = ko[-1]
    if len(final.get('entries') or []) != 2:
        return None

    def prev_win_of(entry_no, before):
        cands = [m for m in ko if m is not before and m.get('winnerEntryNo') == entry_no and round_order(m.get('round')) < round_order(before.get('round'))]
        return max(cands, key=lambda m: round_order(m.get('round'))) if cands else None

    def node(match, depth):
        if match is None:
            return None
        if depth == 0 or len(match.get('entries') or []) != 2:
            return {'m': match, 'kids': [None, None]}
        return {'m': match, 'kids': [node(prev_win_of(no, match), depth - 1) for no in match['entries']]}

    return node(final, DEPTH)


def draw_bracket(draw, tree, pmap, entries_by_no, top, bottom):
    """終盤のトーナメント表を描く。公開ページと同じく両端に名前・内側は線だけ。

    DEPTH から縦の行数が決まる（DEPTH=3 → 片側 4 枠 → 縦 8 行）。
    """
    rows = 2 ** DEPTH
    row_h = (bottom - top) / rows
    name_w = 300
    col_w = 40
    margin = 24
    x_name_l = margin + name_w
    x_name_r = W - x_name_l
    cx = W // 2

    def xl(r):
        return x_name_l + (r + 1) * col_w

    def xr(r):
        return W - xl(r)

    def line(x1, y1, x2, y2, win):
        draw.line([x1, y1, x2, y2], fill=NAVY if win else LINE, width=4 if win else 2)

    final = tree['m']
    champion = final.get('winnerEntryNo')

    def label(no, y, is_left):
        e = entries_by_no.get(no)
        if not e:
            return
        name, sub = entry_label(e, pmap)
        is_champ = no == champion
        # 外側にエントリー番号を置くぶんを差し引く。国際大会は名前が長く、
        # 差し引かないと番号に接触する（例: JONGJITPRAEWA・SOMSANITTHANPITCHA）。
        f = fit_font(draw, name, name_w - 52, 22, bold=is_champ, min_size=11)
        sf_ = font(14)
        nx = (x_name_l - 8) if is_left else (x_name_r + 8)
        tw = text_w(draw, name, f)
        draw.text((nx - tw if is_left else nx, y - 23), name, font=f, fill=NAVY if is_champ else (40, 46, 60))
        if sub:
            sw = text_w(draw, sub, sf_)
            draw.text((nx - sw if is_left else nx, y + 2), sub, font=sf_, fill=GRAY)
        nf = font(13)
        ns = str(no)
        draw.text((margin if is_left else W - margin - text_w(draw, ns, nf), y - 21), ns, font=nf, fill=GRAY)

    def score(match, no, y, x, is_left):
        sc = (match.get('scores') or {}).get(str(no))
        if sc is None:
            return
        won = match.get('winnerEntryNo') == no
        f = font(15, bold=won)
        t = str(sc) + ('' if won or not match.get('retired') else 'R')
        tw = text_w(draw, t, f)
        draw.text(((x - 5 - tw) if is_left else (x + 5), y - 19), t, font=f, fill=NAVY if won else GRAY)

    def row_y(row):
        return top + row * row_h

    def walk(node, r, lo, hi, x_of, is_left):
        """`node` を列 `r`（0 が最も外側）に描く。この部分木は行 [lo, hi) を占める。

        子が無い枠は「不戦勝でここまで来た」なので、名前の列から一気にこの列まで
        真っ直ぐ通す（公開ページの不戦勝の扱いと同じ）。戻り値は次の列へ出ていく y。
        """
        m = node['m']
        pair = m.get('entries') or [None, None]
        half = (lo + hi) / 2
        ys = []
        for i, no in enumerate(pair):
            kid = node['kids'][i] if i < len(node['kids']) else None
            sub = (lo, half) if i == 0 else (half, hi)
            won = m.get('winnerEntryNo') == no
            if kid is not None and r > 0:
                y = walk(kid, r - 1, sub[0], sub[1], x_of, is_left)
                line(x_of(r - 1), y, x_of(r), y, won)
            else:
                y = row_y((sub[0] + sub[1]) / 2)
                label(no, y, is_left)
                line(x_of(-1), y, x_of(r), y, won)
            score(m, no, y, x_of(r), is_left)
            ys.append(y)

        if len(ys) != 2:
            return ys[0] if ys else row_y((lo + hi) / 2)
        line(x_of(r), ys[0], x_of(r), ys[1], False)
        w_y = ys[0] if m.get('winnerEntryNo') == pair[0] else ys[1]
        mid = (ys[0] + ys[1]) / 2
        line(x_of(r), w_y, x_of(r), mid, True)
        return mid

    kids = tree['kids']
    ly = walk(kids[0], DEPTH - 1, 0, rows, xl, True) if kids[0] else row_y(rows / 2)
    ry = walk(kids[1], DEPTH - 1, 0, rows, xr, False) if kids[1] else row_y(rows / 2)

    # 決勝。勝った側だけ太線を中央まで（公開ページと同じ規約）。
    # スコアは中央の点を挟んで左右に振り分ける（同じ高さでぶつかるので上下に置けない）。
    for no, y, x_end, is_left in ((final['entries'][0], ly, xl(DEPTH - 1), True), (final['entries'][1], ry, xr(DEPTH - 1), False)):
        line(x_end, y, cx, y, final.get('winnerEntryNo') == no)
        score(final, no, y, cx + (-10 if is_left else 10), is_left)
    draw.ellipse([cx - 7, (ly + ry) / 2 - 7, cx + 7, (ly + ry) / 2 + 7], fill=YELLOW)


def draw_head(draw, title, subtitle):
    """大会名と「年 種目」を**同じ大きさ**で 2 行に出す（2026-07-31 ユーザー決定）。

    snslib.draw_header は大会名を 40px、副題を 24px で描くが、ここでは同サイズにしたいので
    独自に描く。ヘッダーを低くするぶん、ブラケットの縦を稼げる（ベスト16 は縦 8 行要る）。
    """
    h = 96
    draw.rectangle([0, 0, W, h], fill=NAVY)
    draw.rectangle([0, h, W, h + 5], fill=YELLOW)
    f = fit_font(draw, title, W - 60, 26, bold=True)
    draw.text((30, 20), title, font=f, fill=WHITE)
    sf = fit_font(draw, subtitle, W - 60, 26, bold=True)
    draw.text((30, 54), subtitle, font=sf, fill=(198, 208, 228))
    return h + 5


def render(data, title, subtitle):
    img, draw = new_canvas(W, H)
    tree = build_tree(data['matches'])
    if not tree:
        return None
    top = draw_head(draw, title, subtitle) + 22
    bottom = H - 54 - 14
    draw_bracket(draw, tree, participants_map(data), {e['entryNo']: e for e in data['entries']}, top, bottom)
    draw_footer(draw, W, H)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='PNG と索引を書き込む')
    ap.add_argument('--only', help='tournamentId の前方一致で絞る')
    args = ap.parse_args()

    # 大会名は index.json / local_index.json の label。
    # information の `source` は「出典にした要項・結果 PDF の名称」であって大会名ではない
    # （例: source="第72回全国高等学校総合体育大会" に対し label="全国高等学校総合体育大会"）。
    # ページの見出しも index の label を使っているので、そちらに合わせる。
    tournament_label = {}
    for f in ('index.json', 'local_index.json'):
        fp = os.path.join(ROOT, 'data', 'tournaments', f)
        if not os.path.exists(fp):
            continue
        for e in json.load(open(fp, encoding='utf-8')):
            if e.get('tournamentId') and e.get('label'):
                tournament_label.setdefault(e['tournamentId'], e['label'])

    info_cache = {}

    def label_of(tid, year, cat):
        """(大会名, 種目名) を返す。種目名だけは information の categories[].label から。"""
        if tid not in info_cache:
            p = os.path.join(ROOT, 'data', 'tournaments', 'information', f'{tid}.json')
            info_cache[tid] = json.load(open(p, encoding='utf-8')) if os.path.exists(p) else []
        catlabel = cat
        for e in info_cache[tid]:
            if str(e.get('year')) != str(year):
                continue
            for c in e.get('categories') or []:
                if c.get('categoryId') == cat:
                    catlabel = c.get('label') or cat
        return tournament_label.get(tid, tid), catlabel

    index = {}
    made = 0
    skipped = 0
    for path in sorted(glob.glob(os.path.join(DETAILS, '*', '*', '*.json'))):
        tid, year, fname = path.split(os.sep)[-3:]
        cat = fname[:-5]
        if args.only and not tid.startswith(args.only):
            continue
        try:
            data = json.load(open(path, encoding='utf-8'))
        except Exception:
            continue
        if not isinstance(data, dict) or not data.get('entries') or not data.get('matches'):
            continue

        name, catlabel = label_of(tid, year, cat)
        img = render(data, f'{name}', f'{year}年 {catlabel}')
        if img is None:
            skipped += 1
            continue

        # 色数が少ない図なのでパレット化する。RGB のままだと 1 枚 90KB・全体 25MB になり、
        # git に載せるには重い。128 色パレットで見た目を保ったまま 1/3（約 30KB）に収まる。
        buf = io.BytesIO()
        img.convert('P', palette=1, colors=128).save(buf, format='PNG', optimize=True)
        raw = buf.getvalue()
        h8 = hashlib.sha256(raw).hexdigest()[:8]
        rel = f'/og/tournaments/{tid}-{year}-{cat}-{h8}.png'
        index[f'{tid}/{year}/{cat}'] = rel
        made += 1
        if args.apply:
            os.makedirs(OUT_DIR, exist_ok=True)
            with open(os.path.join(ROOT, 'public' + rel), 'wb') as f:
                f.write(raw)

    if args.apply:
        # 古い PNG を掃除（内容ハッシュが変わると別名になるため）
        keep = {os.path.basename(v) for v in index.values()}
        for f in os.listdir(OUT_DIR) if os.path.isdir(OUT_DIR) else []:
            if f.endswith('.png') and f not in keep:
                os.remove(os.path.join(OUT_DIR, f))
        with open(INDEX_PATH, 'w', encoding='utf-8') as f:
            json.dump(dict(sorted(index.items())), f, ensure_ascii=False, indent=2)
            f.write('\n')

    print('OGP画像（ベスト16トーナメント表）' + ('生成・書き込み' if args.apply else ' dry-run（書き込みません）'))
    print(f'  生成対象: {made} 件')
    print(f'  対象外（決勝が未確定）: {skipped} 件')
    if args.apply:
        print(f'  索引: {os.path.relpath(INDEX_PATH, ROOT)}')


if __name__ == '__main__':
    main()
