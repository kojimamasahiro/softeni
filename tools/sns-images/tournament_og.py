# -*- coding: utf-8 -*-
"""大会の年度別結果ページ向け OGP 画像（summary_large_image / 1200x630）を生成する。

内容は**ベスト16のトーナメント表**。ベスト16→8→4→決勝の4ラウンドを、公開ページの
トーナメント表と同じ「両端に名前・内側は線だけ・勝者の線が太い」描き方で 1 枚にする。
上部にサイト名バーは置かず、**下に余白を確保する**（X がカードの左下にタイトルを重ねるため。
2026-09-09 変更。詳細は `render()` の docstring）。

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

使い方（`npm run og:tournaments -- <args>` でもよい。python の選び方は tools/sns-images/run.sh）:
  tournament_og.py                              # 生成対象を一覧（書き込まない）
  tournament_og.py --changed                    # 更新された種目だけを一覧
  tournament_og.py --apply --changed            # 更新された種目だけ生成する（通常はこれ）
  tournament_og.py --apply --only highschool-championship/2026/doubles-none-boys
  tournament_og.py --apply --all                # 全種目。下記の理由で通常は使わない

**`--apply` に `--changed` / `--only` / `--all` のいずれも付けないとエラーで止まる。**
理由: フォントを OS のシステムパスから解決しているため、**データが1文字も変わっていなくても
再生成すると別ビットマップ＝別ハッシュ＝別ファイル**になる。2026-09-09 の実測では全件 --apply で
337枚中313枚が差し替え対象になった（画素差 10.1%、並べて見た内容は完全に同一）。
見た目の変わらない差分を12MBぶん積むだけなので、対象の明示を必須にしている。
"""
import argparse
import glob
import hashlib
import io
import json
import os
import re
import subprocess
import sys

