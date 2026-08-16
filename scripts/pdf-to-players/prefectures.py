"""47都道府県の略称→正式名称。SKILL.md「都道府県は正式名称に展開する」の実装。

辞書に無い値は勝手に直さず、呼び出し側が `prefecture_not_in_dict` として報告する。
列ズレやOCR誤認はここで顕在化させるのが狙いなので、曖昧一致は入れない。
"""

from __future__ import annotations

_BASE = [
    '北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島',
    '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川',
    '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知',
    '三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山',
    '鳥取', '島根', '岡山', '広島', '山口',
    '徳島', '香川', '愛媛', '高知',
    '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄',
]

_SUFFIX = {'北海道': '', '東京': '都', '大阪': '府', '京都': '府'}

# 略称 -> 正式名称
CANONICAL: dict[str, str] = {}
for _b in _BASE:
    _full = _b + _SUFFIX.get(_b, '県')
    CANONICAL[_b] = _full
    CANONICAL[_full] = _full

# 都道府県ではないが prefecture 欄に正当に入る値。
# 一般・学生カテゴリでは所属連盟が入るため（実データに `日本学連` 等が存在する）。
NON_PREFECTURE_OK = {'日本学連', '学連', '日本連盟', '中華台北', '韓国', '台湾'}


def normalize(raw: str | None) -> tuple[str | None, bool]:
    """(正式名称, 辞書に在ったか) を返す。辞書に無ければ原文をそのまま返す。"""
    if not raw:
        return None, False
    s = raw.strip().strip('()（）　 ')
    if not s:
        return None, False
    if s in CANONICAL:
        return CANONICAL[s], True
    if s in NON_PREFECTURE_OK:
        return s, True
    # 全中のドロー表は「近畿・滋賀県」のようにブロック名を前置きする。
    # ブロックは都道府県ではないので、後ろの県名だけを取る。
    if '・' in s:
        tail = s.split('・')[-1].strip()
        if tail in CANONICAL:
            return CANONICAL[tail], True
        if tail in NON_PREFECTURE_OK:
            return tail, True
    return s, False


def looks_like_prefecture(raw: str | None) -> bool:
    return normalize(raw)[1]
