#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""全日本高校選抜（JSTA 記録・Excel 様式）の団体戦PDF → 既存 details の各試合に対戦ごとの記録を足す。

既存の `data/tournaments/details/highschool-senbatsu/<年>/team-none-{boys,girls}.json` の
`matches[]` はそのままに、各試合へ `matches`（第1〜第3対戦のペアとゲーム数）を書き足す。
形は STリーグ（`data/st-league/<年>/matches.json`）の対戦に揃えている。仕様は
docs/adr/ADR-020-team-match-rubber-details.md。

## この様式の見極め（2022・2025 年度の男女4ページで検証）

- **テキストPDF。1ページ＝1種目**（p1 男子・p2 女子）。左半面にエントリー 1〜18、右半面に 19〜36。
- 試合ごとに「ペア・ペア 本数 － 本数 ペア・ペア」が**3行の塊**で印字される。
  **左のペア＝エントリー番号の小さい学校、右＝大きい学校**。丸数字（④）が取った側。
- 打ち切られた対戦も載る。**スコアが空欄＝未実施**、**丸数字の無い途中の本数（3-3 など）＝打ち切り**。
- 塊の位置: **両校とも初戦の試合は、2校のエントリー行のちょうど中間**に置かれる。
  3回戦以降は中間に来ない（準々決勝の塊が別の2回戦の中間と偶然重なることがある）。
  決勝の塊はページ下の中央。
- トーナメント線の横に**学校単位の本数**（「東北 1 － ② 高田商」）が同じ「－」で印字される。
  「・」が無い行は対戦ではないので捨てる。名前の行に紛れ込む数字も捨てる。
- **年度によって1文字ずつ別の語になる**（2022 女子）。同じ行で間隔 4.5pt 未満の1文字の語をつなぐ
  （名前の中の字間は約3pt、姓と名の間は約7pt）。

## 塊と試合の対応

1. 両校とも初戦の試合: 2校の行の中間 ±4pt にある、同じ半面の塊が1つだけなら決める。
2. それ以外: 左の選手が a 校の、右の選手が b 校の**これまでの試合の選手と重なる**塊を選ぶ。
   同点なら勝敗の一致、次に位置の近さ。半面をまたぐ試合（決勝）はページ中央の塊だけを見る。
3. 検算: 塊の勝ち数が既存の本数と一致すること／同じ選手が2校に割り当てられないこと。
   どちらかが崩れたら書き込まない（`--write` しても止まる）。

## 選手

同じ氏名・同じ学校の**個人戦の出場記録**（details の participants）があれば姓と名で持つ
（`{"lastName", "firstName"}`）。無ければ**名前だけ**持つ（`{"name"}`。PDFで姓と名が
離れていれば半角スペース1つで区切る）。名前だけの選手は participants に足さない
（足すと選手一覧で新しい選手として採番されるため）。

## 使い方

    python3 scripts/pdf/highschool_senbatsu_team_matches.py PDF --page 1 \
        --details data/tournaments/details/highschool-senbatsu/2025/team-none-boys.json [--write]

`--write` が無ければ差分を表示するだけ。

`--corrections`（任意）で**勝者の丸数字が抜けている対戦**を補正できる。勝った側が
出典の別の場所（学校単位の本数）で決まるものだけ、理由つきで足す
（`highschool-senbatsu-2024-corrections.json`）。印字が補正の前提と違えば止まる。

`--zero-as-not-played`（任意）は、**未実施の対戦を空欄でなく `0 － 0` と印字する出典**のため
（2021 女子。同じ PDF の男子ページは空欄で、7件ずつちょうど対応する）。
**他の2対戦だけで既に決着している試合の `0 － 0`** だけを未実施に倒し、
そうでない `0 － 0`（本当の打ち切り）が1つでもあれば止まる。変換した対戦は毎回表示する。
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

