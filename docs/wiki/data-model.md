# Data Model

## 概要

このリポジトリでは、少なくとも次の 2 系統のデータを扱っています。

- 静的 JSON: `data/**`, `public/data/**`
- Supabase: score 機能の動的データ

## 静的 JSON

### 大会データ

主な配置:

- `data/tournaments/index.json`
- `data/tournaments/local_index.json`
- `data/tournaments/information/*.json`
- `data/tournaments/details/**`
- `data/local-sources/prefecture-sources.json`
- `data/local-sources/detected-documents.json`
- `data/local-sources/ignored-documents.json`

識別・名寄せ用データ:

- チームマスタ（連番id）: `data/teams/teams.json` ＋ 文脈 `data/teams/team-context.json`
- チーム名の正準対応表: `data/tournaments/team-name-aliases.json`
- 同姓同名の別人分割: `data/players/homonyms.json`
- 詳しくは [チーム・選手の名寄せと識別](./team-player-identity.md)

関連ドキュメント:

- `docs/tournament-data-structure.md`

現行の source of truth:

- 大会一覧・世代・地域紐付け: `index.json`, `local_index.json`
- 年度情報・開催地・外部リンク・カテゴリ表示名: `information/*.json`
- 結果本体: `details/**`
- 地方大会巡回元 URL: `data/local-sources/prefecture-sources.json`

地方大会候補検知ストア:

- `detected-documents.json`
  巡回で見つけた候補リンクの確認用ストア
- `ignored-documents.json`
  `prefectureSlug + normalizedUrl` 完全一致で除外する恒久 deny list

注意:

- `detected-documents.json` の `accepted` は確認済み候補を意味するだけで、公開データ反映済みは意味しない

### 大会の会場データ（`venues`）

`information/*.json` の各年レコードは、開催地を2系統で持つ。

- `location`（string）… 都道府県。**既存フィールド。書き換えない**
- `venues`（配列）… 会場の構造化データ。2026-07 に追加

`location` を温存するのは、`src/pages/tournaments/index.tsx` の `prefNameToId[info.location]` が
開催地フィルタの逆引きに使っているため。`"兵庫県、京都府"` のように壊れた値も存在するが
（複数県開催を1文字列に詰めたもの）、整理は読み取り側を `venues` へ切り替えるときにまとめて行う。

`venues` を**配列にする理由**は、大会と会場が 1:N だから。次の3パターンが実在する。

- 日別に会場が変わる（例: 全日本選手権は開会式・競技1〜2日目・3日目で施設が異なる）
- 種目・年齢区分別に会場が分かれる（例: 全日本シニアは年齢区分ごとに3〜4施設）
- 複数市区町村・複数都道府県にまたがる（例: 兵庫県神戸市／京都府福知山市・舞鶴市）

#### フィールド定義

| フィールド | 型 | 必須 | 説明 |
|---|---|---|---|
| `prefecture` | string | ○ | 都道府県。複数県開催ではここが正（`location` ではなく） |
| `city` | string \| null | ○ | 市区町村 |
| `name` | string \| null | ○ | 施設名。要項PDF未取得なら `null` |
| `aliases` | string[] | | 別名。**ネーミングライツによる改称・旧称**を入れる |
| `nameRaw` | string | | 出典の表記そのまま。`name` と異なるときだけ書く |
| `postalCode` / `address` / `tel` | string | | `address` は都道府県から書く |
| `courts` | number | | 面数 |
| `surface` | string | | 下記の正規化語彙 |
| `usage` | string | | どの日・どの種目に使われたか。**自由文** |
| `note` | string | | 出典の誤りを直した場合の根拠、値を書かなかった理由 |

#### 記載ルール

- **`surface` は正規化語彙**。要項の表記は「クレー**コート**」「砂入り人工芝」のように
  末尾の「コート」の有無が揺れる。施設名は識別子なので原文を保つが、`surface` は将来の
  絞り込みに使う閉じた語彙なので入力時に揃える。
  現行値: `クレー` / `ハード` / `砂入り人工芝` / `木床フローリング`
  （確認は `grep -rho '"surface": "[^"]*"' data/tournaments/information/ | sort -u`）
- **`indoor` は持たない**。要項に屋内/屋外の明記がないことが多く、施設名からの推測になるため。
- **`usage` は構造化しない**。`categories[].categoryId` と紐付けたくなるが、年度によっては
  `categories` が空で参照先がない（例: `zennihon-senior` の2026年度）。用途が固まるまで原文を保つ。
- **推測で埋めない**。値が壊れていれば書かず、`note` に理由を残す
  （例: TEL「0773-63-764」は9桁で桁落ちのため `tel` を省略）。

#### 出典（要項PDF）の誤りへの対処

**要項PDF自体に誤記がある。** 実例（`zennihon-senior` 2025年度）:
「三段池科研電機（**福山市**三段池公園）テニスコート 〒620-0017 **京都府福知山市**字猪崎377-1」。
括弧書きは誤りで正しくは福知山市。**福山市は広島県に実在し STリーグ プレーオフの開催地**でもあるため、
鵜呑みにすると正しそうな見た目のまま別県に紐づく。

