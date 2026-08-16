"""大会ごとの抽出プロファイル。

自動調整（tuning.py）は未知の様式に対する保険で、**既に分かっている大会**まで
毎回探索させる必要はない。分かっているものは分かっているものとして書いておく。

これは「共有ロジックに大会固有の語彙を継ぎ足す」やり方とは別物である:

  - 宣言的なデータで、他の様式のふるまいを一切変えない
  - 大会ごとに独立していて、増やしても既存が壊れない
  - どの大会にどの設定を使ったかが1か所を見れば分かる

新しい大会を登録する手順は README の「プロファイルの増やし方」を見ること。
自動判定に任せたいときは `--no-profile`。
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pdfplumber


@dataclass
class Profile:
    name: str
    # PDFの本文にこの文字列が含まれていたらこのプロファイルとみなす。
    # 大会名は表紙・各ページの見出しに必ず入るので、署名として使える。
    signature: list[str]
    gap: float = 6.0
    y_tol: float = 3.0
    bracket_cut: bool = False
    category: str | None = None  # 'doubles' / 'team' / None（ページごとに自動判定）
    roles: dict[int, str] = field(default_factory=dict)
    # 様式の性質。無いものを「要確認」に出さないための宣言。
    has_prefecture: bool = True   # 都道府県欄があるか
    splits_name: bool = True      # 姓と名が別々に書かれているか
    note: str = ''


PROFILES: list[Profile] = [
    Profile(
        name='zenchu',
        signature=['全国中学校ソフトテニス大会'],
        gap=6.0,
        y_tol=3.0,
        bracket_cut=False,
        category=None,  # 個人戦ページと団体戦ページが混在するので自動判定に任せる
        note=(
            'ブラケット表。氏名は姓と名が別スロット。所属と都道府県が同じ列に'
            '行ごとの交互（1行目に「近畿・滋賀県」、2行目に「朝桜中学校」）。'
            '下部に決勝進出ペアの再掲枠があり duplicate_players に出る。'
        ),
    ),
    Profile(
        name='intercollegiate',
        signature=['三笠宮賜杯', '全日本学生'],
        gap=9.0,
        y_tol=3.0,
        bracket_cut=True,
        category=None,  # 1ページ目が団体戦、3ページ目以降が個人戦なのでページごとに判定させる
        has_prefecture=False,
        splits_name=False,
        note=(
            'ブラケット表。**都道府県欄が無い**（所属は大学名）。'
            '氏名は均等割り付けで姓名の境目が座標に無いため分割しない（姓に氏名がまとめて入る）。'
            '所属は括弧つきで、ペアの2行の間の行に置かれる。'
            'エントリー番号もペアの2行目に来る。'
        ),
    ),
]


def page_text(pdf_path: str, page_num: int = 1, max_pages: int = 3) -> str:
    """署名を探すためのテキスト。先頭数ページだけ見れば足りる。"""
    out = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for p in pdf.pages[: max(max_pages, page_num)]:
                out.append(''.join(c['text'] for c in p.chars if c['text'].strip()))
    except Exception:
        return ''
    return '\n'.join(out)


def detect(pdf_path: str) -> Profile | None:
    """PDFの本文から大会を見分ける。見つからなければ None（自動調整に回す）。"""
    text = page_text(pdf_path)
    if not text:
        return None
    for prof in PROFILES:
        if any(sig in text for sig in prof.signature):
            return prof
    return None


def by_name(name: str) -> Profile | None:
    for prof in PROFILES:
        if prof.name == name:
            return prof
    return None


def names() -> list[str]:
    return [p.name for p in PROFILES]
