# アジア競技大会2026 団体戦の決勝と混合ダブルスの結果取り込み

## 状況

2026-09-22、「ミックスダブルスの結果まで出た。更新してほしい」という依頼。
9/20 の団体戦（準決勝・決勝）と 9/21 の混合ダブルス（予選リーグから決勝まで）を
公式リザルトサイトから取り込んだ。9/22 の男女シングルスは対象外（まだ進行中）。

## 結果

| 種目 | 優勝 | 準優勝 | 3位（準決勝敗退・2つ） |
|---|---|---|---|
| 女子団体 | **日本**（決勝 2-1 チャイニーズ・タイペイ） | チャイニーズ・タイペイ | 韓国・フィリピン |
| 男子団体 | **日本**（決勝 2-0 チャイニーズ・タイペイ） | チャイニーズ・タイペイ | 韓国・インドネシア |
| 混合ダブルス | YU Kai-wen・HUANG Shih-yuan（チャイニーズ・タイペイ） | **上松・天間**（決勝 4-5） | **前田・丸山**・KIM Yeon-hwa・PARK Jaekyu（韓国） |

- 女子団体決勝は 第1対戦 天間・宮前 5-0 / 第2対戦 岩倉 1-4 / 第3対戦 前田・中谷 5-0
- 男子団体決勝は 第1対戦 内本・黒坂 5-0 / 第2対戦 上松 4-1 / 第3対戦は未実施
- 混合は33試合（予選リーグ22・1回戦4・準々決勝4・準決勝2・決勝1）。すべて本数で決着（棄権・不戦勝なし）

## 混合ダブルスの推定が当たった

ADR-021 で「各組上位2組が決勝Tへ」を**推定**として出していた。公式の決勝Tに入った12組は
各組の上位2組とちょうど一致した（取り込みスクリプトが試合から計算した組内順位で確認）。
→ `format.assumptions` を外し、`summary` に事実として書いた。

公式の組み合わせで新しく分かったこと: **1回戦が不戦勝だったのは A・C・D・F組の1位**。
B・E組（4組ずつの組）の1位は1回戦から出た。**なぜその4組かは公表されていない**ので、
「組の大きさで決まる」のような規則としては書いていない（推定を増やさない）。

席順（公式の Brackets。1回戦 Match 1〜8）:

| 1回戦 | 上 | 下 |
|---|---|---|
| 1 | A1 上松・天間 | （不戦勝） |
| 2 | F2 ネパール | E2 インドネシア SANGER・ARASY |
| 3 | B1 韓国 KIM・PARK | D2 フィリピン MANALAC・NUGUIT |
| 4 | C1 チャイニーズ・タイペイ LIN・CHIANG | （不戦勝） |
| 5 | D1 韓国 KIM・LEE | （不戦勝） |
| 6 | C2 インドネシア LALUYAN・NAFIIAH | E1 前田・丸山 |
| 7 | B2 インド | A2 フィリピン SANOSA・NUGUIT |
| 8 | F1 チャイニーズ・タイペイ YU・HUANG | （不戦勝） |

不戦勝の側は `knockoutDraw.slots` で `null`。**席をわざと入れ替える（F2 と C2）と `bracket:verify` が
混合のファイルで2件の不一致を出す**ことを確かめ、席順が検証の対象に入っていることを確認した。

## 読み取りで踏んだ罠: メダルマッチは頭文字表記になる

準決勝・決勝の結果ページは、ブラウザの表示幅が狭いと選手名が `TEMMA R` `LEE H` のような
**姓＋名の頭文字**で出る（`.show-mobile` のスパン）。フルネームは同じ DOM の `.hide-mobile` 側にある。
予選リーグのページはフルネームだった（レイアウトが違う）。

頭文字のままだと**韓国男子の `LEE H` が LEE Hyungwon か LEE Haneul か決められない**。
一日目のペアの組み方から推し量ることはできるが、推測になる。表示幅を 1440px に広げて
フルネームで読み直した（`LEE H` は LEE Hyungwon だった）。
一日目の教訓（国コードとの照合）はそのまま使い、6試合とも1回目で一致した。

## 取り込みの変更

- `draw.json`: 団体の準決勝4試合に結果とオーダー、決勝2試合（`w-f` / `m-f`）を追加。
  混合は予選リーグ22試合に結果、決勝T11試合（`x-r2`〜`x-f`）と `knockoutDraw` を追加
- `build_details.py`: ラウンドに「1回戦」を足した（敗退は `1回戦敗退` = `{kind:'round', round:1}`）
- `information/asian-games.json`: 混合の `format`（上記）

## 選手の通算成績への影響

prebuild の差分は `data/players/uematsu-toshiki` と `data/players/maruyama-kaito` の `analysis.json` だけ。
上松は +4試合（予選 5-0・準々決勝 5-2・準決勝 5-1 の勝ち、決勝 4-5 の負け）、ゲームは +19-8 で、
転記した本数と一致した。**アジア大会の試合が日本選手の通算成績に入り始めた**（ランキングは除外済み）。
外国選手も勝敗を持つようになったので、open-questions の「結果が入った後の外国選手の扱い」が現実の論点になった。

## 検査

check:entries / check:team-match-details / check:orphans / check:placements /
bracket:verify（472大会・不一致0。席の入れ替えで落ちることも確認）/ check-name-splits --strict /
check:upcoming / format:test、すべて問題なし。highschool:pipeline と prebuild も流した。

wiki の予算超過が5ページ出るが（data-import / data-model / public-pages / deployment / highschool）、
**すべて main の時点で同じ字数で超えていたもの**で、今回の変更では触っていない。

## 関連

- [upcoming-tournaments-runbook.md](../wiki/upcoming-tournaments-runbook.md) S11
- [ADR-021](../adr/ADR-021-category-competition-format.md) / [ADR-015](../adr/ADR-015-knockout-draw-by-group.md)
- [2026-09-18-asian-games-day1-results.md](./2026-09-18-asian-games-day1-results.md)

## 参考文献

- https://results.asiangames2026.org/#/discipline/TST/schedule/daily/2026-09-20
- https://results.asiangames2026.org/#/discipline/TST/schedule/daily/2026-09-21

## Compile Log

- **コンパイルした**: 状態と残作業・頭文字表記の罠・不戦勝の組 → runbook S11 /
  推定の確定 → ADR-021 の Implementation Status と `format.summary` /
  外国選手が勝敗を持ち始めた件 → `open-questions.md`（混合の推定の項は解消したので消した）
- **出さなかったもの**:
  - メダル表・試合ごとのスコア … details が正。wiki に転記すると二重管理になる
  - 席順の表 … `knockoutDraw` が正。raw にだけ残した
  - 上松の成績の増分 … 検算の記録。wiki には不要
  - wiki の予算超過5ページ … 今回と無関係。圧縮は別作業
