# 2016年インターハイ結果PDFからのエントリー抽出

## 背景

[2017年の作業](2026-08-30-interhigh-2017-pdf-entries-import.md)に続けて、同じセッション内で
ユーザーから2016年度（平成28年度）全国高等学校総合体育大会ソフトテニス競技大会の記録PDF
（`2016_C06_40.pdf`, 10ページ）を渡され、男子のみ（男子ダブルス p1-8、男子団体 p10）の
選手名簿を同じ運用（`tools/highschool-championship-2016/` に initialPlayers.json のみ配置、
`data/tournaments/details` へは書かない）で作ってほしいと依頼された。

## 実施したこと

2017年で確立した手順をそのまま踏襲した。新しい判断や修正は発生していない:

1. `scripts/pdf/highschool_championship_entries.py --year 2016 --boys-doubles-pages 1-8
   --boys-team-page 10 --out <scratch>` で抽出（座標しきい値は変更なしでそのまま通った）。
   男子ダブルス322エントリー・男子団体48校、entryNo重複・欠番・空欄いずれもゼロ。
   ページ9「男子個人戦ベスト8以降」は既知の4エントリー（No.1/61/121/161）の勝敗再掲のみで
   新規エントリーは無いため対象外とした（ユーザー指定どおり1-8のみが対象）。
2. 都道府県は個人戦・団体戦とも省略形（「奈良」等）だったため、2017年と同じ接尾辞補完を
   一時ファイルに適用（`participants[].id` と `entries[].playerIds` を両方張り替え）。
3. `scripts/pdf/details_to_initial_players.py` で `tools/highschool-championship-2016/
   {doubles,team}-none-boys.initialPlayers.json` を生成。`data/tournaments/details` には
   書いていない。

抽出結果を画像と照合（entryNo 1,22,42,62,...,322 を無作為に抽出して目視）し、全件一致を確認した。

## 追記: 女子（別PDF `2016_C05_40.pdf`）

同日、別ファイルで女子分（女子ダブルス p1-8、女子団体 p10。男子と同じページ構成）の依頼が
続いた。同じ手順をそのまま適用し、`tools/highschool-championship-2016/
{doubles,team}-none-girls.initialPlayers.json` を追加した。女子ダブルス314エントリー・
女子団体48校、entryNo重複・欠番・空欄いずれもゼロ。座標しきい値・接尾辞補完手順とも
男子から変更なし。これで2016年は男女とも `tools/highschool-championship-2016/` に
4カテゴリ揃った。

## Compile Log

反映先: [docs/wiki/data-import.md](../wiki/data-import.md)。

wiki に載せたもの:

- 2016年PDFでも同じ座標しきい値・同じtools/ステージング運用がそのまま通った旨
  （2017年に続き2年分目の再現性の傍証として、`highschool_championship_entries.py`の
  項目の年度リストに追記する程度の軽微な更新）。

意図的に載せなかったもの:

- 個々のentryNo照合結果 — 2017年ノートと同様、新しい知見を含まないため。
- 「ベスト8以降」ページを対象外とした判断の詳細 — ユーザーがページ範囲を明示指定しており、
  判断の余地がそもそ無かったため恒久ドキュメントに残す価値が無い。
