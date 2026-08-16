"""抽出パラメータを自分で選ぶ（決定的・LLM不使用）。

`--gap` や `--y-tol` を人が試行錯誤するのをやめるための層。
何通りか抽出してみて、**結果を採点していちばん良かったものを採る**。

採点にLLMは要らない。この領域には「正解らしさ」を機械が測れる手掛かりがあるため:

  - 都道府県の欄が47都道府県辞書に当たるか（列がずれると当たらなくなる）
  - エントリー番号が連番として素直か
  - 所属が空でないか
  - ダブルスなら、ペアが2名そろっていて姓と名の両方が入っているか

列が1つずれた抽出は、これらがまとめて崩れる。だから点数が素直に効く。

この層があると、未知の様式に当たったときの手順が
「座標を実測して調整する」から「もう一度実行する」に変わる。
"""

from __future__ import annotations

from dataclasses import dataclass

import geometry
import labeling
from prefectures import looks_like_prefecture

# 既定値を先頭に置く。同点なら既定値が選ばれるようにするため
# （既に検証済みのPDFの結果を、調整層を入れたせいで変えてしまわないように）。
GAP_CANDIDATES = (6.0, 4.0, 9.0, 14.0, 2.5)
Y_TOL_CANDIDATES = (3.0, 2.0, 5.0)

# これを下回ったら「うまく取れていない」とみなす。
# 検証済みのPDF（2段組の一覧・全中の個人戦/団体戦）はいずれも 0.9 以上だった。
GOOD_ENOUGH = 0.75


@dataclass
class Attempt:
    gap: float
    y_tol: float
    category: str
    score: float
    count: int
    detail: dict
    columns: list
    rows: list
    labels: dict
    trace: dict
    entries: list
    pdf_numbers: list
    bracket_cut: bool = True

    def label(self) -> str:
        return f'gap={self.gap:g} y-tol={self.y_tol:g} 括弧で切る={"はい" if self.bracket_cut else "いいえ"}'


def _ratio(items, pred) -> float:
    items = list(items)
    return sum(1 for x in items if pred(x)) / len(items) if items else 0.0


def prefecture_in_table(rows) -> bool:
    """この表に都道府県が書かれているか（生のセル値で判定する）。

    大学の大会のように**都道府県欄が存在しない様式**がある。
    そこで都道府県の取れ具合を採点すると、抽出が完璧でも点数が頭打ちになり、
    直しようのないものをLLMに直させることになる（実際に起きた）。

    判定は**ラベルでなく生のセル値**で行う。ラベルを見ると、
    都道府県の列を取り違えた抽出が「都道府県は無い様式」として減点を免れてしまう。
    """
    for row in rows:
        for v in row.cells.values():
            if looks_like_prefecture(v):
                return True
    return False


def name_split_possible(attempts) -> bool:
    """姓と名が別々の位置に書かれている様式か。

    氏名が均等割り付けで1つの帯に収まる様式（三笠宮賜杯のドロー表など）では、
    座標に姓名の境目が無く、機械には割れない。割れないものを減点しない。
    総当たりのどれか1つでも姓と名を別の列として拾えたなら、割れる様式とみなす。
    """
    for a in attempts:
        for idx, role in a.labels.items():
            if role == 'firstname' and sum(1 for r in a.rows if r.cells.get(idx, '').strip()) >= 3:
                return True
    return False


