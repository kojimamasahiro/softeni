#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""インターハイ（全国高等学校総合体育大会）の団体戦の記録PDF → 対戦ごとの記録（ADR-020）。

既存の `data/tournaments/details/highschool-championship/<年>/team-none-{boys,girls}.json` の
各試合へ `matches`（ペア・本数・**ゲームごとのポイント**）を差し込む。

**収録範囲は年度で変わる**。2024〜2026 は**ベスト8以降の7試合だけ**（1〜3回戦は学校単位の本数のみ）、
**2022・2023 は1回戦から全47試合**（2022 は不戦の1試合を除く46試合）。
**詳細ページの範囲は見出しを1ページずつ目視して決める**（`pdftotext -layout`。人の指定は1ページずれる）。

## この様式の見極め（令和8年度 女子団体で検証。令和5〜6年度でも通る）

- テキストPDF。ページ構成は **p1 入賞校一覧 / p2 トーナメント表 / p3・p4 準々決勝 / p5 準決勝 / p6 決勝**。
  年度でページ数は変わるので `--pages` で渡す。詳細ページは1ページに最大2試合
  （2023 は p12-35 の24ページに47試合）。
- 1試合 = 見出し行（**左右の端にエントリー番号**・学校名・都道府県・学校単位の本数）＋ 3対戦。
  **エントリー番号が印字されているので、details の試合とは番号で直接対応する**
  （高校選抜のように位置や選手の重なりから推測しなくてよい）。
- 1対戦 = ゲーム行が最大7行（左のポイント・「－」・右のポイント）。**丸数字がそのゲームを取った側**。
  行の中ほどに両ペアの氏名（「・」は無い）と、対戦の本数（丸数字＝その対戦の勝者）。
  **氏名は1つの語（2024・2026）か1文字ずつの語（2023）**。どちらも `pair_names` が扱う。
- **打ち切りの印字はあてにしない**。「打ち切り」と書かれる対戦とそうでない対戦がある
  （準決勝で 3-3 のまま印字のみ）。**勝者は本数の丸数字の有無で決める**。
  **打ち切りの本数を印字しない年度がある**（2023）。`to_detail` の docstring を参照。
- **不戦の試合は見出しの本数が `R`**（2022 男子 p28・女子 p18）で、ペアも本数もゲームも印字されない。
  元資料にオーダーが無いので `matches` を入れず、飛ばした試合を表示する。
- **打ち切りの瞬間に進行中だったゲームが印字される**（丸数字がどちらにも無い行。2022 に8件）。
  ADR-020 は決着したゲームだけを持つので落とし、落とした行を表示する。
- ポイントは10以上になる（実測 `⑫ － 10`）。丸数字の10〜20も読む（`team_match_details.CIRCLED`）。

列のx座標（pt・A4縦）:
  左 姓112 / 名146 | 左 本数223-226 | 左ポイント270-279 | 「－」293 | 右ポイント316-325 | 右 本数360-364 | 右 姓425 / 名459

## 検算

- 見出しの学校単位の本数 ＝ details の `scores`
- 対戦の勝ち数 ＝ details の `scores`
- **印字された本数 ＝ ゲームごとのポイントから数え直した本数**（この様式だけで効く強い検算）。
  本数の印字が無い対戦（2023 の打ち切り）は数え直しで埋め、埋めた対戦を表示する。
  `not_played`（ゲームも本数も無い）は数えるものが無いので対象外。
- 同じ選手が2校に割り当てられない（**同名の別人は `--same-name` で明示的に通す**）

## 使い方

    python3 scripts/pdf/highschool_championship_team_matches.py PDF --pages 3-6 \
        --details data/tournaments/details/highschool-championship/2026/team-none-girls.json [--write]
    # 1回戦から載る年度（2023）と同名の別人がいる場合
    python3 scripts/pdf/highschool_championship_team_matches.py PDF --pages 12-35 \
        --details .../2023/team-none-boys.json --same-name 佐藤直輝 --write
    npx prettier --write data/tournaments/details/highschool-championship/2026/team-none-girls.json
    npm run check:team-match-details

`--write` が無ければ表示だけ。検算に1件でも引っかかれば書き込まない。冪等。
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
from team_match_details import individual_index, player_ref, score_of, write_details  # noqa: E402