PREFS = ('北海道 青森 岩手 宮城 秋田 山形 福島 茨城 栃木 群馬 埼玉 千葉 東京 神奈川 新潟 富山 石川 福井 山梨 '
         '長野 岐阜 静岡 愛知 三重 滋賀 京都 大阪 兵庫 奈良 和歌山 鳥取 島根 岡山 広島 山口 徳島 香川 愛媛 '
         '高知 福岡 佐賀 長崎 熊本 大分 宮崎 鹿児島 沖縄').split()
SPECIAL = set('・･－()（）')
DOUBLES_TYPES = ['D1', 'D2', 'D3']
POS_TOL = 4.0
MERGE_GAP = 4.5


def read_words(pdf, page):
    html = subprocess.run(['pdftotext', '-bbox', '-f', str(page), '-l', str(page), pdf, '-'],
                          capture_output=True, text=True, check=True).stdout
    width = float(re.search(r'<page width="([\d.]+)"', html).group(1))
    ws = [dict(x0=float(a), y0=float(b), x1=float(c), y1=float(d), t=e)
          for a, b, c, d, e in re.findall(
              r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', html)]
    return width, merge_chars(ws)


def merge_chars(ws):
    def single(w):
        return len(w['t']) == 1 and w['t'] not in SPECIAL and score_of(w['t']) is None

    out = []
    for w in sorted(ws, key=lambda w: (round(w['y0'], 1), w['x0'])):
        p = out[-1] if out else None
        if (p and p['_single'] and single(w) and abs(p['y0'] - w['y0']) < 0.3
                and 0 <= w['x0'] - p['x1'] < MERGE_GAP):
            p['t'] += w['t']
            p['x1'] = w['x1']
            continue
        w = dict(w, _single=single(w))
        out.append(w)
    return out


def cy(w):
    return (w['y0'] + w['y1']) / 2


def entry_rows(ws, width):
    """エントリー番号の行: 左端か右端の数字で、同じ行に都道府県名があるもの"""
    rows = {}
    for w in ws:
        if not w['t'].isdigit() or not (w['x0'] < 45 or w['x0'] > width - 60):
            continue
        same = [v['t'] for v in ws if v is not w and abs(v['y0'] - w['y0']) < 1]
        if any(p in same for p in PREFS):
            rows[int(w['t'])] = cy(w)
    return rows


def pair_names(tokens):
    """['錦見', '琉生', '・', '伊藤', '陽聖'] -> ['錦見 琉生', '伊藤 陽聖']"""
    parts, cur = [], []
    for t in tokens:
        if t['t'] in '・･':
            parts.append(cur)
            cur = []
        elif score_of(t['t']) is None:
            cur.append(t['t'])
    parts.append(cur)
    return [unicodedata.normalize('NFKC', ' '.join(p)) for p in parts if p]


def read_rubbers(ws):
    dashes = [w for w in ws if w['t'] == '－']
    segs = defaultdict(list)
    for w in ws:
        if w['t'] == '－':
            continue
        cands = [d for d in dashes if abs(cy(d) - cy(w)) < 1.6]
        if not cands:
            continue
        mx = (w['x0'] + w['x1']) / 2
        d = min(cands, key=lambda d: abs((d['x0'] + d['x1']) / 2 - mx))
        if abs((d['x0'] + d['x1']) / 2 - mx) <= 110:
            segs[id(d)].append(w)
    out = []
    for d in dashes:
        left = sorted([w for w in segs[id(d)] if w['x1'] <= d['x0'] + 0.5], key=lambda w: w['x0'])
        right = sorted([w for w in segs[id(d)] if w['x0'] >= d['x1'] - 0.5], key=lambda w: w['x0'])
        if not any(w['t'] in '・･' for w in left + right):
            continue  # 学校単位の本数の行
        ls = score_of(left[-1]['t']) if left else None
        rs = score_of(right[0]['t']) if right else None
        out.append(dict(x=(d['x0'] + d['x1']) / 2, y=cy(d),
                        left=pair_names(left[:-1] if ls else left),
                        right=pair_names(right[1:] if rs else right), ls=ls, rs=rs))
    return out


def group_blocks(rubbers):
    out, cur = [], []
    for r in sorted(rubbers, key=lambda r: (round(r['x']), r['y'])):
        if cur and (abs(cur[-1]['x'] - r['x']) > 1 or r['y'] - cur[-1]['y'] > 7):
            out.append(cur)
            cur = []
        cur.append(r)
    if cur:
        out.append(cur)
    return out


def apply_rubber_fixes(details, blocks, chosen, fixes, stem):
    """勝者の丸数字が抜けている対戦に、丸を補う（`--corrections` の `rubbers`）。

    当てる値が出典の別の場所で決まるものだけを足す。印字が補正の前提
    （本数の組と、どちらにも丸が無いこと）と違えば止まる。
    """
    mine = [f for f in fixes if f['key'].split('|')[0] == stem]
    used, notes = set(), []
    for m in details['matches']:
        i = chosen.get(m['matchId'])
        for f in mine:
            if i is None or f['key'] != f'{stem}|{m["matchId"]}':
                continue
            used.add(f['key'])
            r = blocks[i][f['rubber']]
            printed = [r['ls'][0] if r['ls'] else None, r['rs'][0] if r['rs'] else None]
            circled = bool((r['ls'] and r['ls'][1]) or (r['rs'] and r['rs'][1]))
            if printed != f['printed'] or circled:
                sys.exit(f'{f["key"]} 第{f["rubber"] + 1}対戦: 印字が補正の前提と違う（{printed} 丸 {circled}）')
            side = 'ls' if f['winner'] == 'A' else 'rs'
            r[side] = (r[side][0], True)
            notes.append(f'    {f["key"]} 第{f["rubber"] + 1}対戦 {printed[0]} － {printed[1]}'
                         f' → {f["winner"]} の勝ち: {f["why"]}')
    unused = [f['key'] for f in mine if f['key'] not in used]
    if unused:
        sys.exit(f'当てはまらない補正: {unused}')
    return notes


def zero_to_not_played(details, blocks, chosen, school):
    """未実施を `0 － 0` と印字する出典のため、決着済みの試合の `0 － 0` だけを未実施に倒す。

    ADR-020 の `unfinished` は「打ち切り時点の途中の本数」なので、1ゲームも行われていない
    `0 － 0` は本来 `not_played`。ただし**本当に 0-0 で打ち切られた対戦**と区別できないと
    記録を消してしまうので、**他の2対戦だけで勝敗が付いている試合**に限る。
    """
    notes, risky = [], []
    for m in details['matches']:
        i = chosen.get(m['matchId'])
        if i is None:
            continue
        blk = blocks[i]
        zeros = [k for k, r in enumerate(blk)
                 if r['ls'] and r['rs'] and r['ls'][0] == 0 and r['rs'][0] == 0
                 and not r['ls'][1] and not r['rs'][1]]
        if not zeros:
            continue
        decided = max(wins([r for k, r in enumerate(blk) if k not in zeros])) > len(blk) // 2
        for k in zeros:
            where = f'{m["matchId"]} {school[m["entries"][0]]} 対 {school[m["entries"][1]]} 第{k + 1}対戦'
            if not decided:
                risky.append(where)
                continue
            blk[k]['ls'] = blk[k]['rs'] = None
            notes.append('    ' + where)
    if risky:
        sys.exit('\n'.join(['決着していない試合の `0 － 0` は未実施に倒せない（本当の打ち切りかもしれない）:'] + risky))
    return notes


def wins(blk):
    return (sum(1 for r in blk if r['ls'] and r['ls'][1]), sum(1 for r in blk if r['rs'] and r['rs'][1]))


def players_of(blk, side):
    return {key_of(p) for r in blk for p in r[side]}


def assign(details, rows, blocks, width):
    n_entries = len(details['entries'])
    half = lambda n: 'L' if n <= n_entries // 2 else 'R'
    center = lambda blk: sum(r['y'] for r in blk) / len(blk)
    in_half = lambda blk, h: (blk[0]['x'] < width / 2) == (h == 'L')

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

    for m in details['matches']:
        a, b = m['entries']
        if m['matchId'] not in first or half(a) != half(b):
            continue
        ey = (rows[a] + rows[b]) / 2
        near = [i for i, blk in enumerate(blocks)
                if i not in used and len(blk) == 3 and in_half(blk, half(a)) and abs(center(blk) - ey) <= POS_TOL]
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
            if half(a) == half(b):
                if not in_half(blk, half(a)):
                    continue
            elif abs(blk[0]['x'] - width / 2) > 20:
                continue
            la, rb = players_of(blk, 'left'), players_of(blk, 'right')
            overlap = len(la & roster[a]) + len(rb & roster[b]) - 2 * (len(la & roster[b]) + len(rb & roster[a]))
            k = (overlap, wins(blk) == want, -abs(center(blk) - ey))
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
    ap.add_argument('--page', type=int, required=True)
    ap.add_argument('--details', required=True)
    ap.add_argument('--corrections', help='勝者の丸数字が抜けている対戦を補正する JSON（任意）')
    ap.add_argument('--zero-as-not-played', action='store_true',
                    help='未実施を `0 － 0` と印字する出典（2021 女子）。決着済みの試合のものだけ倒す')
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    details_path = Path(args.details)
    details = json.load(open(details_path, encoding='utf-8'))
    width, ws = read_words(args.pdf, args.page)
    rows = entry_rows(ws, width)
    blocks = group_blocks(read_rubbers(ws))
    school = {e['entryNo']: e['playerIds'][0].split('_')[0] for e in details['entries']}

    errors = []
    if len(rows) != len(details['entries']):
        errors.append(f'エントリー行 {len(rows)} 件 / details {len(details["entries"])} 件')
    if len(blocks) != len(details['matches']) or any(len(b) != 3 for b in blocks):
        errors.append(f'塊 {len(blocks)} 件（3行でないもの {sum(len(b) != 3 for b in blocks)}）/ 試合 {len(details["matches"])} 件')
    if errors:
        sys.exit('\n'.join(errors))

    chosen = assign(details, rows, blocks, width)
    fixed = []
    if args.corrections:
        fixes = json.loads(Path(args.corrections).read_text(encoding='utf-8'))['rubbers']
        fixed = apply_rubber_fixes(details, blocks, chosen, fixes, details_path.stem)
    zeroed = zero_to_not_played(details, blocks, chosen, school) if args.zero_as_not_played else []
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
            print(f'    {s["type"]} {s["status"]:10} {fmt(s["playersA"]):22} {s["scoreA"]!s:>4}-{s["scoreB"]!s:<4} {fmt(s["playersB"])}')
            for p in s['playersA'] + s['playersB']:
                counts['linked' if 'lastName' in p else 'name_only'] += 1
    if fixed:
        print('\n'.join(['出典の丸数字の抜けとして補正した対戦（--corrections）:'] + fixed))
    if zeroed:
        print('\n'.join(['`0 － 0` を未実施として扱った対戦（--zero-as-not-played）:'] + zeroed))
    print('対戦の状態:', {k: counts[k] for k in ('completed', 'unfinished', 'not_played')},
          '/ 選手（延べ）: 記録あり', counts['linked'], '名前だけ', counts['name_only'], '（* は記録あり）')

    if errors:
        print('\n'.join(['書き込みを中止:'] + errors), file=sys.stderr)
        sys.exit(1)
    if args.write:
        write_details(details_path, details)


if __name__ == '__main__':
    main()