def score_entries(
    entries: list[dict],
    category: str,
    pdf_numbers: list,
    prefecture_expected: bool = True,
    name_split_expected: bool = True,
    entry_cells_seen: int | None = None,
) -> tuple[float, dict]:
    """抽出結果の「正解らしさ」を 0..1 で返す。内訳も一緒に返す（人に見せるため）。

    **その文書に実在しない項目は採点しない**（分母から外す）。
    無い項目を減点すると、到達不可能な目安を課すことになる。
    """
    if not entries:
        return 0.0, {'理由': '1件も抽出できていない'}

    detail: dict[str, float] = {}
    parts: list[tuple[float, float]] = []  # (値, 重み)

    if category == 'team':
        team = _ratio(entries, lambda e: bool((e.get('team') or '').strip()))
        detail['所属が入っている割合'] = team
        parts.append((team, 3.0))
        if prefecture_expected:
            pref = _ratio(entries, lambda e: looks_like_prefecture(e.get('prefecture')))
            detail['都道府県が辞書に当たる割合'] = pref
            parts.append((pref, 3.0))
        else:
            detail['都道府県'] = 'この様式には欄が無い（採点対象外）'
    else:
        players = [p for e in entries for p in e.get('information') or []]
        team = _ratio(players, lambda p: bool((p.get('team') or '').strip()))
        pair = _ratio(entries, lambda e: len(e.get('information') or []) == 2)
        detail['所属が入っている割合'] = team
        detail['ペアが2名そろっている割合'] = pair
        parts += [(team, 2.0), (pair, 2.0)]
        if prefecture_expected:
            pref = _ratio(players, lambda p: looks_like_prefecture(p.get('prefecture')))
            detail['都道府県が辞書に当たる割合'] = pref
            parts.append((pref, 3.0))
        else:
            detail['都道府県'] = 'この様式には欄が無い（採点対象外）'
        if name_split_expected:
            both = _ratio(players, lambda p: bool((p.get('lastName') or '').strip()) and bool((p.get('firstName') or '').strip()))
            detail['姓と名の両方が入っている割合'] = both
            parts.append((both, 3.0))
        else:
            detail['姓名の分割'] = '座標に境目が無い様式（採点対象外・要目視）'

    numbers = [n for n in pdf_numbers if n is not None]
    if len(numbers) >= 3:
        increasing = sum(1 for a, b in zip(numbers, numbers[1:]) if b > a) / (len(numbers) - 1)
        distinct = len(set(numbers)) / len(numbers)
        seq = (increasing + distinct) / 2
        detail['エントリー番号の素直さ'] = seq
        parts.append((seq, 1.5))

        # 抽出した件数と、PDFに書かれたエントリー番号の最大値が合っているか。
        # 個人戦を団体戦と取り違えると、1人が1エントリーになって件数がおよそ倍になる。
        # 中身がどれも「それらしく」見えるため他の観点では気づけないが、
        # この照合だけは構造的に破れる（実際、三笠宮賜杯のページで
        # 誤った団体戦解釈が満点を取っていたのをこれで落とした）。
        top = max(numbers)
        if top > 0:
            fit = min(len(entries), top) / max(len(entries), top)
            detail['件数とエントリー番号の最大値の整合'] = fit
            parts.append((fit, 2.5))

    total_weight = sum(w for _, w in parts)
    score = sum(v * w for v, w in parts) / total_weight if total_weight else 0.0

    # 採点項目が少ない解釈ほど満点を取りやすい、という偏りへの手当て。
    # 幾何が崩れてエントリー番号の列を失うと、番号まわりの検査が丸ごと外れ、
    # 「所属が入っているか」だけの一項目で満点になってしまう
    # （三笠宮賜杯で、氏名を所属と読んだ178件の解釈が1.00を取っていた）。
    # ドロー表にエントリー番号が無いことはまず無いので、失っていること自体を減点する。
    # 判定は「表にエントリー番号の列があったか」で行う。pdf_numbers は
    # エントリーを作った行で拾えた番号だけなので、番号がペアの別の行に
    # 書かれている様式（全中）では空になり、正しい抽出まで減点してしまう。
    if entry_cells_seen is not None and entry_cells_seen < 3:
        score *= 0.6
        detail['エントリー番号'] = '列が見つからない（幾何が崩れている疑い・減点）'

    return score, detail


