# アイデア: 全中（全国中学校ソフトテニス大会）ブロック大会の掲載

## 状況

Idea Backlog。発散→収束方向（2026-08-08）。高校総体の地区大会掲載（2026-07-22、[highschool-block-tournament-data](./2026-07-22-idea-highschool-block-tournament-data.md)）と同型の要望としてユーザーが提起。検討の結果「中学専用カテゴリは作らず、既存の大会登録の仕組みに通常の大会として乗せる」方針で合意し、次の一歩は実データ登録。

## 目的

全中（`secondaryschool-championship`、`generationId: "junior"`）にも、都道府県予選と全国大会本大会の間にある地区（ブロック）大会が存在する。高校総体の地区大会と同様に、この結果を掲載したい。

## ユーザーが興味を持った点

- 「全中のブロック大会を追加したい。高校カテゴリのようなものはないが、作った方がいいかどうか検討したい」（2026-08-08）
- 検討の結果「とりあえずideaにしておいて、通常の大会として登録しようと思います」（2026-08-08）。新規の中学カテゴリページを作らず、既存の大会登録フローに乗せる方向で合意

## わかっていること

### 既存インフラは generation 非依存（コード変更不要）

高校の地区大会掲載時（2026-07-22）に作られた `data/tournaments/blocks.json`（9ブロックのマスタ）、`local_index.json` の `blockId` フィールド、`/tournaments/block`・`/tournaments/block/[blockId]` ページは、いずれも `generationId` で分岐しない汎用実装と確認済み（`src/pages/tournaments/block/[blockId]/index.tsx` は `t.blockId === blockId` でフィルタするのみ）。したがって `local_index.json` に `generationId: "junior"` のエントリを `blockId` 付きで追加し、`information/`・`details/` を通常大会と同じフォーマットで置けば、既存ページがそのまま表示する。新規ページ・ルーティングの追加は不要。

### ブロック区分は1箇所だけ高校と異なる（要対応）

Web調査（iezo.net の全中予選まとめページ、2026年度）で確認した区分:

- 関東・北信越（甲信・北陸）・東海・近畿（関西）・中国・四国・九州の7ブロックは `blocks.json` の既存定義と都道府県構成が完全一致
- **東北のみ異なる**: 高校は北海道が独立ブロック（`hokkaido-block`）だが、中学は「北海道・東北エリア」として北海道込み7県（北海道・青森・岩手・秋田・宮城・山形・福島）で1ブロック（東北大会）
- 既存 `tohoku` ブロック（6県、北海道なし）をそのまま使うと北海道の中学チームの行き場がない。`blocks.json` に中学用の新ブロックエントリ（例: id `tohoku-hokkaido-jhs`、北海道込み7県）を追加する必要がある。既存の高校向け `tohoku` / `hokkaido-block` には触れない

### 中学カテゴリページは現状存在しない

`secondaryschool-championship` は `/highschool` のような専用セクションを持たず、汎用の `/tournaments/[generation]/[tournamentId]` ハブに載っているだけ（`grep` で `secondaryschool` を参照する箇所は `lib/nationalTitles.ts` のみ）。

### 高校側の先例判断

高校地区大会のページ構成決定（[highschool-block-tournament-page-structure](./2026-07-22-highschool-block-tournament-page-structure.md)）では、地区大会データを「ランキング加点・卒業生集計・都道府県ページの主要大会表示・学校ページ内部リンク」といった高校カテゴリ機能には統合しない方針を確定済み。理由は①ブロックごとのPDF入手状況のばらつきが全国横断集計を歪める、②「これは何の成績か」の見分けやすさ、③ロジック分岐追加による負債回避、の3点。この理由は中学にも同様に当てはまり、むしろ中学は土台となるカテゴリページ自体が無いため、ブロック大会のためだけに新カテゴリを作るのはスコープ過大と判断。

## 課題・未解決

- `blocks.json` への中学用東北ブロック（北海道込み）の追加方法・id未確定
- 全中側の `tournamentId` 命名規則未確定（案: `secondaryschool-{blockId}-block`、高校の `highschool-{blockId}-block` に準拠）
- 実データ（組み合わせPDF）は未取得
- `/tournaments/block` のページ文言（`index.tsx` / `[blockId]/index.tsx`）が「高校総体（インターハイ）の地区大会など」と高校前提の書き方になっている。中学データが入るタイミングで生成カテゴリを問わない表現に修正する必要あり
- `TournamentSearchTable` の開催地フィルタ等、ブロック大会を横断一覧に出す既存箇所での表示確認は未実施

## 目指したい方向性

「中学専用カテゴリは作らず、既存の大会登録の仕組みに通常の大会として乗せる」方針で収束。次の一歩は実データ（組み合わせPDF）の取得と、`tournament-pdf-to-players` skill を使った1ブロック分の通し確認。

## 関連

- [2026-07-22-idea-highschool-block-tournament-data.md](./2026-07-22-idea-highschool-block-tournament-data.md) — 同型の高校側アイデア（先例）
- [2026-07-22-highschool-block-tournament-page-structure.md](./2026-07-22-highschool-block-tournament-page-structure.md) — 高校側のページ構成決定・実施結果
- [../wiki/data-model.md](../wiki/data-model.md) — 大会データの静的JSON構造
- [../wiki/highschool.md](../wiki/highschool.md) — 高校カテゴリの地区大会統合方針（統合しない、の先例）
- `tournament-pdf-to-players` skill — ドロー表PDF → initialPlayers JSON変換

## 参考文献

- [全国中学校ソフトテニス大会 - Wikipedia](https://ja.wikipedia.org/wiki/全国中学校ソフトテニス大会)
- [中学総体ソフトテニス2026全中予選 各都道府県・ブロック大会の日程・組合せ・結果](https://www.iezo.net/forum/tennis-j/149787/)（ブロック区分・都道府県構成の一次確認）
- [東北 中学校ソフトテニス大会2026 日程・組合せ・結果](https://www.iezo.net/forum/tennis-j/149790/)
