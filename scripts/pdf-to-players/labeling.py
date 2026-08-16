"""検出した列が「何の列か」を決める。

ここがこのツールで唯一、判断が要る工程。
幾何的な列検出（geometry.py）は決定的にできるが、
「左から2番目の列が姓なのか学校名なのか」はセルの中身を見ないと決まらない。

方針は scripts/venue-agent/ と同じ:
  - まず決定的なヒューリスティックで判定する
  - 確信が持てない列だけ、ローカルLLMに聞く（任意・Ollama未起動でも動く）
  - LLMにはツール呼び出しをさせない。1ページぶんの列サンプル → ラベルのJSON、それだけ

LLMを使わなくても動くことを優先している。判断の対象が
「数十件のサンプルから列の種類を当てる」という狭い問題なので、
ヒューリスティックでもかなりの割合が当たるため。
"""

from __future__ import annotations

import json
import re

from prefectures import looks_like_prefecture

# 列に付けられるラベル
ROLES = ('entry', 'surname', 'firstname', 'name', 'team', 'prefecture', 'team_prefecture', 'ignore')

ROLE_JA = {
    'entry': 'エントリー番号',
    'surname': '姓',
    'firstname': '名',
    'name': '氏名（姓名が同じ列）',
    'team': '所属・学校名',
    'prefecture': '都道府県・所属連盟',
    'team_prefecture': '所属と都道府県が交互（行ごとに判定）',
    'ignore': '無視',
}

NAME_ROLES = ('surname', 'firstname', 'name')

_DIGIT = re.compile(r'^[0-9０-９]+$')
_KANA_ONLY = re.compile(r'^[ぁ-んァ-ヶー]+$')
# 所属らしさの語彙。**あくまで補助**で、ここに語を足して対応する運用はしない
# （大会ごとに書き方が違うので、足し続けることになる）。
# 判定の主役は構造的な手掛かり（下の team_prefecture の条件）と、
# それでも決まらないときのローカルLLM。
_TEAM_HINT = re.compile(r'(高校|高等学校|中学|小学|大学|学園|学院|クラブ|ソフト|連盟|商業|工業|附属|付属|ＴＣ|TC|ｸﾗﾌﾞ)')
_BRACKET_ONLY = re.compile(r'^[()（）\s]+$')
_ZEN2HAN = str.maketrans('０１２３４５６７８９', '0123456789')
# ドロー表の対戦スコア。丸数字（勝者側）と全角数字が混ざる。
_SCORE_LIKE = re.compile(r'^[0-9０-９①-⑳\s]{1,4}$')


def column_values(columns, rows) -> dict[int, list[str]]:
    """列indexごとに、行から拾ったセル値の一覧を作る。

    Column.samples は文字単位なので意味づけには使えない（文字が連なっただけになる）。
    判定に使うのは必ずこちらの行由来の値。
    """
    values: dict[int, list[str]] = {c.index: [] for c in columns}
    for row in rows:
        for idx, cell in row.cells.items():
            if cell.strip():
                values.setdefault(idx, []).append(cell.strip())
    return values


def _ratio(values: list[str], pred) -> float:
    if not values:
        return 0.0
    return sum(1 for v in values if pred(v)) / len(values)