def attempt(pdf_path: str, page: int, gap: float, y_tol: float, category: str | None, build_entries, guess_category,
            prefecture_expected: bool = True, name_split_expected: bool = True, bracket_cut: bool = True) -> Attempt | None:
    """1通りの設定で抽出して採点する。"""
    cols, rows = geometry.build_table(pdf_path, page, gap=gap, tolerance=y_tol, bracket_cut=bracket_cut)
    if not rows:
        return None
    labels, trace = labeling.resolve_labels(cols, rows, use_llm=False, model='')
    cat = category or guess_category(labels, rows)
    entries, numbers = build_entries(rows, labels, cat)
    entry_cols = [i for i, r in labels.items() if r == 'entry']
    seen = sum(1 for r in rows for i in entry_cols if r.cells.get(i, '').strip())
    score, detail = score_entries(entries, cat, numbers, prefecture_expected, name_split_expected, seen)
    a = Attempt(gap, y_tol, cat, score, len(entries), detail, cols, rows, labels, trace, entries, numbers, bracket_cut)
    a.prefecture_expected = prefecture_expected
    a.name_split_expected = name_split_expected
    return a


def auto_tune(pdf_path: str, page: int, category: str | None, build_entries, guess_category) -> tuple[Attempt | None, list[Attempt]]:
    """候補を総当たりして、いちばん点数の高い抽出を返す。

    同点なら「既定値に近いもの」→「件数が多いもの」の順で選ぶ。
    件数を先に見ると、ゴミを大量に拾った抽出が勝ってしまうため。
    """
    attempts: list[Attempt] = []
    for bi, bracket_cut in enumerate((False, True)):
        for gi, gap in enumerate(GAP_CANDIDATES):
            for yi, y_tol in enumerate(Y_TOL_CANDIDATES):
                a = attempt(pdf_path, page, gap, y_tol, category, build_entries, guess_category, bracket_cut=bracket_cut)
                if a is None:
                    continue
                a.detail['_order'] = bi * 100 + gi * 10 + yi
                attempts.append(a)
                # 既定値で十分な点が出たら、残りは試さない（毎回全通り走らせない）。
                if bi == 0 and gi == 0 and yi == 0 and a.score >= 0.95:
                    return a, attempts

    if not attempts:
        return None, []

    # 「この文書に何が実在するか」は総当たりを一通り見ないと分からない。
    # 分かったうえで採点し直す。無い項目を減点したままだと、
    # 直しようのない失点でLLMを呼び続けることになる。
    pref_ok = prefecture_in_table(attempts[0].rows)
    split_ok = name_split_possible(attempts)
    if not (pref_ok and split_ok):
        for a in attempts:
            order = a.detail.get('_order')
            ec = [i for i, r in a.labels.items() if r == 'entry']
            seen = sum(1 for r in a.rows for i in ec if r.cells.get(i, '').strip())
            a.score, a.detail = score_entries(a.entries, a.category, a.pdf_numbers, pref_ok, split_ok, seen)
            a.detail['_order'] = order
            a.prefecture_expected, a.name_split_expected = pref_ok, split_ok

    best = max(attempts, key=lambda a: (round(a.score, 3), -a.detail['_order'], a.count))
    return best, attempts


def format_attempts(best: Attempt, attempts: list[Attempt]) -> str:
    lines = [f'自動調整: {len(attempts)}通り試し、{best.label()} を採用（点数 {best.score:.2f} / {best.count}件）']
    for k, v in best.detail.items():
        if not k.startswith('_'):
            lines.append(f'    {k}: {v:.2f}' if isinstance(v, float) else f'    {k}: {v}')
    others = sorted((a for a in attempts if a is not best), key=lambda a: -a.score)[:3]
    if others:
        lines.append('  次点: ' + ' / '.join(f'{a.label()} {a.score:.2f}({a.count}件)' for a in others))
    return '\n'.join(lines)


