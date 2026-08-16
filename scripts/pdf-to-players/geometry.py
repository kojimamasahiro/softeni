"""PDFの文字座標から「行 × 列」の表を復元する（決定的・LLM不使用）。

ドロー表は2段組の表で、素朴なテキスト抽出だと順序が崩れる。
そこで文字のx/y座標から行と列を組み立て直す。

このモジュールは既存の scripts/pdf/ の資産から要点だけを取り出して汎用化したもの:
  - 左右分割と列検出の考え方は scripts/pdf/calibrate.py（中央の空白帯・文字占有幅から検出）
  - フォントサイズに応じて行の許容誤差を変える処理は scripts/pdf/master.py
    （小さい文字が混ざる欄でY座標がずれ、同じ行が2行に割れるのを防ぐため）

master.py と違い、座標をモジュール定数で持たない。すべて検出値か引数で渡す。
大会ごとにソースを書き換える運用にしないため。
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pdfplumber

# これより小さい文字は、同じ行でもY座標が上下にぶれる（ルビ・注記・小さい所属名など）。
SMALL_SIZE_THRESHOLD = 6.5


@dataclass
class Column:
    """検出した列。x範囲と、そこに入っていた文字のサンプル。"""

    index: int
    x0: float
    x1: float
    side: str  # 'left' / 'right'
    samples: list[str] = field(default_factory=list)
    in_brackets: bool = False  # 括弧の内側にある列か（＝氏名ではなく属性）

    @property
    def width(self) -> float:
        return self.x1 - self.x0


@dataclass
class Row:
    """検出した行。列indexごとのセル文字列を持つ。"""

    top: float
    side: str
    cells: dict[int, str]
    page: int = 0

    def text(self) -> str:
        return ''.join(self.cells[k] for k in sorted(self.cells))


def load_chars(pdf_path: str, page_num: int) -> list[dict]:
    """1ページぶんの文字を座標つきで読む。空白文字は落とす。"""
    with pdfplumber.open(pdf_path) as pdf:
        if page_num < 1 or page_num > len(pdf.pages):
            raise IndexError(f'ページ {page_num} は存在しません（全 {len(pdf.pages)} ページ）')
        page = pdf.pages[page_num - 1]
        chars = [
            {'text': c['text'], 'x0': c['x0'], 'x1': c['x1'], 'top': c['top'], 'size': c.get('size', 0)}
            for c in page.chars
            if c['text'].strip()
        ]
        return chars


def page_count(pdf_path: str) -> int:
    with pdfplumber.open(pdf_path) as pdf:
        return len(pdf.pages)


def has_text_layer(pdf_path: str) -> bool:
    """テキスト層があるか。無ければ画像/スキャンPDFなのでOCR経路に回す必要がある。"""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages[:3]:
                if any(c['text'].strip() for c in page.chars):
                    return True
    except Exception:
        return False
    return False


def body_chars(chars: list[dict]) -> list[dict]:
    """見出しの大きい字を落として「表の本文」だけを返す。

    大会名の見出しは本文より大きい字でページを横断して書かれているため、
    そのまま座標を測ると本文側の空白帯が見出しで埋まり、列も左右の境目も見失う。
    全中2024のドロー表で実際に起きた: 正しい左右の境目 x≈256 に対し x≈380 を選び、
    さらに姓・名・所属の3列が1列に融合していた。
    """
    sizes = [round(c['size'], 1) for c in chars if c['size']]
    if not sizes:
        return chars
    modal = max(set(sizes), key=sizes.count)

    # 「本文より大きい」だけを条件にすると、表の中で使われている大きめの字まで落ちる。
    # 全中2024の女子団体戦ページはチーム名が12.7pt・都道府県が8.2ptで、
    # 最頻の1.5倍という条件だとチーム名が丸ごと消えて所属が空になっていた。
    # 見出しは**大きく、かつ全体のごく一部**という点で表の中身と区別できる。
    drop = {
        s
        for s in set(sizes)
        if s > modal * 1.3 and sizes.count(s) < len(sizes) * 0.1
    }
    if not drop:
        return chars
    body = [c for c in chars if round(c['size'], 1) not in drop]
    return body if len(body) >= len(chars) * 0.5 else chars


def _split_by_row_vote(chars: list[dict], min_share: float = 0.9) -> float | None:
    """行ごとに空いている縦位置を数え、最も多くの行が空けている x を左右の境目とする。

    ページ中央付近だけを候補にする。表の外側の余白は当然どの行も空いているため。
    """
    if len(chars) < 20:
        return None
    rows: dict[float, list[tuple[float, float]]] = {}
    for c in chars:
        rows.setdefault(round(c['top'] / 3), []).append((c['x0'], c['x1']))
    if len(rows) < 5:
        return None

    x0 = min(c['x0'] for c in chars)
    x1 = max(c['x1'] for c in chars)
    lo, hi = x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.7

    counts: list[tuple[float, int]] = []
    x = lo
    while x <= hi:
        counts.append((x, sum(1 for spans in rows.values() if not any(a <= x <= b for a, b in spans))))
        x += 1.0
    if not counts:
        return None

    # 「ほぼ全部の行が空けている」帯を集め、そのうち**いちばん幅の広い帯**を境目にする。
    # 完全に空いている帯だけを見ると、たまたま1行も文字が無いだけの狭い隙間を選んでしまう
    # （全中2024の個人戦ページでは、氏名の文字と文字の間の14pt を境目に選び、
    # 右段の氏名を途中で切っていた）。幅は「本当の区切り」を示す良い指標になる。
    threshold = len(rows) * min_share
    runs: list[list[float]] = []
    for x, c in counts:
        if c >= threshold:
            if runs and x - runs[-1][1] <= 1.5:
                runs[-1][1] = x
            else:
                runs.append([x, x])
    if not runs:
        return None
    widest = max(runs, key=lambda r: r[1] - r[0])
    if widest[1] - widest[0] < 8:
        return None
    return (widest[0] + widest[1]) / 2


def detect_side_split(chars: list[dict], min_gap: float = 15.0) -> float | None:
    """左右2段組の分割位置を、ページ中央付近の最も広い空白帯から求める。

    1段組のPDFでは空白帯が見つからず None を返す。呼び出し側は全体を1側として扱う。
    """
    if not chars:
        return None

    # まず「行ごとの投票」で探す。大半の行に共通して空いている縦線が左右の境目のはず、
    # という考え方。見出しの行がページを横断していても、1行ぶんの反対票にしかならないので
    # 結論が変わらない。全中2024の団体戦ページは見出しが本文と同じ字の大きさで、
    # 大きさで見出しを外す方法が効かず、この方法でだけ境目が出た。
    voted = _split_by_row_vote(chars)
    if voted is not None:
        return voted

    xs = sorted((c['x0'], c['x1']) for c in body_chars(chars))
    page_x0 = min(x0 for x0, _ in xs)
    page_x1 = max(x1 for _, x1 in xs)
    center = (page_x0 + page_x1) / 2

    # x方向の被覆区間をマージして、隙間を列挙する
    merged: list[list[float]] = []
    for x0, x1 in xs:
        if merged and x0 <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], x1)
        else:
            merged.append([x0, x1])

    best = None
    for a, b in zip(merged, merged[1:]):
        gap_x0, gap_x1 = a[1], b[0]
        if gap_x1 - gap_x0 < min_gap:
            continue
        mid = (gap_x0 + gap_x1) / 2
        # 中央にいちばん近い広い隙間を採用する。端の余白を誤って選ばないため。
        dist = abs(mid - center)
        if dist > (page_x1 - page_x0) * 0.25:
            continue
        if best is None or dist < best[0]:
            best = (dist, mid)
    return best[1] if best else None


def detect_columns(chars: list[dict], side: str, gap: float = 6.0, min_row_share: float = 0.04, bracket_cut: bool = False) -> list[Column]:
    """列を「その縦位置に文字を置いている行がどれだけ多いか」で検出する。

    単純に文字の占有幅を union すると、**1行あるだけで列が融合する**。
    見出しの行はページを横断して書かれているので、これに必ず引っかかる
    （全中2024の団体戦ページでは見出しが本文と同じ字の大きさで、
    大きさによる除外も効かず、右段の5列ぶんが1列に潰れていた）。

    行単位で数えれば、見出しは1票にしかならず列を融合させない。
    gap 未満しか離れていない run は同じ列に併合する（氏名の文字送りを割らないため）。
    """
    if not chars:
        return []

    rows: dict[float, list[tuple[float, float]]] = {}
    for c in chars:
        rows.setdefault(round(c['top'] / 3), []).append((c['x0'], c['x1']))
    if not rows:
        return []

    lo = int(min(c['x0'] for c in chars))
    hi = int(max(c['x1'] for c in chars)) + 1
    threshold = max(2, len(rows) * min_row_share)

    # 括弧は「ここから別の情報が始まる」ことを示す構造的な区切り記号。
    # 語彙ではないので、様式が変わっても意味が変わらない。
    # 括弧の位置で列を必ず切る。これをしないと、氏名の帯と括弧内の所属の帯が
    # 隙間の広さでは分けられず融合する（氏名が均等割り付けの様式で起きる。
    # 文字間の隙間と、帯と帯の隙間が同じくらいになるため）。
    # ただし常に切ればよいわけではない。括弧が本文中に散発的に出るだけの様式では
    # 余計な列が生まれる（全中の団体戦ページで25→29チームに増えた）。
    # 切るか切らないかは決め打ちせず、**採点に選ばせる**（tuning.py の総当たり）。
    cut: set[int] = set()
    if bracket_cut:
        for c in chars:
            if c['text'] in '（）()':
                for x in range(int(c['x0']), int(c['x1']) + 1):
                    cut.add(x)

    active: list[int] = []
    for x in range(lo, hi + 1):
        if x in cut:
            continue
        count = sum(1 for spans in rows.values() if any(a <= x <= b for a, b in spans))
        if count >= threshold:
            active.append(x)
    if not active:
        return []

    merged: list[list[float]] = []
    for x in active:
        crossed_cut = merged and any(v in cut for v in range(int(merged[-1][1]) + 1, x))
        if merged and x - merged[-1][1] <= gap and not crossed_cut:
            merged[-1][1] = float(x)
        else:
            merged.append([float(x), float(x)])

    columns = [Column(index=i, x0=a, x1=b, side=side) for i, (a, b) in enumerate(merged)]

    # 括弧の内側に入る列に印を付ける。括弧の中身は氏名ではなく、
    # そのエントリーの属性（所属・都道府県）である、という構造的な約束。
    # これも語彙ではないので様式が変わっても意味が変わらない。
    spans: list[tuple[float, float]] = []
    by_row: dict[float, list[dict]] = {}
    for c in chars:
        if c['text'] in '（）()':
            by_row.setdefault(round(c['top'] / 3), []).append(c)
    for cs in by_row.values():
        cs.sort(key=lambda c: c['x0'])
        opens = [c for c in cs if c['text'] in '（(']
        closes = [c for c in cs if c['text'] in '）)']
        for o in opens:
            after = [c for c in closes if c['x0'] > o['x1']]
            if after:
                spans.append((o['x1'], after[0]['x0']))
    if spans:
        for col in columns:
            mid = (col.x0 + col.x1) / 2
            hits = sum(1 for a, b in spans if a <= mid <= b)
            col.in_brackets = hits >= max(1, len(spans) * 0.3)

    for c in chars:
        col = assign_column(c, columns)
        if col is not None and len(col.samples) < 400:
            col.samples.append(c['text'])
    return columns


def assign_column(c: dict, columns: list[Column], tolerance: float = 0.0) -> Column | None:
    """文字を、いちばん重なりの大きい列に割り当てる。

    列の範囲は1pt刻みで数えて作るので端が丸まる。左端の一致で判定すると、
    x0=75.9 の文字が 76 から始まる列に入らず、氏名の1文字目だけ落ちる。
    重なりがまったく無い文字は、tolerance の範囲内でいちばん近い列に寄せる。
    """
    best, best_overlap = None, 0.0
    for col in columns:
        overlap = min(c['x1'], col.x1) - max(c['x0'], col.x0)
        if overlap > best_overlap:
            best, best_overlap = col, overlap
    if best is not None or tolerance <= 0:
        return best

    nearest, nearest_dist = None, tolerance
    for col in columns:
        dist = max(col.x0 - c['x1'], c['x0'] - col.x1, 0.0)
        if dist <= nearest_dist:
            nearest, nearest_dist = col, dist
    return nearest


def group_rows(chars: list[dict], columns: list[Column], side: str, tolerance: float = 3.0) -> list[Row]:
    """Y座標で行にまとめ、各文字を列に割り当てる。

    行の判定はフォントサイズで許容誤差を変える。小さい文字が混ざる欄では
    同じ行が2行に割れてペアが崩れるため（master.py が踏んでいた問題）。
    """
    if not chars:
        return []
    # 見出しは列にも行にも入れない。入れると先頭に幽霊の1件ができ、
    # 以降のペアの組み方が1つずつずれる（全中2024で実際に起きた）。
    chars = body_chars(chars)
    if not chars:
        return []
    ordered = sorted(chars, key=lambda c: (c['top'], c['x0']))
    groups: list[list[dict]] = [[ordered[0]]]
    anchor = ordered[0]['top']
    for prev, cur in zip(ordered, ordered[1:]):
        tol = tolerance
        if cur['size'] < SMALL_SIZE_THRESHOLD or prev['size'] < SMALL_SIZE_THRESHOLD:
            tol = max(tolerance, 4.0)
        # 直前の文字とだけ比べると、少しずつずれた文字が数珠つなぎになり、
        # 10pt以上離れた別々の行がひと続きに融合する。小さい文字が混ざる欄で
        # 許容誤差が緩むと特に起きやすい（三笠宮賜杯の右段で、2人の氏名が
        # 1文字ずつ交互に混ざった「松猪坂股健拓人海」が出ていた）。
        # まとまりの**先頭**と比べれば、連鎖しても広がらない。
        if (cur['top'] - anchor) > tol:
            groups.append([cur])
            anchor = cur['top']
        else:
            groups[-1].append(cur)

    rows: list[Row] = []
    for g in groups:
        cells: dict[int, list[tuple[float, str]]] = {}
        for c in sorted(g, key=lambda c: c['x0']):
            col = assign_column(c, columns)
            if col is not None:
                cells.setdefault(col.index, []).append((c['x0'], c['text']))
        rows.append(
            Row(
                top=min(c['top'] for c in g),
                side=side,
                cells={k: ''.join(t for _, t in sorted(v)).strip() for k, v in cells.items()},
            )
        )
    return [r for r in rows if r.text()]


def build_table(pdf_path: str, page_num: int, gap: float = 6.0, tolerance: float = 3.0, bracket_cut: bool = False):
    """1ページを (columns, rows) に変換する。左側→右側の順に並べる。"""
    chars = load_chars(pdf_path, page_num)
    if not chars:
        return [], []

    split = detect_side_split(chars)
    sides = (
        [('left', [c for c in chars if c['x0'] < split]), ('right', [c for c in chars if c['x0'] >= split])]
        if split is not None
        else [('left', chars)]
    )

    all_columns: list[Column] = []
    all_rows: list[Row] = []
    for side, side_chars in sides:
        cols = detect_columns(side_chars, side, gap=gap, bracket_cut=bracket_cut)
        # 列indexは左右で通し番号にする（表として一意に扱うため）
        offset = len(all_columns)
        for col in cols:
            col.index += offset
        rows = group_rows(side_chars, cols, side, tolerance=tolerance)
        for r in rows:
            r.page = page_num
        all_columns.extend(cols)
        all_rows.extend(rows)
    return all_columns, all_rows
