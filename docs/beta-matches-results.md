# beta/matches-results / score 公開 保守ガイド

## 概要

試合結果公開機能は、1つの記録・分析コアを 2 つの公開面から使う構成になっています。

- `softeni-pick` mode
  既存のベータ導線と記録管理導線を持つ本体サイト
- `score` mode
  `score.softeni-pick.com` で公開する閲覧専用サイト

モード判定は Host / referer ではなく、`lib/siteConfig.ts` の `siteConfig.mode` だけを基準にします。

この機能は SSR ではなく静的生成前提です。新しい試合を公開するには、`public/data/beta-matches/` の更新と再ビルドが必要です。

## ルーティングと責務

### `softeni-pick` mode

公開系:

- `/beta/matches-results`
- `/beta/matches-results/[matchId]`
- `/beta/matches-results/growth`

管理系:

- `/beta`
- `/beta/matches`
- `/beta/matches/create`
- `/beta/matches/[matchId]`
- `/beta/matches/[matchId]/input`

役割:

- 既存のベータ公開面を維持する
- 記録入力、編集、試合作成、管理導線を持つ
- `score` 公開先への案内リンクを置ける

### `score` mode

公開系:

- `/matches`
- `/matches/[matchId]`
- `/matches/growth`

役割:

- `score.softeni-pick.com` の閲覧専用公開面
- 既存 `matchId` をそのまま URL に使う
- `siteConfig.baseUrl` を使って canonical / OGP / 共有 URL を組み立てる

### `score` mode で閉じるもの

`score` 側では `/beta/*` を原則 404 にします。あわせて管理ページと書き込み API も閉じます。

404 対象ページ:

- `/beta`
- `/beta/matches-results*`
- `/beta/matches*`

拒否対象 API:

- `POST /api/matches`
- `PATCH /api/matches/[matchId]`
- `DELETE /api/matches/[matchId]`
- `POST|PUT|DELETE /api/matches/[matchId]/points`
- `POST /api/matches/[matchId]/games`
- `PATCH /api/matches/[matchId]/games/[gameId]`

## データソース

### 生成物

- `public/data/beta-matches/meta.json`
  `matchIds` を保持し、静的パス生成の第一候補になる
- `public/data/beta-matches/index.json`
  一覧表示用の軽量データ
- `public/data/beta-matches/matches/{matchId}.json`
  詳細ページ用の完全データ
- `public/data/beta-matches/growth/targets.json`
  成長分析一覧用の対象データ
- `public/data/beta-matches/growth/reports/{target}.json`
  成長分析詳細用のレポートデータ

### 生成スクリプト

実装: `scripts/generate-beta-matches-json.mjs`

- Supabase の `matches`、`games`、`points` から公開用 JSON を生成する
- 取得対象は作成日時降順の全件（取得上限なし）
- 出力は追記型で、出力先 `public/data/beta-matches/` を全削除せず既存ファイルを更新する（公開 URL の消失を防ぐ）。旧仕様の「最新 50 件上限＋毎回削除して再生成」は撤廃済み（docs/wiki/data-import.md・score-site-link.md 参照）
- 環境変数がない場合は既存スナップショットを再利用する
- 一覧用には `summarizeMatchForIndex` でポイント配列を落として軽量化する
- 公開前に `toPublicMatchSnapshot` で内部項目を除外する

### 公開 JSON から除外する内部項目

公開 JSON には、少なくとも次を含めません。

- `source_site_match_id`
- `source_site_tournament_id`
- `edit_token`
- `edit_token_hash`
- `recorder_side`
- `created_by`
- `updated_by`
- `internal_note`
- `import_source`
- `debug_*`
- `_debug*`
- `_supabase*`

`score` 側は閲覧専用なので、編集や内部運用にだけ必要なデータは公開 JSON に出さない前提です。

## 主要ロジック

### モード設定

実装: `lib/siteConfig.ts`

- `siteConfig.mode`
  `softeni-pick` / `score` の切り替え基準
- `siteConfig.baseUrl`
  canonical / OGP / 共有 URL の起点
- `siteConfig.siteName`
  サイト名
- `siteConfig.ogImage`
  OGP 画像 URL
- `getPublicMatchesListPath`
- `getPublicMatchDetailPath`
- `getPublicMatchesGrowthPath`

環境変数:

- `SITE_MODE`
- `NEXT_PUBLIC_SITE_MODE`
- `NEXT_PUBLIC_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_SITE_NAME`
- `NEXT_PUBLIC_PUBLIC_OG_IMAGE`

