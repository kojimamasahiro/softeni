#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""インターハイの**記録報告書**（文字がアウトライン化されたPDF）の団体戦 → 対戦ごとの記録（ADR-020）。

`highschool_championship_team_matches.py` と**紙面の作りは同じ**（列のx座標も同じ）が、
あちらは `pdftotext` が使える前提。こちらは令和7年度の記録報告書のように
**テキスト層もフォントも無く、1文字が1つのベクター塗りパスになっている**PDF用。

## この様式の見極め

- `pdftotext` が空を返し、`pdffonts` が1行も出さない。`page.get_drawings()` に
  **1文字＝1つの fill パス**が入っている（全日本社会人2022と同じ作り）。
- 見出しのエントリー番号だけは塗り＋線（`'fs'`）。`'f'` だけ拾うと番号が消える。
- **「打ち切り」の白い箱が、その下のゲーム行を覆っている**。ページをそのまま描画すると
  隠れた数字が読めず本数が合わなくなる。パスを1本ずつ白紙に描き直せば読める（実例:
  令和7年度 男子 上宮-岡崎城西 第1対戦。隠れていた2行を足して 2-3 が合う）。
- **未実施の対戦は本数もゲームも印字されない**（ペアだけ）。対戦の区切りは氏名の行で決める。
  本数を手がかりにすると対戦が1つ消えて D1/D2/D3 がずれる。
- 「一」のような横棒1本の字は高さ0.8ptしかない。高さでふるうと氏名から抜け落ちる。

## 読み方

数字も氏名も、同じディレクトリの `highschool-championship-2025-glyphs.json`
（正規化した字形 → 文字）との内積で読む。**人が漢字を読む必要は無い**。
辞書に無い字形（類似度 0.94 未満）は「辞書に足せ」と報告して止まる。**当て推量はしない**。

- 辞書は 2025 の紙面から作った（281字形・256種）。作り方は
  docs/raw/2026-09-18-interhigh-2025-outlined-team-match-order.md。
- **⑥と⑧は字形が近い**。1位と2位の差が 0.02 未満なら「際どい」として止まる。
- `--names`（任意）は**入力ではなく照合用**。辞書を作った元の読みと食い違えば止まる。

## 検算

- 見出しのエントリー番号・学校単位の本数 ＝ details の `entries` / `scores`
- 対戦の勝ち数 ＝ details の `scores`
- **印字された本数 ＝ ゲームごとのポイントから数え直した本数**
- **ゲームの得点がソフトテニスとして成立する**（4点先取・デュースは2点差）。
  本数の数え直しでは見つからない ⑥/⑧ の取り違えがここに出る
- 同じ選手が2校に割り当てられない / 個人戦の名簿に居ない選手は報告（居なくてもよい）

## 出典の誤記

`--corrections`（任意）で、出典の印字がゲームとして成立しない箇所を補正できる。
**印字が一致するときだけ**当てるので、読み取りがずれていれば気付ける。当てた箇所は毎回表示する。

## 使い方

    python3 scripts/pdf/highschool_championship_team_matches_outlined.py PDF --pages 28-31 \
        --details data/tournaments/details/highschool-championship/2025/team-none-boys.json \
        --corrections scripts/pdf/highschool-championship-2025-corrections.json [--write]
    npx prettier --write data/tournaments/details/highschool-championship/2025/team-none-boys.json
    npm run check:team-match-details

`--write` が無ければ表示だけ。検算に1件でも引っかかれば書き込まない。冪等。
PyMuPDF と numpy と Pillow が要る（`.venv`）。
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from team_match_details import individual_index, player_ref, write_details  # noqa: E402

N = 32
GLYPHS = Path(__file__).resolve().parent / 'highschool-championship-2025-glyphs.json'
# 列のx座標（pt・A4縦）。テキスト層のある年度の様式と同じ
COLS = {
    'Lno': (40, 80), 'Llast': (100, 145), 'Lfirst': (145, 205), 'Lgame': (210, 245),
    'Lpt': (258, 288), 'Rpt': (308, 335), 'Rgame': (350, 378),
    'Rlast': (412, 458), 'Rfirst': (458, 512), 'Rno': (505, 555),
}
TYPES = ['D1', 'D2', 'D3']


