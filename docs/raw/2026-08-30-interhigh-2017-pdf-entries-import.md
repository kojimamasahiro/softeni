# 2017年インターハイ結果PDFからのエントリー抽出（tools/ ステージング運用）

## 背景

ユーザーから2017年度全国高等学校総合体育大会ソフトテニス競技大会の記録報告書PDF
（91ページ）を渡され、`highschool-championship/2017/` の4カテゴリ
（doubles-none-boys / doubles-none-girls / team-none-boys / team-none-girls）を
充実させたい、との依頼を受けた。ページ範囲はユーザー指定
（男子ダブルス15-22 / 男子団体25 / 女子ダブルス51-58 / 女子団体61）で、PDF内の見出し
（「男子個人選手権（その1〜8）」「男子団体戦」等）と一致することを確認済み。

2019年の前例（[2026-08-20-interhigh-2019-pdf-entries-import.md](2026-08-20-interhigh-2019-pdf-entries-import.md)）
と同じ理由（予選ラウンドはブラケット線の座標追跡では勝敗を確実に自動判定できない）を
説明したところ、ユーザーの判断は「選手名簿のみで結果はこちらが入力する。tools/配下に
ディレクトリを切って、他大会と同様に initialPlayers.json のみ置いてほしい」だった。

## 実施したこと

- `scripts/pdf/highschool_championship_entries.py`（2018/2019で検証済み、変更なし）が
  2017年PDFでもそのまま通ることを確認した。DBL_LEFT/DBL_RIGHT の固定X座標しきい値
  （左ブロック分割点=100pt、右ブロック分割点=405pt等）が2017年PDFの実測座標とも一致し、
  318エントリー×2種目・48チーム×2種目のすべてで entryNo の重複・欠番ゼロ、氏名/所属/
  都道府県の空欄ゼロだった。**同一レイアウトが複数年度で使い回されている**ことの追加傍証。
- 一般化ずみの新パイプライン（`scripts/pdf-to-players/extract_tournament.py`、列の
  自動検出＋自動調整）でも試したが、**このブラケット様式では使わない方が良い**という
  結論に至った。理由は「行ごとの列本数がページ内容によって変わる」問題:
  姓・名それぞれが1〜2文字ずつの固定スロットに入る様式（`highschool_championship_entries.py`
  の「パターン2」）は、2文字分のスロットが隣接データで偶然くっつくと1列に、離れると2列に
  自動検出され、**同じ大会・同じブロックのページ間でも列数が変わる**。`--roles` は列
  インデックスで固定するため、ページ間で列数が変わると別のページに誤って別役割を割り当てる
  （実際、右段の「姓」が「所属」と誤認され、続く「名」列が姓/名に誤分割されるバグが
  複数ページで発生し、1ページ目では発生しなかった）。座標のしきい値を直接使う
  `highschool_championship_entries.py` はこの種の列数変動に影響されないため、この
  レイアウト系統では今後も専用スクリプトを使うべき。
- 都道府県: 2017年PDFは個人戦・団体戦とも都道府県が**省略形のみ**（「奈良」「三重」等）で
  印字されていた。2019年の記録（既存wikiの記載）は「団体戦概況ページだけ省略形」だったため、
  年度によって省略される範囲が違う。`node scripts/normalize-prefectures.mjs` は
  `data/tournaments/details/` 配下の実ファイルに対して直接動くツールで、今回は
  `data/tournaments/details` 側にはまだ書き込みたくなかった（結果未入力のうちは
  tools/ ステージングだけにしたいというユーザーの意向）ため、同じ補完ロジック
  （47都道府県の接尾辞マップ＋東京都/大阪府/京都府/北海道の特例）をスクリプト外で
  一時ディレクトリ上のdetails形式JSONに適用してから `details_to_initial_players.py`
  に渡した。適用時は `participants[].id`（`姓_名_学校_都道府県` 形式）と
  `entries[].playerIds` の参照を両方張り替える必要がある（片方だけ変えると
  `details_to_initial_players.py` の `by_id` 参照が壊れる）。47都道府県すべて解決、
  未解決値なし。
- 出力は `data/tournaments/details/highschool-championship/2017/` には書かず、
  `tools/highschool-championship-2017/{doubles,team}-none-{boys,girls}.initialPlayers.json`
  にのみ置いた（`highschool-championship-2018`/`-2019` という空の同名ディレクトリが
  既に `tools/` 配下にあり、命名の前例として踏襲した）。この4ファイルを
  `tools/tournament3` に貼り付けてPDFを見ながら手動でスコア入力する運用を想定している
  （`matches`/`results` を含む最終形は、その入力が終わってから
  `data/tournaments/details/highschool-championship/2017/` に反映する）。

## 未解決 / 今後の課題

- 予選ラウンドの `matches`/`results` は今回も生成していない（方針は2019年と同じ）。
  ユーザーが `tools/tournament3` で手動入力する予定。
- `tools/highschool-championship-2017/` のファイルが実際に `tools/tournament3` へ
  問題なく読み込めるかは未検証（次回のスコア入力作業で確認されるはず）。

## Compile Log

反映先: [docs/wiki/data-import.md](../wiki/data-import.md)（`highschool_championship_entries.py`
の項目に、2017年でも同じ座標しきい値が通った旨と、都道府県省略の範囲が年度で違う旨を追記。
また `scripts/pdf-to-players/extract_tournament.py` を**このレイアウト系統には使わない**
という判断を明記）。

wiki に載せたもの:

- 2017年PDFでも既存の固定座標しきい値がそのまま通った実績（複数年度で座標が安定している
  ことの追加傍証として今後の年度処理に有用）
- 汎用パイプライン（scripts/pdf-to-players）がこのブラケット様式で列数不安定になる具体的な
  失敗パターン（今後同種PDFに汎用パイプラインを使おうとしたときに同じ轍を踏まないため）
- 都道府県の省略範囲が年度によって違う点（個人戦も省略される年がある）

意図的に載せなかったもの:

- 都道府県接尾辞補完をスクリプト外でその場限りに適用した具体的なPythonコード —
  一時ファイルに対する使い捨て処理であり、正式なスクリプトとして残す判断はまだしていない
  （`data/tournaments/details` に書く運用に戻すなら `normalize-prefectures.mjs` を
  そのまま使えばよく、別実装を残す必要がない）。
- 座標の生の実測値の比較表 — 「2018/2019と同じ値で通った」という結論だけが今後の
  年度処理に意味を持つため。
