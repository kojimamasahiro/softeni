#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""score 機能で記録した団体戦の対戦を、details の団体戦の試合へオーダー（ADR-020 の matches）として書き戻す。

    python3 scripts/score-team-matches.py            # 下書き（何を書くか・飛ばす理由を表示）
    python3 scripts/score-team-matches.py --write    # 書き込み（整形は npx prettier --write で）

元は score の公開スナップショット（public/data/beta-matches/matches/*.json）。先に
`node scripts/generate-beta-matches-json.mjs` で Supabase から更新しておく。

決まり（ADR-023）:
- 対象は tournament_category='team'・team_rubber_order あり・siteLink ありの試合。完了（completed）だけを使う
- 第1対戦から欠けずに並び、勝ち数が親の scores と一致した試合だけを書く（揃うまで書かない）
- 既に matches を持つ試合は上書きしない（同じなら何もしない、違えば止める。--replace で置き換え）
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts' / 'pdf'))
from team_match_details import DETAILS_ROOT, individual_index, player_ref, write_details  # noqa: E402

SNAPSHOT_DIR = ROOT / 'public' / 'data' / 'beta-matches' / 'matches'


def load_rubbers(snapshot_dir):
    rubbers = []
    for f in sorted(snapshot_dir.glob('*.json')):
        m = json.loads(f.read_text(encoding='utf-8')).get('match') or {}
        if m.get('tournament_category') != 'team' or not m.get('team_rubber_order'):
            continue
        rubbers.append(m)
    return rubbers


def details_path_of(tournament_path):
    # /tournaments/{generation}/{tournamentId}/{year}/{gameCategory}/{age}/{gender}
    parts = tournament_path.strip('/').split('/')
    if len(parts) != 7:
        return None
    _, _, tid, year, cat, age, gender = parts
    return DETAILS_ROOT / tid / year / f'{cat}-{age}-{gender}.json'


def side_players(m, side, idx):
    players = []
    for n in (1, 2):
        ln = (m.get(f'team_{side}_player{n}_last_name') or '').strip()
        fn = (m.get(f'team_{side}_player{n}_first_name') or '').strip()
        team = (m.get(f'team_{side}_player{n}_team_name') or '').strip()
        if not ln and not fn:
            continue
        players.append(player_ref(f'{ln} {fn}'.strip(), team, idx))
    return players


def to_rubber(m, flip, idx, warnings):
    """score の1試合 -> TeamMatchDetail。flip なら score の B が親の entries[0]（A）"""
    label = f'{m.get("round_name") or ""} 第{m["team_rubber_order"]}対戦（{m["id"]}）'
    games = []
    wins = {'A': 0, 'B': 0}
    for g in sorted(m.get('games') or [], key=lambda g: g.get('game_number') or 0):
        w = g.get('winner_team')
        if w not in ('A', 'B'):
            continue  # 決着していないゲームは持たない（ADR-020）
        pa, pb = g.get('points_a') or 0, g.get('points_b') or 0
        if (w == 'A') != (pa > pb):
            warnings.append(f'{label}: 第{g.get("game_number")}ゲームの勝者 {w} とポイント {pa}-{pb} が合わない')
        if flip:
            w, pa, pb = ('B' if w == 'A' else 'A'), pb, pa
        wins[w] += 1
        games.append([pa, pb])
    if wins['A'] == wins['B']:
        return None, f'{label}: 取ったゲーム数が同じ（{wins["A"]}-{wins["B"]}）で勝者が決まらない'
    need = (m.get('best_of') or 7) // 2 + 1
    if max(wins.values()) != need:
        warnings.append(f'{label}: 勝者のゲーム数 {max(wins.values())} が {m.get("best_of")}ゲームマッチの {need} と違う')
    a, b = ('b', 'a') if flip else ('a', 'b')
    return {
        'type': f'D{m["team_rubber_order"]}',
        'status': 'completed',
        'winner': 'A' if wins['A'] > wins['B'] else 'B',
        'scoreA': wins['A'],
        'scoreB': wins['B'],
        'playersA': side_players(m, a, idx),
        'playersB': side_players(m, b, idx),
        'games': games,
    }, None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--write', action='store_true', help='details に書き込む（無ければ下書きの表示だけ）')
    ap.add_argument('--replace', action='store_true', help='既に matches を持つ試合も置き換える')
    ap.add_argument('--snapshot', type=Path, default=SNAPSHOT_DIR, help='score のスナップショットの置き場所（検証用）')
    args = ap.parse_args()

    groups = defaultdict(list)
    skipped = []
    for m in load_rubbers(args.snapshot):
        link = m.get('siteLink') or {}
        if not link.get('tournamentPath') or len(link.get('entryNos') or []) != 2:
            skipped.append(f'{m["id"]}: 大会に紐付いていない（siteLink なし）')
            continue
        if m.get('status') != 'completed':
            skipped.append(f'{m.get("round_name") or ""} 第{m["team_rubber_order"]}対戦（{m["id"]}）: 記録が完了していない（{m.get("status")}）')
            continue
        groups[(link['tournamentPath'], frozenset(link['entryNos']))].append(m)

    idx = individual_index()
    warnings, errors, changed = [], [], defaultdict(list)
    details_cache = {}

    for (tpath, entry_set), rubbers in sorted(groups.items(), key=lambda kv: kv[0][0]):
        dpath = details_path_of(tpath)
        if not dpath or not dpath.exists():
            errors.append(f'{tpath}: details が見つからない')
            continue
        details = details_cache.setdefault(dpath, json.loads(dpath.read_text(encoding='utf-8')))
        parents = [x for x in details['matches'] if set(x.get('entries') or []) == set(entry_set)]
        if len(parents) != 1:
            errors.append(f'{dpath.relative_to(ROOT)}: エントリー {sorted(entry_set)} の試合が {len(parents)} 件')
            continue
        parent = parents[0]
        head = f'{dpath.relative_to(ROOT)} {parent["matchId"]}（{parent.get("round")}・{"/".join(map(str, parent["entries"]))}）'

        orders = sorted(r['team_rubber_order'] for r in rubbers)
        if len(set(orders)) != len(orders):
            errors.append(f'{head}: 同じ対戦が2件ある（{orders}）')
            continue
        if orders != list(range(1, len(orders) + 1)):
            skipped.append(f'{head}: 対戦が欠けている（記録済み {orders}）')
            continue

        built = []
        for r in sorted(rubbers, key=lambda r: r['team_rubber_order']):
            flip = str(r.get('team_a_entry_number') or '').strip() == str(parent['entries'][1])
            if not flip and str(r.get('team_a_entry_number') or '').strip() != str(parent['entries'][0]):
                errors.append(f'{head}: 第{r["team_rubber_order"]}対戦のエントリー番号 {r.get("team_a_entry_number")} が親と合わない')
                break
            rubber, err = to_rubber(r, flip, idx, warnings)
            if err:
                errors.append(f'{head}: {err}')
                break
            built.append(rubber)
        else:
            won_a = sum(1 for x in built if x['winner'] == 'A')
            won_b = sum(1 for x in built if x['winner'] == 'B')
            want_a = parent['scores'].get(str(parent['entries'][0]))
            want_b = parent['scores'].get(str(parent['entries'][1]))
            if (won_a, won_b) != (want_a, want_b):
                skipped.append(f'{head}: 勝ち数 {won_a}-{won_b} が親の本数 {want_a}-{want_b} と合わない（揃うまで書かない）')
                continue
            if 'matches' in parent:
                if parent['matches'] == built:
                    print(f'変更なし  {head}')
                    continue
                if not args.replace:
                    errors.append(f'{head}: 既に matches があり中身が違う（置き換えるなら --replace）')
                    continue
            print(f'書き込む  {head}')
            for x in built:
                names = lambda ps: '・'.join(p.get('name') or f'{p["lastName"]} {p["firstName"]}' for p in ps)  # noqa: E731
                linked = sum(1 for p in x['playersA'] + x['playersB'] if 'lastName' in p)
                print(f'  {x["type"]} {names(x["playersA"])} {x["scoreA"]}-{x["scoreB"]} {names(x["playersB"])}'
                      f'  games={x["games"]}  姓名で結び付いた選手 {linked}/{len(x["playersA"]) + len(x["playersB"])}')
            changed[dpath].append({**parent, 'matches': built})

    for s in skipped:
        print(f'飛ばす    {s}')
    for w in warnings:
        print(f'注意      {w}')
    for e in errors:
        print(f'エラー    {e}', file=sys.stderr)
    if errors:
        sys.exit(1)

    if not changed:
        print('書き込む試合はありません')
        return
    if not args.write:
        print('（下書き。書き込むには --write）')
        return
    for dpath, matches in changed.items():
        write_details(dpath, {'matches': matches})


if __name__ == '__main__':
    main()
