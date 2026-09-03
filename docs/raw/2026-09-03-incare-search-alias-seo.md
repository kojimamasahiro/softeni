# インカレ（全日本学生選手権大会）の検索語対策（2026-09-03）

## きっかけ

ユーザーからの指摘:

> 全日本学生選手権大会だが、SEO的にはインカレの方が検索されると思うが、対策はできるか？

[全中の「大会名の表記と検索語の乖離」](../wiki/seo.md#大会名の表記と検索語の乖離missing-literal2026-08-28-追加)
と全く同じ型の疑いだったため、同じ手順（SERP実測 → 乖離の有無を確認 → 対策）で調べた。

## SERP実測

WebSearchで代替実測（2026-09-03）。

- 「ソフトテニス インカレ 結果」: 上位のほぼ全てが「インカレ」を title に literal で含む
  （zutto-sports「ソフトテニスインカレ2026結果速報」、princess-of-stn「全日本インカレ結果
  まとめ」複数件、sposoku「全日本インカレ学生ソフトテニス選手権2023」）。
- 「ソフトテニス 全日本学生選手権大会 結果」でも、上位の実質的な内容は「全日本インカレ
  ソフトテニス」「三笠宮賜杯全日本学生ソフトテニス選手権大会」など、**「ソフトテニス」も
  「インカレ」も併記した表記**が占めている。
- 当サイトの `label`「全日本学生選手権大会」は「ソフトテニス」「インカレ」のどちらも
  literal で0回。全中とほぼ同じ欠落だった。

GSC実測（表示回数・掲載順位の実データ）は未実施。全中の教訓通り「GSCに出ない＝需要が無い」
とは読まない（[計測の原則](../wiki/seo.md#計測の原則2026-08-28-追加)）。また「インカレ」は
競技横断語（他競技のインカレも同時期に開催）なので、Trendsだけでの需要判断もしない。

## 対策: 全中で作った仕組みをそのまま再利用

`data/tournaments/index.json` の `searchLabel`/`searchAliases`/`searchNote` と
`lib/tournamentSearchNames.ts`（全中で導入済み）は、この型のためだけに作られた汎用機構。
**コード変更なし・データ追加のみ**で対応できた。

- `zennihon-university`: `searchLabel: "全日本学生ソフトテニス選手権大会"`
  （`label` に「ソフトテニス」が無い問題も同時に解消）、`searchAliases: ["インカレ"]`
- `zennihon-university-ouza`（全日本大学ソフトテニス王座決定戦）: SERP上で大学対抗戦も
  「インカレ」と呼ばれていることを確認できたため、こちらにも `searchAliases: ["インカレ"]`
  のみ追加。`label` に既に「ソフトテニス」が入っているため `searchLabel` は不要だった
- `zennihon-university-indoor`（全日本学生選抜インドア選手権大会）: SERP上で「インカレ」との
  紐付けが見当たらなかったため対象外とした

## 確認

- `node scripts/check-tournament-entries.mjs` … 問題なし
- `npx tsc --noEmit` … エラーなし
- 開発サーバーでハブページ・年度別結果ページ（`zennihon-university` / `zennihon-university-ouza`）
  双方の title・h1・meta description・FAQのJSON-LDが「インカレ（全日本学生ソフトテニス選手権
  大会）」表記に切り替わることを確認済み。`searchLabel`/`searchAliases` 未設定の大会（大多数）
  は出力が1文字も変わらないことも、この機構自体の設計として既に保証されている
  （`buildTournamentSearchNames` は未設定時 `headingName === label`）

## 残っている懸念

- 実装後のGSC実測（順位・表示回数の変化）は未実施。次のクロール・インデックス反映を待って
  確認する必要がある
- `zennihon-university-ouza` の `tournamentId` が実際にどの大会（文部科学大臣杯全日本大学
  対抗選手権大会）に対応するかは、[インカレの姓名分割](2026-08-29-intercollegiate-name-split.md)
  の追記2で触れた「団体戦の `tournamentId` 未定義」という別の未解決点と関係がありそうだが、
  今回はSEO表記のみの変更でデータの対応関係には踏み込んでいない

## Compile Log

| 項目 | 扱い | 理由 |
|---|---|---|
| 全中の仕組み（`searchLabel`/`searchAliases`/`searchNote`）をインカレにも適用したこと・設定値 | wiki `seo.md` に採用 | 「大会名の表記と検索語の乖離」パターンの2件目の実例として、次に同型の大会が出たときの判断材料になる |
| SERP実測の詳細（個別サイト名・件数） | 採らない（この raw に残す） | 一時点のスナップショットで、durableな知識ではない |
| `zennihon-university-ouza` の `tournamentId` 対応関係の懸念 | 採らない（open-questionsの既存項目と重複するため raw のみに残す） | 既に [open-questions.md](../wiki/open-questions.md) に団体戦の `tournamentId` 未定義が記載済み |
