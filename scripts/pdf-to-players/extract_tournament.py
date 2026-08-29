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
    --category doubles|singles|team   自動判定を上書きする（シングルスは自動判定しないので必須）
    --substitutions FILE      大会中の選手交代を上乗せする
    --gap / --y-tol           列・行の検出パラメータ（レイアウトが崩れるとき）
    --roles "0=entry,1=surname"  列の意味を手で指定する（最後の手段）
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import checks  # noqa: E402
import geometry  # noqa: E402
import labeling  # noqa: E402
import namesplit  # noqa: E402
import profiles  # noqa: E402
import substitutions  # noqa: E402
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


def _cell_boxes(row, labels: dict[int, str], role: str) -> list[tuple[float, float, str]]:
    """`cell()` と同じ列の中身を、文字の座標つきで取り出す。"""
    boxes: list[tuple[float, float, str]] = []
    for i, r in labels.items():
        if r == role:
            boxes.extend(getattr(row, 'char_boxes', {}).get(i, []))
    return sorted(boxes)


def to_int(s: str) -> int | None:
    s = s.strip().translate(str.maketrans('０１２３４５６７８９', '0123456789'))
    return int(s) if s.isdigit() else None


def guess_category(labels: dict[int, str], rows) -> str:
    """姓・名・氏名の列に実際の値が入っていれば個人戦、無ければ団体戦。

    **シングルスは自動判定しない。** ドロー表の見た目はダブルスと同じで、違いは
    「1つの番号に何名ぶら下がるか」だけ。行のまとまり方が崩れているときも同じ形に
    見えるので、機械が見分けると崩れをシングルスと誤認する。プロファイルか
    `--category singles` で人が明示する。
    """
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
        # 「番号の列に何か入っている行」ではなく「**番号として読める**行」を数える。
        # 見出しは大会名が列をまたぐので番号の列にも文字が入り、非空だけを条件にすると
        # 見出しが本体の範囲に含まれてしまう（文部科学大臣杯の団体戦で、見出しが
        # `部科学大臣杯全日` というチーム名として2件入っていた）。
        entry_tops = [
            r.top for r in page_rows if any(to_int(r.cells.get(i, '')) is not None for i in entry_cols)
        ]
        if not entry_tops:
            kept.extend(page_rows)
            continue
        lo, hi = min(entry_tops) - head_margin, max(entry_tops) + tail_margin
        for r in page_rows:
            (kept if lo <= r.top <= hi else dropped).append(r)
    return sorted(kept, key=lambda r: (getattr(r, 'page', 0), 0 if r.side == 'left' else 1, r.top)), dropped




def apply_profile_defaults(entries: list[dict], profile) -> None:
    """様式として決まっている値を、組み上がった entries に流し込む。

    ドロー表に書いていない情報（学生の大会なら所属連盟）は座標からは取れない。
    抽出の途中で混ぜると「PDFから読んだ値」と見分けがつかなくなるので、
    **最後にまとめて**入れる。
    """
    if profile is None or not profile.prefecture_default:
        return
    for e in entries:
        if e.get('category') == 'team':
            # 団体戦は選手名を持たず、エントリー自体が所属を持つ。
            e['prefecture'] = e.get('prefecture') or profile.prefecture_default
            e['name'] = f"{e['team']}（{e['prefecture']}）"
            continue
        for player in e.get('information') or []:
            player['prefecture'] = player['prefecture'] or profile.prefecture_default
            parts = [player['lastName'], player['firstName'], player['team']]
            if profile.tempid_includes_prefecture:
                parts.append(player['prefecture'])
            player['tempId'] = '_'.join(parts)


