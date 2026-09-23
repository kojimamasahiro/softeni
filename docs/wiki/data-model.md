# Data Model

> **適用範囲: 混在**。大会→年度→種目→試合という形と、出典・推測に関する規約は汎用。
> 種目名・団体戦の作り・score 機能はソフトテニス固有。
> **2026-09-18 に現在の仕様だけへ圧縮し、2026-09-23 に再圧縮した。** 出典の誤りの実例・照合の実測・JSON の例は
> [raw/2026-09-18-wiki-archive-data-model.md](../raw/2026-09-18-wiki-archive-data-model.md) /
> [raw/2026-09-23-wiki-archive-data-model.md](../raw/2026-09-23-wiki-archive-data-model.md)。

扱うデータは2系統: **静的 JSON**（`data/**`・`public/data/**`）と **Supabase**（score 機能の動的データ）。
どこで動くかの全体像は [architecture.md](./architecture.md)。

## 大会データ

| 何の正か | ファイル |
|---|---|
| 大会一覧・世代・地域紐付け | `data/tournaments/index.json` / `local_index.json` |
| 年度情報・開催地・外部リンク・カテゴリ表示名 | `data/tournaments/information/*.json` |
| 結果本体 | `data/tournaments/details/**` |
| 公式発表された代表選手団 | `data/tournaments/delegations/*.json` |
| 地方大会の巡回元 URL | `data/local-sources/prefecture-sources.json` |

名寄せ用データ（詳細は [team-player-identity.md](./team-player-identity.md)）: チームマスタ `data/teams/teams.json` ＋
文脈 `team-context.json` / 正準対応表 `data/tournaments/team-name-aliases.json` / 同姓同名の分割 `data/players/homonyms.json`。
フィールドと語彙のリファレンスは [tournament-data-structure.md](./tournament-data-structure.md)。

`data/local-sources/ignored-documents.json` は `prefectureSlug + normalizedUrl` 完全一致の恒久 deny list（空のまま維持）。
**Deprecated**: `detected-documents.json`（候補検知ストア。未仕分け583件ごと 2026-09-12 に削除。
[tournaments-local.md](./tournaments-local.md) / [ADR-001](../adr/ADR-001-local-source-detection-store.md)）。

### 入力メモ（`note`）は公開しない

`information/*.json` の年エントリ直下・`venues[]`・`delegations/*.json` が持つ `note` は**入力時のメモ**で、
出典の誤りをどう直したか・なぜ値を書かなかったか、といった**内部の判断**が入る。これは公開しない。

**「公開しない」は描画結果だけでなくページのペイロードも指す**（`getStaticProps` の props は `__NEXT_DATA__` として
配信HTMLに丸ごと載る。[実例](../raw/2026-09-19-note-in-next-data.md)）。

- **`note` は `getStaticProps` で落とす**（描画側で出し分けない）。`information` の年エントリは
  `lib/tournamentInformationPublic.ts` の `toPublicInformationEntry()` を通す。
- 再発は型で止める。**2つとも要る**: `PublicTournamentInformationEntry` は `note?: never`（`Omit` では代入が通る）、
  **`getStaticProps` の戻り値にページの props 型を付ける**（`Record<string, unknown>` に緩めると素通り）。
- より一般に、**props には出したいフィールドだけを明示的に詰める**。

### 代表名簿（`delegations`）

`data/tournaments/delegations/{tournamentId}-{year}.json`。**国際大会に出る日本代表選手団の、公式発表の転記**。
**当サイトのデータから導出できない外部由来の事実**なので:

- `source` / `sourceUrl` / `announcedOn` を**必ず持つ**。描画側はこれを併記する
- **発表に無いことは書かない**（混合ダブルスのペア構成を過去のペア履歴から推測して補わない）
- **選手のみを持つ**（スタッフは照合相手がサイト内に無く、転記の誤りを検出できないため）