対処は `name`（修正値）＋ `nameRaw`（原文）＋ `note`（根拠）の3点セットで、**原文を必ず残す**。
検出は **`address` 先頭の都道府県と `prefecture` の一致**で行う（上記の誤記はこの1点で検出した）。

#### 施設マスタ（`data/venues/venues.json`）はまだ作らない

施設属性は当面 `venues[]` にインラインで持つ。**同一施設が3回以上出現した時点でマスタへ切り出す**。
出現見込みは `千葉県白子町` 5回 / `大阪府大阪市` 4回 / `広島県広島市` 4回 / `東京都江東区` 3回 /
`北海道札幌市` 3回（`data/local-sources/venue-candidates.json` 集計）。

インライン → マスタの正規化は後から可能だが、逆はID体系を情報不足のまま決めることになるため避ける。
`aliases` にネーミングライツの旧称を貯めておくことが、切り出し時の名寄せコストを下げる。

#### 会場データの取得元

- `data/local-sources/jsta-yearly-events/{年度}.json`
  日本連盟の「大会日程及び開催地一覧」PDF（`t_records/{年度}/{年度}_taikai_alle.pdf`）を構造化したもの。
  2024・2025・2026年度が存在。**手動転記**（自動パーサ未実装）。市区町村レベルまで。
- 施設名・住所・面数・サーフェスは各大会の**要項PDF**（`{年度}_{分類コード}_10.pdf`）の「4. 会場」節。
- `data/local-sources/venue-candidates.json`
  上記と `information` を突き合わせたレビュー用候補ストア。`detected-documents.json` と同型で、
  人が `status` を確定してから `information` へ書き戻す。**日付だけの照合は同日開催の別大会と
  誤マッチするため、大会名の類似度を併用する**（誤マッチは confidence 0.5前後に落ちて分離できる）。
- 作業手順と貼り付け用の断片: [venue-input-worksheet.md](../venue-input-worksheet.md)（作業用・入力完了後は破棄可）
- 経緯: [raw/2026-07-26-idea-tournament-metadata-platform.md](../raw/2026-07-26-idea-tournament-metadata-platform.md)

## Deprecated

- `data/tournaments/{all,corporate,highschool,international-qualifier,junior,masters,university}/**`
  旧構造の `meta.json` / `entries` / `matches` / `results` / `categories.json`
  現行実装では canonical source ではない
- `data/players/*/summary.json`
  選手プロフィールの注目ポイント表示は廃止され、現行実装では参照しない
- `data/players/*/results.json`
  選手別結果の旧中間データ。現行運用では廃止し、ファイルも削除した

### 選手データ

主な配置:

- `data/players/index.json`
- `data/players/*/information.json`
- `data/players/*/analysis.json`

実装メモ:

- `/players/[slug]` のプロフィールページは `data/players/{slug}/information.json` を必須で参照する
- 同ページは `analysis.json` があれば最新試合情報を表示する
- 同ページの `/players/[id]/results` 導線は `data/players/index.json` の `count >= 5` のときだけ表示する
- `/players/[id]/results` の試合結果ページは `data/players/{slug}/results.json` を直接は参照しない
- 試合結果ページは `data/players/index.json` で数値 `id` から選手名を引き、`data/tournaments/details/**` と `data/tournaments/information/*.json` から結果を再構築する
- `data/players/*/analysis.json` は `data/tournaments/details/**` と `data/tournaments/information/*.json` をソースに自動生成する
- `latestMatch` は `results` ページ相当の大会データから最新開催の大会を選んで生成する

選手名の表示ルール:

- 選手名は `lastName`（姓）・`firstName`（名）に分けて保持する。
- 表示時の結合は `src/utils/playerName.ts` の `joinPlayerName(lastName, firstName)` を使う。
- 日本語名（ひらがな・カタカナ・漢字を含む）は姓名を詰めて表示する（例: 内本貴文）。
- ローマ字（英語表記）の国際選手は姓名の間に半角スペースを入れる（例: `UCHIMOTO TAKAFUMI`）。コリアカップ等の国際大会が該当する。
- 判定は名前にひらがな・カタカナ・漢字が含まれるかで行い、含まれなければローマ字とみなしてスペース区切りにする。大会IDによる分岐はしない。
- 適用箇所は試合結果（`MatchResults`）・出場選手一覧（`EntryOverview`）・大会トップの優勝者名表示など。トーナメント表（`TournamentBracket`）の単式は元々スペース区切りで表示している。

団体戦の表示ルール:

