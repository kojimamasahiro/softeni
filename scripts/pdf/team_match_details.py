#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""団体戦の対戦ごとの記録（ADR-020）を details へ書き戻すときの共通部分。

様式ごとの読み取りは `highschool_senbatsu_team_matches.py` /
`highschool_championship_team_matches.py` が持ち、ここは**書き戻し方と選手の結び付け**だけ。
"""
from __future__ import annotations

import glob
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DETAILS_ROOT = ROOT / 'data' / 'tournaments' / 'details'

CIRCLED = {c: i for i, c in enumerate('⓪①②③④⑤⑥⑦⑧⑨')}
CIRCLED.update({c: i + 1 for i, c in enumerate('➀➁➂➃➄➅➆➇➈')})
# デュースが続くとポイントは10以上になる（インターハイで ⑩－8 を実測）
CIRCLED.update({c: i + 10 for i, c in enumerate('⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳')})


def score_of(tok):
    """'④' -> (4, True)（丸数字＝取った側） / '2' -> (2, False) / それ以外 -> None"""
    if tok in CIRCLED:
        return CIRCLED[tok], True
    if tok.isdigit():
        return int(tok), False
    return None


def key_of(name):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', name or ''))


def individual_index():
    """(氏名キー, 学校キー) -> (姓, 名)。個人戦の出場記録から作る"""
    idx = {}
    for f in glob.glob(str(DETAILS_ROOT / '**' / '*.json'), recursive=True):
        if not Path(f).name.startswith(('doubles', 'singles')):
            continue
        try:
            d = json.load(open(f, encoding='utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        if not isinstance(d, dict):
            continue
        for p in d.get('participants', []):
            ln, fn = (p.get('lastName') or '').strip(), (p.get('firstName') or '').strip()
            if ln and fn and p.get('team'):
                idx.setdefault((key_of(ln + fn), key_of(p['team'])), (ln, fn))
    return idx


def player_ref(name, school, idx):
    """個人戦の出場記録があれば姓・名、無ければ名前だけ（ADR-020）"""
    hit = idx.get((key_of(name), key_of(school)))
    return {'lastName': hit[0], 'firstName': hit[1]} if hit else {'name': name}


def _close_of(text, pos, opener):
    """pos の直後から、深さ1の opener が閉じる位置（閉じ括弧の添字）を返す。文字列の中は数えない"""
    closer = {'{': '}', '[': ']'}[opener]
    depth, i, in_str = 1, pos, False
    while i < len(text):
        c = text[i]
        if in_str:
            if c == '\\':
                i += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c in '{[':
            depth += 1
        elif c in '}]':
            depth -= 1
            if depth == 0:
                if c != closer:
                    sys.exit(f'括弧が合わない（{pos}）')
                return i
        i += 1
    sys.exit('閉じ括弧が見つからない')


def insert_sub_matches(text, details):
    """既存の整形を崩さないよう、各試合の末尾に "matches" だけを差し込む（再実行時は置き換える）。

    ファイル全体を json.dumps し直すと、Prettier が元の改行位置を手がかりに折り返しを
    決めるため、触っていない entries まで数千行の差分になる（実測 6,758 行）。
    """
    for m in details['matches']:
        if 'matches' not in m:
            continue
        key = '"matchId": ' + json.dumps(m['matchId'], ensure_ascii=False) + ','
        at = text.find(key)
        if at < 0:
            sys.exit(f'{m["matchId"]} の位置が見つからない')
        close = _close_of(text, at, '{')  # 試合オブジェクトの閉じ括弧
        body = text[at:close]
        old = re.search(r',\s*"matches": \[', body)
        if old:
            arr_close = _close_of(body, old.end(), '[')
            body = body[:old.start()] + body[arr_close + 1:]
        tail = re.search(r'\s*$', body)
        body = body[:tail.start()] + ',\n      "matches": ' + json.dumps(m['matches'], ensure_ascii=False) + body[tail.start():]
        text = text[:at] + body + text[close:]
    return text


def write_details(details_path: Path, details) -> None:
    details_path.write_text(insert_sub_matches(details_path.read_text(encoding='utf-8'), details), encoding='utf-8')
    print('wrote', details_path, '（整形は npx prettier --write で）')
