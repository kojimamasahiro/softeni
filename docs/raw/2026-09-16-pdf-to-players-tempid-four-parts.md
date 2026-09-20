# `extract_tournament.py` の tempId を4項目へ変更

日付: 2026-09-16
きっかけ: 東日本・西日本のエントリー取り込み（[2026-09-14-east-japan-…](2026-09-14-east-japan-2024-pdf-entries-import.md) /
[2026-09-15-west-japan-…](2026-09-15-west-japan-2024-pdf-entries-import.md)）のあと、
ユーザーから「今回のやり取りで skill の更新が必要か確かめて」と依頼された。

## 何が食い違っていたか

| 場所 | 変更前の記述・挙動 |
|---|---|
| skill `tournament-pdf-to-players` | 「tempId は `姓_名_学校` の3項目。都道府県は入れない。**実データは新旧すべて3項目**」 |
| `scripts/pdf-to-players/README.md` | 同上（「SKILL.md の4項目は誤り」と明記） |
| `scripts/pdf-to-players/extract_tournament.py` | 既定3項目。`profiles.py` の `tempid_includes_prefecture` でインカレだけ4項目 |
| `test_regression.py` | 「3項目（実データに合わせる。SKILL.md の4項目は誤り）」を期待値に固定 |
| 実データ | `data/tournaments/details/**` は**全大会が4項目**。`tools/` も4項目が多数派 |

実測（2026-09-16、`tools/*/*.initialPlayers.json`）: **4項目 14,734件・19フォルダ / 3項目 8,328件・7フォルダ**。
3項目は `highschool-championship-2012`〜`-2017` と `west-japan-2026` の旧ファイルのみ。
2026-08 の「新旧すべて3項目」は調べ違いで、2026-09-04 の天皇杯統一（4項目）より前の観測だった。

## 直したもの

- **skill**（`.claude/skills/tournament-pdf-to-players/SKILL.md`）: tempId を4項目に修正（JSONの例も）。
  あわせて今回の取り込みで分かった「一般カテゴリのブラケット表」の節を新設し、ステージング節に
  `information/*.json` の追加手順（JSTA の年度別結果ページを一次ソースにする）を追記。
- **CLI**: `identity.py` を新設し `make_temp_id()` に組み立てを集約。
  `extract_tournament.py` の3経路（抽出時・都道府県の既定値の適用・`substitutions.py` の選手交代）が
  それぞれ別に組み立てていたのを1か所にした。**都道府県が空のときだけ3項目**になる
  （抽出の途中段階では所属も県もまだ決まっていない行があるため）。
- `profiles.py` の `tempid_includes_prefecture` は不要になったので削除（インカレ2件の指定も）。
- `test_regression.py` の期待値を4項目へ更新（`147/147 passed`）。
- fixture（全中2024 p1）で実際の出力が `保海_郁弥_朝桜中学校_滋賀県` になることを確認。
- README の該当節を書き直し。

## 直していないもの

- **`scripts/pdf/details_to_initial_players.py` は既定3項目のまま**（`--tempid-with-prefecture` で4項目）。
  同じ理由で4項目が正しいが、こちらは別スクリプトなので独立に判断する。**要判断**。
- `tools/highschool-championship-2012`〜`-2017`、`tools/west-japan-2026` の3項目ファイル（8,328件）。
  2026-09-04 に天皇杯だけ揃えたときと同じく、触るときに揃えるか決める。

## Compile Log（2026-09-16）

`docs/wiki/data-import.md` の `extract_tournament.py` の節に tempId 4項目と `identity.py` への集約を追記し、
`details_to_initial_players.py` の節に「このスクリプトだけ既定が3項目」と明記した。

**取り込んだもの**
- CLI の既定が4項目になったこと（利用者が最初に知りたい挙動）
- 2つのスクリプトで既定が違うこと（取り違えると年度間で識別子がずれる）

**入れなかったもの**
- 3項目/4項目の実測件数: 時点依存の数値。raw と skill に残せば足りる
- 変更前の食い違いの一覧: 履歴。raw に残す
- `identity.py` の実装詳細: コードのドキュメント文字列が正
