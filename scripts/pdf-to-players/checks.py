"""抽出結果の決定的な検証（LLM不使用）。

元PDFに誤植・列ズレ・OCR誤認があり得るという前提なので、
「きれいに出た」ことより「どこが怪しいか」を人に見せることを優先する。
自動では何も直さない。直すと、直した箇所が人の目から消えるため。

項目は SKILL.md の「最終検証レポート」節に対応している。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from prefectures import normalize


@dataclass
class Report:
    category: str
    count: int
    duplicate_ids: list[int] = field(default_factory=list)
    missing_ids: list[int] = field(default_factory=list)
    prefecture_not_in_dict: list[dict] = field(default_factory=list)
    entries_missing_2nd_player: list[int] = field(default_factory=list)
    review_name_split: list[dict] = field(default_factory=list)
    order_mismatch_warnings: list[dict] = field(default_factory=list)
    empty_team: list[int] = field(default_factory=list)
    duplicate_players: list[dict] = field(default_factory=list)

    @property
    def clean(self) -> bool:
        return not any(
            [
                self.duplicate_ids,
                self.missing_ids,
                self.prefecture_not_in_dict,
                self.entries_missing_2nd_player,
                self.review_name_split,
                self.order_mismatch_warnings,
                self.empty_team,
                self.duplicate_players,
            ]
        )

    def to_dict(self) -> dict:
        return {
            'category': self.category,
            'count': self.count,
            'clean': self.clean,
            'duplicate_ids': self.duplicate_ids,
            'missing_ids': self.missing_ids,
            'prefecture_not_in_dict': self.prefecture_not_in_dict,
            'entries_missing_2nd_player': self.entries_missing_2nd_player,
            'review_name_split': self.review_name_split,
            'order_mismatch_warnings': self.order_mismatch_warnings,
            'empty_team': self.empty_team,
            'duplicate_players': self.duplicate_players,
        }


def _id_problems(ids: list[int]) -> tuple[list[int], list[int]]:
    seen: dict[int, int] = {}
    for i in ids:
        seen[i] = seen.get(i, 0) + 1
    duplicate = sorted(k for k, v in seen.items() if v > 1)
    missing: list[int] = []
    if ids:
        lo, hi = min(ids), max(ids)
        # 連番が正であるという前提は「1から始まっているとき」だけ置く。
        # ページ単位で抽出すると 26 始まりのような正当な範囲があるため。
        present = set(ids)
        missing = [n for n in range(lo, hi + 1) if n not in present]
    return duplicate, missing


def build_report(
    entries: list[dict],
    category: str,
    pdf_numbers: list[int] | None = None,
    has_prefecture: bool = True,
    splits_name: bool = True,
) -> Report:
    """検証レポートを作る。

    `has_prefecture` / `splits_name` は**その様式に存在しない項目を要確認に出さない**ため。
    都道府県欄の無い大会で全件が prefecture_not_in_dict に並ぶと、
    本当に見るべき警告が埋もれる。"""
    ids = [e['id'] for e in entries]
    duplicate, missing = _id_problems(ids)
    report = Report(category=category, count=len(entries), duplicate_ids=duplicate, missing_ids=missing)

    for e in entries:
        if category == 'team':
            if has_prefecture:
                pref = e.get('prefecture')
                _, known = normalize(pref)
                if not known:
                    report.prefecture_not_in_dict.append({'id': e['id'], 'prefecture': pref})
            if not (e.get('team') or '').strip():
                report.empty_team.append(e['id'])
            continue

        info = e.get('information') or []
        # シングルスは1エントリー1名。ダブルスの「2人目が無い」は当てはまらない。
        if category != 'singles' and len(info) < 2:
            report.entries_missing_2nd_player.append(e['id'])
        for p in info:
            if has_prefecture:
                _, known = normalize(p.get('prefecture'))
                if not known:
                    report.prefecture_not_in_dict.append({'id': e['id'], 'prefecture': p.get('prefecture')})
            last = (p.get('lastName') or '').strip()
            first = (p.get('firstName') or '').strip()
            # 姓4文字以上・名が空は珍しい。列ズレか姓名分割の失敗を疑う。
            if splits_name and (len(last) >= 4 or not first or not last):
                report.review_name_split.append(
                    {'id': e['id'], 'lastName': last, 'firstName': first, 'team': p.get('team')}
                )
            if not (p.get('team') or '').strip() and e['id'] not in report.empty_team:
                report.empty_team.append(e['id'])

    # 同じ顔ぶれが2回出てくるのを検出する。
    # ドロー表の下部には決勝進出ペアや優勝ペアを再掲する枠があり、抽出すると重複する。
    # 元データ由来なので機械では消さず、人に見せて判断してもらう。
    seen: dict[str, int] = {}
    for e in entries:
        if category == 'team':
            key = f"{e.get('team')}|{e.get('prefecture')}"
        else:
            key = '|'.join(sorted(f"{p.get('lastName')}{p.get('firstName')}" for p in e.get('information') or []))
        if not key.strip('|'):
            continue
        if key in seen:
            report.duplicate_players.append({'id': e['id'], 'same_as_id': seen[key], 'name': e.get('name')})
        else:
            seen[key] = e['id']

    if category == 'team' and pdf_numbers:
        # PDFから拾えた番号と、行順で振ったidの食い違いを警告する。
        # 番号セルは縦位置がずれて行から漏れることがあるため、行順のほうを正とする。
        for e, n in zip(entries, pdf_numbers):
            if n is not None and n != e['id']:
                report.order_mismatch_warnings.append({'row_order_id': e['id'], 'pdf_number': n, 'name': e.get('name')})

    return report


def format_report(report: Report) -> str:
    r = report
    lines = [f"種目: {r.category} / 抽出件数: {r.count} / clean: {r.clean}"]
    def add(label: str, items, fmt=str):
        if items:
            lines.append(f'  [要確認] {label}: {len(items)}件')
            for it in items[:10]:
                lines.append(f'      {fmt(it)}')
            if len(items) > 10:
                lines.append(f'      … 他 {len(items) - 10} 件')

    add('id重複 (duplicate_ids)', r.duplicate_ids)
    add('id欠番 (missing_ids)', r.missing_ids)
    add('都道府県辞書に無い (prefecture_not_in_dict)', r.prefecture_not_in_dict)
    add('ペアの2人目が無い (entries_missing_2nd_player)', r.entries_missing_2nd_player)
    add('姓名分割の目視推奨 (review_name_split)', r.review_name_split)
    add('番号と行順の食い違い (order_mismatch_warnings)', r.order_mismatch_warnings)
    add('所属が空 (empty_team)', r.empty_team)
    add('同じ顔ぶれの重複 (duplicate_players)', r.duplicate_players)
    if r.clean:
        lines.append('  引っかかった項目はありません（件数は必ず人が確認すること）')
    return '\n'.join(lines)