def heuristic_label(values: list[str], width: float) -> tuple[str, float]:
    """1列ぶんのセル値から (ラベル, 確信度0-1) を返す。"""
    vals = [v for v in values if v.strip()]
    if not vals:
        return 'ignore', 1.0

    if _ratio(vals, lambda v: bool(_BRACKET_ONLY.match(v))) > 0.8:
        return 'ignore', 0.95

    if _ratio(vals, lambda v: bool(_DIGIT.match(v))) > 0.8:
        # ドロー表の本体にはスコア欄（0/1 の並び）があり、これも数字だけの列になる。
        # エントリー番号は「値がほぼ全部違う」「最大値が2以上」という点で区別できる。
        nums = [int(v.translate(_ZEN2HAN)) for v in vals if v.translate(_ZEN2HAN).isdigit()]
        distinct = len(set(nums))
        if nums and distinct >= max(3, len(nums) * 0.6) and max(nums) >= 2:
            return 'entry', 0.9
        return 'ignore', 0.8

    # スコア欄は丸数字と全角数字が混ざる（④④ / １２ / ２０）。
    # 数字だけの判定では丸数字が漏れるので、ここで別に落とす。
    if _ratio(vals, lambda v: bool(_SCORE_LIKE.match(v))) >= 0.7:
        return 'ignore', 0.85

    pref_ratio = _ratio(vals, looks_like_prefecture)
    team_ratio = _ratio(vals, lambda v: bool(_TEAM_HINT.search(v)))

    # ブラケット表では1つの列が行ごとに「都道府県」と「学校名」を交互に持つ
    # （全中のドロー表: 1行目に 近畿・滋賀県、2行目に 朝桜中学校）。
    # どちらか一方に決めると必ず半分を取り違えるので、専用のラベルにして行ごとに判定する。
    #
    # 所属側の語尾は大会ごとに揺れる（略称・クラブ名・ローマ字）ので、
    # 所属らしさの判定に頼りきらない。**都道府県が半分程度しか当たらない**こと自体が、
    # 「都道府県だけの列ではなく何かと交互になっている」という十分な手掛かりになる
    # （都道府県だけの列なら 1.0 近くまで当たる）。
    if pref_ratio > 0.25 and (team_ratio > 0.25 or pref_ratio < 0.7):
        return 'team_prefecture', min(0.9, 0.5 + (pref_ratio + max(team_ratio, 0.25)) * 0.2)

    if pref_ratio > 0.7:
        return 'prefecture', min(0.95, 0.6 + pref_ratio * 0.35)

    if team_ratio > 0.4:
        return 'team', min(0.9, 0.5 + team_ratio * 0.4)

    avg_len = sum(len(v) for v in vals) / len(vals)
    kana_ratio = _ratio(vals, lambda v: bool(_KANA_ONLY.match(v)))

    # 姓と名は幅と字種で分ける。名はひらがな・カタカナだけの割合が姓より明確に高い。
    if avg_len <= 4.5 and width < 60:
        if kana_ratio > 0.25:
            return 'firstname', 0.5 + kana_ratio * 0.3
        return 'surname', 0.55
    if avg_len <= 8:
        return 'name', 0.4
    return 'team', 0.35


def heuristic_labels(columns, rows) -> dict[int, tuple[str, float]]:
    values = column_values(columns, rows)
    out: dict[int, tuple[str, float]] = {}
    side_rows = {s: sum(1 for r in rows if r.side == s) for s in {c.side for c in columns}}
    for col in columns:
        vals = values.get(col.index, [])
        # ほとんどの行が空の列は、表の列ではなく散発的な記号（シード印・凡例など）。
        # 名前の列として拾うと1件ぶん枠を食い、以降のペアの組み方がずれる
        # （全中2024の右段にあった 'Ｒ' の1文字で実際に起きた）。
        total = side_rows.get(col.side, len(rows)) or 1
        if len(vals) < 3 or len(vals) / total < 0.05:
            out[col.index] = ('ignore', 0.7)
            continue
        role, conf = heuristic_label(vals, col.width)
        # 括弧の内側は氏名ではない。中身が都道府県なら都道府県、そうでなければ所属。
        # 印は幾何（geometry.py）が付けたもので、語彙判定ではない。
        if getattr(col, 'in_brackets', False) and role in NAME_ROLES:
            role = 'prefecture' if _ratio(vals, looks_like_prefecture) > 0.5 else 'team'
            conf = 0.8
        out[col.index] = (role, conf)
    return out


# ---------------------------------------------------------------- LLM

# Ollamaのモデル名。**qwen2.5 に 9b は存在しない**（0.5b/1.5b/3b/7b/14b/32b/72b）。
# scripts/venue-agent/README.md に `qwen2.5:9b-instruct` と書かれていたのが誤りで、
# それが設計メモとこのツールに引き継がれていた。実際に pull しようとして発覚した。
# 16GB機なら 7b(4.7GB) が無難。品質を上げたいときは 14b(9.0GB)。
DEFAULT_MODEL = 'qwen2.5:7b-instruct'

OLLAMA_URL = 'http://localhost:11434'


