"""姓名が1列にまとまった様式で、姓と名の境目を決める。

三笠宮賜杯（インカレ）のドロー表は氏名を1つの枠に均等割り付けで書く。文字は等間隔に
並ぶので「姓と名は別々の列」という前提が通らず、これまでは分割せず姓に氏名をまとめて
入れていた。

ところが**均等割り付けは氏名全体にではなく、姓と名それぞれに掛かっている**。
だから境目の字間だけがわずかに広い。

    松尾奏汰  字間 [10.1, 18.2, 10.0] → 松尾|奏汰
    榎祐希人  字間 [14.6, 11.8, 11.8] → 榎|祐希人
    小田原晃太 字間 [5.5, 5.5, 13.6, 5.5] → 小田原|晃太

この差は 2.5pt 前後あり、同じ枠内の他の字間との差として十分に出る。実測（2026年
インカレ男子ダブルス 1170名）では 94% がこの信号で割れ、リポジトリの既存選手データ
23,812組と照合できた796名のうち **793名（99.6%）が一致**した。残る3件
（`西浩|太朗` `榎祐|希人` `西奏|音`）はいずれも既存データ側の誤りで、座標のほうが
正しかった。

信号が出ないのは、氏名全体が等間隔に置かれていて本当に境目が座標に無い行だけ
（1170名中43名）。そこはリポジトリの姓名コーパスと姓辞書に落とす。それでも決まらな
かったものは分割せず `firstName` を空のままにして `review_name_split` に出す。
**推測で埋めない。** 人が見れば一目で分かるものを、機械が黙って間違えるほうが害が大きい。
"""

from __future__ import annotations

import json
import os
import statistics
from collections import Counter
from dataclasses import dataclass, field
from functools import lru_cache

# 境目とみなすのに必要な「他の字間との差」。実測では信号のある行は 2.5pt 以上、
# 無い行は 0.1pt 以下にきれいに分かれるので、その谷間に置いている。
MIN_SIGNAL_PT = 1.5

_SEPARATORS = (' ', '　', '\xa0')


def split_by_geometry(char_boxes: list[tuple[float, float, str]]) -> tuple[str, str] | None:
    """文字の x 座標から姓名の境目を決める。決められなければ None。

    char_boxes は (x0, x1, 文字) の並び。空白文字は含まれていなくてよい
    （geometry.load_chars が落とす）。落とされた空白の跡はそのぶん広い字間として
    残るので、区切り文字を明示している様式もこの規則で拾える。
    """
    boxes = sorted((b for b in char_boxes if b[2] not in _SEPARATORS), key=lambda b: b[0])
    if len(boxes) < 3:
        # 2文字は 1+1 に割れるが、その根拠が字間からは得られない
        # （比較対象の字間が無い）。ここでは決めない。
        return None

    gaps = [boxes[i + 1][0] - boxes[i][1] for i in range(len(boxes) - 1)]
    widest = max(gaps)
    others = sorted(gaps)[:-1]
    if widest - statistics.median(others) < MIN_SIGNAL_PT:
        return None

    cut = gaps.index(widest) + 1
    text = ''.join(b[2] for b in boxes)
    return text[:cut], text[cut:]


@dataclass
class Corpus:
    """リポジトリの既存選手データから作った姓名の辞書。"""

    full: dict[str, set[tuple[str, str]]] = field(default_factory=dict)
    surnames: Counter = field(default_factory=Counter)
    givens: Counter = field(default_factory=Counter)
    # (氏名, 所属) → その割り方が何件あったか。同じ人が別の割り方で入っている
    # ことが実際にあるため、集合ではなく件数で持つ。
    by_team: dict[tuple[str, str], Counter] = field(default_factory=dict)


def _walk(node, out: list[tuple[str, str, str | None]]) -> None:
    if isinstance(node, dict):
        last, first, team = node.get('lastName'), node.get('firstName'), node.get('team')
        # `count: 0` は「正準化で使われなくなった綴り」。data/players/index.json には
        # 誤った割り方の行がこの形で残るので、辞書に入れると**誤りを正例として学習する**
        # （docs/raw/2026-08-29-name-split-audit.md）。実例として `西奏|音` が count 0 で
        # 残っており、混ぜると `西奏音` の割り方が2通りに見えて決められなくなる。
        if node.get('count') == 0:
            last = None
        if isinstance(last, str) and isinstance(first, str) and last and first:
            out.append((last, first, team if isinstance(team, str) and team else None))
        for v in node.values():
            _walk(v, out)
    elif isinstance(node, list):
        for v in node:
            _walk(v, out)


