#!/usr/bin/env python3
"""大会ドロー表PDF → initialPlayers 形式JSON（CLI本体）。

`tournament-pdf-to-players` スキルの手順を、Claudeが居なくても回せるようにしたもの。

役割分担（scripts/venue-agent/ と同じ流儀）:
    PDF →(決定的: geometry.py)→ 行×列の表 ★ここで必ず人に見せる
       →(判断: labeling.py / ローカルLLMは任意)→ 各列の意味
           →(決定的)→ initialPlayers JSON
               →(決定的: checks.py)→ 検証レポート
                   →(人)→ tool へ投入

LLMが要るのは「この列は姓か学校名か」の一点だけで、そこもヒューリスティックで
かなり当たる。Ollamaが無くても最後まで通る。

使い方:
    # 1ページだけ出して確認する（必ず最初にこれ）
    python3 extract_tournament.py DRAW.pdf --pages 1 --out /tmp/page1.json

    # 表の見え方だけ確認したい
    python3 extract_tournament.py DRAW.pdf --pages 1 --dump-table

    # 確認できたら全ページ
    python3 extract_tournament.py DRAW.pdf --out entries.json

    # 列の意味づけをローカルLLMにも見てもらう
    python3 extract_tournament.py DRAW.pdf --pages 1 --llm

主要オプション:
    --category doubles|team   自動判定を上書きする
    --gap / --y-tol           列・行の検出パラメータ（レイアウトが崩れるとき）
    --roles "0=entry,1=surname"  列の意味を手で指定する（最後の手段）
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import checks  # noqa: E402
import geometry  # noqa: E402
import labeling  # noqa: E402
import profiles  # noqa: E402
import tuning  # noqa: E402
from prefectures import looks_like_prefecture, normalize  # noqa: E402


def parse_roles(spec: str | None) -> dict[int, str]:
    if not spec:
        return {}
    out: dict[int, str] = {}
    for part in spec.split(','):
        if '=' not in part:
            continue
        k, v = part.split('=', 1)
        v = v.strip()
        if v in labeling.ROLES:
            out[int(k.strip())] = v
    return out


def cell(row, labels: dict[int, str], role: str) -> str:
    """行から指定ラベルの列の値を取り出す（同じラベルの列が複数あれば連結）。"""
    parts = [row.cells[i].strip() for i in sorted(row.cells) if labels.get(i) == role and row.cells[i].strip()]
    return ''.join(parts)


def split_team_prefecture(team_raw: str, pref_raw: str) -> tuple[str, str]:
    """`ヨネックス(東京都)` のように所属と都道府県が同じ列に入っている場合に割る。

    列の隙間が狭いレイアウトでは、幾何的な列検出では分けられない。
    括弧は分離できる確実な手掛かりなので、ここだけ文字で処理する。
    右段では閉じ括弧が別の列に落ちることがあるため、閉じ括弧は必須にしない。
    """
    if pref_raw.strip():
        return team_raw.strip(), pref_raw.strip()
    for op, cl in (('(', ')'), ('（', '）')):
        if op in team_raw:
            head, _, tail = team_raw.partition(op)
            return head.strip(), tail.replace(cl, '').strip()
    return team_raw.strip(), ''


def to_int(s: str) -> int | None:
    s = s.strip().translate(str.maketrans('０１２３４５６７８９', '0123456789'))
    return int(s) if s.isdigit() else None


def guess_category(labels: dict[int, str], rows) -> str:
    """姓・名・氏名の列に実際の値が入っていれば個人戦、無ければ団体戦。"""
    name_cols = [i for i, r in labels.items() if r in ('surname', 'firstname', 'name')]
    if not name_cols:
        return 'team'
    filled = sum(1 for row in rows for i in name_cols if row.cells.get(i, '').strip())
    return 'doubles' if filled >= max(2, len(rows) * 0.2) else 'team'


def _trim_outside_rows(ordered, labels: dict[int, str], head_margin: float = 25.0, tail_margin: float = 30.0):
    """表の本体の外にある行（見出しと、下部の再掲枠）を落とす。

    ドロー表には本体の上に大会名の見出しがあり、下に「決勝進出ペア」「優勝」の再掲枠がある。
    どちらも表の列に重なるので、そのまま処理すると幽霊のエントリーができ、
    以降の組み方が1つずつずれる。字の大きさでは見分けられないページがある（全中の団体戦は
    見出しが本文と同じ大きさ）ため、**エントリー番号の並びの範囲**を本体とみなす。

    落とした行は必ず表示する。黙って捨てると「全部拾えた」ように見えてしまうため。
    """
    entry_cols = {i for i, r in labels.items() if r == 'entry'}
    if not entry_cols:
        return ordered, []
    kept, dropped = [], []
    for page in sorted({getattr(r, 'page', 0) for r in ordered}):
        page_rows = [r for r in ordered if getattr(r, 'page', 0) == page]
        entry_tops = [
            r.top for r in page_rows if any(r.cells.get(i, '').strip() for i in entry_cols)
        ]
        if not entry_tops:
            kept.extend(page_rows)
            continue
        lo, hi = min(entry_tops) - head_margin, max(entry_tops) + tail_margin
        for r in page_rows:
            (kept if lo <= r.top <= hi else dropped).append(r)
    return sorted(kept, key=lambda r: (getattr(r, 'page', 0), 0 if r.side == 'left' else 1, r.top)), dropped


def build_entries(rows, labels: dict[int, str], category: str):
    """行の並びから entries を組み立てる。左側→右側、各側は上から下の順。

    ドロー表は「エントリー番号は1行目にだけ入り、ペアの2人目は番号の無い行」という
    構造をしているので、番号の有無で区切る。番号が両行に入るレイアウトでも、
    同じ番号なら同じエントリーに束ねる。
    """
    # ページ → 左右 → 上から下、の順。ページをまたぐときにページ順を先に見ないと、
    # 全ページの左側をまとめて処理してしまい、エントリーの並びが崩れる。
    ordered = sorted(rows, key=lambda r: (getattr(r, 'page', 0), 0 if r.side == 'left' else 1, r.top))
    ordered, dropped = _trim_outside_rows(ordered, labels)
    build_entries.dropped_rows = dropped

    entries: list[dict] = []
    pdf_numbers: list[int | None] = []
    current: dict | None = None
    current_no: int | None = None

    for row in ordered:
        no = to_int(cell(row, labels, 'entry'))
        team_raw = cell(row, labels, 'team')
        pref_raw = cell(row, labels, 'prefecture')
        last = cell(row, labels, 'surname')
        first = cell(row, labels, 'firstname')
        whole = cell(row, labels, 'name')

        # 所属と都道府県が交互に入る列は、行ごとに中身で振り分ける。
        mixed = cell(row, labels, 'team_prefecture')
        if mixed:
            if looks_like_prefecture(mixed):
                pref_raw = pref_raw or mixed
            else:
                team_raw = team_raw or mixed

        team_raw, pref_raw = split_team_prefecture(team_raw, pref_raw)

        if category == 'team':
            # ブラケット表の団体戦は「1行目にチーム名、2行目に都道府県」と縦に分けて書く
            # （全中2024 p5-6）。1行1エントリーとみなすと件数が倍になり県が全部欠ける。
            # 2段組の一覧（1行にすべて入る）も、同じ処理で1行=1エントリーになる。
            if not (team_raw.strip() or pref_raw.strip()):
                continue
            need_new = (
                current is None
                or (no is not None and no != current_no)
                or (team_raw.strip() and current.get('team'))
                or (pref_raw.strip() and current.get('prefecture'))
            )
            if need_new:
                current = {'team': team_raw.strip(), 'prefecture': pref_raw.strip()}
                entries.append(current)
                pdf_numbers.append(no)
                current_no = no if no is not None else current_no
            else:
                current['team'] = current.get('team') or team_raw.strip()
                current['prefecture'] = current.get('prefecture') or pref_raw.strip()
            continue

        if not (last or first or whole):
            # 氏名が無く所属だけの行。ブラケット表では所属をペアの2行の「間」に
            # 独立した行として置く様式がある（三笠宮賜杯）。捨てると所属が全部空になる。
            if (team_raw.strip() or pref_raw.strip()) and current is not None:
                for p in current['information']:
                    p['team'] = p['team'] or team_raw.strip()
                    if not p['prefecture']:
                        p['prefecture'] = normalize(pref_raw)[0]
                current['pending_team'] = team_raw.strip()
                current['pending_pref'] = pref_raw.strip()
            continue
        if whole and not last:
            # 姓名が1列にまとまっている場合。境界が無いので分割はせず、
            # 姓だけ埋めて review_name_split に載せる（人が直す前提）。
            last, first = whole.strip(), ''

        pref, _ = normalize(pref_raw)
        player = {
            'lastName': last.strip(),
            'firstName': first.strip(),
            'team': team_raw.strip(),
            'prefecture': pref,
            'playerId': None,
            # tempId は実データに合わせて 姓_名_学校 の3項目。
            # SKILL.md は 姓_名_学校_都道府県 と書いているが、tools/ 配下の実ファイルは
            # 新旧すべて3項目だった（docs/raw/2026-08-14-idea-local-llm-skill-replacement.md）。
            'tempId': f"{last.strip()}_{first.strip()}_{team_raw.strip()}",
        }

        # エントリー番号は「このエントリーの識別子」であって「ここから新しいエントリー」
        # という印ではない。番号がペアの1行目に来る様式（全中）と2行目に来る様式
        # （三笠宮賜杯）があり、後者で番号を見た瞬間に切ると全ペアが1人ずつに割れる。
        # 区切りは「2人そろったら次」を主とし、番号は**すでに番号を持つエントリーの
        # 番号と食い違ったとき**だけ区切りに使う。
        new_entry = (
            current is None
            or len(current['information']) >= 2
            or (no is not None and current_no is not None and no != current_no)
        )
        if not new_entry and current.get('pending_team') and not player['team']:
            # 直前に見た「所属だけの行」を、後から来た2人目にも配る。
            player['team'] = current['pending_team']
            player['prefecture'] = player['prefecture'] or normalize(current.get('pending_pref'))[0]
        if new_entry:
            current = {'information': [player]}
            entries.append(current)
            pdf_numbers.append(no)
            current_no = no if no is not None else current_no
        else:
            current['information'].append(player)

    # ペア内で所属・都道府県を揃える。
    # ブラケット表は「1行目に都道府県、2行目に学校名」と縦に分けて書くため、
    # 行だけを見ると片方の選手にしか値が入らない。ダブルスのペアは同じ所属なので寄せてよい
    # （所属の異なる混成ペアは一般カテゴリに実在するが、その場合は両方の行に所属が書かれる）。
    if category != 'team':
        for e in entries:
            info = e['information']
            team = next((p['team'] for p in info if p['team']), '')
            pref = next((p['prefecture'] for p in info if p['prefecture']), None)
            for p in info:
                p['team'] = p['team'] or team
                p['prefecture'] = p['prefecture'] or pref
                p['tempId'] = f"{p['lastName']}_{p['firstName']}_{p['team']}"

    # id は行順で確定する（番号セルは縦位置がずれて拾えないことがあるため）。
    result = []
    for i, e in enumerate(entries, start=1):
        if category == 'team':
            pref, _ = normalize(e.get('prefecture'))
            result.append(
                {
                    'id': i,
                    'name': f"{e['team']}（{pref or ''}）",
                    'team': e['team'],
                    'prefecture': pref,
                    'category': 'team',
                }
            )
        else:
            info = e['information']
            names = '・'.join(p['lastName'] for p in info if p['lastName'])
            team = info[0]['team'] if info else ''
            result.append({'id': i, 'name': f'{names}（{team}）', 'information': info, 'category': 'doubles'})
    return result, pdf_numbers


def dump_table(columns, rows, labels, trace) -> str:
    values = labeling.column_values(columns, rows)
    lines = ['--- 検出した列 ---']
    for col in columns:
        role = labels.get(col.index, 'ignore')
        vs = [v for v in values.get(col.index, []) if v.strip()][:6]
        lines.append(
            f'  列{col.index:2d} [{col.side:5s}] x {col.x0:6.1f}–{col.x1:6.1f} '
            f'→ {labeling.ROLE_JA[role]:18s} ({trace.get(col.index, "")})'
        )
        lines.append(f'          例: {" | ".join(vs)}')
    lines.append(f'--- 検出した行: {len(rows)} 行 ---')
    for row in sorted(rows, key=lambda r: (getattr(r, 'page', 0), 0 if r.side == 'left' else 1, r.top))[:12]:
        cells = ' | '.join(f'{i}:{row.cells[i]}' for i in sorted(row.cells) if row.cells[i].strip())
        lines.append(f'  [{row.side:5s} y={row.top:6.1f}] {cells}')
    if len(rows) > 12:
        lines.append(f'  … 他 {len(rows) - 12} 行')
    return '\n'.join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description='大会ドロー表PDF → initialPlayers JSON')
    ap.add_argument('pdf')
    ap.add_argument('--pages', help='例: 1 / 1-3 / 1,3,5（既定は全ページ）')
    ap.add_argument('--out', '-o', help='出力JSONのパス（省略時は標準出力に出さずレポートのみ）')
    ap.add_argument('--category', choices=['doubles', 'team'], help='種目の自動判定を上書きする')
    ap.add_argument('--gap', type=float, help='列とみなす最小の空白幅(pt)。省略時は自動調整')
    ap.add_argument('--y-tol', type=float, help='同じ行とみなすY座標の許容誤差(pt)。省略時は自動調整')
    ap.add_argument('--roles', help='列の意味を手で指定する 例: "0=entry,1=surname,2=firstname"')
    ap.add_argument('--no-llm', action='store_true', help='うまく取れないときのローカルLLMへの問い合わせをしない')
    ap.add_argument('--model', default=labeling.DEFAULT_MODEL)
    ap.add_argument('--llm-rounds', type=int, default=3, help='LLMに直させる回数の上限')
    ap.add_argument('--profile', help=f'大会プロファイルを指定する（{", ".join(profiles.names())}）')
    ap.add_argument('--no-profile', action='store_true', help='プロファイルを使わず自動調整だけで解く')
    ap.add_argument('--dump-table', action='store_true', help='列と行の検出結果だけ表示して終わる')
    args = ap.parse_args()

    if not Path(args.pdf).exists():
        print(f'エラー: ファイルが見つかりません: {args.pdf}', file=sys.stderr)
        return 2

    if not geometry.has_text_layer(args.pdf):
        print(json.dumps({'error': 'no_text_layer'}, ensure_ascii=False))
        print('テキスト層がありません。画像/スキャンPDFです。', file=sys.stderr)
        print('ocrmypdf -l jpn でテキスト層を付けてから再実行してください（OCR経路）。', file=sys.stderr)
        return 3

    total = geometry.page_count(args.pdf)
    if args.pages:
        pages: list[int] = []
        for part in args.pages.split(','):
            if '-' in part:
                a, b = part.split('-', 1)
                pages.extend(range(int(a), int(b) + 1))
            else:
                pages.append(int(part))
    else:
        pages = list(range(1, total + 1))

    # ページごとに独立して処理する。ドロー表はページごとに列の位置が違うので、
    # 全ページの列をまとめて意味づけすると、あるページの座標が別のページの判定を狂わせる
    # （全中2024で 1ページ目だけ通したときと 1-2ページを通したときで結果が変わった）。
    print(f'PDF: {args.pdf} / 対象ページ: {pages}（全{total}ページ）')
    manual_roles = parse_roles(args.roles)
    entries: list[dict] = []
    pdf_numbers: list[int | None] = []
    category = args.category
    any_rows = False

    # 既に分かっている大会は、分かっている設定で解く。
    # 自動調整は未知の様式に対する保険で、毎回探索させる必要はない。
    profile = None
    if not args.no_profile:
        profile = profiles.by_name(args.profile) if args.profile else profiles.detect(args.pdf)
        if args.profile and profile is None:
            print(f'エラー: プロファイル「{args.profile}」は登録されていません（{", ".join(profiles.names())}）', file=sys.stderr)
            return 2
    if profile:
        print(f'プロファイル: {profile.name} を適用（{profile.note}）')
        if profile.category and not args.category:
            category = profile.category
        if profile.roles:
            manual_roles = {**profile.roles, **manual_roles}

    manual = args.gap is not None or args.y_tol is not None or profile is not None
    gap = args.gap if args.gap is not None else (profile.gap if profile else 6.0)
    y_tol = args.y_tol if args.y_tol is not None else (profile.y_tol if profile else 3.0)
    bracket_cut = profile.bracket_cut if profile else False

    for p in pages:
        print(f'\n=== ページ {p} ===')

        if manual:
            # 人が明示したパラメータは尊重する（自動調整で上書きしない）。
            best = tuning.attempt(
                args.pdf, p, gap, y_tol, category, build_entries, guess_category,
                prefecture_expected=tuning.prefecture_in_table(
                    geometry.build_table(args.pdf, p, gap=gap, tolerance=y_tol, bracket_cut=bracket_cut)[1]
                ),
                name_split_expected=True,
                bracket_cut=bracket_cut,
            )
            tried = [best] if best else []
        else:
            best, tried = tuning.auto_tune(args.pdf, p, category, build_entries, guess_category)

        if best is None:
            print('  文字を抽出できませんでした')
            continue
        any_rows = True
        if not manual:
            print(tuning.format_attempts(best, tried))

        cols, rows, labels, trace = best.columns, best.rows, best.labels, best.trace

        # 点数が低い＝未知の様式。ここで初めてローカルLLMに列の判定を任せる。
        # ふだんは呼ばない（規則で足りているときに呼んでも遅くなるだけのため）。
        # 一発勝負にせず、採点の内訳を返して直させる（tuning.repair）。
        if best.score < tuning.GOOD_ENOUGH and not args.no_llm:
            trouble = labeling.probe_ollama(args.model)
            if trouble:
                print(f'  点数が低いのでローカルLLMに聞きたいのですが、使える状態ではありません:')
                print(f'    {trouble}')
            else:
                print(f'  点数が低いため、ローカルLLM({args.model})に列の判定を聞きます（最大{args.llm_rounds}回）…')
                best = tuning.repair(
                    best,
                    category,
                    build_entries,
                    guess_category,
                    propose=lambda c, r, fb, temp: labeling.llm_labels(c, r, model=args.model, feedback=fb, temperature=temp),
                    rounds=args.llm_rounds,
                )
                cols, rows, labels, trace = best.columns, best.rows, best.labels, best.trace

        # 人が列の役割を指定していれば最後に上書きする。
        if manual_roles:
            for idx, role in manual_roles.items():
                if idx in labels:
                    labels[idx] = role
                    trace[idx] = '--roles で人が指定'
            cat3 = category or guess_category(labels, rows)
            best.entries, best.pdf_numbers = build_entries(rows, labels, cat3)
            best.category = cat3

        print(dump_table(cols, rows, labels, trace))
        for msg in tuning.diagnose(best):
            print(msg)
        if args.dump_table:
            continue

        category = category or best.category
        for r in getattr(build_entries, 'dropped_rows', []):
            print(f'  （表の外として除外）y={r.top:.0f} {r.text()[:60]}')
        entries.extend(best.entries)
        pdf_numbers.extend(best.pdf_numbers)

    if not any_rows:
        print('文字を1つも抽出できませんでした。--gap / --y-tol を調整するか、ページ指定を確認してください。', file=sys.stderr)
        return 4
    if args.dump_table:
        return 0

    # ページをまたいで id を振り直す。
    for i, e in enumerate(entries, start=1):
        e['id'] = i
    report = checks.build_report(
        entries,
        category,
        pdf_numbers if category == 'team' else None,
        has_prefecture=profile.has_prefecture if profile else True,
        splits_name=profile.splits_name if profile else True,
    )

    print()
    print(checks.format_report(report))

    if args.out:
        Path(args.out).write_text(json.dumps(entries, ensure_ascii=False, indent=1), encoding='utf-8')
        print(f'\n出力: {args.out}')
    print('\n※ このJSONをtoolへ入れる前に、上のレポートと件数を必ず人が確認すること。')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