def probe_ollama(model: str = DEFAULT_MODEL, timeout: int = 5) -> str | None:
    """Ollamaが使える状態かを調べ、駄目な理由を日本語で返す（問題なければ None）。

    「繋がらない」と「モデルが入っていない」を区別する。
    まとめて「接続できませんでした」と出すと、既に起動しているサーバーを
    もう一度起動しようとする遠回りを生む（実際に起きた）。
    """
    try:
        import requests
    except ImportError:
        return 'requests が入っていません（pip3 install --break-system-packages requests）'
    try:
        res = requests.get(f'{OLLAMA_URL}/api/tags', timeout=timeout)
        res.raise_for_status()
        names = {m.get('name', '') for m in res.json().get('models', [])}
    except Exception as e:
        return f'Ollamaに繋がりません（{type(e).__name__}）。`ollama serve` が動いているか確認してください。'

    if not names:
        return f'Ollamaは動いていますが、モデルが1つも入っていません。`ollama pull {model}` を実行してください。'
    if model in names or f'{model}:latest' in names:
        return None
    return (
        f'Ollamaは動いていますが、モデル `{model}` が入っていません。\n'
        f'    `ollama pull {model}` を実行するか、入っているモデルを --model で指定してください。\n'
        f'    いま入っているモデル: {", ".join(sorted(names))}'
    )

SYSTEM_PROMPT = """あなたはソフトテニスの大会ドロー表（組み合わせ表）PDFから機械的に抽出された表を読む担当です。
各列のサンプル値を見て、その列が何の列かを判定してください。

ラベルは次のいずれかだけを使います:
- entry: エントリー番号（連番の数字）
- surname: 選手の姓
- firstname: 選手の名
- name: 姓と名が1つの列に入っている
- team: 所属・学校名・クラブ名
- prefecture: 都道府県名、または所属連盟名
- ignore: 上のどれでもない（罫線・記号・見出しなど）

判定できないときは ignore ではなく、いちばん近いラベルを選んでください。
出力は次の形のJSONのみ。説明文を書かないこと。

{"labels": [{"index": 0, "role": "entry"}, {"index": 1, "role": "surname"}]}
"""


def describe_columns(columns, rows) -> str:
    """LLMに見せる表の説明。列ごとのサンプル値を並べただけのもの。"""
    values = column_values(columns, rows)
    lines = []
    for col in columns:
        vs = [v for v in values.get(col.index, []) if v.strip()][:12]
        lines.append(f'列{col.index}（{col.side}側 / 幅{col.width:.0f}pt）: ' + ' | '.join(vs))
    return '\n'.join(lines)


def llm_labels(columns, rows, model: str = DEFAULT_MODEL, timeout: int = 120, feedback: str | None = None, temperature: float = 0.1) -> dict[int, str] | None:
    """Ollamaに列の意味づけだけを聞く。失敗したら None（呼び出し側はヒューリスティックで続行）。

    `feedback` には前回の提案が機械の採点でどう外れたかを渡す。
    一発で当てさせるのではなく、採点結果を見せて直させるほうが小さいモデルには効く。
    """
    try:
        import requests
    except ImportError:
        return None

    user = '次の列のラベルを判定してください。\n\n' + describe_columns(columns, rows)
    if feedback:
        user += '\n\n' + feedback

    try:
        res = requests.post(
            'http://localhost:11434/api/chat',
            json={
                'model': model,
                'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}, {'role': 'user', 'content': user}],
                'stream': False,
                'format': 'json',
                'options': {'temperature': temperature},
            },
            timeout=timeout,
        )
        res.raise_for_status()
        content = res.json()['message']['content']
        parsed = json.loads(content)
    except Exception:
        return None

    out: dict[int, str] = {}
    for item in parsed.get('labels', []):
        try:
            idx = int(item['index'])
            role = str(item['role'])
        except (KeyError, TypeError, ValueError):
            continue
        if role in ROLES:
            out[idx] = role
    return out or None