### データ取得と表示名整形

実装: `lib/betaMatchesStatic.ts`

- `getLatestBetaMatches`
  一覧ページ用の試合配列を返す
- `getLatestBetaMatchIds`
  `meta.json` 優先で ID 一覧を返す
- `getBetaMatchById`
  詳細ページ用の試合データを返す
- `getBetaTeamDisplayName`
  旧形式フィールドと `teams` 構造の両方から表示名を作る。選手名は姓＋名のフルネーム（`姓 名`）で生成し、ペアは `・` で連結する（名が無い場合は姓のみにフォールバック）

### 分析ロジック

実装: `lib/matchAnalysis.ts`

- ポイント列を再構築してチーム別の比較指標を作る
- サーブ、レシーブ、重要局面、ラリー長、連続得点、決着内訳を集計する
- `scoreIntegrity` で再構築スコアと元データの一致を検証する
- 不一致時は分析表示だけ停止し、スコア表示とポイント詳細は続ける

### 画面の責務

一覧:

- `src/pages/beta/matches-results/index.tsx`
- `src/pages/matches/index.tsx`

詳細:

- `src/pages/beta/matches-results/[matchId]/index.tsx`
- `src/pages/matches/[matchId]/index.tsx`

成長分析:

- `src/pages/beta/matches-results/growth/index.tsx`
- `src/pages/matches/growth/index.tsx`

`/matches*` 側は既存 UI を再利用し、公開導線と `MetaHead` だけを `siteConfig` ベースで切り替えています。

## 型と境界

実装: `src/types/matchAccess.ts`

- `CommonMatchInput`
  共通の試合入力境界。試合基本情報、対戦カード、選手情報、`teams` 構造を含む
- `SofteniPickMatchInput`
  `CommonMatchInput` に `softeni-pick` 専用の運用項目を足したもの
- `PublicMatchSnapshot`
  公開 JSON に出してよい試合データ境界

設計意図:

- 記録・分析コアは共通で持つ
- `softeni-pick` 専用項目は連携メタデータに寄せる
- `score` 側へは公開用スナップショットだけを流す

## 改修時の見方

### ルーティングや公開挙動を変える場合

優先確認箇所:

- `lib/siteConfig.ts`
- `src/pages/beta/matches-results/*`
- `src/pages/matches/*`
- `src/components/MetaHead.tsx`

特に `siteConfig.mode` を増やしたり、`getPublic*Path` を変えたりすると、canonical、OGP、導線、静的生成先がまとめて影響を受けます。

### データ形式を変更する場合

優先確認箇所:

- `scripts/generate-beta-matches-json.mjs`
- `lib/betaMatchesStatic.ts`
- `src/types/matchAccess.ts`
- `src/pages/beta/matches-results/[matchId]/index.tsx`
- `lib/matchAnalysis.ts`

特に `games[].points[]`、`winner_team`、`rally_count`、サーブ関連フィールドは表示と分析の両方に影響します。

### API 制約を変える場合

優先確認箇所:

- `src/pages/api/matches/index.ts`
- `src/pages/api/matches/[matchId]/index.ts`
- `src/pages/api/matches/[matchId]/points/index.ts`
- `src/pages/api/matches/[matchId]/games/index.ts`
- `src/pages/api/matches/[matchId]/games/[gameId].ts`

`score` 側を閲覧専用で保つ前提が崩れないかを先に確認します。

## 確認項目

改修後は少なくとも次を確認します。

- `softeni-pick` mode で `/beta/matches-results*` が従来どおり見られる
- `score` mode で `/matches*` が見られ、`/beta/*` が 404 になる
- `matchId` ごとの静的生成が両モードで意図どおりに動く
- `score` mode で書き込み API が拒否される
- canonical / OGP / 共有 URL が `siteConfig.baseUrl` を向く
- `games/points` がある試合で試合サマリー、振り返りポイント、成長分析が表示できる
- `focusTeam` や `targetKey` クエリが URL に保持される
- 公開 JSON に内部項目が含まれていない
- `scoreIntegrity` 不一致データで分析のみ停止し、スコア表示とポイント詳細は見られる

## 補足

- `score.softeni-pick.com` は初回リリースでは閲覧専用
- モード判定は `siteConfig.mode` のみを基準にする
- 公開データは `public/data/beta-matches/` にコミット済みスナップショットを置けるため、Supabase 接続がない環境でも確認できる
