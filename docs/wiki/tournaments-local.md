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
- `data/local-sources/prefecture-sources.json`
  地方大会候補巡回の都道府県別 source URL
- `data/local-sources/detected-documents.json`
  巡回で見つけた候補リンクの確認用ストア
- `data/local-sources/ignored-documents.json`
  恒久 deny list

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

候補検知用の別ストア:

- 巡回元 URL 管理
  `data/local-sources/prefecture-sources.json`
- 新規候補の一時保管
  `data/local-sources/detected-documents.json`
- 恒久的に無視する URL
  `data/local-sources/ignored-documents.json`

### 基本ルール

- `/tournaments/` と `/tournaments/local/[federationId]` で別々の掲載データは持たない
- 地域大会ページに載せたい大会は `local_index.json` に追加する
- 外部リンクのみで掲載したい年度は `information/{tournamentId}.json` に `sourceUrl` を入れる
- 内部結果を公開できるカテゴリは `details/**` を追加する
- UI は `details` の有無で内部結果リンクを出し、`sourceUrl` の有無で年度単位の外部結果導線を出す
- 候補検知ストアの内容は、そのまま公開ページには使わない
- `detected-documents.json` の `accepted` は確認済み候補を意味するだけで、公開反映済みは意味しない

### 推奨運用フロー

1. まず `local_index.json` に大会を登録する
2. 年度データを `information/{tournamentId}.json` に追加する
3. 内部結果未整備でも `sourceUrl` があれば県別ページに掲載する
4. 後から `details/**` を追加したカテゴリは、自動的に内部結果リンクへ昇格する

候補検知の補助フロー:

1. `node scripts/crawl-local-tournaments.mjs` で都道府県サイトを巡回する
2. 当年度または年度不明で、かつ要項・案内系ではなく PDF / Excel 直リンクでもない候補だけを `data/local-sources/detected-documents.json` に保存する
3. 採用候補を `accepted` にしても、公開ページにはまだ反映されない
4. 掲載するものだけ、人手で `information/{tournamentId}.json` の `sourceUrl` に反映する

補足:

- `--min-confidence` で保存対象の下限スコアを調整できる

### 定型予選大会(高校総体予選など)の半自動反映

県単位で毎年開催される定型予選大会は、候補検知から公開反映までを半自動化している。

- 候補検知時に「高校総体 / インターハイ / 全国高等学校総合体育大会」等のパターンで `inferred.qualifierType: "interhigh"` を付与する(`scripts/normalize-local-tournament-candidate.mjs`)
- 該当時は confidence に +0.1 する
- 例外として、qualifierType 付きかつ結果キーワードを含む候補は PDF / Excel 直リンクでも保存する(予選結果は PDF 直リンク掲載が多いため)
- `node scripts/apply-accepted-qualifiers.mjs` で `accepted` 済みの予選候補を公開データへ反映する
  - tournamentId は `highschool-{prefectureSlug}-interhigh-qualifier`
  - `local_index.json` に大会が無ければ自動登録する(47県の事前一括登録は不要)
  - `information/{tournamentId}.json` に年度+`sourceUrl` のみのエントリを追加する(`startDate`/`endDate` は空文字、`categories` は空配列)
  - 既存の `sourceUrl` は `--force` 無しでは上書きしない。反映済み候補には `appliedAt` を記録し再実行は冪等
  - `--dry-run` / `--allow-new`(new 候補のプレビュー用)/ `--type=` / `--documents=` に対応
- 県予選の内部データ化(details 追加)は、取得可能なデータがある県だけ行う方針(本戦主・県予選従)

巡回元について:

- IH 予選の結果は都道府県連盟ではなく高体連専門部サイトに掲載されることが多い
- `prefecture-sources.json` の `sourceUrls` 配列に高体連専門部 URL を追加済み(2026-06 時点で 21 県)
- Wix / Google Sites 等の JS レンダリング主体のサイトは現行クローラ(fetch + cheerio)では読めない場合がある

### この方針の意図

- `/tournaments/` 用と `/tournaments/local/` 用で二重管理しない
- 外部掲載から内部掲載への移行を追加作業なしで吸収する
- 年度単位の `sourceUrl` とカテゴリ単位の `details` という粒度差を、そのまま UI に反映する
- 手動運用の入力点を増やさず、長期の保守負荷を抑える
- 候補検知と公開反映を分離して、誤検出の公開を防ぐ

## 既知の実装上の特徴

- 県別ページは全都道府県分を静的生成するため、対象大会が 0 件でもページ自体は存在する
- 空ページでは「現在登録されている大会はありません。」を表示する
- 大会カードの並び順は `local_index.json` の配列順に依存し、明示ソートはしていない

## Assumption

- `federationId` は都道府県単位の識別子として運用している
- `areaId: "city"` を持つ `local_index.json` の大会も、現行 UI では都道府県ページ配下にまとめて表示する
- `prefecture-sources.json` の `slug` は `data/prefectures.json` の `id` と一致させる
- `prefecture-sources.json` は `sourceUrl` 1 本でも `sourceUrls` 複数本でも運用できる
- `html_detail` は v1 では予約値で、実処理は `link_only` と同等
- 一部の一覧ページはサイト個別の抽出ロジックを使う
  - 例: 島根県の大会一覧ページでは `結果` 列の資料リンクを候補化する

未解決項目は [Open Questions](./open-questions.md) に集約する。