| フィールド | 意味 |
|---|---|
| `tournamentId` / `year` | 対応する `information` レコードを一意に決める（年が一致するときだけ使う） |
| `members[].gender` | `boys` / `girls`。表示のグループ分け |
| `members[].affiliation` | 名簿の表記そのまま（正式名称）。サイト内の略称へ寄せない |
| `members[].categoryIds` | 出場種目。`information` の `categories[].categoryId` と対応 |
| `note` | 入力時のメモ。**公開ページには出さない**（[入力メモ（`note`）は公開しない](#入力メモnoteは公開しない)） |

生年月日・年齢は名簿にあっても取り込まない（個人情報で、掲載する用途が無い）。
検査は `npm run check:upcoming` の **[4]**。表示は [public-pages.md](./public-pages.md)。

`details/**` に入れないのは、種目の割り当てを表現できず、ペア未発表の種目で entries が作れないため。

### 種目別の競技日程（`schedule`）

`information` の `categories[].schedule` ＋ 年度レコードの `scheduleSource` / `scheduleSourceUrl` / `scheduleCheckedOn`。
**主催者が種目ごとの日程を出している開催前・開催中の大会だけ**に書く。

- `startDate` / `endDate` はその種目の最初の試合日〜決勝日（1日なら同じ値）。**間の毎日試合があるとは限らない**
- `finalTime` は決勝の開始予定時刻（`HH:MM`、**会場の現地時刻**）。出典に無ければ省略
- **出典が無ければ一切表示しない**。表示は「（予定）」＋出典・確認日（`scheduleCheckedOn`）を必ず併記
- **推測で埋めない**（出典に無い日は書かず `note` に理由）。日単位の細かい進行は持たない
- 出典は年度レコードに1つ（種目ごとに違う例がまだ無い。**Assumption**。出たら種目側へ移す）

整形は `lib/categorySchedule.ts`、検査は `check:upcoming` の **[5]**。

### 種目別の競技方式（`format`）

`information` の `categories[].format`。**主催者が方式を文章で公開しておらず、見る人が
公式サイトの画面から形式を読み取れない大会だけ**に書く（[ADR-021](../adr/ADR-021-category-competition-format.md)）。
ほとんどの大会は持たない。

- フィールドは `summary`（**1つの文章**。組数・通過数を欄に分けない＝推測で埋める圧力を作らない）/ `assumptions[]` /
  `source` / `sourceUrl` / `checkedOn`
- **出典から決まらない点は `assumptions[]` へ**（画面で「当サイトの推定」と分けて出す）。無ければフィールドごと省く
- **出典が無ければ表示しない**。出典は**種目側**に持つ。公開しない入力メモは `note`（`format` に混ぜない）

整形は `lib/categoryFormat.ts`、表示は `CategoryFormatNotice.tsx`、検査は `npm run format:test`。

### 段階で分割された大会の最終成績

1つの大会を進行段階ごとに複数の `categoryId` へ分けることがある（例: 予選会の
`singles-tournament-*` → `singles-semifinal-*` → `singles-final-*`）。

**規約: 最終成績（`results[].tournament.rank`）は、決着したカテゴリだけが持つ。**
先の段階へ進んだ選手は、手前のカテゴリでは `tournament: null` にする。そうしないと同じ選手・同じ大会が
「ベスト8」と「優勝」の2エントリーとして集計され、進出率やタイトル数が二重計上される。
`results[].roundrobin.{group,rank}` はブラケット復元（`lib/bracketLayout.ts`）が使うので**消さない**。

段階を表す `age` 語彙: `final` / `semifinal` / `tournament` / `qualifying` / `upper` / `lower` / `top` / `second`。
年齢区分（`over50` 等）とは別物で、**年齢区分の重複出場（全日本シニアの over50 と over60 など）は正常**。
検査は `npm run check:placements`。

進出率の二重計上は `reachRates` 側で `placement.kind === 'unknown'` を分母から外して初めて解ける
（[upcoming-tournaments-runbook.md](./upcoming-tournaments-runbook.md) の M2）。

### 中止（開催されなかった回）

回次だけ進んで開催されなかった回は、`information/*.json` の年エントリに `status: 'cancelled'` を持たせる。
`details/` 側には何も作らない（中止は試合結果ではなく大会運営上の事実）。

`location` / `startDate` / `endDate` は**中止時点の予定値**（実績ではない）、`categories` は空配列、
`note` は公開しない入力メモ（理由・予定値である旨・出典）。判定は `lib/tournamentCancellation.ts` の
`isCancelledEntry()` に集約する（述語を各所にコピーしない）。理由フィールドは持たない。

| | 打ち切り `categories[].status: 'abandoned'` | 中止 `status: 'cancelled'` |
|---|---|---|
| 粒度 | カテゴリ | 年（エントリ自体） |
| 実施 | 途中まで実施され成績が残る | 1試合も行われていない |
| 集計 | ベスト8等として入る／開催年として数える | 一切入らない（年表にだけ存在） |

- **中止年を成績系のデータ構造に混ぜてはいけない。** `champions` / `yearGroups` / `championRows` は
  `details/` 由来のままにし、中止年は別配列で渡して描画時にだけ年で合流させる
  （連覇・`○年ぶりN回目`・playerStats・JSON-LD を無変更に保つため）。
- **投入は既存の収録範囲と地続きの大会だけ**。間の年が未収録の大会に中止年だけ挿すと読めなくなる。
- 出典は一次資料で1件ずつ確認する。**年が飛んでいることは中止の証拠にならない**（未収録・隔年・4年周期もある）。

### 大会の会場データ（`venues`）

`information/*.json` の各年レコードは開催地を2系統で持つ。

- `location`（string）… 都道府県。**構造は書き換えない**（開催地フィルタの逆引き `prefNameToId[info.location]` が使う）
- `venues`（配列）… 会場の構造化データ。大会と会場が 1:N（日別・種目別・複数市区町村や複数県）だから配列

**「書き換えない」は構造の話で、事実誤りは直す**（前年レコードからの複製で壊れる失敗モードが実在する。公開値）。

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `prefecture` | string | ○ | 都道府県。複数県開催ではここが正（`location` ではなく） |
| `city` | string \| null | ○ | 市区町村 |
| `name` | string \| null | ○ | 施設名。要項PDF未取得なら `null` |
| `aliases` | string[] | | 別名。**ネーミングライツによる改称・旧称**を入れる |
| `nameRaw` | string | | 出典の表記そのまま。`name` と異なるときだけ書く |
| `postalCode` / `address` / `tel` | string | | `address` は都道府県から書く |
| `courts` | number | | 面数 |
| `surface` | string | | 正規化語彙（下記） |
| `usage` | string | | どの日・どの種目に使われたか。**自由文** |
| `note` | string | | 出典の誤りを直した根拠、値を書かなかった理由。**公開しない**（上記の節） |

レコード直下の任意フィールド: `guidelineUrl`（要項PDFのURL）、`note`（**公開しない**）。
型は `src/types/tournament.ts` の `TournamentInformationEntry` / `TournamentVenue`。

記載ルール:

- **`surface` は正規化語彙**（`クレー` / `ハード` / `砂入り人工芝` / `木床フローリング`）。施設名は原文を保つ
- **`indoor` は持たない**（要項に明記が無く推測になるため）。**`usage` は構造化しない**
  （`categories` が空の年度があり紐付け先が無い）。
- **推測で埋めない**。値が壊れていれば書かず `note` に理由を残す（桁落ちした TEL など）。

#### 出典と検算

手順の詳細はスキル `tournament-venue-data`。wiki に置くのは守ることだけ。

- **要項PDF自体に誤記がある**。`name`（修正値）＋ `nameRaw`（原文）＋ `note`（根拠）の3点セットで**原文を必ず残す**。
  検出は `address` 先頭の都道府県と `prefecture` の一致。
- **出典が正しくても現状と違うことがある**: 要項は変更前のまま公開され続ける（変更要項は別ドメインのことも）。
  年の取り違えは既存の `startDate` と突き合わせ、PDF の新旧は**メタデータの作成日時**で判定する。未発表の項目は書かない。
- `data/local-sources/jsta-yearly-events/{年度}.json`（日本連盟の日程・開催地一覧PDFの手動転記。2024年度以降）は
  **開催地の正としないが、書き換えもしない**。`venue-candidates.json` は突き合わせのレビュー用候補ストア。
- 照合は `location` の検算にも使える。**日付だけの照合は同日開催の別大会と誤マッチする**（大会名の類似度を併用）、
  **都道府県の切り出しは47都道府県のリストで前方一致**（`..[県]` の正規表現は誤検出）、2023年以前は機械照合できない。
- 人が仕分けないと進まないストアは溜まって止まる（`detected-documents.json` の前例）。**育てるなら出口を先に決める**。

#### 施設マスタと描画先

施設マスタ（`data/venues/venues.json`）は**まだ作らない**。**同一施設が3回以上出現した時点で切り出す**。

描画先は**大会ハブの「開催前」ブロックだけ**（`UpcomingTournamentSection.tsx`）。
**確定した過去の大会では描画しない**（需要が未検証のため）。補充は
[upcoming-tournaments-runbook.md](./upcoming-tournaments-runbook.md) の S7。

## 選手データ

`data/players/index.json` / `data/players/*/information.json` / `data/players/*/analysis.json`。

- `/players/[slug]`（プロフィール）は `information.json` を必須で参照し、`analysis.json` があれば最新試合情報を出す。
  `/players/[id]/results` への導線は `index.json` の `count >= 5` のときだけ
- `/players/[id]/results` は `index.json` で数値 `id` から選手名を引き、`details/**` と `information/*.json` から**再構築**する
- `analysis.json` は `details/**` と `information/*.json` から自動生成する。`latestMatch` は最新開催の大会から作る

**Deprecated**: `data/tournaments/{all,corporate,highschool,…}/**` の旧構造（`meta.json` / `entries` 等）、
`data/players/*/summary.json`、`data/players/*/results.json`（ファイルも削除済み）。

### 選手名の表示ルール

- 姓 `lastName` と名 `firstName` に分けて保持し、結合は `src/utils/playerName.ts` の `joinPlayerName()` を使う
- 日本語名は詰めて表示（例: 内本貴文）、ローマ字の国際選手は半角スペース区切り（例: `UCHIMOTO TAKAFUMI`）
- 判定は**ひらがな・カタカナ・漢字を含むか**で行う。**大会IDによる分岐はしない**

### 団体戦の表示ルール

- 団体戦の `participants[]` は姓名を持たず（`lastName`/`firstName` が `null`）、`team` と `prefecture` だけを持つ
- 表示は **「チーム名（都道府県）」**（例: `東北（宮城県）`）。`prefecture` が無い大会はチーム名のみ
- 判定は `isTeamFormatPlayers()` に集約する。**`lastName === null` で判定しない**（`unpackTournamentDetailData()` が
  `null` を `''` にするので、個人戦扱いになり `（東北）` のような表示になる）

### 団体戦の対戦ごとの記録（オーダー）（[ADR-020](../adr/ADR-020-team-match-rubber-details.md)）

試合オブジェクトに任意の `matches`（対戦の配列。型 `TeamMatchDetail`）。形は STリーグの `MatchDetail` に揃え、
`type` は `D1` `D2` `D3` / `S`。**A は親の `entries[0]`、B は `entries[1]`。**

- `status` は5種類。`completed` / `retired`（途中棄権。winner は棄権しなかった側で**本数が少ないことがある**）/
  `walkover`（不戦勝。本数なし・**出さなかった側の選手が空配列**）/ `unfinished`（打ち切り。winner なし）/ `not_played`
- 選手は、同じ氏名・同じ学校の個人戦の出場記録があれば `{ lastName, firstName }`、無ければ `{ name }`。
  **名前だけの選手は `participants` に足さない**（選手一覧に採番されるため）
- 勝者の数は親の `scores` と一致。検査 `npm run check:team-match-details`（prebuild）
- ゲームごとのポイントは `games`（`[[Aのポイント, Bのポイント], …]` を実施順に）。対戦詳細に表示する（ADR-020 追記8）。
  **決着したゲームだけ**で、中断されたゲーム（`4-4` / `0-0`）は持たない（本数は `scoreA`/`scoreB` に残る）
- 個人戦の試合も同じ形の `games` を持てる（A は `entries[0]`。アジア大会 2026 の混合・シングルス）
- 元資料にある試合だけ持つ（高校選抜 **2020〜2025 の全年度**、アジア大会 2026 団体、
  インターハイ **2021・2024〜2026 はベスト8以降**・**2019・2022・2023 は1回戦から**。
  **インターハイ 2018 年以前は元資料にオーダーの記録が無い**ので、これ以上は増えない）
- **選手の成績集計（Player Statistics Engine）には入れない**（STリーグと同じ扱い）
- **入力ツールで details を作り直すと消える**。取り込みスクリプトを再実行する

## score 機能のデータ

公開 JSON: `public/data/beta-matches/` 配下（`meta.json` / `index.json` / `matches/*.json` / `growth/*`）。
成長分析の運用設定（手動メンテ）: `data/growth-featured.json`（`/growth/[slug]` の allowlist。ADR-004）と
`data/growth-exclusions.json`（撤回リスト。載せた `subject_key` はレポート生成から除外）。

Supabase のテーブル（`matches` / `games` / `points` / `match_video_sessions` / `match_point_candidates`）の
列・リレーションは [database.md](./database.md) に集約する（ここでは再掲しない）。

モデル上の特徴:

- `matches` はフラットな `team_a_*` / `team_b_*` と構造化された `teams` の両方を持つ
- `games.points_a` / `points_b` / `winner_team` は `points` からの派生値に近い
- 公開用 JSON では内部フィールドを削除する

**Assumption**: `src/types/database.ts` は Supabase 実体の完全な schema ではなくアプリ利用向けの型。
`teams` が新しめの表現で `team_a` / `team_b` は互換のために残っている可能性がある。

## Open Questions

- RLS・index・trigger・constraint の全体像
- `matches.status` と `processing_status` の正式な状態遷移
- points の `result_type` の正式な語彙表

## 発展候補アイデア一覧（Idea Backlog）

表の「状況・目的」は**状況と1行の目的・残りだけ**（規則は [idea-backlog.md](./idea-backlog.md)）。

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| 大会メタデータ基盤（会場・施設・日程・要項） | **一部実装**（2026-08-25〜）。残りは[実行ランブック](./upcoming-tournaments-runbook.md) | [アイデア](../raw/2026-07-26-idea-tournament-metadata-platform.md) |
| Knowledge Graph によるデータ設計・UX統合 | 発散フェーズ（2026-07-11）。関係解決ロジックが機能ごとに重複実装されている。次は候補ビューの小さな試作 | [アイデア](../raw/2026-07-11-idea-knowledge-graph-views.md) |
| 全中ブロック大会の掲載 | **投入済み**（2026-08-11、9ブロック） | [アイデア](../raw/2026-08-08-idea-zenchu-block-tournament-data.md) |
| 中学カテゴリの公開ページ | **実装済み**（2026-08-12）。残は build 完走と GSC 効果測定。仕様は [secondaryschool.md](./secondaryschool.md) | [アイデア](../raw/2026-08-12-idea-juniorhigh-category-pages.md) |
| 小学生カテゴリの公開ページ | **実装済み**（2026-09-13）。残は build 完走と GSC 効果測定。仕様は [primaryschool.md](./primaryschool.md) | [アイデア](../raw/2026-09-12-idea-primaryschool-category.md) |
| 団体戦のオーダー | **一部実装**（2026-09-19）。インターハイは記録がある年度（2019・2021〜2026）を全部入れた。学校ページのメンバーと年度別結果の FAQ に反映済み（[SEO](../raw/2026-09-19-idea-team-match-order-seo.md)）。残は選手ページでの見せ方 | [アイデア](../raw/2026-09-18-idea-team-match-order.md) |