def descriptor(dr):
    """1つの塗りパスだけを白紙に描き直して、32×32 に正規化する。
    ページをそのまま描くと「打ち切り」の白い箱に隠れた字が読めない。"""
    r = dr['rect']
    pad = 0.5
    doc = pymupdf.open()
    page = doc.new_page(width=r.width + 2 * pad, height=r.height + 2 * pad)
    off = pymupdf.Point(-r.x0 + pad, -r.y0 + pad)
    sh = page.new_shape()
    for it in dr['items']:
        op = it[0]
        if op == 'l':
            sh.draw_line(it[1] + off, it[2] + off)
        elif op == 'c':
            sh.draw_bezier(it[1] + off, it[2] + off, it[3] + off, it[4] + off)
        elif op == 're':
            sh.draw_rect(pymupdf.Rect(it[1].x0 + off.x, it[1].y0 + off.y,
                                      it[1].x1 + off.x, it[1].y1 + off.y))
        elif op == 'qu':
            q = it[1]
            sh.draw_quad(pymupdf.Quad(q.ul + off, q.ur + off, q.ll + off, q.lr + off))
    sh.finish(fill=(0, 0, 0), color=None, even_odd=dr.get('even_odd', False), closePath=True)
    sh.commit()
    z = 160 / max(r.width, r.height)
    pm = page.get_pixmap(matrix=pymupdf.Matrix(z, z), colorspace=pymupdf.csGRAY, alpha=False)
    a = 255.0 - np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width).astype(float)
    doc.close()
    ys, xs = np.nonzero(a > 40)
    if len(ys) == 0:
        return None
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = a.shape
    sc = max(h, w) / N
    hh, ww = max(1, int(round(h / sc))), max(1, int(round(w / sc)))
    im = Image.fromarray(a.astype(np.uint8)).resize((ww, hh), Image.LANCZOS)
    out = Image.new('L', (N, N), 0)
    out.paste(im, ((N - ww) // 2, (N - hh) // 2))
    v = np.asarray(out.filter(ImageFilter.GaussianBlur(0.4)), dtype=float).ravel()
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else None


def load_glyphs():
    ds, chars = [], []
    for e in json.load(open(GLYPHS, encoding='utf-8')):
        v = np.frombuffer(base64.b64decode(e['bm']), dtype=np.uint8).astype(float)
        ds.append(v / np.linalg.norm(v))
        chars.append(e['char'])
    return np.asarray(ds), chars


def read_glyphs(pdf, pages):
    ds, chars = load_glyphs()
    doc = pymupdf.open(pdf)
    out = []
    for pno in pages:
        page = doc[pno - 1]
        for dr in page.get_drawings():
            if dr['type'] not in ('f', 'fs') or dr.get('fill') != (0.0, 0.0, 0.0):
                continue
            r = dr['rect']
            if r.width < 0.3 or r.height < 0.3 or r.width > 60 or r.height > 60:
                continue
            v = descriptor(dr)
            if v is None:
                continue
            # numpy が matmul で無害な警告を出すことがある。値が有限かは下で確かめる
            with np.errstate(divide='ignore', over='ignore', invalid='ignore'):
                s = ds @ v
            if not np.isfinite(s).all():
                sys.exit(f'字形の照合が数値的に壊れた（p{pno} x={r.x0:.0f} y={r.y0:.0f}）')
            order = np.argsort(-s)
            j = int(order[0])
            # 2位が「別の字」ならその差を持つ。⑥と⑧は字形が近く、差が 0.02 を切る実例がある
            second = next((float(s[k]) for k in order[1:] if chars[k] != chars[j]), 0.0)
            out.append(dict(page=pno, x0=r.x0, y0=r.y0, x1=r.x1, y1=r.y1, w=r.width, h=r.height,
                            d=v, ch=chars[j] if s[j] >= 0.94 else None,
                            margin=float(s[j]) - second))
    return out


def col(g, name):
    a, b = COLS[name]
    xm = (g['x0'] + g['x1']) / 2
    return a <= xm <= b


def cy(g):
    return g['y0'] + g['h'] / 2


def bucket(items, tol=4.0):
    """y が近いものを1行に。丸数字は背が高く中心がずれるので、整数丸めでは行が割れる"""
    out = []
    for it in sorted(items, key=cy):
        if out and cy(it) - cy(out[-1][0]) <= tol:
            out[-1].append(it)
        else:
            out.append([it])
    return out


DIGIT = re.compile(r'^\d+c?$')


def val(g):
    """'4c' -> (4, True)（丸数字＝取った側） / '4' -> (4, False）"""
    if not g['ch'] or not DIGIT.match(g['ch']):
        return None
    return (int(g['ch'][:-1]), True) if g['ch'].endswith('c') else (int(g['ch']), False)


def text_of(glyphs):
    """氏名のセル（左からのグリフ列）を文字列にする"""
    return ''.join(g['ch'] or '\uFFFD' for g in glyphs)


def matches_on(glyphs, page):
    gs = [g for g in glyphs if g['page'] == page]
    ys = sorted({round(cy(g)) for g in gs if (col(g, 'Lgame') or col(g, 'Rgame')) and g['h'] >= 11.0})
    heads = []
    for y in ys:
        if heads and y - heads[-1]['y'] < 20:
            continue
        no = {}
        for side in 'LR':
            no[side] = ''.join(g['ch'] or '' for g in sorted(
                [g for g in gs if col(g, side + 'no') and abs(cy(g) - y) < 8 and (g['ch'] or '').isdigit()],
                key=lambda g: g['x0']))
        if not (no['L'].isdigit() and no['R'].isdigit()):
            continue          # ページ見出し（「団体戦」等）が列に掛かったもの
        sc = {}
        for side in 'LR':
            v = [val(g) for g in gs if col(g, side + 'game') and abs(cy(g) - y) < 8 and g['h'] >= 11.0]
            sc[side] = v[0] if v else None
        heads.append(dict(y=y, L=int(no['L']), R=int(no['R']), scL=sc['L'], scR=sc['R']))
    out = []
    for i, h in enumerate(heads):
        y1 = heads[i + 1]['y'] - 20 if i + 1 < len(heads) else 10 ** 9
        out.append((h, [g for g in gs if h['y'] + 8 < cy(g) < y1]))
    return out


def rubbers(gs):
    """対戦の区切りは氏名の行で決める（未実施の対戦は本数が印字されないため）"""
    rows = {s: bucket([g for g in gs if col(g, s + 'last') and g['h'] >= 5.0]) for s in 'LR'}
    for s in 'LR':
        if len(rows[s]) != 6:
            sys.exit(f'氏名の行が {s}{len(rows[s])} 行（3対戦×2人＝6を期待）')
    cents = [(cy(rows['L'][2 * i][0]) + cy(rows['L'][2 * i + 1][0])) / 2 for i in range(3)]
    subs = []
    for i, y in enumerate(cents):
        lo = (y + cents[i - 1]) / 2 if i else y - 55
        hi = (y + cents[i + 1]) / 2 if i + 1 < len(cents) else y + 55
        blk = [g for g in gs if lo < cy(g) < hi]
        cnt = {}
        for side in 'LR':
            v = [val(g) for g in blk if col(g, side + 'game') and 7.0 <= g['h'] <= 10.5]
            cnt[side] = v[0] if v else None
        games = []
        for row in bucket([g for g in blk if (col(g, 'Lpt') or col(g, 'Rpt'))
                           and 6.0 <= g['h'] <= 9.0 and val(g)]):
            d = {}
            for g in row:
                d['L' if col(g, 'Lpt') else 'R'] = val(g)
            games.append(d)
        names = {}
        for side in 'LR':
            names[side] = [{p: [g for g in blk if col(g, side + p) and g['w'] <= 30
                                and abs(cy(g) - cy(row[0])) <= 4.0]
                            for p in ('last', 'first')} for row in rows[side][2 * i:2 * i + 2]]
        subs.append(dict(cnt=cnt, games=games, names=names))
    return subs


def build(args):
    pages = [int(x) for x in args.pages.split('-')]
    pages = list(range(pages[0], pages[-1] + 1))
    glyphs = read_glyphs(args.pdf, pages)
    details = json.loads(Path(args.details).read_text(encoding='utf-8'))
    idx = individual_index()
    sibling = Path(args.details).parent / Path(args.details).name.replace('team-', 'doubles-')
    roster = defaultdict(set)
    if sibling.exists():
        for pl in json.loads(sibling.read_text(encoding='utf-8')).get('participants', []):
            roster[f"{pl['team']}_{pl['prefecture']}"].add((pl['lastName'], pl['firstName']))
    fixes, applied = {}, []
    expect = json.loads(Path(args.names).read_text(encoding='utf-8')) if args.names else None
    if args.corrections:
        for c in json.loads(Path(args.corrections).read_text(encoding='utf-8'))['corrections']:
            fixes[(c['key'], c['rubber'], c['game'])] = c
    teams = {e['entryNo']: e['playerIds'][0] for e in details['entries']}
    by_entries = {tuple(m['entries']): m for m in details['matches']}

    problems, warnings, counts = [], [], defaultdict(int)
    named = defaultdict(int)
    for page in pages:
        for h, gs in matches_on(glyphs, page):
            key = f"{page}|{h['L']}|{h['R']}"
            parent = by_entries.get((h['L'], h['R'])) or by_entries.get((h['R'], h['L']))
            if parent is None:
                problems.append(f'{key}: details に {h["L"]}-{h["R"]} の試合が無い')
                continue
            flip = parent['entries'][0] != h['L']       # A/B は親の entries の順
            for side, no in (('L', h['L']), ('R', h['R'])):
                want = parent['scores'].get(str(no))
                got = (h['scL'] if side == 'L' else h['scR'])
                if got is None or got[0] != want:
                    problems.append(f'{key}: 学校単位の本数 {side}={got} / details={want}')
            subs, wins = [], defaultdict(int)
            for k, sub in enumerate(rubbers(gs)):
                cells = [sub['names']['L'][0], sub['names']['L'][1],
                         sub['names']['R'][0], sub['names']['R'][1]]
                pair = [[text_of(c['last']), text_of(c['first'])] for c in cells]
                if expect is not None and key in expect:
                    for got, want in zip(pair, expect[key][k]):
                        if got != list(want):
                            problems.append(f'{key} D{k+1}: 字形辞書の読み {got} が'
                                            f'照合用の {want} と違う')
                for i, (nm, c) in enumerate(zip(pair, cells)):
                    school = teams[h['L'] if i < 2 else h['R']].rsplit('_', 1)[0]
                    for part, gl in (('姓', c['last']), ('名', c['first'])):
                        for g in gl:
                            if g['ch'] is None:
                                problems.append(
                                    f'{key} D{k+1}: {part}に辞書に無い字形がある'
                                    f'（p{g["page"]} x={g["x0"]:.0f} y={g["y0"]:.0f}）。'
                                    f'{GLYPHS.name} に足す')
                    if not (nm[0] and nm[1]):
                        problems.append(f'{key} D{k+1}: 氏名が空（{nm}）')
                        continue
                    if (nm[0], nm[1]) not in roster[teams[h['L'] if i < 2 else h['R']]]:
                        warnings.append(f'{key} D{k+1}: {nm[0]}{nm[1]}（{school}）は'
                                        f'この大会の個人戦の名簿に居ない')
                lw = sum(1 for g in sub['games'] if (g.get('L') or (0, False))[1])
                rw = sum(1 for g in sub['games'] if (g.get('R') or (0, False))[1])
                cl, cr = sub['cnt']['L'], sub['cnt']['R']
                for gi, g in enumerate(sub['games']):
                    if g.get('L') is None or g.get('R') is None:
                        problems.append(f'{key} D{k+1}: {gi+1}ゲーム目の片側が読めない')
                if sub['games']:
                    if cl is None or cr is None:
                        problems.append(f'{key} D{k+1}: ゲームがあるのに本数が読めない')
                        continue
                    if (cl[0], cr[0]) != (lw, rw):
                        problems.append(f'{key} D{k+1}: 印字の本数 {cl[0]}-{cr[0]} / '
                                        f'ポイントの数え直し {lw}-{rw}')
                        continue
                    status = 'completed' if (cl[1] or cr[1]) else 'unfinished'
                elif cl is None and cr is None:
                    status = 'not_played'
                else:
                    problems.append(f'{key} D{k+1}: 本数はあるのにゲームが無い')
                    continue
                pa, pb = (pair[:2], pair[2:]) if not flip else (pair[2:], pair[:2])
                sa, sb = ((cl, cr) if not flip else (cr, cl)) if status != 'not_played' else (None, None)
                # ADR-020 の `games` は**決着したゲームだけ**（取ったのは多いほう・同点は無い）。
                # この様式は打ち切り時点の**途中のゲーム**も印字するので、丸数字の無い行は落とす
                # （落とさないと 4-4 のような同点が入り、prebuild の検査が落ちる）
                games = [[g['L'][0], g['R'][0]] for g in sub['games']
                         if g.get('L') and g.get('R') and (g['L'][1] or g['R'][1])]
                # 出典の誤記の補正。印字が一致するときだけ当てる（ずれたら気付けるように）
                fix = fixes.get((key, k, None))
                for gi in range(len(games)):
                    c = fixes.get((key, k, gi))
                    if not c:
                        continue
                    if games[gi] != c['printed']:
                        problems.append(f'{key} D{k+1}: 補正の対象 {c["printed"]} が'
                                        f'{gi+1}ゲーム目に無い（読めたのは {games[gi]}）')
                        continue
                    games[gi] = list(c['corrected'])
                    applied.append(f'{key} D{k+1} {gi+1}ゲーム目 '
                                   f'{c["printed"][0]}-{c["printed"][1]} → '
                                   f'{c["corrected"][0]}-{c["corrected"][1]}: {c["why"]}')
                # ソフトテニスのゲームとして成立する得点か（4点先取・デュースは2点差）。
                # ⑥と⑧の取り違えはここに出る。**出典の誤記でも鳴る**ので止めずに報告する
                for gi, (a, b) in enumerate(games):
                    hi, lo = max(a, b), min(a, b)
                    if not ((hi == 4 and lo <= 2) or (hi >= 5 and hi - lo == 2)):
                        warnings.append(f'{key} D{k+1}: {gi+1}ゲーム目 {a}-{b} は'
                                        f'ゲームとして成立しない（4点先取・デュースは2点差）')
                if flip:
                    games = [[b, a] for a, b in games]
                rec = {'type': TYPES[k], 'status': status}
                if status == 'completed':
                    rec['winner'] = 'A' if sa[1] else 'B'
                    wins['A' if sa[1] else 'B'] += 1
                else:
                    rec['winner'] = None
                # not_played も scoreA/scoreB は **null を明記**する（検査が key の存在を見る）
                rec['scoreA'], rec['scoreB'] = (sa[0], sb[0]) if status != 'not_played' else (None, None)
                ta = teams[parent['entries'][0]].rsplit('_', 1)[0]
                tb = teams[parent['entries'][1]].rsplit('_', 1)[0]
                rec['playersA'] = [player_ref(''.join(n), ta, idx) for n in pa]
                rec['playersB'] = [player_ref(''.join(n), tb, idx) for n in pb]
                for p in rec['playersA'] + rec['playersB']:
                    named['記録あり' if 'lastName' in p else '名前だけ'] += 1
                if games:
                    rec['games'] = games
                counts[status] += 1
                subs.append(rec)
            for side, letter in ((parent['entries'][0], 'A'), (parent['entries'][1], 'B')):
                if wins[letter] != parent['scores'].get(str(side)):
                    problems.append(f'{key}: 対戦の勝ち数 {letter}={wins[letter]} / '
                                    f'details={parent["scores"].get(str(side))}')
            parent['matches'] = subs
    thin = [g for g in glyphs if g['ch'] and g['margin'] < 0.02]
    for g in thin:
        problems.append(f'p{g["page"]} y={g["y0"]:.0f} x={g["x0"]:.0f}: '
                        f'字形の判定が際どい（「{g["ch"]}」と2位の差 {g["margin"]:.3f}）')
    # 同じ選手が2校に割り当てられていないか
    owner = defaultdict(set)
    for m in details['matches']:
        for s in m.get('matches', []):
            for side, ent in (('playersA', m['entries'][0]), ('playersB', m['entries'][1])):
                for p in s[side]:
                    owner[p.get('name') or p['lastName'] + p['firstName']].add(ent)
    for nm, es in owner.items():
        schools = {teams[e].rsplit('_', 1)[0] for e in es}
        if len(schools) > 1:
            problems.append(f'{nm} が2校に割り当てられている: {schools}')
    return details, problems, warnings, applied, counts, named


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('pdf')
    ap.add_argument('--pages', required=True, help='詳細ページ（例 28-31）。1始まり')
    ap.add_argument('--details', required=True)
    ap.add_argument('--corrections', help='出典の誤記を補正する JSON（任意）')
    ap.add_argument('--names', help='人が読んだ氏名の JSON。**入力ではなく照合用**（任意）。'
                                    '字形辞書を作った元の読みと食い違わないかを見る')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()
    details, problems, warnings, applied, counts, named = build(args)
    for m in details['matches']:
        if not m.get('matches'):
            continue
        print(f'{m["round"]} {m["entries"][0]} 対 {m["entries"][1]}  {m["scores"]}')
        for s in m['matches']:
            fmt = lambda ps: '・'.join(p.get('name') or p['lastName'] + p['firstName'] for p in ps)
            sc = '-' if s['scoreA'] is None else f'{s["scoreA"]}-{s["scoreB"]}'
            pts = ' '.join(f'{a}-{b}' for a, b in s.get('games', []))
            print(f'    {s["type"]} {s["status"]:11s} {fmt(s["playersA"]):22s} {sc} '
                  f'{fmt(s["playersB"]):22s} | {pts}')
    print(f'\n対戦の状態: {dict(counts)} / 選手（延べ）: ' +
          ' '.join(f'{k} {v}' for k, v in named.items()))
    if applied:
        print('\n'.join(['', '出典の誤記を補正した箇所:'] + ['  ' + a for a in applied]))
    if warnings:
        print('\n'.join(['', '要確認:'] + ['  ' + w for w in warnings]))
    if problems:
        print('\n'.join(['書き込みを中止:'] + problems), file=sys.stderr)
        sys.exit(1)
    if args.write:
        write_details(Path(args.details), details)


if __name__ == '__main__':
    main()