def _feedback(prev_labels: dict[int, str], detail: dict, score: float) -> str:
    """前回の提案が採点でどう外れたかを、次の提案のための指示にする。

    以前は決め打ちした5項目だけを見ていたため、**実際に落ちている項目が
    その5つに無いとフィードバックが空になり**、「もう一度やり直せ」としか
    言えていなかった。採点の内訳をそのまま走査して、低い項目を全部伝える。
    """
    ADVICE = {
        '都道府県が辞書に当たる割合': (
            '47都道府県の名前を含む値がある列に prefecture を付けてください。'
            'その列に学校名やクラブ名も混ざっている（行ごとに交互）なら team_prefecture です。'
        ),
        '所属が入っている割合': '所属らしい値（学校名・クラブ名・大学名）の列に team か team_prefecture を付けてください。',
        '姓と名の両方が入っている割合': '姓の列に surname、名の列に firstname を、別々の列に付けてください。',
        'ペアが2名そろっている割合': 'ダブルスのペアが2名そろっていません。氏名の列の指定を見直してください。',
        'エントリー番号の素直さ': '連番の数字が並ぶ列にだけ entry を付けてください。スコア欄は ignore です。',
        '件数とエントリー番号の最大値の整合': (
            '抽出された件数とエントリー番号の最大値が合っていません。'
            '個人戦なら1エントリー2名です。氏名の列を所属と取り違えていないか見直してください。'
        ),
    }
    lines = [
        f'前回あなたが付けたラベルを機械で採点した結果は {score:.2f} でした（合格の目安は {GOOD_ENOUGH}）。',
        '次の点が足りていません。',
    ]
    low = [(k, v) for k, v in detail.items() if isinstance(v, float) and not k.startswith('_') and v < 0.7]
    for k, v in sorted(low, key=lambda kv: kv[1]):
        lines.append(f'- {k}: {v:.2f} — ' + ADVICE.get(k, 'この項目が低くなるラベルの付け方になっています。'))
    if not low:
        lines.append('- 個々の項目は悪くないので、列の役割そのものを別の組み合わせで考え直してください。')
    for k, v in detail.items():
        if isinstance(v, str) and not k.startswith('_'):
            lines.append(f'- {k}: {v}')
    lines.append('前回の割り当て: ' + ', '.join(f'列{i}={r}' for i, r in sorted(prev_labels.items())))
    lines.append('**前回と同じ割り当てを返さないでください。** 別の解釈を出してください。')
    return '\n'.join(lines)


def repair(
    best: Attempt,
    category: str | None,
    build_entries,
    guess_category,
    propose,
    rounds: int = 3,
    log=print,
) -> Attempt:
    """点数が低いとき、LLMに列の割り当てを提案させ、機械が採点して採否を決める。

    改善しなければ**採点の内訳をフィードバックしてもう一度提案させる**。
    一発勝負にしないのは、9〜14Bクラスは一度で当てるより
    「どこが外れたか」を見せて直させるほうが当たるため。

    採否を決めるのは常に機械（`score_entries`）で、LLMの自己申告は使わない。
    改善しなかったら元の結果をそのまま返す。**LLMは提案するだけで、決めない。**

    `propose(columns, rows, feedback) -> dict[int, str] | None` は差し替え可能にしてある。
    Ollamaが無い環境でもこのループ自体をテストできるようにするため。
    """
    current = best
    feedback = None
    proposals_seen: list[dict] = []
    # 聞き直すたびに温度を上げる。低温度のまま同じ質問を繰り返しても、
    # まったく同じ答えが返ってくるだけで回数を無駄にする。
    temperatures = (0.1, 0.5, 0.8, 1.0)
    for i in range(1, rounds + 1):
        temp = temperatures[min(i - 1, len(temperatures) - 1)]
        proposal = propose(best.columns, best.rows, feedback, temp)
        if proposal is None:
            log(f'  → LLMに接続できませんでした（Ollamaが起動していない可能性）。規則の結果で続けます。')
            return current
        labels = dict(proposal)
        if labels in proposals_seen:
            log(f'  → LLMの提案 {i}回目: 前回と同じ割り当てだったので打ち切ります。')
            break
        proposals_seen.append(dict(labels))
        trace = {idx: f'LLMの提案（{i}回目 / temperature {temp}）' for idx in labels}
        # LLMが姓と名を1つずつに決め切っているなら、幾何による再割り当てはしない。
        # 上書きすると提案の違いが消え、何回聞いても同じ結果になる。
        for side in ('left', 'right'):
            cols = [c for c in best.columns if c.side == side]
            if sum(1 for c in cols if labels.get(c.index) in labeling.NAME_ROLES) > 2:
                labeling.regroup_name_columns([c for c in cols], labels, trace)
        cat = category or guess_category(labels, best.rows)
        entries, numbers = build_entries(best.rows, labels, cat)
        ec = [i for i, r in labels.items() if r == 'entry']
        entry_seen = sum(1 for r in best.rows for i in ec if r.cells.get(i, '').strip())
        score, detail = score_entries(
            entries, cat, numbers,
            getattr(best, 'prefecture_expected', True),
            getattr(best, 'name_split_expected', True),
            entry_seen,
        )
        log(f'  → LLMの提案 {i}回目: 点数 {score:.2f}（現在 {current.score:.2f}）')

        if score > current.score:
            current = Attempt(
                best.gap, best.y_tol, cat, score, len(entries), detail,
                best.columns, best.rows, labels, {**best.trace, **trace}, entries, numbers, best.bracket_cut,
            )
            current.prefecture_expected = getattr(best, 'prefecture_expected', True)
            current.name_split_expected = getattr(best, 'name_split_expected', True)
        if current.score >= GOOD_ENOUGH:
            log(f'  → 採用しました（点数 {current.score:.2f}）。')
            return current
        feedback = _feedback(labels, detail, score)

    if current is not best:
        log(f'  → 目安には届きませんでしたが、いちばん良かった提案を採用します（点数 {current.score:.2f}）。')
    else:
        log('  → LLMの提案はどれも改善しませんでした。規則の結果を使います。')
    return current


