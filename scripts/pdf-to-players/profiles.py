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
    # 氏名が1つの枠に入る様式か。均等割り付けの氏名は列検出でページごとに1〜3列へ
    # 割れ方が変わり、たまたま2列に割れたページだけ「姓と名の列」と誤読される。
    # 様式として分かっているなら、検出結果に関わらず氏名として扱い、
    # 姓名の境目は字間から決める（namesplit.py）。
    name_in_one_column: bool = False
    # 都道府県欄が無い様式で、代わりに入れる所属連盟名。一般・学生カテゴリでは
    # `prefecture` に `日本学連` のような連盟名が入るのが実データの慣習
    # （data/tournaments/details/zennihon-championship/*）。
    prefecture_default: str | None = None
    # tempId の末尾に prefecture を足すか。既定の tempId は 姓_名_学校 の3項目だが、
    # 実データには 姓_名_学校_都道府県 の4項目も416件ある。大会ごとにどちらか決まる。
    tempid_includes_prefecture: bool = False
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
        # `全日本学生` はシングルス選手権にも含まれるので署名にできない。
        # 男子は「三笠宮賜杯」、女子は「三笠宮妃賜杯」なので `三笠宮` で両方に当たる。
        signature=['三笠宮'],
        # エントリー番号が3桁になると数字が左へ伸び、氏名の左端との間が
        # 男子で6.2pt・女子で4.7ptしか空かない。gapがこれより大きいと番号が氏名の列に
        # 飲まれ、番号が「氏名」として拾われて件数が増える（男子p2以降・女子p3以降で
        # 実際に起きた）。氏名の列が細かく割れる副作用は name_in_one_column が吸収する。
        gap=4.0,
        y_tol=3.0,
        bracket_cut=True,
        category=None,  # 1ページ目が団体戦、3ページ目以降が個人戦なのでページごとに判定させる
        has_prefecture=False,
        splits_name=True,
        name_in_one_column=True,
        prefecture_default='日本学連',
        tempid_includes_prefecture=True,
        note=(
            'ブラケット表。**都道府県欄が無い**（所属は大学名）。'
            '氏名は1つの列に均等割り付けで入るが、割り付けは姓と名それぞれに掛かって'
            'いるため境目の字間だけが広い。そこを境目として割る（namesplit.py）。'
            '所属は括弧つきで、ペアの2行の間の行に置かれる。'
            'エントリー番号もペアの2行目に来る。'
            '都道府県の代わりに所属連盟「日本学連」を入れ、tempIdも4項目にする。'
        ),
    ),
    Profile(
        name='intercollegiate_singles',
        # ダブルス（三笠宮賜杯）とは別大会。1ページに2段組で、
        # 「番号 氏名(所属)」が1行に収まる。ブラケット表ではない。
        signature=['全日本学生シングルス'],
        gap=4.0,
        y_tol=3.0,
        bracket_cut=True,
        category='singles',
        has_prefecture=False,
        name_in_one_column=True,
        prefecture_default='日本学連',
        tempid_includes_prefecture=True,
        note=(
            '2段組の一覧。1行に「番号 氏名(所属)」が収まる（ブラケット表ではない）。'
            '**都道府県欄が無い**（所属は大学名）。氏名は1つの枠に均等割り付け。'
            '所属名が長いと括弧が空になり、**すぐ下の行に所属名だけが溢れて置かれる**'
            '（y_tol でその行を同じ行に取り込む）。'
            '都道府県の代わりに所属連盟「日本学連」を入れ、tempIdも4項目にする。'
        ),
    ),
    Profile(
        name='university_team',
        # 個人戦（三笠宮賜杯）とは別大会。同じ週に開かれるが様式も別で、
        # 署名を共有させると片方の設定がもう片方を壊す。
        signature=['文部科学大臣杯', '全日本大学対抗'],
        gap=6.0,
        y_tol=3.0,
        bracket_cut=False,
        category='team',
        has_prefecture=False,
        prefecture_default='日本学連',
        note=(
            'ブラケット表の団体戦。1行1チームで、**都道府県欄が無い**（大学名のみ）。'
            '個人戦と違い氏名が無いので姓名分割は関係しない。'
            '都道府県の代わりに所属連盟「日本学連」を入れる。'
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
