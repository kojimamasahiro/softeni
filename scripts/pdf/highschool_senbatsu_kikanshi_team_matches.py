#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全日本高校選抜（JSTA 機関誌『ソフトテニス』様式）の団体戦PDF → 既存 details の各試合に対戦ごとの記録を足す。

`highschool_senbatsu_team_matches.py`（JSTA 記録・Excel 様式）と**別の様式**。
書き戻し方・選手の結び付け・割り当ての考え方は同じで、読み取りだけが違う。
形は docs/adr/ADR-020-team-match-rubber-details.md。

## この様式の見極め（2023年度・第49回の男女4ページで検証）

- **テキストPDF。1種目が左右2ページに分かれる**（男子 p26=エントリー 1〜18・p27=19〜36、女子 p28/p29）。
  **決勝は右ページの左上**に「決勝 <学校> ② － 0 <学校>」の見出しつきで置かれる。
- **ペアの行と本数の行が別**。氏名（高さ約10.1pt）の **約2pt下**に本数（高さ約6.5pt）が来る。
  Excel 様式は同じ行なので、そのままでは1つも読めない。
- **縦の位置は行の中心で比べる**（氏名の行は高さ10.1pt・エントリー番号は14.9pt なので、
  上端どうしを比べると約7pt ずれて初戦の中間判定が全部外れる）。
- **左右は本数の行の「－」の x で分ける**（氏名の行だけでは切れ目が無い）。
  **左＝エントリー番号の小さい学校**（男女・全塊で成立を確認）。
- **学校名も都道府県も1文字ずつ別の語**（均等割り付け。`尽@69 誠@93 学@117 園@140`、`香@171 川@189`）。
  なので**都道府県名で行を探せない**。エントリー行は**高さ13pt超の数字**で見つける
  （左ページは x≈50、右ページは x≈538）。**ページ下端の柱（ノンブル）も数字**なので y<800 で捨てる。
- **学校単位の本数が氏名の行に紛れ込む**（高さ約9.7pt の裸の数字）。氏名から数字を捨てる。
- **塊の x が回戦を表す**。左ページは深いほど右（1回戦 x≈153 → 準決勝 x≈343）、
  **右ページは鏡像**（1回戦 x≈445 → 準決勝 x≈260、決勝 x≈176）。
  塊の中では「－」の x が揃うので、x と y の近さだけで3行にまとまる。
- 打ち切られた対戦も載る。**「－」だけで数字が無い＝未実施**。丸数字（④）が取った側。

## 塊と試合の対応

Excel 様式と同じ。1. 両校とも初戦の試合は2校のエントリー行の中間 ±4pt（左右のページをまたがない）。
2. それ以外は、左の選手が a 校の・右の選手が b 校のこれまでの試合の選手と重なる塊。
3. **決勝だけは左右のページをまたぐ**ので、右ページの残った塊から重なりで選ぶ
   （Excel 様式の「ページ中央」に当たる手がかりがこの様式には無い）。
4. 検算: 塊の勝ち数が既存の本数と一致すること／同じ選手が2校に割り当てられないこと。

## 使い方

    python3 scripts/pdf/highschool_senbatsu_kikanshi_team_matches.py PDF --pages 26,27 \
        --details data/tournaments/details/highschool-senbatsu/2023/team-none-boys.json [--write]

`--pages` は**左の山・右の山の順**。`--write` が無ければ表示するだけ。冪等。
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from team_match_details import individual_index, key_of, player_ref, score_of, write_details  # noqa: E402

DOUBLES_TYPES = ['D1', 'D2', 'D3']
DASHES = '－ー―‐-'
POS_TOL = 4.0
NAME_H = (9.0, 11.0)      # 氏名の行の高さ
SCORE_H = (5.5, 7.5)      # 本数の行の高さ
SCORE_DY = (1.0, 3.5)     # 氏名の行から本数の行までの下向きの距離
ENTRY_H = 13.0            # エントリー番号はこれより高い
FOOTER_Y = 800.0          # これより下はページの柱