- 団体戦の `participants[]` は姓名を持たず（JSON 上は `lastName`/`firstName` が `null`）、`team` と `prefecture` だけを持つ。
- 表示は個人戦の「選手名（所属）」ではなく **「チーム名（都道府県）」**（例: `東北（宮城県）`）。`prefecture` が無い大会（コリアカップ、大学王座など）はチーム名のみ。
- 団体戦かどうかの判定は `src/utils/playerName.ts` の `isTeamFormatPlayers()` に集約する。**`lastName === null` で判定してはいけない**: `lib/packedPageData.ts` の `unpackTournamentDetailData()` が `readString()` を通して `null` を `''` に変換するため、ページ側に届く時点で `null` ではなくなっている。これを踏むと個人戦扱いになり、空の選手名＋括弧つきチーム名（`（東北）`）で表示される（2026-08 修正）。
- 適用箇所は対戦詳細（`MatchResults` のエントリー見出しと対戦相手名）とトーナメント表（`TournamentBracket`）。`BracketSheets` と大会トップの優勝者表示は元々「姓名が空なら団体戦」と偽値で判定している。

### score 公開 JSON

- `public/data/beta-matches/meta.json`
- `public/data/beta-matches/index.json`
- `public/data/beta-matches/matches/*.json`
- `public/data/beta-matches/growth/targets.json`
- `public/data/beta-matches/growth/reports/*.json`

### 成長分析の運用設定（手動メンテの静的 JSON）

- `data/growth-featured.json`（成長記録ショーケース `/growth/[slug]` の対象 allowlist。`subjectKey` / `slug` / `playerId` / `playerName` / `title` / `intro`。詳細は ADR-004）
- `data/growth-exclusions.json`（成長分析の撤回リスト。載せた `subject_key` はレポート生成から除外）

## Supabase のテーブル

score 機能の動的データ（`matches` / `games` / `points` / `match_video_sessions` /
`match_point_candidates`）の列・リレーションは [database.md](./database.md) に集約する
（重複記載を避けるため、本ページでは再掲しない）。`src/types/database.ts` 由来。

## モデル上の特徴

- `matches` はフラットな `team_a_*` / `team_b_*` と、構造化された `teams` の両方を持つ
- `games.points_a` / `games.points_b` / `games.winner_team` は `points` から再計算される派生値に近い
- score 公開用 JSON では内部フィールドを削除する

確認根拠:

- `src/pages/api/matches/[matchId]/index.ts`
- `src/pages/api/matches/[matchId]/points/index.ts`
- `scripts/generate-beta-matches-json.mjs`

## Assumption

- `src/types/database.ts` は Supabase 実体の完全な schema 定義ではなく、アプリ利用向け型
- `teams` は新しめの表現で、`team_a` / `team_b` は互換性のために残っている可能性がある

## Open Questions

- RLS、index、trigger、constraint の全体像
- `matches.status` と `processing_status` の正式状態遷移
- points の `result_type` の正式な語彙表

## 発展候補アイデア一覧（Idea Backlog）

| アイデア | 状況・目的（1行） | 詳細 |
|---|---|---|
| 大会メタデータ基盤（会場・施設・日程・大会要項） | 発散フェーズ（2026-07-26）。試合中心のデータ構造に会場・施設・日程・要項を独立エンティティとして足し「大会を管理するサイト」へ広げる案。調査の結果、`information/*.json` は既に `location`/`startDate`/`endDate` を全112件保持し、`/tournaments/` も開催地カラム・フィルタ済みで出発点は0ではないと判明。一方 `location` は38種・中央値2件、2024年以前は24件しかなく、会場ページ生成は `seo.md` が潰したばかりの薄いページ問題を再生産する。暫定結論は「SEOは会場名をliteralで出せば足り、エンティティ化は履歴が貯まるまで待つ。いま着手するのは機能でなくデータ収集」。**jsta.or.jp 実地調査済**: `t_records/{年度}/{年度}_taikai_alle.pdf`（2024・2025年度のみ存在）が全国大会の日程・開催地の一次ソース、要項PDF `{年度}_{分類}_10.pdf` に施設名・住所・コート数・サーフェス・駐車場・日程内訳が定型記載。初回評価の「施設スペックは取得コスト高」は誤りと判明。大会:会場は1:N（日別に変わる）。事前閾値「全国80件中56件」に対しカバー可能は56件でちょうど到達 | [アイデア](../raw/2026-07-26-idea-tournament-metadata-platform.md) |
| Knowledge Graphによるデータ設計・UX統合 | 発散フェーズ（2026-07-11）。選手/チーム/大会/試合の関係解決ロジックが機能ごとに重複実装されている実態を確認（`matchReverseIndex.ts`と`playerStats/reverseIndex.ts`等）。新機能=グラフ上の新ビュー追加、に寄せられないかを検討中。次の一歩は候補ビュー（対戦相手ネットワーク等）の小さな試作 | [アイデア](../raw/2026-07-11-idea-knowledge-graph-views.md) |
| 全中（全国中学校ソフトテニス大会）ブロック大会の掲載 | 収束方向（2026-08-08）。高校地区大会と同型。既存の`blocks.json`/`local_index.json`の`blockId`/`/tournaments/block`はgeneration非依存でコード変更不要と確認済み。ブロック区分は東北のみ相違（中学は北海道込み7県で1ブロック、高校は北海道が独立）のため`blocks.json`に中学用ブロック追加が必要。中学専用カテゴリページは作らず「通常の大会として登録」する方針で合意。次の一歩は実データ取得 | [アイデア](../raw/2026-08-08-idea-zenchu-block-tournament-data.md) |