def apply_role_overrides(labels: dict[int, str], trace: dict[int, str], profile, manual_roles: dict[int, str]) -> bool:
    """検出した列の役割を、プロファイルと `--roles` で上書きする。上書きしたら True。

    `main()` と回帰テストの両方から呼ぶ。片方だけに書くと、テストが本番と違う
    経路を試すことになる。
    """
    changed = False

    # 氏名が1つの枠に入る様式（プロファイルで宣言）は、列がいくつに割れても氏名として
    # 扱う。均等割り付けの氏名はページによって1〜3列に割れ、2列に割れたページだけ
    # 「姓の列と名の列」と誤読されて `木|村奏都` のようにずれる（インカレp2で実際に起きた）。
    if profile is not None and profile.name_in_one_column:
        for idx, role in list(labels.items()):
            if role in ('surname', 'firstname'):
                labels[idx] = 'name'
                trace[idx] = 'プロファイル: 氏名は1つの枠（姓名は字間で分割）'
                changed = True

    # 人が列の役割を指定していれば最後に上書きする。
    for idx, role in (manual_roles or {}).items():
        if idx in labels:
            labels[idx] = role
            trace[idx] = '--roles で人が指定'
            changed = True
    return changed


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
        split_method = ''

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
            # 姓名が1列にまとまっている場合。均等割り付けは姓と名それぞれに掛かって
            # いるので、境目の字間だけがわずかに広い。そこを境目として割る
            # （namesplit.py）。字間に信号が無い行だけ既存選手データに落とし、
            # それでも決まらなければ分割しない（firstName が空のまま
            # review_name_split に出て、人が見る）。
            boxes = _cell_boxes(row, labels, 'name')
            last, first, split_method = namesplit.split_name(whole, boxes, team=team_raw.strip())

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
        if split_method:
            # 姓名をどの根拠で割ったか。出力する直前に落とす（レポートに出すためだけの印）。
            player['_split'] = split_method

        # エントリー番号は「このエントリーの識別子」であって「ここから新しいエントリー」
        # という印ではない。番号がペアの1行目に来る様式（全中）と2行目に来る様式
        # （三笠宮賜杯）があり、後者で番号を見た瞬間に切ると全ペアが1人ずつに割れる。
        # 区切りは「2人そろったら次」を主とし、番号は**すでに番号を持つエントリーの
        # 番号と食い違ったとき**だけ区切りに使う。
        # シングルスは1名で1エントリー。ダブルスの「2人そろったら次」を
        # 「1人そろったら次」に読み替える。
        per_entry = 1 if category == 'singles' else 2
        new_entry = (
            current is None
            or len(current['information']) >= per_entry
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
                # 所属は氏名とは別の行に書かれるので、ここまで来ないと分からない。
                # 字間でも姓名の辞書でも決まらなかった人だけ、**所属つきで**既存データを
                # 引き直す。同姓同名の別人を避けられるうえ、過去に別の割り方で
                # 登録されている同一人物にも当たる。
                if not p['firstName'] and p['team']:
                    found = namesplit.split_by_team_corpus(p['lastName'], p['team'])
                    if found:
                        p['lastName'], p['firstName'] = found
                        p['_split'] = 'team_corpus'
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
            team = info[0]['team'] if info else ''
            if category == 'singles':
                # シングルスは1名なので姓だけでは誰か分からない。既存データに合わせて
                # 「姓 名（所属）」と姓名を空白で繋ぐ（tools/hjs-2026/01_mens_singles.json）。
                p = info[0] if info else {}
                label = ' '.join(x for x in (p.get('lastName'), p.get('firstName')) if x)
            else:
                label = '・'.join(p['lastName'] for p in info if p['lastName'])
            result.append({'id': i, 'name': f'{label}（{team}）', 'information': info, 'category': category})
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
    ap.add_argument('--category', choices=['doubles', 'singles', 'team'], help='種目の自動判定を上書きする')
    ap.add_argument(
        '--substitutions',
        help='大会中の選手交代を書いたJSON。抽出結果に上乗せする（substitutions.py の説明を見ること）',
    )
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

        if apply_role_overrides(labels, trace, profile, manual_roles):
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
    # 交代は「抽出が終わったあと・様式の既定値を入れる前」に当てる。あとから当てると
    # 交代で入った選手だけ prefecture や tempId の形が揃わない。
    if args.substitutions:
        try:
            applied = substitutions.apply(entries, substitutions.load(args.substitutions))
        except (substitutions.SubstitutionError, OSError, json.JSONDecodeError) as e:
            print(f'交代ファイルを読めませんでした: {e}', file=sys.stderr)
            return 5
        print()
        print(f'--- 選手交代を {len(applied)} 件 適用しました（{args.substitutions}）---')
        for line in applied:
            print(line)

    apply_profile_defaults(entries, profile)

    # 氏名が1列の様式で、姓名をどの根拠で割ったかの内訳。何をどこまで機械が決めたのかを
    # 人に見せないと、`clean: true` を「全部確かめた」と読み違えられる。
    split_methods = Counter(
        p.pop('_split') for e in entries for p in e.get('information') or [] if '_split' in p
    )
    if split_methods:
        labels_ja = {
            'geometry': '字間（姓と名それぞれの均等割り付け）',
            'team_corpus': '既存の選手データと一致（所属も一致）',
            'corpus': '既存の選手データと一致（氏名のみ）',
            'dictionary': '姓と名の辞書に1通りだけ一致',
            'unsplit': '決められず未分割（firstName は空）',
        }
        print()
        print('--- 姓名の分割 ---')
        total = sum(split_methods.values())
        for method, count in split_methods.most_common():
            print(f'  {labels_ja.get(method, method)}: {count}名 / {total}名')
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
