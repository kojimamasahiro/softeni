#!/usr/bin/env python3
"""実例ベースの回帰テスト（Ollama不要）。

ここが通らないうちはLLMを使う意味がない、という位置づけは
scripts/venue-agent/test_regression.py と同じ。

団体戦は、人が作った既存の正解データ（tools/tournament3/initialPlayer.js）と
同じPDFから同じ結果が出るかを丸ごと突き合わせる。
個人戦ダブルスは fixtures/ のドロー表PDFで丸ごと突き合わせる。fixtures は
リポジトリに入らない（.gitignore で *.pdf）ので、無ければ SKIP する。
PDFに依らない部分（ペアの束ね方・姓名分割の判断・tempIdの形）は行データを
直接組み立てて固定するので、fixtures が無い環境でも回る。
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import checks  # noqa: E402
import geometry  # noqa: E402
import labeling  # noqa: E402
import namesplit  # noqa: E402
import profiles  # noqa: E402
import substitutions  # noqa: E402
import tuning  # noqa: E402
from extract_tournament import (  # noqa: E402
    apply_profile_defaults,
    apply_role_overrides,
    build_entries,
    guess_category,
    split_team_prefecture,
)
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

    def __init__(self, top: float, cells: dict[int, str], side: str = 'left', char_boxes: dict | None = None):
        self.top = top
        self.cells = cells
        self.side = side
        self.char_boxes = char_boxes or {}

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
    labels, trace = labeling.resolve_labels(cols, rows, use_llm=False, model='')
    apply_role_overrides(labels, trace, prof, prof.roles)
    cat = prof.category or guess_category(labels, rows)
    entries, numbers = build_entries(rows, labels, cat)
    for i, e in enumerate(entries, start=1):
        e['id'] = i
    apply_profile_defaults(entries, prof)
    # ページをまたいで検証したい呼び出し側のために、PDFの番号も残しておく
    # （build_entries.dropped_rows と同じ渡し方）。
    extract_with_profile.pdf_numbers = numbers
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
    check('プロファイル: インカレは氏名が1つの枠に入ると宣言している', p.name_in_one_column is True)

    # 個人戦ページ（3ページ目）
    _, cat, entries, report = extract_with_profile(inter, 3)
    check('インカレp3: 種目が doubles', cat == 'doubles', cat)
    check('インカレp3: 72件（エントリー番号の最大71＋端数1）', len(entries) == 72, f'{len(entries)}件')
    first = entries[0]['information']
    check(
        'インカレp3: 先頭のペアが正しい（字間で姓名に割れる）',
        [(x['lastName'], x['firstName']) for x in first] == [('橋場', '柊一郎'), ('菊山', '太陽')],
        str([(x['lastName'], x['firstName']) for x in first]),
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
        'インカレp3: ほぼ全員が姓名に割れる（割れなかった分だけ要確認に出る）',
        len(report.review_name_split) <= 2,
        str(report.review_name_split),
    )

    # 団体戦ページ（1ページ目）
    _, cat1, entries1, report1 = extract_with_profile(inter, 1)
    check('インカレp1: 種目が team', cat1 == 'team', cat1)
    check('インカレp1: 45チーム', len(entries1) == 45, f'{len(entries1)}件')
    check('インカレp1: 先頭のチーム名', entries1[0]['team'] == '早稲田大学', entries1[0]['team'])
    check('インカレp1: 検証レポートが clean', report1.clean, checks.format_report(report1))


def test_intercollegiate_men_doubles() -> None:
    """2026年インカレ男子ダブルスのドロー表（全8ページ・585エントリー）。

    氏名が1つの枠に均等割り付けで入る様式。姓名の境目は字間から決める。
    エントリー番号が3桁になるページ（p2以降）で番号の列が氏名の列に飲まれた事故と、
    氏名の枠がたまたま2列に割れたページを「姓の列と名の列」と誤読した事故
    （`木|村奏都`）の両方を、ここで押さえている。
    """
    pdf = HERE / 'fixtures' / 'intercollegiate-2026-men-doubles.pdf'
    if not pdf.exists():
        print('SKIP: fixtures/intercollegiate-2026-men-doubles.pdf が無い')
        return

    all_entries = []
    for page in range(1, 9):
        _, cat, entries, _ = extract_with_profile(pdf, page)
        if page == 1:
            check('インカレ男子D: 種目が doubles', cat == 'doubles', cat)
        all_entries.extend(entries)
    for i, e in enumerate(all_entries, start=1):
        e['id'] = i

    check('インカレ男子D: 585エントリー（PDFの番号1〜585と一致）', len(all_entries) == 585, f'{len(all_entries)}件')
    check('インカレ男子D: 全件2名そろう', all(len(e['information']) == 2 for e in all_entries))

    # id は行順で振る。PDFのエントリー番号と一致するはず（ページ→左→右の順）。
    spot = {
        1: [('川﨑', '康平'), ('黒坂', '卓矢')],
        74: [('橋場', '柊一郎'), ('菊山', '太陽')],    # 3桁番号のページの先頭
        111: [('木村', '奏都'), ('村松', '優')],       # 氏名の枠が2列に割れるページ
        585: [('中村', '悠峰'), ('岡田', '侑也')],
    }
    for num, want in spot.items():
        got = [(x['lastName'], x['firstName']) for x in all_entries[num - 1]['information']]
        check(f'インカレ男子D: エントリー{num}が正しい', got == want, str(got))

    check(
        'インカレ男子D: 所属（大学名）が全員に入る',
        all(x['team'] for e in all_entries for x in e['information']),
    )
    unsplit = [x['lastName'] for e in all_entries for x in e['information'] if not x['firstName']]
    check(
        'インカレ男子D: 姓名が割れなかったのは2名だけ（池澤渓人・武井心希）',
        sorted(unsplit) == sorted(['池澤渓人', '武井心希']),
        str(unsplit),
    )


def test_intercollegiate_women_doubles() -> None:
    """2026年インカレ女子ダブルスのドロー表（全8ページ・332エントリー）。

    男子と同じ様式に見えて**氏名の組み方が違う**。男子は姓と名それぞれに均等割り付けが
    掛かるが、女子はほとんどの行が氏名全体を等間隔に置くため、字間から決められるのは
    664名中42名しかない。残りは既存の選手データと辞書に落ちる。
    「字間で決まらない様式でも通ること」をここで押さえている。
    """
    pdf = HERE / 'fixtures' / 'intercollegiate-2026-women-doubles.pdf'
    if not pdf.exists():
        print('SKIP: fixtures/intercollegiate-2026-women-doubles.pdf が無い')
        return

    all_entries = []
    for page in range(1, 9):
        _, cat, entries, _ = extract_with_profile(pdf, page)
        all_entries.extend(entries)
    for i, e in enumerate(all_entries, start=1):
        e['id'] = i

    check('インカレ女子D: 332エントリー（PDFの番号1〜332と一致）', len(all_entries) == 332, f'{len(all_entries)}件')
    check('インカレ女子D: 全件2名そろう', all(len(e['information']) == 2 for e in all_entries))
    check(
        'インカレ女子D: 所属が全員に入る（ページ下部の番号だけの枠を拾わない）',
        all(x['team'] for e in all_entries for x in e['information']),
    )
    spot = {
        1: [('前田', '梨緒'), ('中谷', 'さくら')],
        146: [('谷', '明日里'), ('岡原', '羽椛')],   # 谷明日里は既存データに2通りある（所属で決める）
        332: [('天間', '美嘉'), ('高橋', 'ひかる')],
    }
    for num, want in spot.items():
        got = [(x['lastName'], x['firstName']) for x in all_entries[num - 1]['information']]
        check(f'インカレ女子D: エントリー{num}が正しい', got == want, str(got))

    check(
        'インカレ女子D: prefecture は所属連盟（日本学連）',
        all(x['prefecture'] == '日本学連' for e in all_entries for x in e['information']),
    )
    check(
        'インカレ女子D: tempId は 姓_名_学校_日本学連 の4項目',
        all(x['tempId'].split('_')[-1] == '日本学連' and len(x['tempId'].split('_')) == 4
            for e in all_entries for x in e['information']),
        all_entries[0]['information'][0]['tempId'],
    )


def test_university_team() -> None:
    """2026年 文部科学大臣杯全日本大学対抗選手権（男子団体・全2ページ・96チーム）。

    三笠宮賜杯（個人戦）とは**別大会**で、同じ週に開かれるが様式も別。1行1チームで
    都道府県欄が無い。見出しの大会名が番号の列にも掛かるため、表の本体を
    「番号として読める行」で判定していないと見出しがチーム名として2件入る。
    """
    pdf = HERE / 'fixtures' / 'university-team-2026-boys.pdf'
    if not pdf.exists():
        print('SKIP: fixtures/university-team-2026-boys.pdf が無い')
        return

    prof = profiles.detect(str(pdf))
    check('プロファイル: 大学対抗（団体）を署名で見分ける', prof is not None and prof.name == 'university_team', prof.name if prof else '-')

    all_entries, all_numbers = [], []
    for page in (1, 2):
        _, cat, entries, _ = extract_with_profile(pdf, page)
        check(f'大学対抗p{page}: 種目が team', cat == 'team', cat)
        all_entries.extend(entries)
        all_numbers.extend(extract_with_profile.pdf_numbers)
    # idはページをまたいで振り直す。ページ単位で見るとp2のidが1始まりになり、
    # PDFの番号(49-96)と食い違って当然なので、通しで検証する。
    for i, e in enumerate(all_entries, start=1):
        e['id'] = i
    report = checks.build_report(all_entries, 'team', all_numbers, has_prefecture=False)
    check('大学対抗: 検証レポートが clean（全2ページ通し）', report.clean, checks.format_report(report))

    check('大学対抗: 96チーム（PDFの番号1〜96と一致）', len(all_entries) == 96, f'{len(all_entries)}件')
    check(
        '大学対抗: 見出しがチーム名として入らない',
        not any('大臣杯' in e['team'] or '男子の部' in e['team'] for e in all_entries),
        str([e['team'] for e in all_entries if '大臣杯' in e['team'] or '男子の部' in e['team']]),
    )
    spot = {1: '法政大学', 48: '明治大学', 49: '中央大学', 96: '日本体育大学'}
    for num, want in spot.items():
        check(f'大学対抗: エントリー{num}が {want}', all_entries[num - 1]['team'] == want, all_entries[num - 1]['team'])
    check(
        '大学対抗: prefecture は所属連盟（日本学連）で name にも入る',
        all(e['prefecture'] == '日本学連' for e in all_entries) and all_entries[0]['name'] == '法政大学（日本学連）',
        all_entries[0]['name'],
    )
    check('大学対抗: 情報欄（information）は持たない', all('information' not in e for e in all_entries))

    # 女子は1ページ59チーム。見出しの除外がページ数に依らず効くことも見る。
    pdf_g = HERE / 'fixtures' / 'university-team-2026-girls.pdf'
    if not pdf_g.exists():
        print('SKIP: fixtures/university-team-2026-girls.pdf が無い')
        return
    _, cat_g, entries_g, report_g = extract_with_profile(pdf_g, 1)
    check('大学対抗女子: 種目が team', cat_g == 'team', cat_g)
    check('大学対抗女子: 59チーム（PDFの番号1〜59と一致）', len(entries_g) == 59, f'{len(entries_g)}件')
    check('大学対抗女子: 検証レポートが clean', report_g.clean, checks.format_report(report_g))
    check(
        '大学対抗女子: 見出しがチーム名として入らない',
        not any('大臣杯' in e['team'] or '女子の部' in e['team'] for e in entries_g),
        str([e['team'] for e in entries_g if '大臣杯' in e['team'] or '女子の部' in e['team']]),
    )
    for num, want in {1: '日本体育大学', 30: '國學院大學', 59: '明治大学'}.items():
        check(f'大学対抗女子: エントリー{num}が {want}', entries_g[num - 1]['team'] == want, entries_g[num - 1]['team'])


# ---------------------------------------------------------------- 選手交代


def singles_entries() -> list[dict]:
    def one(eid, last, first, team):
        return {
            'id': eid,
            'name': f'{last} {first}（{team}）',
            'information': [{'lastName': last, 'firstName': first, 'team': team,
                             'prefecture': '日本学連', 'playerId': None,
                             'tempId': f'{last}_{first}_{team}'}],
            'category': 'singles',
        }
    return [one(1, '橋場', '柊一郎', '法政大学'), one(2, '保海', '祥真', '立命館大学')]


def doubles_entries() -> list[dict]:
    return [{
        'id': 1,
        'name': '柏・村上（東北）',
        'information': [
            {'lastName': '柏', 'firstName': '春花', 'team': '東北', 'prefecture': '宮城県',
             'playerId': None, 'tempId': '柏_春花_東北'},
            {'lastName': '村上', 'firstName': '芹', 'team': '東北', 'prefecture': '宮城県',
             'playerId': None, 'tempId': '村上_芹_東北'},
        ],
        'category': 'doubles',
    }]


def test_substitutions() -> None:
    entries = singles_entries()
    applied = substitutions.apply(entries, [
        {'id': 1, 'note': '欠場のため交代', 'players': [{'lastName': '山田', 'firstName': '太郎'}]},
    ])
    check('選手交代: 該当のエントリーだけ差し替わる',
          entries[0]['information'][0]['lastName'] == '山田' and entries[1]['information'][0]['lastName'] == '保海',
          str([e['information'][0]['lastName'] for e in entries]))
    check('選手交代: エントリー番号（ドローの位置）は動かさない', [e['id'] for e in entries] == [1, 2])
    check('選手交代: team を省くと元のエントリーの所属を引き継ぐ',
          entries[0]['information'][0]['team'] == '法政大学', entries[0]['information'][0]['team'])
    check('選手交代: name を作り直す', entries[0]['name'] == '山田 太郎（法政大学）', entries[0]['name'])
    check('選手交代: tempId を作り直す', entries[0]['information'][0]['tempId'] == '山田_太郎_法政大学',
          entries[0]['information'][0]['tempId'])
    check('選手交代: 何を当てたかを説明として返す', len(applied) == 1 and '橋場 柊一郎' in applied[0] and '山田 太郎' in applied[0],
          str(applied))

    entries = doubles_entries()
    substitutions.apply(entries, [{'id': 1, 'players': [
        {'lastName': '柏', 'firstName': '春花'},
        {'lastName': '後藤', 'firstName': '千尋', 'team': '文大杉並'},
    ]}])
    check('選手交代: ダブルスは片方だけの交代でも2名書く（残る側はそのまま）',
          [(p['lastName'], p['team']) for p in entries[0]['information']] == [('柏', '東北'), ('後藤', '文大杉並')],
          str([(p['lastName'], p['team']) for p in entries[0]['information']]))
    check('選手交代: ダブルスの name は 姓・姓（学校名）', entries[0]['name'] == '柏・後藤（東北）', entries[0]['name'])

    team_entries = [{'id': 1, 'name': 'A（広島県）', 'team': 'A', 'prefecture': '広島県', 'category': 'team'}]
    substitutions.apply(team_entries, [{'id': 1, 'team': 'B'}])
    check('選手交代: 団体戦はチーム名を差し替える',
          team_entries[0]['team'] == 'B' and team_entries[0]['name'] == 'B（広島県）', str(team_entries[0]))


def test_substitution_errors() -> None:
    """書き方の誤りは黙って無視せず落ちること。

    id を打ち間違えた交代が「当たったつもり」で消えるのがいちばん危ない。
    """
    cases = [
        ('存在しないエントリー番号', singles_entries, [{'id': 99, 'players': [{'lastName': '山', 'firstName': '田'}]}]),
        ('id が無い', singles_entries, [{'players': [{'lastName': '山', 'firstName': '田'}]}]),
        ('人数が種目と合わない', singles_entries,
         [{'id': 1, 'players': [{'lastName': '山', 'firstName': '田'}, {'lastName': '川', 'firstName': '田'}]}]),
        ('players が無い', singles_entries, [{'id': 1}]),
        ('lastName が空', singles_entries, [{'id': 1, 'players': [{'lastName': '', 'firstName': '田'}]}]),
    ]
    for label, make, subs in cases:
        try:
            substitutions.apply(make(), subs)
            check(f'選手交代: {label} なら落ちる', False, '例外が出なかった')
        except substitutions.SubstitutionError as e:
            check(f'選手交代: {label} なら落ちる', True, str(e)[:60])

    entries = singles_entries()
    try:
        substitutions.apply(entries, [
            {'id': 1, 'players': [{'lastName': '山田', 'firstName': '太郎'}]},
            {'id': 99, 'players': [{'lastName': '鈴木', 'firstName': '一郎'}]},
        ])
    except substitutions.SubstitutionError:
        pass
    check(
        '選手交代: 途中で落ちても、CLIは出力を書かないので中途半端なJSONは残らない',
        entries[0]['information'][0]['lastName'] == '山田',
        '（entries自体は書き換わるが、呼び出し側が例外時に書き出さない）',
    )


def test_intercollegiate_singles() -> None:
    """2026年 全日本学生シングルス選手権（男子・1ページ・92エントリー）。

    ダブルス（三笠宮賜杯）とは別大会で、ブラケット表ではなく2段組の一覧。
    **所属名が長いと括弧が空になり、すぐ下の行に所属名だけが溢れる**（6件）。
    その行を同じ行に取り込めていないと所属が空になる。
    """
    pdf = HERE / 'fixtures' / 'intercollegiate-singles-2026-boys.pdf'
    if not pdf.exists():
        print('SKIP: fixtures/intercollegiate-singles-2026-boys.pdf が無い')
        return

    prof = profiles.detect(str(pdf))
    check('プロファイル: 学生シングルスを署名で見分ける',
          prof is not None and prof.name == 'intercollegiate_singles', prof.name if prof else '-')

    _, cat, entries, report = extract_with_profile(pdf, 1)
    check('学生S: 種目が singles', cat == 'singles', cat)
    check('学生S: 92エントリー（PDFの番号1〜92と一致）', len(entries) == 92, f'{len(entries)}件')
    check('学生S: 1エントリー1名', all(len(e['information']) == 1 for e in entries))
    check('学生S: 検証レポートが clean', report.clean, checks.format_report(report))
    spot = {
        1: ('橋場', '柊一郎', '法政大学'),
        3: ('叶田', '慎之介', '石川工業高等専門学校'),   # 所属が次の行に溢れる
        43: ('小谷', '健', '関西外国語大学'),            # 同上（左段）
        88: ('西牧', '幹起', '石川工業高等専門学校'),     # 同上（右段）
        92: ('坂口', '生磨', '明治大学'),
    }
    for num, want in spot.items():
        p = entries[num - 1]['information'][0]
        check(f'学生S: エントリー{num}が正しい', (p['lastName'], p['firstName'], p['team']) == want,
              str((p['lastName'], p['firstName'], p['team'])))
    check('学生S: 所属が全員に入る（溢れた行を取りこぼさない）',
          all(x['team'] for e in entries for x in e['information']))
    check('学生S: name は 姓 名（所属）', entries[0]['name'] == '橋場 柊一郎（法政大学）', entries[0]['name'])

    # 女子も同じプロファイルで通ること。ダブルスでは男子と女子で氏名の組み方が
    # 違った（女子は字間が効かない）ので、シングルスでも確かめておく。
    pdf_g = HERE / 'fixtures' / 'intercollegiate-singles-2026-girls.pdf'
    if not pdf_g.exists():
        print('SKIP: fixtures/intercollegiate-singles-2026-girls.pdf が無い')
        return
    _, cat_g, entries_g, report_g = extract_with_profile(pdf_g, 1)
    check('学生S女子: 種目が singles', cat_g == 'singles', cat_g)
    check('学生S女子: 84エントリー（PDFの番号1〜84と一致）', len(entries_g) == 84, f'{len(entries_g)}件')
    check('学生S女子: 検証レポートが clean', report_g.clean, checks.format_report(report_g))
    spot_g = {
        1: ('天間', '美嘉', '日本体育大学'),
        21: ('及川', '咲空', '東京女子体育大学'),   # 所属が次の行に溢れる
        84: ('吉木', '理彩', '日本体育大学'),
    }
    for num, want in spot_g.items():
        p = entries_g[num - 1]['information'][0]
        check(f'学生S女子: エントリー{num}が正しい', (p['lastName'], p['firstName'], p['team']) == want,
              str((p['lastName'], p['firstName'], p['team'])))
    check('学生S女子: 全員が姓名に割れる', all(x['firstName'] for e in entries_g for x in e['information']))


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


def build_name_corpus(dirpath: Path) -> str:
    """姓名の辞書を差し替えられるように、最小の data/ を作る。

    本物の data/ を読ませると、リポジトリの選手が増減しただけでテストが動く。
    """
    pairs = [
        ('金子', '大輝'),
        ('佐藤', '晃太'),   # 金子晃太 は「氏名としては未登録・姓と名は既知」を作るため
        ('榎', '竜太郎'),   # ↓と合わせて、既存データ側で割り方が割れている状態を作る
        ('榎竜', '太郎'),
        ('山', '田太郎'),   # ↓と合わせて、辞書に2通り当たる状態を作る
        ('山田', '太郎'),
        ('武', '蔵'),       # 武 と 武井 が両方とも姓として存在する
        ('武井', '涼'),
    ]
    # 所属つき。同一人物が複数の割り方で登録されている実データの状況を再現する
    # （過去のインカレ取り込みが `谷明|日里` `温品芽|叶子` のように入れている）。
    with_team = [
        ('谷', '明日里', '四国大学'),
        ('谷', '明日里', '四国大学'),
        ('谷明', '日里', '四国大学'),
        ('温品', '芽叶子', '東海大学'),
        ('温品', '芽叶子', '東海大学'),
        ('温品芽', '叶子', '東海大学'),
        ('伊東', '月', '白鴎大学'),   # ↓と同数にして「決めない」を作る
        ('伊', '東月', '白鴎大学'),
    ]
    payload = [{'lastName': last, 'firstName': first} for last, first in pairs]
    payload += [{'lastName': last, 'firstName': first, 'team': team} for last, first, team in with_team]
    dirpath.mkdir(parents=True, exist_ok=True)
    (dirpath / 'players.json').write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
    return str(dirpath)

# ---------------------------------------------------------------- 姓名の分割（氏名が1列の様式）


def boxes(text: str, gaps: list[float], width: float = 8.0) -> list[tuple[float, float, str]]:
    """字間を指定して (x0, x1, 文字) の並びを作る。実測値をそのまま書けるようにする。"""
    out, x = [], 60.0
    for i, ch in enumerate(text):
        out.append((x, x + width, ch))
        x += width + (gaps[i] if i < len(gaps) else 0)
    return out


def test_namesplit_geometry() -> None:
    """均等割り付けは姓と名それぞれに掛かるので、境目の字間だけが広い。

    字間はすべて2026年インカレ男子ダブルスのドロー表の実測値。
    """
    cases = [
        ('松尾奏汰', [10.1, 18.2, 10.0], ('松尾', '奏汰')),
        ('浅野梨空', [11.9, 14.5, 11.8], ('浅野', '梨空')),
        ('榎祐希人', [14.6, 11.8, 11.8], ('榎', '祐希人')),      # 1+3
        ('小田原晃太', [5.5, 5.5, 13.6, 5.5], ('小田原', '晃太')),  # 3+2
        ('山岡昂太郎', [6.8, 9.5, 7.0, 6.8], ('山岡', '昂太郎')),   # 2+3
        ('廣田将', [21.9, 24.4], ('廣田', '将')),                 # 2+1
        ('平凛生', [24.4, 21.8], ('平', '凛生')),                 # 1+2
    ]
    for text, gaps, want in cases:
        got = namesplit.split_by_geometry(boxes(text, gaps))
        check(f'姓名分割: 字間で {text} を {want[0]}|{want[1]} に割る', got == want, str(got))


def test_namesplit_no_signal() -> None:
    """字間が均一な行は本当に境目が座標に無い。**推測で割らない**のが正しい。

    ここで無理に argmax を採ると 牛尾彗吾 が `牛尾彗|吾` になる（実際に起きた）。
    """
    for text, gaps in (('牛尾彗吾', [12.7, 12.7, 12.8]), ('盛岡昴生', [12.8, 12.7, 12.7]), ('飯降脩', [23.2, 23.1])):
        got = namesplit.split_by_geometry(boxes(text, gaps))
        check(f'姓名分割: 字間が均一な {text} では決めない', got is None, str(got))

    check(
        '姓名分割: 2文字は字間の比較対象が無いので決めない',
        namesplit.split_by_geometry(boxes('田中', [12.0])) is None,
    )


def test_namesplit_fallbacks(tmp_data) -> None:
    """字間に信号が無いときだけ、既存の選手データと姓名の辞書に落とす。"""
    check(
        '姓名分割: 既存の選手データに同じ氏名があればその割り方を使う',
        namesplit.split_by_corpus('金子大輝', tmp_data) == ('金子', '大輝'),
        str(namesplit.split_by_corpus('金子大輝', tmp_data)),
    )
    check(
        '姓名分割: 既存データで割り方が割れていたら決めない',
        namesplit.split_by_corpus('榎竜太郎', tmp_data) is None,
        str(namesplit.split_by_corpus('榎竜太郎', tmp_data)),
    )
    check(
        '姓名分割: 姓と名の辞書に1通りだけ当たるならそれを使う',
        namesplit.split_by_dictionary('金子晃太', tmp_data) == ('金子', '晃太'),
        str(namesplit.split_by_dictionary('金子晃太', tmp_data)),
    )
    check(
        '姓名分割: 辞書に2通り当たるなら決めない（山|田太郎 と 山田|太郎）',
        namesplit.split_by_dictionary('山田太郎', tmp_data) is None,
        str(namesplit.split_by_dictionary('山田太郎', tmp_data)),
    )
    check(
        '姓名分割: 名が辞書に無ければ決めない（実データの 武井心希 はこれで残った）',
        namesplit.split_by_dictionary('武井心希', tmp_data) is None,
        str(namesplit.split_by_dictionary('武井心希', tmp_data)),
    )
    check(
        '姓名分割: 同じ氏名・同じ所属の選手がいればその割り方に合わせる',
        namesplit.split_by_team_corpus('谷明日里', '四国大学', tmp_data) == ('谷', '明日里'),
        str(namesplit.split_by_team_corpus('谷明日里', '四国大学', tmp_data)),
    )
    check(
        '姓名分割: 同一人物が複数の割り方で登録されていたら件数の多いほうを採る',
        namesplit.split_by_team_corpus('温品芽叶子', '東海大学', tmp_data) == ('温品', '芽叶子'),
        str(namesplit.split_by_team_corpus('温品芽叶子', '東海大学', tmp_data)),
    )
    check(
        '姓名分割: 同数なら所属つきでも決めない',
        namesplit.split_by_team_corpus('伊東月', '白鴎大学', tmp_data) is None,
        str(namesplit.split_by_team_corpus('伊東月', '白鴎大学', tmp_data)),
    )
    check(
        '姓名分割: 所属が違えば当てない（同姓同名の別人を避ける）',
        namesplit.split_by_team_corpus('谷明日里', '別の大学', tmp_data) is None,
        str(namesplit.split_by_team_corpus('谷明日里', '別の大学', tmp_data)),
    )
    last, first, method = namesplit.split_name('該当しない名前', [], None, tmp_data)
    check(
        '姓名分割: どれでも決まらなければ分割せず、名を空にして人に回す',
        (last, first, method) == ('該当しない名前', '', 'unsplit'),
        str((last, first, method)),
    )


def test_namesplit_in_pipeline() -> None:
    """氏名が1列の様式が、entries の組み立てまで通るか。"""
    labels = {0: 'entry', 1: 'name', 2: 'team'}
    rows = [
        FakeRow(10, {1: '松尾奏汰'}, char_boxes={1: boxes('松尾奏汰', [10.1, 18.2, 10.0])}),
        FakeRow(14, {0: '1', 2: '九州産業大学'}),
        FakeRow(18, {1: '清水直哉'}, char_boxes={1: boxes('清水直哉', [11.9, 14.5, 11.8])}),
    ]
    entries, _ = build_entries(rows, labels, 'doubles')
    check('氏名1列: 1エントリーに束ねる', len(entries) == 1, f'{len(entries)}件')
    info = entries[0]['information']
    check('氏名1列: 姓と名に割れる', [(p['lastName'], p['firstName']) for p in info] == [('松尾', '奏汰'), ('清水', '直哉')], str(info))
    check('氏名1列: name は 姓・姓（学校名）', entries[0]['name'] == '松尾・清水（九州産業大学）', entries[0]['name'])
    check('氏名1列: tempId は 姓_名_学校', info[0]['tempId'] == '松尾_奏汰_九州産業大学', info[0]['tempId'])


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
    test_intercollegiate_men_doubles()
    test_intercollegiate_women_doubles()
    test_university_team()
    test_intercollegiate_singles()
    print('\n--- 選手交代（大会中の差し替え） ---')
    test_substitutions()
    test_substitution_errors()
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
    print('\n--- 姓名の分割（氏名が1つの枠に入る様式） ---')
    test_namesplit_geometry()
    test_namesplit_no_signal()
    with tempfile.TemporaryDirectory() as tmp:
        data_dir = build_name_corpus(Path(tmp) / 'data')
        test_namesplit_fallbacks(data_dir)
    test_namesplit_in_pipeline()
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
