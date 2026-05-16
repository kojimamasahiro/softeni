# beta/matches-results 保守ガイド

## 概要

`/beta/matches-results` は、ポイント詳細記録システムで記録された試合を静的ページとして公開するベータ機能です。役割は大きく次の 4 つに分かれます。

- 一覧表示
- 試合詳細表示
- 分析ロジック
- 静的データ取得

この機能は SSR ではなく静的生成前提です。新しい試合を公開するには、`public/data/beta-matches/` の更新と再ビルドが必要です。

## ルーティングと責務

### `/beta/matches-results`

実装: `src/pages/beta/matches-results/index.tsx`

- `public/data/beta-matches/index.json` を読み、試合一覧を静的生成する
- 各行で試合カード名、大会名、回戦、試合状態、ゲームスコア、作成日を表示する
- 試合状態は `games` と `winner_team` を見て `finished / in_progress / not_started` をその場で判定する
- 大会情報が引ける場合は大会詳細ページへの導線を表示する

### `/beta/matches-results/[matchId]`

実装: `src/pages/beta/matches-results/[matchId]/index.tsx`

- `public/data/beta-matches/matches/{matchId}.json` を読み、試合詳細ページを静的生成する
- `getStaticPaths` は `meta.json` か `index.json` から `matchId` 一覧を作る
- 画面は次のブロックで構成される
  - 試合ヘッダー
  - 分析タブ
  - スコアボード
  - 試合統計
  - チーム別統計
  - ゲーム詳細
  - 選手別統計
- 分析タブは `比較` と `チーム別` の 2 種類
- `focusTeam` クエリでチーム視点タブの注目チームを保持する
- ゲーム詳細は最新ゲームのみ初期展開し、ポイントごとの途中スコアと結果種別を表示する

## データソース

### 生成物

- `public/data/beta-matches/meta.json`
  - `matchIds` を保持し、静的パス生成の第一候補になる
- `public/data/beta-matches/index.json`
  - 一覧表示用の軽量データ
  - 各試合にはポイント配列を含めず、ゲーム単位のサマリーだけを持つ
- `public/data/beta-matches/matches/{matchId}.json`
  - 詳細ページ用の完全データ
  - `games[].points[]` まで含む

### 生成スクリプト

実装: `scripts/generate-beta-matches-json.mjs`

- Supabase の `matches`、`games`、`points` から公開用 JSON を生成する
- 取得対象は作成日時降順の最新 50 件
- 環境変数がない場合は、既存の `public/data/beta-matches/` スナップショットを再利用する
- 一覧用には `summarizeMatchForIndex` でポイント配列を落として軽量化している

## 主要ロジック

### データ取得と表示名整形

実装: `lib/betaMatchesStatic.ts`

- `getLatestBetaMatches`
  - `index.json` を読み、一覧ページ用の試合配列を返す
- `getLatestBetaMatchIds`
  - `meta.json` の `matchIds` を優先し、なければ `index.json` から ID を復元する
- `getBetaMatchById`
  - `matches/{matchId}.json` を読み、詳細ページ用の試合データを返す
- `getBetaTeamDisplayName`
  - 旧形式の `team_*_player*_last_name` と新しい `teams` 構造の両方から表示名を作る
  - JSON フォーマット変更の影響を受けやすいポイント

### 分析ロジック

実装: `lib/matchAnalysis.ts`

- ポイント列を再構築してチーム別の比較指標を作る
- 主な集計対象
  - サーブ
  - レシーブ
  - 重要局面
  - ラリー長
  - 連続得点
  - 決着内訳
- 主な分析カード
  - `service_to_points`
  - `key_moments`
  - `momentum`
  - `rally_profile`
  - `point_endings`
- `scoreIntegrity` で再構築スコアと元データの一致を検証する
- 不一致時は分析表示だけ停止し、試合スコアやポイント詳細は表示を続ける

### 詳細ページ内の画面専用集計

実装: `src/pages/beta/matches-results/[matchId]/index.tsx`

- `getMatchStats`
  - 試合全体のラリー数分布、最長ラリー、平均ラリー、最大連続得点などを算出する
- `getPlayerStats`
  - 選手別のウィナー、ミス、サーブ、ゲーム別内訳を算出する

これら 2 つは `lib/matchAnalysis.ts` とは別管理です。分析指標の定義を変えたいのか、画面の補助集計を変えたいのかで触る場所を切り分けると安全です。

## 改修時の見方

### データ形式を変更する場合

優先確認箇所:

- `scripts/generate-beta-matches-json.mjs`
- `lib/betaMatchesStatic.ts`
- `src/pages/beta/matches-results/index.tsx`
- `src/pages/beta/matches-results/[matchId]/index.tsx`
- `lib/matchAnalysis.ts`

特に `team` 表示名まわり、`games[].points[]` の有無、`winner_team`、`rally_count`、サーブ関連フラグは画面表示と分析の両方に影響します。

### 分析指標を変更する場合

優先確認箇所:

- `lib/matchAnalysis.ts`
- `src/pages/beta/matches-results/[matchId]/index.tsx`

`lib/matchAnalysis.ts` はチーム比較とガイドカード向け、詳細ページ内の集計関数は画面の補助統計向けです。片方だけ直すと表示間で数字の意味がずれる可能性があります。

### UI 表示だけを変更する場合

優先確認箇所:

- 一覧: `src/pages/beta/matches-results/index.tsx`
- 詳細: `src/pages/beta/matches-results/[matchId]/index.tsx`

見た目だけの変更でも、詳細ページは表示ロジックと集計ロジックが同居しているため、影響範囲の確認を先に行うのが安全です。

## 確認項目

改修後は少なくとも次を確認します。

- 一覧に `未開始 / 進行中 / 終了` が正しく出る
- `matchId` ごとの静的生成が通る
- 大会情報が取れない試合でも詳細ページが崩れない
- `games/points` がある試合で比較とチーム別が表示される
- `scoreIntegrity` 不一致データで分析のみ停止し、スコア表示とポイント詳細は見られる

## 補足

- この機能は `src/pages/beta/index.tsx` からベータ機能として公開されている
- 公開データは `public/data/beta-matches/` にコミット済みスナップショットを置けるため、Supabase 接続がない環境でも表示確認は可能