def diagnose(best: Attempt | None) -> list[str]:
    """点数が低いときに、座標の話をせずに次の一手を示す。"""
    if best is None:
        return ['文字を1つも抽出できませんでした。テキスト層の無いPDF（画像・スキャン）の可能性があります。']
    if best.score >= GOOD_ENOUGH:
        return []

    msgs = [f'うまく取れていない可能性があります（点数 {best.score:.2f} / 目安 {GOOD_ENOUGH}）。']
    d = best.detail
    if d.get('都道府県が辞書に当たる割合', 1) < 0.5:
        msgs.append('  ・都道府県として読めた値がほとんどありません。列の対応がずれているか、この様式に都道府県欄が無いかのどちらかです。')
    if d.get('所属が入っている割合', 1) < 0.5:
        msgs.append('  ・所属（学校・チーム名）がほとんど空です。所属の列を別の役割と取り違えている可能性があります。')
    if d.get('姓と名の両方が入っている割合', 1) < 0.5:
        msgs.append('  ・姓と名のどちらかが空の選手が多いです。氏名の列が1つにまとまっている様式かもしれません。')
    if '姓名の分割' in d:
        msgs.append('  ・この様式は座標に姓名の境目が無いため、姓名は分割していません（採点対象外）。姓の欄に氏名がまとめて入ります。')
    if '都道府県' in d:
        msgs.append('  ・この様式には都道府県欄がないため、採点対象から外しています。')
    if d.get('ペアが2名そろっている割合', 1) < 0.5:
        msgs.append('  ・ペアが2名そろっていません。行のまとまり方が想定と違う可能性があります。')
    if d.get('エントリー番号の素直さ', 1) < 0.5:
        msgs.append('  ・エントリー番号が連番として読めません。番号でない列を番号と見なしているかもしれません。')
    msgs.append('  次の一手: 上の「検出した列」の例とラベルを見比べて、ずれている列を --roles で指定する。')
    msgs.append('           例) 列2が名、列3が所属と都道府県の交互なら:  --roles "2=firstname,3=team_prefecture"')
    msgs.append('           使えるラベル: entry / surname / firstname / name / team / prefecture / team_prefecture / ignore')
    return msgs
