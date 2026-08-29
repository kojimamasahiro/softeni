"""大会中の選手交代を、抽出結果に上乗せする。

ドロー表PDFは大会が始まる前に配られる。開幕後に欠場や補欠との差し替えが起きても
PDFは出し直されないので、抽出しただけの JSON は途中から実態とずれる。

かといって出来上がった JSON を直接書き換えると、**PDFから作り直した瞬間に交代が消える**。
「誰がいつ誰に代わったのか」も残らない。そこで交代は別ファイルに書いておき、
抽出のたびに上乗せする。こうすると:

  - PDF は一次情報のまま残る
  - 同じコマンドを何度実行しても同じ結果になる
  - 交代の履歴が git の差分として読める

ファイルの形（`--substitutions` に渡す JSON）:

```json
[
  {
    "id": 12,
    "note": "2026-08-30 欠場のため補欠と交代",
    "players": [
      {"lastName": "山田", "firstName": "太郎"},
      {"lastName": "鈴木", "firstName": "一郎", "team": "別の大学"}
    ]
  },
  {"id": 5, "note": "...", "team": "○○大学"}
]
```

- `id` は**エントリー番号**（ドローの位置）。ここは交代しても動かさない
- `players` は交代後の**そのエントリーの全員**。片方だけ代わった場合も2名とも書く。
  「いま誰がその枠にいるか」がファイルを見ただけで分かるようにするため
- `team` を省いた選手は、元のエントリーの所属を引き継ぐ（同じ大学からの補欠が大半のため）
- 団体戦は選手名を持たないので `team` を直接書く
- `note` は任意だが、**日付と理由を書いておくこと**。後から見て判断できなくなる
"""

from __future__ import annotations

import json
from pathlib import Path


class SubstitutionError(ValueError):
    """交代ファイルの書き方が entries と噛み合っていない。"""


def load(path: str) -> list[dict]:
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    if not isinstance(data, list):
        raise SubstitutionError('交代ファイルは配列で書くこと（[{...}, {...}]）')
    return data


def apply(entries: list[dict], subs: list[dict]) -> list[str]:
    """entries を交代後の内容に書き換える。何を適用したかの説明を返す。

    書き方の誤りは**黙って無視せず必ず落とす**。id を打ち間違えた交代が
    「適用されたつもり」で消えるのがいちばん危ない。
    """
    by_id = {e['id']: e for e in entries}
    applied: list[str] = []

    for i, sub in enumerate(subs, start=1):
        if not isinstance(sub, dict) or 'id' not in sub:
            raise SubstitutionError(f'{i}件目: id がありません')
        eid = sub['id']
        entry = by_id.get(eid)
        if entry is None:
            raise SubstitutionError(
                f'{i}件目: エントリー番号 {eid} は抽出結果にありません'
                f'（1〜{max(by_id) if by_id else 0} の範囲で指定すること）'
            )
        note = f"（{sub['note']}）" if sub.get('note') else ''
        before = entry.get('name')

        if entry.get('category') == 'team':
            team = (sub.get('team') or '').strip()
            if not team:
                raise SubstitutionError(f'{i}件目（id={eid}）: 団体戦なので team を書くこと')
            entry['team'] = team
            entry['name'] = f"{team}（{entry.get('prefecture') or ''}）"
            applied.append(f'  id={eid} {before} → {entry["name"]}{note}')
            continue

        players = sub.get('players')
        if not isinstance(players, list) or not players:
            raise SubstitutionError(f'{i}件目（id={eid}）: players に交代後の選手を書くこと')
        expected = 1 if entry.get('category') == 'singles' else 2
        if len(players) != expected:
            raise SubstitutionError(
                f'{i}件目（id={eid}）: {entry.get("category")} なので players は'
                f'{expected}名で書くこと（{len(players)}名ある）。'
                f'片方だけの交代でも、交代後の全員を書く'
            )

        old = entry.get('information') or []
        fallback_team = next((p.get('team') for p in old if p.get('team')), '')
        fallback_pref = next((p.get('prefecture') for p in old if p.get('prefecture')), None)

        info = []
        for j, p in enumerate(players):
            last = (p.get('lastName') or '').strip()
            first = (p.get('firstName') or '').strip()
            if not last:
                raise SubstitutionError(f'{i}件目（id={eid}）: {j + 1}人目の lastName が空です')
            team = (p.get('team') or fallback_team).strip()
            pref = p.get('prefecture') or fallback_pref
            info.append(
                {
                    'lastName': last,
                    'firstName': first,
                    'team': team,
                    'prefecture': pref,
                    'playerId': p.get('playerId'),
                    # tempId は entries の組み立てと同じ形。プロファイルが
                    # 都道府県つき(4項目)を指定していれば、後段で上書きされる。
                    'tempId': f'{last}_{first}_{team}',
                }
            )
        entry['information'] = info
        team = info[0]['team']
        if entry.get('category') == 'singles':
            label = ' '.join(x for x in (info[0]['lastName'], info[0]['firstName']) if x)
        else:
            label = '・'.join(p['lastName'] for p in info if p['lastName'])
        entry['name'] = f'{label}（{team}）'
        applied.append(f'  id={eid} {before} → {entry["name"]}{note}')

    return applied
