# Tournaments Local

## 概要

`/tournaments/local/` は、都道府県単位で地域大会結果への導線を提供する公開ページ群です。

- トップ: `/tournaments/local`
- 県別: `/tournaments/local/[federationId]`

実装上は「地域大会の専用詳細ページ」を持たず、既存の大会詳細 URL へリンクします。

確認根拠:

- `src/pages/tournaments/local/index.tsx`
- `src/pages/tournaments/local/[federationId]/index.tsx`
- `src/components/tournaments/TournamentCard.tsx`

## 役割

- `/tournaments/local`
  都道府県一覧への入口
- `/tournaments/local/[federationId]`
  その都道府県に紐づく大会と年度別カテゴリ結果への入口
- 遷移先
  `/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]`

## 使用データ

- `data/prefectures.json`
  都道府県 ID、名称、地方区分
- `data/tournaments/federations.json`
  連盟名と連盟公式 URL
- `data/tournaments/local_index.json`
  地域大会と `federationId` の対応
- `data/tournaments/information/{tournamentId}.json`
  年度ごとの開催情報とカテゴリ一覧
- `data/tournaments/details/{tournamentId}/{year}/{categoryId}.json`
  実際に結果表示へ出せるカテゴリ詳細

関連:

- [Data Model](./data-model.md)
- `docs/tournament-data-structure.md`

## `/tournaments/local` の仕様

- `data/prefectures.json` の全都道府県を対象にページを生成する
- 表示順は固定の地方区分順
  北海道 → 東北 → 関東 → 中部 → 近畿 → 中国 → 四国 → 九州・沖縄
- 各都道府県カードは `/tournaments/local/{prefecture.id}` へリンクする
- `federations.json` に `officialUrl` がある場合だけ「連盟サイト」リンクを出す

注意:

- `federations.json` に未登録でも、`prefectures.json` に存在すれば都道府県カード自体は表示される

## `/tournaments/local/[federationId]` の仕様

- `getStaticPaths` は `data/prefectures.json` の全都道府県分を生成する
- `federationId` が `prefectures.json` に存在しない場合は `404`
- ページ上部の「連盟公式サイト」は `federations.json` の `officialUrl` を使う
- 大会一覧の元データは `local_index.json` を `federationId` で絞り込んで取得する

### 大会表示条件

- `local_index.json` に大会があっても、それだけでは表示しない
- `information/{tournamentId}.json` が読めることが前提
- 各年度の `categories` について、対応する `details/{tournamentId}/{year}/{categoryId}.json` が存在するカテゴリだけ内部結果リンクを表示する
- 内部結果カテゴリが 0 件でも、その年度に `sourceUrl` があれば年度を表示する
- その場合は年度単位で外部結果導線のみを表示する
- 1 件も表示可能年度がない大会は非表示

つまり、県別ページには次のいずれかを満たす年度が出ます。

- 内部結果へ遷移できるカテゴリがある
- 外部結果 URL がある

### 表示構造

- 大会ごとにカード表示
- カード内で年ごとにカテゴリチップを表示
- 年度に `sourceUrl` がある場合は、年見出し横に年度単位の外部結果ボタンを 1 つ表示
- 年表示は `TournamentCard` 内で降順ソートする
- カテゴリチップ押下で既存の大会詳細ページへ遷移する
- 外部結果ボタンは `sourceUrl` に新規タブで遷移する

## データ項目の実装上の扱い

`local_index.json` の主な利用項目:

- `tournamentId`
- `generationId`
- `federationId`
- `label`

実装メモ:

- `local_index.json` の `label` は県別ページの大会名として使う
- `local_index.json` の `officialUrl` は現在のページ描画では使っていない
- 連盟リンクは大会単位ではなく、県ページ上部に 1 つだけ表示する
- 年度単位の外部結果導線は `information/{tournamentId}.json` の `sourceUrl` を使う
- `sourceUrl` はカテゴリ単位ではなく年度単位のため、外部結果導線も年度ごとに 1 つだけ表示する

## 運用方針

長期運用では、地域大会ページ専用の重複データを増やさず、既存データから自動的に表示を組み立てる方針を採る。

source of truth:

- 大会をどの都道府県ページに載せるか
  `data/tournaments/local_index.json`
- 年度ごとの外部結果導線
  `data/tournaments/information/{tournamentId}.json` の `sourceUrl`
- 内部結果ページへ出せるカテゴリ詳細
  `data/tournaments/details/{tournamentId}/{year}/{categoryId}.json`

### 基本ルール

- `/tournaments/` と `/tournaments/local/[federationId]` で別々の掲載データは持たない
- 地域大会ページに載せたい大会は `local_index.json` に追加する
- 外部リンクのみで掲載したい年度は `information/{tournamentId}.json` に `sourceUrl` を入れる
- 内部結果を公開できるカテゴリは `details/**` を追加する
- UI は `details` の有無で内部結果リンクを出し、`sourceUrl` の有無で年度単位の外部結果導線を出す

### 推奨運用フロー

1. まず `local_index.json` に大会を登録する
2. 年度データを `information/{tournamentId}.json` に追加する
3. 内部結果未整備でも `sourceUrl` があれば県別ページに掲載する
4. 後から `details/**` を追加したカテゴリは、自動的に内部結果リンクへ昇格する

### この方針の意図

- `/tournaments/` 用と `/tournaments/local/` 用で二重管理しない
- 外部掲載から内部掲載への移行を追加作業なしで吸収する
- 年度単位の `sourceUrl` とカテゴリ単位の `details` という粒度差を、そのまま UI に反映する
- 手動運用の入力点を増やさず、長期の保守負荷を抑える

## 既知の実装上の特徴

- 県別ページは全都道府県分を静的生成するため、対象大会が 0 件でもページ自体は存在する
- 空ページでは「現在登録されている大会はありません。」を表示する
- 大会カードの並び順は `local_index.json` の配列順に依存し、明示ソートはしていない

## Assumption

- `federationId` は都道府県単位の識別子として運用している
- `areaId: "city"` を持つ `local_index.json` の大会も、現行 UI では都道府県ページ配下にまとめて表示する

未解決項目は [Open Questions](./open-questions.md) に集約する。
