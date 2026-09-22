# -*- coding: utf-8 -*-
"""選手結果ページ向け OGP 画像（summary_large_image / 1200x630）を生成する。

対象は全国大会優勝者だけ（2026-09-22 ユーザー判断。docs/raw/2026-09-22-idea-seo-expansion.md #4）。
描く内容（優勝の判定・通算成績）は TS の Player Statistics Engine が正なので、
`npm run og:players:export` が書き出す `.playerstats/og-cards.json` を読むだけにする。

tournament_og.py との違い:
  ファイル名のハッシュを**画像のバイト列ではなく描く内容（カードの JSON）**から取る。
  画像のハッシュにすると、フォントの解決結果の差だけで内容が同じでも別ファイルになり
  全件が差し替わる（tournament_og.py の 2026-09-09 実測で 337 枚中 313 枚）。
  内容ハッシュなら、成績が変わった選手の画像だけが作り直される。
  描き方を変えたときは RENDER_VERSION を上げる（全件が作り直される）。

使い方（python の選び方は tools/sns-images/run.sh）:
  npm run og:players:export                         # 入力 JSON を作る
  bash tools/sns-images/run.sh tools/sns-images/player_og.py          # 対象の一覧（書き込まない）
  bash tools/sns-images/run.sh tools/sns-images/player_og.py --apply  # 生成・索引更新・古い PNG の掃除
"""
import argparse
import glob
import hashlib
import io
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from snslib import GRAY, LINE, NAVY, YELLOW, fit_font, font, new_canvas, text_w  # noqa: E402
from tournament_og import paste_brand_mark  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
CARDS_PATH = os.path.join(ROOT, '.playerstats', 'og-cards.json')
OUT_DIR = os.path.join(ROOT, 'public', 'og', 'players')
INDEX_PATH = os.path.join(ROOT, 'data', 'players', 'og-images.json')

W, H = 1200, 630
MARGIN_X = 64
# X はカードの左下にタイトルを重ねるので、下は空けておく（tournament_og.py の render() と同じ理由）
BOTTOM_RESERVED = 96
MAX_TITLE_LINES = 4
RENDER_VERSION = '2'


def _years(years):
    ys = sorted(years)
    if len(ys) <= 3:
        return '・'.join(str(y) for y in ys)
    return f'{ys[0]}〜{ys[-1]}年の{len(ys)}回'


def render(card):
    img, draw = new_canvas(W, H)
    x = MARGIN_X
    y = 56

    # 通算成績は右上（名前の横）に置く。下側は大会名の行が伸びるので重ねない。
    rec_w = 0
    m = card.get('matches')
    if m and m.get('total'):
        big = font(56, bold=True)
        small = font(26)
        rec = f'{m["wins"]}勝{m["losses"]}敗'
        cap = f'収録{m["total"]}試合'
        rec_w = max(text_w(draw, rec, big), text_w(draw, cap, small))
        draw.text((W - MARGIN_X - text_w(draw, rec, big), y + 12), rec, font=big, fill=NAVY)
        draw.text((W - MARGIN_X - text_w(draw, cap, small), y + 12 + 56 + 14), cap, font=small, fill=GRAY)

    # 選手名（大）と所属
    name_max = W - MARGIN_X * 2 - (rec_w + 40 if rec_w else 0)
    nf = fit_font(draw, card['name'], name_max, 96, bold=True, min_size=48)
    draw.text((x, y), card['name'], font=nf, fill=NAVY)
    y += nf.size + 22
    if card.get('team'):
        tf = fit_font(draw, card['team'], W - MARGIN_X * 2, 38, min_size=22)
        draw.text((x, y), card['team'], font=tf, fill=GRAY)
        y += tf.size + 20

    draw.rectangle([x, y, x + 120, y + 6], fill=YELLOW)
    y += 30

    # 全国大会優勝（大会ごとに1行）
    head = f'全国大会優勝 {card["titleCount"]}回'
    hf = font(30, bold=True)
    draw.text((x, y), head, font=hf, fill=NAVY)
    y += hf.size + 16

    titles = card['titles']
    shown = titles[:MAX_TITLE_LINES]
    rest = len(titles) - len(shown)
    lf_size = 34 if len(shown) <= 2 else 30
    for t in shown:
        label = t['label']
        yrs = f'（{_years(t["years"])}）'
        lf = fit_font(draw, label, 760, lf_size, bold=True, min_size=20)
        draw.text((x + 8, y), label, font=lf, fill=NAVY)
        yf = font(lf_size - 6)
        draw.text((x + 8 + text_w(draw, label, lf) + 18, y + 5), yrs, font=yf, fill=GRAY)
        y += lf_size + 14
    if rest > 0:
        draw.text((x + 8, y), f'ほか{rest}大会', font=font(26), fill=GRAY)
        y += 40

    draw.line([(0, H - BOTTOM_RESERVED + 20), (W, H - BOTTOM_RESERVED + 20)], fill=LINE, width=1)
    paste_brand_mark(img)
    return img


def content_hash(card):
    payload = json.dumps({'v': RENDER_VERSION, 'card': card}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()[:8]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='PNG と索引を書き込む')
    ap.add_argument('--only', help='選手 id（カンマ区切り）に限定する')
    args = ap.parse_args()

    if not os.path.exists(CARDS_PATH):
        print(f'{os.path.relpath(CARDS_PATH, ROOT)} がありません。先に `npm run og:players:export` を実行してください。', file=sys.stderr)
        return 2
    cards = json.load(open(CARDS_PATH, encoding='utf-8'))
    only = set(args.only.split(',')) if args.only else None

    index = {}
    made = kept = 0
    for card in cards:
        pid = str(card['id'])
        if only and pid not in only:
            continue
        rel = f'/og/players/{pid}-{content_hash(card)}.png'
        index[pid] = rel
        dest = os.path.join(ROOT, 'public' + rel)
        if os.path.exists(dest):
            kept += 1
            continue
        made += 1
        if args.apply:
            img = render(card)
            buf = io.BytesIO()
            img.convert('P', palette=1, colors=128).save(buf, format='PNG', optimize=True)
            os.makedirs(OUT_DIR, exist_ok=True)
            with open(dest, 'wb') as f:
                f.write(buf.getvalue())

    print(f'対象 {len(index)} 人: 新規生成 {made} / 既存のまま {kept}' + ('' if args.apply else '（dry-run）'))
    if not args.apply:
        return 0

    merged = {}
    if only and os.path.exists(INDEX_PATH):
        merged = json.load(open(INDEX_PATH, encoding='utf-8'))
    merged.update(index)
    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(merged.items(), key=lambda kv: int(kv[0]))), f, ensure_ascii=False, indent=1)
        f.write('\n')

    # 索引から外れた PNG（成績が変わって別ハッシュになった旧版・対象外になった選手）を消す
    live = {os.path.basename(p) for p in merged.values()}
    removed = 0
    for path in glob.glob(os.path.join(OUT_DIR, '*.png')):
        if os.path.basename(path) not in live:
            os.remove(path)
            removed += 1
    if removed:
        print(f'古い PNG を {removed} 枚削除しました')
    return 0


if __name__ == '__main__':
    sys.exit(main())
