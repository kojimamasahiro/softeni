"""`tempId`（tool へ渡す選手の仮識別子）の組み立て。

**形は `姓_名_学校_都道府県` の4項目**。都道府県の代わりに所属連盟名
（`学連` / `日本学連` / `高体連` 等）が入る大会では、それを4項目目に使う。

なぜ4項目か: `scripts/pdf/tournament_results_common.py` の `build()` が
`participants[].id` と `entries[].playerIds` をこの形で組み直しており、
`data/tournaments/details/**` は全大会が4項目で揃っている。details を作る経路は
tempId を見ないので3項目でも通るが、`tools/tournament3` に貼って人がスコアを入力し、
その出力を書き出す経路だけは tempId がそのまま識別子になるため、同じ大会の
年度間で識別子の形がずれる。

2026-08 時点のこのCLIは3項目を既定にしていた（当時「実データは新旧すべて3項目」と
調べ違えたため）。2026-09-16 に4項目へ変更。経緯は
`docs/raw/2026-09-04-zennihon-championship-2016-pdf-entries-import.md`。

組み立てはこの関数だけに置く。以前は抽出・都道府県の既定値の適用・選手交代の3経路が
それぞれ別に組み立てており、片方だけ形が変わる余地があった。
"""

from __future__ import annotations


def make_temp_id(last: str | None, first: str | None, team: str | None, prefecture: str | None) -> str:
    """`姓_名_学校_都道府県` を組み立てる。

    都道府県が空のときだけ3項目になる（抽出の途中段階では都道府県がまだ決まって
    いないことがあり、そこで `_` を増やすと値の無い項目が識別子に混じるため）。
    """
    parts = [(last or '').strip(), (first or '').strip(), (team or '').strip()]
    pref = (prefecture or '').strip()
    if pref:
        parts.append(pref)
    return '_'.join(parts)