@lru_cache(maxsize=4)
def load_corpus(data_dir: str | None = None) -> Corpus:
    """リポジトリの既存選手データから姓名の対を集める。

    大会結果・選手ファイルに `lastName` / `firstName` が入っているので、それを
    そのまま辞書として使える。外部の姓名辞書を持ち込むより、この競技の実際の
    顔ぶれに当たる確率が高い。
    """
    root = data_dir or os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'data')
    rows: list[tuple[str, str, str | None]] = []
    for dirpath, _, files in os.walk(root):
        for name in files:
            if not name.endswith('.json'):
                continue
            try:
                with open(os.path.join(dirpath, name), encoding='utf-8') as fh:
                    _walk(json.load(fh), rows)
            except Exception:
                continue
    corpus = Corpus()
    for last, first, team in rows:
        corpus.full.setdefault(last + first, set()).add((last, first))
        corpus.surnames[last] += 1
        corpus.givens[first] += 1
        if team:
            corpus.by_team.setdefault((last + first, team), Counter())[(last, first)] += 1
    return corpus


def split_by_team_corpus(text: str, team: str | None, data_dir: str | None = None) -> tuple[str, str] | None:
    """同じ氏名・同じ所属の選手が既存データにいれば、その割り方に合わせる。

    姓名の対だけで引くと、同姓同名の別人や過去の誤った割り方に当たる。所属まで
    合えば同一人物とみなしてよく、**既存の `playerId` と結びつけるうえでも
    そちらに揃っているほうが正しい**。

    同じ人が複数の割り方で登録されていることが実際にある（過去のインカレ取り込みが
    `谷明|日里` `温品芽|叶子` のように誤って入れている）。その場合は件数の多いほうを
    採り、同数なら決めない。
    """
    if not team:
        return None
    counts = load_corpus(data_dir).by_team.get((text, team))
    if not counts:
        return None
    ranked = counts.most_common()
    if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
        return None
    return ranked[0][0]


def split_by_corpus(text: str, data_dir: str | None = None) -> tuple[str, str] | None:
    """既存データに同じ氏名があればその割り方を使う。割り方が割れていたら決めない。"""
    found = load_corpus(data_dir).full.get(text)
    if found and len(found) == 1:
        return next(iter(found))
    return None


def split_by_dictionary(text: str, data_dir: str | None = None) -> tuple[str, str] | None:
    """姓の辞書と名の辞書の両方に当たる切り方が1通りだけならそれを使う。

    2通り以上あるときは決めない。`山田太郎` は `山|田太郎` と `山田|太郎` の
    どちらも辞書に当たってしまうので、機械には決められない。
    """
    corpus = load_corpus(data_dir)
    hits = [
        (text[:i], text[i:])
        for i in range(1, len(text))
        if text[:i] in corpus.surnames and text[i:] in corpus.givens
    ]
    return hits[0] if len(hits) == 1 else None


def split_name(
    text: str,
    char_boxes: list[tuple[float, float, str]] | None = None,
    team: str | None = None,
    data_dir: str | None = None,
) -> tuple[str, str, str]:
    """姓・名・どの根拠で決めたか、を返す。決められなければ (氏名, '', 'unsplit')。

    確からしい順に試す。字間を先に見るのは、実測で既存データより正確だったため
    （不一致3件はすべて既存データ側の誤りだった）。
    """
    text = text.strip()
    if not text:
        return '', '', 'empty'
    if char_boxes:
        by_geometry = split_by_geometry(char_boxes)
        if by_geometry:
            return by_geometry[0], by_geometry[1], 'geometry'
    by_team = split_by_team_corpus(text, team, data_dir)
    if by_team:
        return by_team[0], by_team[1], 'team_corpus'
    for method, fn in (('corpus', split_by_corpus), ('dictionary', split_by_dictionary)):
        found = fn(text, data_dir)
        if found:
            return found[0], found[1], method
    return text, '', 'unsplit'