COLS = {
    'left_last': (100, 141),
    'left_first': (141, 180),
    'left_games': (210, 240),
    'left_point': (260, 285),
    'dash': (288, 305),
    'right_point': (310, 332),
    'right_games': (352, 375),
    'right_last': (415, 456),
    'right_first': (456, 512),
}
RUBBER_GAP = 25.0  # 同じ対戦のゲーム行は約10pt間隔、対戦の間は30pt以上あく。
# 「打ち切り」の印字がゲーム行を1行ぶん押し下げるため同じ対戦の中に20pt の隙があく（2024 男子）。
NAME_ROW_GAP = 3.0  # 氏名の行は約10pt間隔。同じ行の文字は同じ y（誤差1pt未満）
TYPES = ['D1', 'D2', 'D3']


def words(pdf, page):
    html = subprocess.run(['pdftotext', '-bbox', '-f', str(page), '-l', str(page), pdf, '-'],
                          capture_output=True, text=True, check=True).stdout
    width = float(re.search(r'<page width="([\d.]+)"', html).group(1))
    ws = [dict(x=(float(a) + float(c)) / 2, x0=float(a), y=(float(b) + float(d)) / 2, t=e)
          for a, b, c, d, e in re.findall(
              r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', html)]
    return width, ws


def in_col(w, col):
    lo, hi = COLS[col]
    return lo <= w['x'] < hi


def pick(ws, col, y0, y1):
    return sorted([w for w in ws if in_col(w, col) and y0 <= w['y'] <= y1], key=lambda w: w['y'])


def headers(ws, width):
    """見出し行 = 左端のエントリー番号と、同じ行の右端のエントリー番号"""
    out = []
    for w in ws:
        if w['t'].isdigit() and w['x0'] < 75:
            right = [v for v in ws if v['t'].isdigit() and v['x0'] > width - 75 and abs(v['y'] - w['y']) < 3]
            if right:
                out.append((w['y'], int(w['t']), int(right[0]['t'])))
    return sorted(out)


def rubber_groups(ws):
    dashes = sorted([w for w in ws if w['t'] == '－' and in_col(w, 'dash')], key=lambda w: w['y'])
    groups, cur = [], []
    for d in dashes:
        if cur and d['y'] - cur[-1]['y'] > RUBBER_GAP:
            groups.append(cur)
            cur = []
        cur.append(d)
    if cur:
        groups.append(cur)
    return groups


def pair_names(ws, last_col, first_col, y0, y1):
    """1行が1人。姓と名は別の欄に並ぶ（「・」は無い）。

    **年度によって姓が1つの語（2024・2026）か1文字ずつの語（2023）になる**ので、
    行ごとに欄の中の語を x 順に連結する。**欄の境界（`COLS`）で姓と名を分ける**——
    どちらの欄も均等割り付けなので、文字の間隔で分けることはできない
    （2023 の `國 松 樹 人` は姓の中の間隔 18pt ＞ 姓と名の間隔 16pt）。
    """
    chars = [(w, col) for col in (last_col, first_col) for w in pick(ws, col, y0, y1)]
    rows = []
    for w, col in sorted(chars, key=lambda c: c[0]['y']):
        if not rows or w['y'] - rows[-1][0] > NAME_ROW_GAP:
            rows.append((w['y'], [], []))
        rows[-1][1 if col == last_col else 2].append(w)
    join = lambda g: ''.join(w['t'] for w in sorted(g, key=lambda w: w['x']))
    return [unicodedata.normalize('NFKC', f'{join(last)} {join(first)}'.strip())
            for _, last, first in rows]


def parse_page(pdf, page):
    width, ws = words(pdf, page)
    hs = headers(ws, width)
    groups = rubber_groups(ws)
    out = []
    for i, (hy, a, b) in enumerate(hs):
        next_y = hs[i + 1][0] if i + 1 < len(hs) else 10_000
        lg = pick(ws, 'left_games', hy - 4, hy + 4)
        rg = pick(ws, 'right_games', hy - 4, hy + 4)
        subs = []
        for g in [g for g in groups if hy < g[0]['y'] < next_y]:
            y0, y1 = g[0]['y'] - 6, g[-1]['y'] + 6
            games, inprogress = [], []
            for d in g:
                lp = next((w for w in ws if in_col(w, 'left_point') and abs(w['y'] - d['y']) < 3), None)
                rp = next((w for w in ws if in_col(w, 'right_point') and abs(w['y'] - d['y']) < 3), None)
                if lp is None and rp is None:
                    continue  # 行だけあって実施されなかったゲーム
                pl, pr = score_of(lp['t']) if lp else None, score_of(rp['t']) if rp else None
                if not (pl and pl[1]) and not (pr and pr[1]):
                    # どちらにも丸数字が無い＝打ち切りの時点で進行中だったゲーム。
                    # ADR-020 は決着したゲームだけを持つ（2022 男子 p34 の `3 － 0`）。
                    # 丸数字の読み落ちなら、印字された本数との数え直しで止まる
                    inprogress.append(f"{lp['t'] if lp else ''}-{rp['t'] if rp else ''}")
                    continue
                games.append((pl, pr))
            sub_l = pick(ws, 'left_games', y0, y1)
            sub_r = pick(ws, 'right_games', y0, y1)
            subs.append(dict(
                playersA=pair_names(ws, 'left_last', 'left_first', y0, y1),
                playersB=pair_names(ws, 'right_last', 'right_first', y0, y1),
                gamesA=score_of(sub_l[0]['t']) if sub_l else None,
                gamesB=score_of(sub_r[0]['t']) if sub_r else None,
                points=games,
                inprogress=inprogress,
            ))
        # 見出しの本数は数字でないことがある（不戦の `R`。2022 男子 p28・女子 p18）
        head = [score_of(c[0]['t']) if c else None for c in (lg, rg)]
        out.append(dict(page=page, entryA=a, entryB=b,
                        scoreA=head[0][0] if head[0] else None,
                        scoreB=head[1][0] if head[1] else None,
                        subs=subs))
    return out


def counted_games(points):
    """ゲームごとのポイントから本数を数え直す（丸数字が付いた側がそのゲームを取った）"""
    return [sum(1 for p in points if p[side] and p[side][1]) for side in (0, 1)]


def to_detail(index, sub, school_a, school_b, idx):
    """ADR-020 の TeamMatchDetail へ。勝者は本数の丸数字で決まる。

    **打ち切りの対戦の本数を印字しない年度がある**（2023）。その場合だけ、印字された
    ゲームから数え直した本数を入れる（ADR-020 の `unfinished` は「途中の本数」を持つ）。
    印字がある年度（2024・2026）は印字を正とし、数え直しは検算に使う。
    """
    winner = 'A' if sub['gamesA'] and sub['gamesA'][1] else 'B' if sub['gamesB'] and sub['gamesB'][1] else None
    # 本数・決着したゲーム・進行中のゲームのどれかが印字されていれば、その対戦は始まっている。
    # **ゲームの有無で決めてはいけない**——進行中のゲーム1つだけで打ち切られると（2022）
    # games が空になり、本数 `0 － 0` だけが残る。それは未実施ではなく打ち切り
    started = any((sub['gamesA'], sub['gamesB'], sub['points'], sub['inprogress']))
    status = 'completed' if winner else ('unfinished' if started else 'not_played')
    derived = status == 'unfinished' and not sub['gamesA'] and not sub['gamesB']
    scores = counted_games(sub['points']) if derived else [
        sub['gamesA'][0] if sub['gamesA'] else None,
        sub['gamesB'][0] if sub['gamesB'] else None,
    ]
    return {
        'type': TYPES[index],
        'status': status,
        'winner': winner,
        'scoreA': scores[0],
        'scoreB': scores[1],
        'playersA': [player_ref(n, school_a, idx) for n in sub['playersA']],
        'playersB': [player_ref(n, school_b, idx) for n in sub['playersB']],
        'games': [[p[0][0] if p[0] else None, p[1][0] if p[1] else None] for p in sub['points']],
        '_derived': derived,  # 出力前に落とす。数え直しで埋めた本数を表示するための印
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('pdf')
    ap.add_argument('--pages', required=True, help='詳細ページの範囲。例: 3-6')
    ap.add_argument('--details', required=True)
    ap.add_argument('--same-name', action='append', default=[], metavar='氏名',
                    help='同名の別人として2校に現れてよい氏名（人が確かめたものだけ足す。複数指定可）')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    lo, _, hi = args.pages.partition('-')
    details_path = Path(args.details)
    details = json.load(open(details_path, encoding='utf-8'))
    school = {e['entryNo']: e['playerIds'][0].split('_')[0] for e in details['entries']}
    by_pair = {tuple(sorted(m['entries'])): m for m in details['matches']}
    idx = individual_index()

    problems, derived, blank, dropped, owner, counts = [], [], [], [], defaultdict(set), defaultdict(int)
    for page in range(int(lo), int(hi or lo) + 1):
        for m in parse_page(args.pdf, page):
            db = by_pair.get(tuple(sorted((m['entryA'], m['entryB']))))
            label = f"p{page} {school.get(m['entryA'], m['entryA'])}({m['entryA']}) 対 {school.get(m['entryB'], m['entryB'])}({m['entryB']})"
            if not db:
                problems.append(f'{label}: details に該当の試合が無い')
                continue
            flip = db['entries'][0] != m['entryA']  # details と左右が逆なら入れ替える
            want = (db['scores'][str(m['entryA'])], db['scores'][str(m['entryB'])])
            if not any(s['playersA'] or s['playersB'] or s['points'] for s in m['subs']):
                # 不戦（片側が来ない）。見出しに `R` と印字され、ペアも本数もゲームも無い。
                # 元資料にオーダーが無いので `matches` は持たない（ADR-020）
                blank.append(f'{label} {db["round"]}: オーダーの印字が無い（不戦）ので入れない')
                continue
            if (m['scoreA'], m['scoreB']) != want:
                problems.append(f"{label}: 見出しの本数 {(m['scoreA'], m['scoreB'])} / details {want}")
            if len(m['subs']) != 3:
                problems.append(f'{label}: 対戦が {len(m["subs"])} 件（3件のはず）')
                continue  # 塊の切り出しが崩れている。ここから先は当てにならない

            subs = [to_detail(k, s, school[m['entryA']], school[m['entryB']], idx) for k, s in enumerate(m['subs'])]
            print(f"{label} {db['round']} {m['scoreA']}-{m['scoreB']}")
            for k, (s, raw) in enumerate(zip(subs, m['subs'])):
                counted = counted_games(raw['points'])
                if raw['inprogress']:
                    dropped.append(f'{label} 第{k + 1}対戦: 打ち切り時点で進行中のゲーム '
                                   f'{" ".join(raw["inprogress"])} を games に入れなかった')
                if s.pop('_derived'):
                    derived.append(f'{label} 第{k + 1}対戦: 本数の印字が無く、ゲームから {counted[0]}-{counted[1]} と数えた')
                elif s['status'] == 'not_played':
                    pass  # ゲームも本数も印字されない（ペアだけ）。数え直すものが無い
                elif counted != [s['scoreA'], s['scoreB']]:
                    problems.append(f'{label} 第{k + 1}対戦: 本数 {[s["scoreA"], s["scoreB"]]} / ゲームから数え直すと {counted}')
                for side, players in (('playersA', s['playersA']), ('playersB', s['playersB'])):
                    if len(players) != 2:
                        problems.append(f'{label} 第{k + 1}対戦: {side} が {len(players)} 人')
                    for p in players:
                        counts['記録あり' if 'lastName' in p else '名前だけ'] += 1
                        owner[p.get('name') or p['lastName'] + p['firstName']].add(m['entryA'] if side == 'playersA' else m['entryB'])
                counts[s['status']] += 1
                fmt = lambda ps: '・'.join(p.get('name') or p['lastName'] + p['firstName'] for p in ps)
                pts = ' '.join(f'{g[0]}-{g[1]}' for g in s['games'])
                print(f"    {s['type']} {s['status']:10} {fmt(s['playersA']):20} {s['scoreA']}-{s['scoreB']} {fmt(s['playersB']):20} | {pts}")
            wins = [sum(1 for s in subs if s['winner'] == side) for side in ('A', 'B')]
            if tuple(wins) != want:
                problems.append(f'{label}: 対戦の勝ち数 {tuple(wins)} / details {want}')
            if flip:
                subs = [dict(s, winner={'A': 'B', 'B': 'A'}.get(s['winner']), scoreA=s['scoreB'], scoreB=s['scoreA'],
                             playersA=s['playersB'], playersB=s['playersA'],
                             games=[[g[1], g[0]] for g in s['games']]) for s in subs]
            db['matches'] = subs

    clash = {p: sorted(school.get(n, n) for n in s) for p, s in owner.items() if len(s) > 1}
    allowed = {p: s for p, s in clash.items() if p in args.same_name}
    if len(clash) > len(allowed):
        rest = {p: v for p, v in clash.items() if p not in allowed}
        problems.append(f'2校に割り当てられた選手: {rest}（同名の別人と確かめたら --same-name で通す）')
    if blank:
        print('\n'.join(['\nオーダーの印字が無い試合（入れていない）:'] + blank))
    if derived:
        print('\n'.join(['\n本数の印字が無く、ゲームから数えた対戦:'] + derived))
    if dropped:
        print('\n'.join(['\n進行中のまま打ち切られたゲーム（ADR-020 に従い games に入れない）:'] + dropped))
    if allowed:
        print('\n同名の別人として通した選手（--same-name）:', allowed)
    print('\n対戦の状態:', {k: counts[k] for k in ('completed', 'unfinished', 'not_played')},
          '/ 選手（延べ）: 記録あり', counts['記録あり'], '名前だけ', counts['名前だけ'])

    if problems:
        print('\n'.join(['書き込みを中止:'] + problems), file=sys.stderr)
        sys.exit(1)
    if args.write:
        write_details(details_path, details)


if __name__ == '__main__':
    main()