def read_words(pdf, page):
    html = subprocess.run(['pdftotext', '-bbox', '-f', str(page), '-l', str(page), pdf, '-'],
                          capture_output=True, text=True, check=True).stdout
    width = float(re.search(r'<page width="([\d.]+)"', html).group(1))
    ws = [dict(x0=float(a), y0=float(b), x1=float(c), y1=float(d), t=e)
          for a, b, c, d, e in re.findall(
              r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', html)]
    return width, ws


def by_row(ws):
    rows = defaultdict(list)
    for w in ws:
        rows[round(w['y0'], 1)].append(w)
    return {y: sorted(v, key=lambda w: w['x0']) for y, v in sorted(rows.items())}


def height(row):
    return max(w['y1'] - w['y0'] for w in row)


def entry_rows(ws, width):
    """エントリー番号の行: 高さ13pt超の数字で、左端か右端にあるもの（柱は除く）"""
    rows = {}
    for w in ws:
        if not w['t'].isdigit() or w['y1'] - w['y0'] <= ENTRY_H or w['y0'] > FOOTER_Y:
            continue
        if w['x0'] < 60 or w['x0'] > width - 60:
            rows[int(w['t'])] = (w['y0'] + w['y1']) / 2
    return rows


def pair_names(tokens):
    """['塚本', '大翔・豊田', '祐冴'] -> ['塚本 大翔', '豊田 祐冴']

    氏名は1つの語のことも、姓と名が別の語のこともある。`・` は語の中に含まれる。
    学校単位の本数（裸の数字）が同じ行に紛れ込むので捨てる。
    """
    text = ' '.join(t['t'] for t in tokens if score_of(t['t']) is None)
    text = unicodedata.normalize('NFKC', text)
    return [re.sub(r'\s+', ' ', p).strip() for p in text.split('・') if p.strip()]


def read_rubbers(ws):
    """氏名の行と、その約2pt下の本数の行を1対戦として読む"""
    rows = by_row(ws)
    names = {y: r for y, r in rows.items() if NAME_H[0] <= height(r) <= NAME_H[1] and any('・' in w['t'] for w in r)}
    scores = {y: r for y, r in rows.items()
              if SCORE_H[0] <= height(r) <= SCORE_H[1] and any(w['t'] in DASHES for w in r)}
    out = []
    for y, nr in names.items():
        cand = [sy for sy in scores if SCORE_DY[0] < sy - y < SCORE_DY[1]]
        if not cand:
            continue
        sr = scores[min(cand)]
        dash = next(w for w in sr if w['t'] in DASHES)
        dx = (dash['x0'] + dash['x1']) / 2
        nums = [w for w in sr if w['t'] not in DASHES]
        ls = next((score_of(w['t']) for w in nums if w['x1'] <= dash['x0'] + 0.5), None)
        rs = next((score_of(w['t']) for w in nums if w['x0'] >= dash['x1'] - 0.5), None)
        out.append(dict(x=dx, y=(min(w['y0'] for w in nr) + max(w['y1'] for w in nr)) / 2,
                        left=pair_names([w for w in nr if w['x1'] <= dx]),
                        right=pair_names([w for w in nr if w['x0'] >= dx]), ls=ls, rs=rs))
    return out


def group_blocks(rubbers):
    """同じ x（「－」の位置）で、縦に9pt以内に続く対戦を1つの試合にまとめる"""
    out, cur = [], []
    for r in sorted(rubbers, key=lambda r: (round(r['x']), r['y'])):
        if cur and (abs(cur[-1]['x'] - r['x']) > 1 or r['y'] - cur[-1]['y'] > 9):
            out.append(cur)
            cur = []
        cur.append(r)
    if cur:
        out.append(cur)
    return out


def wins(blk):
    return (sum(1 for r in blk if r['ls'] and r['ls'][1]), sum(1 for r in blk if r['rs'] and r['rs'][1]))


def players_of(blk, side):
    return {key_of(p) for r in blk for p in r[side]}


def assign(details, rows, blocks, page_of):
    """塊と試合の対応。Excel 様式と同じ考え方（初戦は中間、以降は選手の重なり）"""
    n_entries = len(details['entries'])
    half = lambda n: 0 if n <= n_entries // 2 else 1

    played, first = set(), set()
    for m in details['matches']:
        a, b = m['entries']
        if a not in played and b not in played:
            first.add(m['matchId'])
        played |= {a, b}

    used, chosen, roster = set(), {}, defaultdict(set)

    def take(m, i):
        a, b = m['entries']
        used.add(i)
        chosen[m['matchId']] = i
        roster[a] |= players_of(blocks[i], 'left')
        roster[b] |= players_of(blocks[i], 'right')

    center = lambda blk: sum(r['y'] for r in blk) / len(blk)

    for m in details['matches']:
        a, b = m['entries']
        if m['matchId'] not in first or half(a) != half(b):
            continue
        ey = (rows[a] + rows[b]) / 2
        near = [i for i, blk in enumerate(blocks)
                if i not in used and len(blk) == 3 and page_of[i] == half(a) and abs(center(blk) - ey) <= POS_TOL]
        if len(near) == 1:
            take(m, near[0])

    for m in details['matches']:
        if m['matchId'] in chosen:
            continue
        a, b = m['entries']
        ey = (rows[a] + rows[b]) / 2
        want = (m['scores'][str(a)], m['scores'][str(b)])
        best = None
        for i, blk in enumerate(blocks):
            if i in used or len(blk) != 3:
                continue
            # 決勝だけが左右の山をまたぐ。この様式では右ページに置かれる
            if half(a) == half(b) and page_of[i] != half(a):
                continue
            la, rb = players_of(blk, 'left'), players_of(blk, 'right')
            overlap = len(la & roster[a]) + len(rb & roster[b]) - 2 * (len(la & roster[b]) + len(rb & roster[a]))
            k = (overlap, wins(blk) == want, -abs(center(blk) - ey) if page_of[i] == half(a) else 0)
            if best is None or k > best[0]:
                best = (k, i)
        if best is not None and best[0][0] > 0:
            take(m, best[1])
    return chosen


def rubber_detail(no, r, school_a, school_b, idx):
    played = r['ls'] is not None or r['rs'] is not None
    winner = 'A' if r['ls'] and r['ls'][1] else 'B' if r['rs'] and r['rs'][1] else None
    status = 'completed' if winner else ('unfinished' if played else 'not_played')
    return {
        'type': DOUBLES_TYPES[no],
        'status': status,
        'winner': winner,
        'scoreA': r['ls'][0] if r['ls'] else None,
        'scoreB': r['rs'][0] if r['rs'] else None,
        'playersA': [player_ref(p, school_a, idx) for p in r['left']],
        'playersB': [player_ref(p, school_b, idx) for p in r['right']],
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('pdf')
    ap.add_argument('--pages', required=True, help='左の山,右の山（例: 26,27）')
    ap.add_argument('--details', required=True)
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    pages = [int(p) for p in args.pages.split(',')]
    if len(pages) != 2:
        sys.exit('--pages は「左の山,右の山」の2ページ')

    details_path = Path(args.details)
    details = json.load(open(details_path, encoding='utf-8'))

    rows, blocks, page_of = {}, [], []
    for side, page in enumerate(pages):
        width, ws = read_words(args.pdf, page)
        rows.update(entry_rows(ws, width))
        bs = group_blocks(read_rubbers(ws))
        print(f'p{page}: エントリー行 {len(entry_rows(ws, width))} 件 / 塊 {len(bs)} 件'
              f'（3行でないもの {sum(len(b) != 3 for b in bs)}）')
        blocks += bs
        page_of += [side] * len(bs)

    school = {e['entryNo']: e['playerIds'][0].split('_')[0] for e in details['entries']}
    errors = []
    if len(rows) != len(details['entries']):
        errors.append(f'エントリー行 {len(rows)} 件 / details {len(details["entries"])} 件')
    if len(blocks) != len(details['matches']) or any(len(b) != 3 for b in blocks):
        errors.append(f'塊 {len(blocks)} 件 / 試合 {len(details["matches"])} 件')
    if errors:
        sys.exit('\n'.join(errors))

    chosen = assign(details, rows, blocks, page_of)
    missing = [m['matchId'] for m in details['matches'] if m['matchId'] not in chosen]
    if missing:
        errors.append(f'割り当てられない試合: {missing}')

    owner = defaultdict(set)
    for m in details['matches']:
        if m['matchId'] not in chosen:
            continue
        a, b = m['entries']
        blk = blocks[chosen[m['matchId']]]
        for p in players_of(blk, 'left'):
            owner[p].add(a)
        for p in players_of(blk, 'right'):
            owner[p].add(b)
        want = (m['scores'][str(a)], m['scores'][str(b)])
        if wins(blk) != want:
            errors.append(f'{m["matchId"]} {school[a]} 対 {school[b]}: PDF {wins(blk)} / details {want}')
    clash = {p: sorted(school[n] for n in s) for p, s in owner.items() if len(s) > 1}
    if clash:
        errors.append(f'2校に割り当てられた選手: {clash}')

    idx = individual_index()
    counts = defaultdict(int)
    for m in details['matches']:
        if m['matchId'] not in chosen:
            continue
        a, b = m['entries']
        blk = blocks[chosen[m['matchId']]]
        m['matches'] = [rubber_detail(k, r, school[a], school[b], idx) for k, r in enumerate(blk)]
        print(f'{m["matchId"]:9} {m["round"]:5} {school[a]} {m["scores"][str(a)]}-{m["scores"][str(b)]} {school[b]}')
        for s in m['matches']:
            counts[s['status']] += 1
            fmt = lambda ps: '・'.join(p.get('name') or p['lastName'] + p['firstName'] + '*' for p in ps)
            print(f'    {s["type"]} {s["status"]:10} {fmt(s["playersA"]):24} {s["scoreA"]!s:>4}-{s["scoreB"]!s:<4} {fmt(s["playersB"])}')
            for p in s['playersA'] + s['playersB']:
                counts['linked' if 'lastName' in p else 'name_only'] += 1
    print('対戦の状態:', {k: counts[k] for k in ('completed', 'unfinished', 'not_played')},
          '/ 選手（延べ）: 記録あり', counts['linked'], '名前だけ', counts['name_only'], '（* は記録あり）')

    if errors:
        print('\n'.join(['書き込みを中止:'] + errors), file=sys.stderr)
        sys.exit(1)
    if args.write:
        write_details(details_path, details)


if __name__ == '__main__':
    main()