from PIL import Image  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from snslib import (  # noqa: E402
    GRAY, LINE, NAVY, YELLOW,
    entry_label, font, fit_font, new_canvas, participants_map, text_w,
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
        max_w = name_w - 52
        f = fit_font(draw, name, max_w, 22, bold=is_champ, min_size=11)
        # 最小サイズでも収まらないほど長い名前は末尾を省略する。縮小だけに任せると
        # はみ出してエントリー番号に重なる（実例: MANALACNOELLE CONCHITA・CATINDIG...）。
        if text_w(draw, name, f) > max_w:
            while len(name) > 4 and text_w(draw, name + '…', f) > max_w:
                name = name[:-1]
            name += '…' 
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


# 旧「サイト名バー」の高さ（ネイビー 52px + 下線のイエロー 5px）。
# バー自体は 2026-09-09 に廃止したが、**その高さぶんを下の余白に振り替えて**いるので
# 定数として残す。トーナメント表の縦幅（bottom - top）はバーがあった頃と同じになる。
BRAND_BAR_H = 52 + 5

# トーナメント表の上下マージン。バーがあった頃はバー直下から 26px 空けていた。
TOP_MARGIN = 26
BOTTOM_MARGIN = 22

# ブランドマーク（SP + ラケット）。既定 OG カードから**マークだけ**を切り出して使う。
# `public/og/twitter-card-summary.png` は 192x192 で、上にマーク・下に「Softeni Pick」の
# ワードマークが入っている。インクのある行を数えると 18〜144（マーク）と 153〜170
# （ワードマーク）の2ブロックに分かれるので、前者だけを取る。
# ワードマークを入れないのは、X がカードの左下に出すタイトルと文字が二重になるため。
BRAND_LOGO_PATH = os.path.join(ROOT, 'public', 'og', 'twitter-card-summary.png')
BRAND_MARK_BOX = (36, 18, 164, 145)   # マークだけの外接矩形（128x127）
BRAND_MARK_BG = (239, 239, 235)       # 元画像の地の色
BRAND_MARK_SIZE = 38                  # 貼り付ける一辺
BRAND_MARK_RIGHT = 24                 # 右マージン。トーナメント表の左右マージンに合わせる
BRAND_MARK_BOTTOM = 20                # 下マージン


_BRAND_MARK_CACHE = {}


def brand_mark(size=BRAND_MARK_SIZE):
    """ブランドマークを RGBA で返す。読めなければ None（画像生成自体は止めない）。

    元画像は地が (239,239,235) の不透明 PNG なので、そのまま貼ると**キャンバスの地
    (250,250,248) との差が四角い枠として見えてしまう**。地の色からの距離をアルファに
    変換して切り抜く。距離ベースなのはアンチエイリアスの縁を残すため
    （二値マスクにすると縮小時にギザつく）。
    """
    # アルファ生成が 16,256 px の Python ループなので、456 枚ぶん回すと無駄が大きい。
    # サイズごとに 1 回だけ作って使い回す。
    if size in _BRAND_MARK_CACHE:
        return _BRAND_MARK_CACHE[size]
    try:
        src = Image.open(BRAND_LOGO_PATH).convert('RGB').crop(BRAND_MARK_BOX)
    except Exception:
        _BRAND_MARK_CACHE[size] = None
        return None
    alpha = Image.new('L', src.size)
    sp, ap = src.load(), alpha.load()
    for y in range(src.size[1]):
        for x in range(src.size[0]):
            r, g, b = sp[x, y]
            d = abs(r - BRAND_MARK_BG[0]) + abs(g - BRAND_MARK_BG[1]) + abs(b - BRAND_MARK_BG[2])
            ap[x, y] = 255 if d >= 120 else int(d * 255 / 120)
    out = src.convert('RGBA')
    out.putalpha(alpha)
    mark = out.resize((size, size), Image.LANCZOS)
    _BRAND_MARK_CACHE[size] = mark
    return mark


def paste_brand_mark(img):
    """右下にブランドマークだけを置く（2026-09-09 追加）。

    X はカードの**左下**にタイトルを重ねる。タイトルが長いと右端近くまで伸びることが
    あるので、**文字は置かず**マークだけを右下に小さく置く。サイト名バーを廃止して
    画像から出所が消えていたのを、文字と衝突しない形で戻すもの。
    """
    mark = brand_mark()
    if mark is None:
        return
    img.paste(mark, (W - BRAND_MARK_RIGHT - mark.size[0], H - BRAND_MARK_BOTTOM - mark.size[1]), mark)


def render(data):
    """1200x630 に決勝までの4ラウンドを描く。

    レイアウト（2026-09-09 変更）:
      - **上部のサイト名バーを廃止した。** 2026-07-31 に「サイト名だけを上に置き、残りの縦を
        すべて表に使う」としていたが、X のカードは**画像の左下にタイトルを重ねて表示する**ため、
        下に何も無いと表の一番下の行がタイトルに隠れる。
      - バーの高さ（57px）ぶんを**そのまま下の余白へ振り替え**、表全体を 57px 上へ寄せた。
        `bottom - top` はバーがあった頃と同じなので、**表の縮尺・行間は変わらない**。
      - サイト名の**文字**は置かない。代わりに**右下にブランドマークだけ**を置く
        （`paste_brand_mark`）。X のタイトルは左下から始まり、長いと右端近くまで伸びるので、
        文字を足すと二重になったり重なったりする。
    """
    img, draw = new_canvas(W, H)
    tree = build_tree(data['matches'])
    if not tree:
        return None
    top = TOP_MARGIN
    bottom = H - BOTTOM_MARGIN - BRAND_BAR_H
    draw_bracket(draw, tree, participants_map(data), {e['entryNo']: e for e in data['entries']}, top, bottom)
    paste_brand_mark(img)
    return img


def _git(*argv):
    """git を呼んで stdout を返す。失敗したら None（git が無い / ref が無い環境でも落とさない）。"""
    try:
        out = subprocess.run(['git', *argv], cwd=ROOT, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return None
    return out.stdout if out.returncode == 0 else None


def changed_categories(base):
    """`data/tournaments/details/**` のうち更新されたものを {(tid, year, cat)} で返す。

    「更新があった大会だけ」を機械的に決めるための入口。対象は
      - 未コミットの変更（`git status`）
      - `base`（既定 origin/main）から現在のブランチまでの変更（`git diff base...HEAD`）
    の和。取り込み→コミット→後日インサイト→OGP、という順で作業しても拾えるように
    2つを足している。

    なぜ必要か（2026-09-09）:
      レンダリングはシステムフォントに依存するので、**データが1文字も変わっていなくても
      再生成すると別ハッシュ＝別ファイルになる**。実測で 337 枚中 313 枚が差し替わった
      （画素差 10.1%、内容は完全に同一）。全件 --apply は見た目の変わらない churn を
      12MB ぶん積むだけなので、更新された種目だけに絞る手段が要る。
      詳細は docs/wiki/public-pages.md「大会 年度別結果ページの OGP 画像」。
    """
    rel = os.path.relpath(DETAILS, ROOT)
    paths = set()

    status = _git('status', '--porcelain', '--', rel)
    if status:
        for line in status.splitlines():
            # `XY <path>` / リネームは `XY <old> -> <new>`
            entry = line[3:].strip()
            if ' -> ' in entry:
                entry = entry.split(' -> ', 1)[1]
            paths.add(entry.strip('"'))

    diff = _git('diff', '--name-only', f'{base}...HEAD', '--', rel) if base else None
    if diff is None and base:
        # base が解決できない（fetch していない / 単独クローン）。未コミット分だけで続行する。
        print(f'  警告: `{base}` を解決できないため、未コミットの変更だけを対象にします', file=sys.stderr)
    elif diff:
        paths.update(line.strip() for line in diff.splitlines() if line.strip())

    out = set()
    for pth in paths:
        parts = pth.split('/')
        if len(parts) < 3 or not parts[-1].endswith('.json'):
            continue
        out.add((parts[-3], parts[-2], parts[-1][:-5]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--apply', action='store_true', help='PNG と索引を書き込む')
    ap.add_argument('--only', help='限定フィルタ。tournamentId / tournamentId/year / tournamentId/year/category の形式で指定')
    ap.add_argument('--changed', action='store_true',
                    help='data/tournaments/details/** が更新された種目だけを対象にする（未コミット分 + --base からの差分）')
    ap.add_argument('--base', default='origin/main', help='--changed の比較先。既定 origin/main')
    ap.add_argument('--all', action='store_true',
                    help='全種目を対象に --apply する。既存の画像もフォント差で差し替わるので、意図するときだけ付ける')
    args = ap.parse_args()

    # 全件 --apply は既存画像をほぼ全部差し替える（フォントの解決結果が環境で変わるため。
    # 2026-09-09 実測で 337 枚中 313 枚）。事故を防ぐため、書き込み時は対象の明示を必須にする。
    if args.apply and not (args.only or args.changed or args.all):
        print(
            '--apply には --changed / --only / --all のいずれかが必要です。\n'
            '  --changed  更新された種目だけ（通常はこれ）\n'
            '  --only     tournamentId[/year[/category]] で明示\n'
            '  --all      全種目。既存画像もフォント差で差し替わるので、意図するときだけ\n'
            '対象の確認だけなら --apply を外して dry-run してください。',
            file=sys.stderr)
        return 2

    changed = changed_categories(args.base) if args.changed else None
    if changed is not None:
        print(f'--changed: 更新された種目 {len(changed)} 件を対象にします')
        for tid, year, cat in sorted(changed):
            print(f'    {tid}/{year}/{cat}')

    # --only フィルタをパース。--only 省略時は only_parts が空リストになるので全件が対象。
    # （2026-09-09 修正: ここは None を返していて `len(None)` で TypeError になり、
    #  --only 無しの実行＝docstring と wiki が案内している「生成対象を一覧」が動かなかった）
    only_parts = args.only.split('/') if args.only else []
    only_tid = only_parts[0] if len(only_parts) > 0 else None
    only_year = only_parts[1] if len(only_parts) > 1 else None
    only_cat = only_parts[2] if len(only_parts) > 2 else None

    index = {}
    made = 0
    skipped = 0
    for path in sorted(glob.glob(os.path.join(DETAILS, '*', '*', '*.json'))):
        tid, year, fname = path.split(os.sep)[-3:]
        cat = fname[:-5]
        if changed is not None and (tid, year, cat) not in changed:
            continue
        if only_tid and not tid.startswith(only_tid):
            continue
        if only_year and year != only_year:
            continue
        if only_cat and cat != only_cat:
            continue
        try:
            data = json.load(open(path, encoding='utf-8'))
        except Exception:
            continue
        if not isinstance(data, dict) or not data.get('entries') or not data.get('matches'):
            continue

        img = render(data)
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
        # 既存の索引を読み込んで新しい結果をマージ（--only で限定した場合も他が消えないように）
        merged = {}
        if os.path.exists(INDEX_PATH):
            try:
                merged = json.load(open(INDEX_PATH, encoding='utf-8'))
            except Exception:
                pass
        merged.update(index)

        # 古い PNG を掃除（内容ハッシュが変わると別名になるため）
        keep = {os.path.basename(v) for v in merged.values()}
        for f in os.listdir(OUT_DIR) if os.path.isdir(OUT_DIR) else []:
            if f.endswith('.png') and f not in keep:
                os.remove(os.path.join(OUT_DIR, f))
        with open(INDEX_PATH, 'w', encoding='utf-8') as f:
            json.dump(dict(sorted(merged.items())), f, ensure_ascii=False, indent=2)
            f.write('\n')

    print('OGP画像（ベスト16トーナメント表）' + ('生成・書き込み' if args.apply else ' dry-run（書き込みません）'))
    print(f'  生成対象: {made} 件')
    print(f'  対象外（決勝が未確定）: {skipped} 件')
    if args.apply:
        print(f'  索引: {os.path.relpath(INDEX_PATH, ROOT)}')


if __name__ == '__main__':
    # main() の戻り値を終了コードにする。--apply のガードが 2 を返しても、
    # sys.exit を通さないと 0 で終わってエラーが呼び出し側から見えない。
    sys.exit(main() or 0)