def regroup_name_columns(columns, labels, trace) -> None:
    """姓・名に割れすぎた列を、side ごとに「姓の領域」「名の領域」の2つへまとめ直す。

    氏名は文字ごとに固定スロットへ置かれるので、名前の長さが揃っていない側では
    スロットの隙間が均等に開き、3列以上に割れる（全中2024の右段: 川|田|泰成）。
    隙間の大小で姓と名を割れないため、次の順で決める:

      1. 側の中でいちばん広い隙間が2番目より明確に広ければ、そこを姓/名の境目にする
      2. 決め手が無ければ、**反対側の境目の相対位置を写す**。ブラケット表は左右対称で、
         同じ様式が鏡像で並んでいるため（実測でも左右の氏名領域の幅は同じだった）
      3. それも無ければ姓/名に分けず 'name' にして、検証レポートの目視対象に落とす
    """
    ratios: dict[str, float] = {}
    runs: list[tuple[str, list]] = []
    for side in ('left', 'right'):
        cols = [c for c in columns if c.side == side and labels.get(c.index) in NAME_ROLES]
        if not cols:
            continue
        cols.sort(key=lambda c: c.x0)
        runs.append((side, cols))
        if len(cols) < 2:
            continue
        span = cols[-1].x1 - cols[0].x0
        if span <= 0:
            continue

        boundary = None
        # 姓は1文字ずつの狭いスロットに置かれ、名はまとめて広い枠に入ることが多い。
        # 右端の列だけが明らかに広いなら、そこが名の領域。
        # （全中2024: 姓のスロットは7〜16pt、名の枠は30pt前後だった）
        if len(cols) >= 3:
            others = sorted(c.width for c in cols[:-1])
            median = others[len(others) // 2]
            if median > 0 and cols[-1].width > median * 1.5:
                boundary = (cols[-2].x1 + cols[-1].x0) / 2

        if boundary is None:
            gaps = [(cols[i + 1].x0 - cols[i].x1, i) for i in range(len(cols) - 1)]
            ordered = sorted(gaps, reverse=True)
            # 2列なら境目は明らか。3列以上は、最大の隙間が2番目より明確に広いときだけ採る。
            if len(ordered) == 1 or ordered[0][0] > ordered[1][0] * 1.2:
                boundary = (cols[ordered[0][1]].x1 + cols[ordered[0][1] + 1].x0) / 2

        if boundary is not None:
            ratios[side] = (boundary - cols[0].x0) / span

    for side, cols in runs:
        if len(cols) == 1:
            labels[cols[0].index] = 'name'
            trace[cols[0].index] = trace.get(cols[0].index, '') + ' / 氏名1列'
            continue
        if len(cols) == 2:
            labels[cols[0].index], labels[cols[1].index] = 'surname', 'firstname'
            for c in cols:
                trace[c.index] = trace.get(c.index, '') + ' / 姓名2列とみなす'
            continue

        ratio = ratios.get(side)
        source = 'この側の最大の隙間'
        if ratio is None:
            other = 'right' if side == 'left' else 'left'
            ratio = ratios.get(other)
            source = f'{other}側の境目を鏡像で写した'
        if ratio is None:
            for c in cols:
                labels[c.index] = 'name'
                trace[c.index] = trace.get(c.index, '') + ' / 姓名の境目を決められず氏名列として扱う'
            continue

        boundary = cols[0].x0 + (cols[-1].x1 - cols[0].x0) * ratio
        for c in cols:
            labels[c.index] = 'surname' if (c.x0 + c.x1) / 2 < boundary else 'firstname'
            trace[c.index] = trace.get(c.index, '') + f' / 姓名の境目 x={boundary:.0f}（{source}）'


def resolve_labels(columns, rows, use_llm: bool, model: str, threshold: float = 0.6):
    """ヒューリスティックを土台に、確信度の低い列だけLLMの判定で上書きする。

    返り値は (ラベル辞書, 判断の記録). 記録は人に見せるためのもので、
    どの列を何で決めたかが分かるようにしておく（あとから誤りの原因を辿れるように）。
    """
    base = heuristic_labels(columns, rows)
    labels = {i: r for i, (r, _) in base.items()}
    trace = {i: f'ヒューリスティック（確信度 {c:.2f}）' for i, (_, c) in base.items()}

    if not use_llm:
        regroup_name_columns(columns, labels, trace)
        return labels, trace

    llm = llm_labels(columns, rows, model=model)
    if llm is None:
        for i in trace:
            trace[i] += ' ※LLMに接続できずヒューリスティックのみ'
        regroup_name_columns(columns, labels, trace)
        return labels, trace

    for idx, (role, conf) in base.items():
        if conf >= threshold or idx not in llm:
            continue
        if llm[idx] != role:
            trace[idx] = f'LLMが上書き（ヒューリスティックは {ROLE_JA[role]} / 確信度 {conf:.2f}）'
            labels[idx] = llm[idx]
        else:
            trace[idx] = f'LLMも同じ判定（確信度 {conf:.2f}）'
    regroup_name_columns(columns, labels, trace)
    return labels, trace
