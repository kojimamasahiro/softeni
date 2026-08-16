#!/usr/bin/env python3
"""実例ベースの回帰テスト（Ollama不要）。

ここが通らないうちはLLMを使う意味がない、という位置づけは
scripts/venue-agent/test_regression.py と同じ。

団体戦は、人が作った既存の正解データ（tools/tournament3/initialPlayer.js）と
同じPDFから同じ結果が出るかを丸ごと突き合わせる。
個人戦ダブルスは**リポジトリに元PDFが無い**ため、行データを直接組み立てて
ロジック（ペアの束ね方・姓名分割の警告・tempIdの形）だけを固定する。
実際のドロー表PDFが手に入ったら、団体戦と同じ丸ごと突合に差し替えること。
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import checks  # noqa: E402
import geometry  # noqa: E402
import labeling  # noqa: E402
import profiles  # noqa: E402
import tuning  # noqa: E402
from extract_tournament import build_entries, guess_category, split_team_prefecture  # noqa: E402
from prefectures import normalize  # noqa: E402

REPO = HERE.parent.parent
PASSED: list[str] = []
FAILED: list[str] = []


def check(name: str, cond: bool, detail: str = '') -> None:
    (PASSED if cond else FAILED).append(name)
    mark = 'OK  ' if cond else 'FAIL'
    print(f'{mark}: {name}' + (f' — {detail}' if detail else ''))


class FakeRow:
    """geometry.Row と同じ形の最小オブジェクト。PDF無しでロジックを試すため。"""

    def __init__(self, top: float, cells: dict[int, str], side: str = 'left'):
        self.top = top
        self.cells = cells
        self.side = side

    def text(self) -> str:
        return ''.join(self.cells.values())


# ---------------------------------------------------------------- 団体戦（実PDF・丸ごと突合）


def test_team_golden() -> None:
    pdf = REPO / 'scripts' / 'pdf' / 'tournament.pdf'
    gold_js = REPO / 'tools' / 'tournament3' / 'initialPlayer.js'
    if not pdf.exists() or not gold_js.exists():
        print('SKIP: tournament.pdf または tools/tournament3/initialPlayer.js が無い')
        return

    cols, rows = geometry.build_table(str(pdf), 1)
    labels, _ = labeling.resolve_labels(cols, rows, use_llm=False, model='')
    category = guess_category(labels, rows)
    entries, numbers = build_entries(rows, labels, category)
    report = checks.build_report(entries, category, numbers)

    m = re.search(r'\[(.*)\]', gold_js.read_text(encoding='utf-8'), re.S)
    gold = json.loads('[' + m.group(1) + ']')

    check('団体戦: 種目が team と判定される', category == 'team', category)
    check('団体戦: 件数が正解と一致', len(entries) == len(gold), f'{len(entries)} vs {len(gold)}')
    diffs = [
        (g['id'], k, g.get(k), n.get(k))
        for g, n in zip(gold, entries)
        for k in ('name', 'team', 'prefecture', 'category')
        if g.get(k) != n.get(k)
    ]
    check('団体戦: 全項目が正解と一致', not diffs, f'差分{len(diffs)}件: {diffs[:3]}')
    check('団体戦: 検証レポートが clean', report.clean, checks.format_report(report))


# ---------------------------------------------------------------- 個人戦（実PDF・ブラケット表）


def extract_page(pdf: Path, page: int, category: str | None = None):
    cols, rows = geometry.build_table(str(pdf), page)
    labels, _ = labeling.resolve_labels(cols, rows, use_llm=False, model='')
    cat = category or guess_category(labels, rows)
    entries, numbers = build_entries(rows, labels, cat)
    for i, e in enumerate(entries, start=1):
        e['id'] = i
    return cat, entries, checks.build_report(entries, cat, numbers if cat == 'team' else None)


def test_zenchu_doubles() -> None:
    """全中2024のドロー表（ブラケット表）。2段組の一覧とは構造がまったく違う。

    各ページは 左16 + 右16 = 32エントリー。加えてページ下部に決勝進出ペアの再掲枠が
    1つあるため、抽出は33件になり、その1件は duplicate_players に挙がるのが正しい。
    """
    pdf = HERE / 'fixtures' / 'zenchu-2024-draw.pdf'
    if not pdf.exists():
        print('SKIP: fixtures/zenchu-2024-draw.pdf が無い')
        return

    expected = {
        1: ('保海', '郁弥', '朝桜中学校', '滋賀県', '木原'),
        2: ('常包', '匠紀', '牟礼中学校', '香川県', '福島'),
        3: ('裏', '詩音', '奈良LEGENDS', '奈良県', '中山'),
        4: ('阿部', '寧々', '山陽学園中学校', '岡山県', '森川'),
    }
    for page, (last, first, team, pref, last32) in expected.items():
        cat, entries, report = extract_page(pdf, page)
        check(f'全中p{page}: 種目が doubles と判定される', cat == 'doubles', cat)
        check(f'全中p{page}: 33件（32エントリー＋再掲枠1）', len(entries) == 33, f'{len(entries)}件')
        if not entries:
            continue
        p0 = entries[0]['information'][0]
        check(f'全中p{page}: 先頭の姓名', (p0['lastName'], p0['firstName']) == (last, first), f"{p0['lastName']}/{p0['firstName']}")
        check(f'全中p{page}: 先頭の所属', p0['team'] == team, p0['team'])
        check(
            f'全中p{page}: ブロック付き都道府県が展開される（近畿・滋賀県 → 滋賀県）',
            p0['prefecture'] == pref,
            str(p0['prefecture']),
        )
        check(
            f'全中p{page}: 32番目のエントリー',
            len(entries) >= 32 and entries[31]['information'][0]['lastName'] == last32,
            entries[31]['information'][0]['lastName'] if len(entries) >= 32 else '-',
        )
        check(f'全中p{page}: ペアが全件2名そろう', all(len(e['information']) == 2 for e in entries))
        check(f'全中p{page}: 再掲枠を重複として検出', len(report.duplicate_players) == 1, str(report.duplicate_players))


def test_zenchu_team() -> None:
    """全中2024の団体戦ページ（p5-6）。個人戦とはさらに別の構造。

    チーム名と都道府県が同じ列に**行ごとの交互**で入り（1行目にチーム名、2行目に県）、
    ページ下部に「優勝」の再掲枠がある。左13 + 右12 = 25チーム。
    """
    pdf = HERE / 'fixtures' / 'zenchu-2024-draw.pdf'
    if not pdf.exists():
        print('SKIP: fixtures/zenchu-2024-draw.pdf が無い')
        return

    expected = {
        5: ('姫路ふぁみりー', '兵庫県', '北広島大曲中学校', '上青木中学校'),
        6: ('昇陽中学校', '大阪府', '早来学園', '山陽学園中学校'),
    }
    for page, (first_team, first_pref, seventh, last) in expected.items():
        cat, entries, report = extract_page(pdf, page, category='team')
        check(f'全中p{page}: 25チーム（左13＋右12）', len(entries) == 25, f'{len(entries)}件')
        if len(entries) < 25:
            continue
        check(f'全中p{page}: 先頭のチーム名', entries[0]['team'] == first_team, entries[0]['team'])
        check(
            f'全中p{page}: 先頭の都道府県（ブロック付き表記を展開）',
            entries[0]['prefecture'] == first_pref,
            str(entries[0]['prefecture']),
        )
        check(
            f'全中p{page}: 長いチーム名の1文字目が落ちない',
            entries[6]['team'] == seventh,
            entries[6]['team'],
        )
        check(f'全中p{page}: 末尾のチーム名', entries[-1]['team'] == last, entries[-1]['team'])
        check(f'全中p{page}: 全件に都道府県が入る', all(e['prefecture'] for e in entries))
        check(
            f'全中p{page}: 下部の「優勝」再掲枠が混ざらない',
            not report.empty_team and not report.prefecture_not_in_dict,
            checks.format_report(report),
        )


# ---------------------------------------------------------------- 大会プロファイル


def extract_with_profile(pdf: Path, page: int):
    prof = profiles.detect(str(pdf))
    assert prof is not None
    cols, rows = geometry.build_table(str(pdf), page, gap=prof.gap, tolerance=prof.y_tol, bracket_cut=prof.bracket_cut)
    labels, _ = labeling.resolve_labels(cols, rows, use_llm=False, model='')
    for idx, role in prof.roles.items():
        if idx in labels:
            labels[idx] = role
    cat = prof.category or guess_category(labels, rows)
    entries, numbers = build_entries(rows, labels, cat)
    for i, e in enumerate(entries, start=1):
        e['id'] = i
    report = checks.build_report(
        entries, cat, numbers if cat == 'team' else None,
        has_prefecture=prof.has_prefecture, splits_name=prof.splits_name,
    )
    return prof, cat, entries, report


def test_profiles() -> None:
    """大会ごとのプロファイルが、署名で選ばれて正しい設定を当てるか。"""
    zen = HERE / 'fixtures' / 'zenchu-2024-draw.pdf'
    inter = HERE / 'fixtures' / 'intercollegiate-draw.pdf'

    if zen.exists():
        p = profiles.detect(str(zen))
        check('プロファイル: 全中を署名で見分ける', p is not None and p.name == 'zenchu', p.name if p else '-')

    if not inter.exists():
        print('SKIP: fixtures/intercollegiate-draw.pdf が無い')
        return

    p = profiles.detect(str(inter))
    check('プロファイル: インカレを署名で見分ける', p is not None and p.name == 'intercollegiate', p.name if p else '-')
    check('プロファイル: インカレは都道府県欄が無いと宣言している', p.has_prefecture is False)
    check('プロファイル: インカレは姓名を分割しないと宣言している', p.splits_name is False)

    # 個人戦ページ（3ページ目）
    _, cat, entries, report = extract_with_profile(inter, 3)
    check('インカレp3: 種目が doubles', cat == 'doubles', cat)
    check('インカレp3: 72件（エントリー番号の最大71＋端数1）', len(entries) == 72, f'{len(entries)}件')
    first = entries[0]['information']
    check(
        'インカレp3: 先頭のペアが正しい',
        [x['lastName'] for x in first] == ['橋場柊一郎', '菊山太陽'],
        str([x['lastName'] for x in first]),
    )
    check('インカレp3: 所属（大学名）が両名に入る', all(x['team'] == '法政大学' for x in first), str([x['team'] for x in first]))
    check(
        'インカレp3: 氏名が2人分混ざらない（行の連鎖融合が起きない）',
        all('松猪' not in x['lastName'] for e in entries for x in e['information']),
    )
    check(
        'インカレp3: 都道府県欄が無い様式なので都道府県の警告を出さない',
        not report.prefecture_not_in_dict,
        f'{len(report.prefecture_not_in_dict)}件',
    )
    check(
        'インカレp3: 姓名を分割しない様式なので分割の警告を出さない',
        not report.review_name_split,
        f'{len(report.review_name_split)}件',
    )

    # 団体戦ページ（1ページ目）
    _, cat1, entries1, report1 = extract_with_profile(inter, 1)
    check('インカレp1: 種目が team', cat1 == 'team', cat1)
    check('インカレp1: 45チーム', len(entries1) == 45, f'{len(entries1)}件')
    check('インカレp1: 先頭のチーム名', entries1[0]['team'] == '早稲田大学', entries1[0]['team'])
    check('インカレp1: 検証レポートが clean', report1.clean, checks.format_report(report1))


# ---------------------------------------------------------------- LLMによる修復ループ


def test_llm_repair_loop() -> None:
    """LLMが提案し、機械が採点して採否を決めるループが本当に働くか。

    Ollamaが無い環境でも検証できるよう、提案する側を差し替えて試す。
    確かめたいのはモデルの賢さではなく、**提案を機械が正しく採否できているか**。
    """
    pdf = HERE / 'fixtures' / 'zenchu-2024-draw.pdf'
    if not pdf.exists():
        print('SKIP: fixtures/zenchu-2024-draw.pdf が無い')
        return

    cols, rows = geometry.build_table(str(pdf), 1)
    good, _ = labeling.resolve_labels(cols, rows, use_llm=False, model='')

    # 規則が失敗した状況を作る（氏名の列を全部つぶす）。
    broken = {i: ('ignore' if r in ('surname', 'firstname', 'name', 'team_prefecture') else r) for i, r in good.items()}
    entries, numbers = build_entries(rows, broken, 'doubles')
    base_score, base_detail = tuning.score_entries(entries, 'doubles', numbers)
    base = tuning.Attempt(6.0, 3.0, 'doubles', base_score, len(entries), base_detail, cols, rows, broken, {}, entries, numbers)
    check('修復: 壊した状態は目安を下回る', base_score < tuning.GOOD_ENOUGH, f'{base_score:.2f}')

    calls: list[str | None] = []

    def propose_good(columns, rws, feedback, temperature=0.1):
        calls.append(feedback)
        return dict(good)

    fixed = tuning.repair(base, None, build_entries, guess_category, propose_good, rounds=3, log=lambda *_: None)
    check('修復: 正しい提案を採用して点数が上がる', fixed.score > base_score, f'{base_score:.2f} → {fixed.score:.2f}')
    check('修復: 目安に届いたら追加で聞かない', len(calls) == 1, f'{len(calls)}回呼んだ')

    # 出鱈目な提案は採らない。
    # 毎回まったく同じ提案。低温度のLLMが実際にこうなる。
    def propose_junk(columns, rws, feedback, temperature=0.1):
        calls.append(feedback)
        return {i: 'ignore' for i in good}

    calls.clear()
    kept = tuning.repair(base, None, build_entries, guess_category, propose_junk, rounds=3, log=lambda *_: None)
    check('修復: 改善しない提案は採らない', kept.score == base_score, f'{kept.score:.2f}')
    check(
        '修復: 同じ提案が返ってきたら打ち切る（回数を無駄にしない）',
        len(calls) == 2,
        f'{len(calls)}回呼んだ',
    )
    check(
        '修復: 2回目に採点の内訳と点数をフィードバックしている',
        calls[1] is not None and '合格の目安' in calls[1] and '前回と同じ割り当てを返さないでください' in calls[1],
        str(calls[1])[:70],
    )

    # 聞き直すたびに温度が上がっているか（同じ答えの繰り返しを避けるため）
    temps: list[float] = []

    def propose_varying(columns, rws, feedback, temperature=0.1):
        # 毎回わずかに違う提案を返す（同一提案の打ち切りに引っかからないように）。
        temps.append(temperature)
        out = dict(broken)
        for n, idx in enumerate(sorted(good)):
            if n < len(temps):
                out[idx] = good[idx]
        return out

    tuning.repair(base, None, build_entries, guess_category, propose_varying, rounds=3, log=lambda *_: None)
    check('修復: 聞き直すたびに temperature を上げる', temps == [0.1, 0.5, 0.8], str(temps))

    # 接続できないときは元の結果を返す。
    unreachable = tuning.repair(base, None, build_entries, guess_category, lambda *a, **k: None, rounds=3, log=lambda *_: None)
    check('修復: LLMに繋がらなければ規則の結果を返す', unreachable is base)


# ---------------------------------------------------------------- 列の意味づけ


def test_labeling() -> None:
    # ドロー表本体のスコア欄は 0/1 だけの数字列。エントリー番号と間違えてはいけない。
    role, _ = labeling.heuristic_label(['0', '1', '0', '1', '1', '0', '0'], width=6)
    check('列判定: スコア欄(0/1)をエントリー番号にしない', role == 'ignore', role)

    role, _ = labeling.heuristic_label([str(i) for i in range(1, 25)], width=12)
    check('列判定: 連番はエントリー番号', role == 'entry', role)

    role, _ = labeling.heuristic_label(['東京都', '広島県', '愛媛県', '徳島県'], width=40)
    check('列判定: 都道府県', role == 'prefecture', role)

    role, _ = labeling.heuristic_label(['尽誠学園', '高田商', '東北高校', '岡崎城西'], width=90)
    check('列判定: 所属（学校名）', role == 'team', role)

    role, _ = labeling.heuristic_label([')', ')', ')', ')'], width=4)
    check('列判定: 括弧だけの列は無視', role == 'ignore', role)

    # ブラケット表は1つの列に都道府県と所属を行ごとの交互で入れる。
    role, _ = labeling.heuristic_label(
        ['近畿・滋賀県', '朝桜中学校', '九州・長崎県', '長崎南山中学校', '北信越・新潟県', '巻西中学校'], width=52
    )
    check('列判定: 都道府県と所属が交互（正式名称）', role == 'team_prefecture', role)

    # 2023年の全中ドロー表は学校名を「西郷第一中」「南中」と略す。
    # 正式名称しか見ていなかったため所属の列を氏名の列と取り違え、
    # 姓名の境目まで狂って所属も都道府県も空になっていた。
    role, _ = labeling.heuristic_label(
        ['東北・福島県', '西郷第一中', '近畿・滋賀県', '朝桜中', '東海・愛知県', '朝日中', '九州・宮崎県', '南中'],
        width=52,
    )
    check('列判定: 都道府県と所属が交互（学校名が略称）', role == 'team_prefecture', role)

    # 都道府県だけの列は交互と誤認しない（当たる割合がほぼ1.0になるため）。
    role, _ = labeling.heuristic_label(['東京都', '広島県', '愛媛県', '徳島県', '大阪府', '北海道'], width=52)
    check('列判定: 都道府県だけの列は交互と誤認しない', role == 'prefecture', role)


# ---------------------------------------------------------------- 都道府県


def test_prefectures() -> None:
    check('都道府県: 奈良 → 奈良県', normalize('奈良')[0] == '奈良県')
    check('都道府県: 東京 → 東京都', normalize('東京')[0] == '東京都')
    check('都道府県: 大阪 → 大阪府', normalize('大阪')[0] == '大阪府')
    check('都道府県: 京都 → 京都府', normalize('京都')[0] == '京都府')
    check('都道府県: 北海道はそのまま', normalize('北海道')[0] == '北海道')
    check('都道府県: 日本学連は正当な値として通す', normalize('日本学連')[1] is True)
    check('都道府県: 辞書に無い値は未知として報告される', normalize('奈艮')[1] is False, '列ズレ/OCR誤認の検出')


def test_split_team_prefecture() -> None:
    check('括弧割り: ヨネックス(東京都)', split_team_prefecture('ヨネックス(東京都)', '') == ('ヨネックス', '東京都'))
    check(
        '括弧割り: 閉じ括弧が別列に落ちても割れる',
        split_team_prefecture('國學院大學Ａ(東京都', '') == ('國學院大學Ａ', '東京都'),
    )
    check('括弧割り: 都道府県列があるならそちらを優先', split_team_prefecture('東北', '宮城県') == ('東北', '宮城県'))


# ---------------------------------------------------------------- 個人戦ダブルス（合成データ）

DOUBLES_LABELS = {0: 'entry', 1: 'surname', 2: 'firstname', 3: 'team', 4: 'prefecture'}


def doubles_rows() -> list[FakeRow]:
    """エントリー番号が1行目にだけ入る、ドロー表の典型構造。"""
    return [
        FakeRow(10, {0: '1', 1: '柏', 2: '春花', 3: '東北', 4: '宮城'}),
        FakeRow(20, {1: '村上', 2: '芹', 3: '東北', 4: '宮城'}),
        FakeRow(40, {0: '2', 1: '松野下', 2: '夏穂', 3: '文大杉並', 4: '東京'}),
        FakeRow(50, {1: '後藤', 2: '千尋', 3: '文大杉並', 4: '東京'}),
    ]


def test_doubles_pairing() -> None:
    entries, _ = build_entries(doubles_rows(), DOUBLES_LABELS, 'doubles')
    check('ダブルス: 番号の無い行を同じエントリーに束ねる', len(entries) == 2, f'{len(entries)}件')
    check('ダブルス: 1エントリー2名', all(len(e['information']) == 2 for e in entries))
    check('ダブルス: name は 姓・姓（学校名）', entries[0]['name'] == '柏・村上（東北）', entries[0]['name'])
    check(
        'ダブルス: 3文字姓が壊れない（松野下）',
        entries[1]['information'][0]['lastName'] == '松野下',
        entries[1]['information'][0]['lastName'],
    )
    check(
        'ダブルス: tempId は 姓_名_学校 の3項目（実データに合わせる。SKILL.mdの4項目は誤り）',
        entries[0]['information'][0]['tempId'] == '柏_春花_東北',
        entries[0]['information'][0]['tempId'],
    )
    check(
        'ダブルス: 都道府県が正式名称に展開される',
        entries[0]['information'][0]['prefecture'] == '宮城県',
        entries[0]['information'][0]['prefecture'],
    )
    check('ダブルス: playerId は常に null', entries[0]['information'][0]['playerId'] is None)

    report = checks.build_report(entries, 'doubles')
    check('ダブルス: 正常なデータでは clean', report.clean, checks.format_report(report))


def test_doubles_problems() -> None:
    rows = [
        FakeRow(10, {0: '1', 1: '柏', 2: '春花', 3: '東北', 4: '宮城'}),  # 2人目が無い
        FakeRow(40, {0: '2', 1: '長谷川内', 2: '', 3: '文大杉並', 4: '東京'}),  # 姓4文字・名が空
        FakeRow(50, {1: '後藤', 2: '千尋', 3: '文大杉並', 4: '奈艮'}),  # 都道府県が辞書に無い
    ]
    entries, _ = build_entries(rows, DOUBLES_LABELS, 'doubles')
    report = checks.build_report(entries, 'doubles')

    check('検証: ペアの2人目が無いエントリーを検出', 1 in report.entries_missing_2nd_player, str(report.entries_missing_2nd_player))
    check('検証: 姓4文字以上/名が空を目視対象に挙げる', len(report.review_name_split) >= 1, str(report.review_name_split))
    check(
        '検証: 都道府県辞書に無い値を検出（列ズレ・OCR誤認のサイン）',
        any(p['prefecture'] == '奈艮' for p in report.prefecture_not_in_dict),
        str(report.prefecture_not_in_dict),
    )
    check('検証: 問題があれば clean が False', not report.clean)


def test_id_problems() -> None:
    entries = [
        {'id': 1, 'team': 'A', 'prefecture': '東京都', 'name': 'A（東京都）'},
        {'id': 2, 'team': 'B', 'prefecture': '広島県', 'name': 'B（広島県）'},
    ]
    report = checks.build_report(entries, 'team', pdf_numbers=[1, 5])
    check(
        '検証: PDFの番号と行順の食い違いを警告する',
        len(report.order_mismatch_warnings) == 1,
        str(report.order_mismatch_warnings),
    )


def main() -> int:
    print('=== scripts/pdf-to-players 回帰テスト（Ollama不要）===\n')
    print('--- 団体戦: 実PDFを人が作った正解データと丸ごと突合 ---')
    test_team_golden()
    print('\n--- 個人戦ダブルス: 実PDF（全中2024のブラケット表） ---')
    test_zenchu_doubles()
    print('\n--- 団体戦: 実PDF（全中2024のブラケット表） ---')
    test_zenchu_team()
    print('\n--- 大会プロファイル（全中 / インカレ） ---')
    test_profiles()
    print('\n--- LLMによる修復ループ（提案する側を差し替えて検証） ---')
    test_llm_repair_loop()
    print('\n--- 列の意味づけ ---')
    test_labeling()
    print('\n--- 都道府県 ---')
    test_prefectures()
    test_split_team_prefecture()
    print('\n--- 個人戦ダブルス（合成データ・元PDFが無いため） ---')
    test_doubles_pairing()
    test_doubles_problems()
    print('\n--- id の検証 ---')
    test_id_problems()

    total = len(PASSED) + len(FAILED)
    print(f'\n{len(PASSED)}/{total} passed')
    if FAILED:
        print('失敗:')
        for f in FAILED:
            print(f'  - {f}')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
