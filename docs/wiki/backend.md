# Backend

## 概要

- フロント本体は Next.js Pages Router ベース
- 公開形態は 2 モード
- `softeni-pick`: 本体サイト
- `score`: 試合結果・成長分析の閲覧専用サイト

主な根拠:

- `lib/siteConfig.ts`
- `src/pages/`
- `src/pages/api/matches/**`
- `README.md`

## 実行モデル

- 静的公開ページが多く、`getStaticProps` / `getStaticPaths` を利用
- 一方で試合入力・動画レビューは `src/pages/api/matches/**` と Supabase を使う動的機能
- `score` モードでは書き込み API を 404 扱いにしている

## 主要バックエンド機能

### 1. 試合データ API

- `GET /api/matches`
- `POST /api/matches`
- `GET /api/matches/[matchId]`
- `PATCH /api/matches/[matchId]`
- `DELETE /api/matches/[matchId]`
- `POST /api/matches/[matchId]/games`
- `PATCH /api/matches/[matchId]/games/[gameId]`
- `POST|PUT|DELETE /api/matches/[matchId]/points`

補足:

- 試合詳細は `matches -> games -> points` を順に取得して組み立てる
- ポイント追加・更新・削除時に `recomputeGameScore` でゲーム集計を再計算する
- 勝敗ロジックは `lib/matchRules.ts`

### 2. 動画レビュー API

- `GET|POST /api/matches/[matchId]/video-sessions`
- `GET /api/matches/[matchId]/video-sessions/[sessionId]`
- `POST /api/matches/[matchId]/video-sessions/[sessionId]/segment`
- `PATCH /api/matches/[matchId]/video-sessions/[sessionId]/candidates/[candidateId]`
- `POST /api/matches/[matchId]/video-sessions/[sessionId]/commit`

補足:

- YouTube URL または upload ソースをセッションとして保持
- 候補ポイントを生成し、人手レビュー後に `points` へ反映する流れ
- UI は `src/pages/beta/matches/[matchId]/video-review.tsx`

### 3. 静的 JSON 配信

- `public/data/beta-matches/index.json`
- `public/data/beta-matches/matches/*.json`
- `public/data/beta-matches/growth/**`

用途:

- `score` モード公開面のデータソース
- 動的 API 不可な環境でも閲覧可能にするためのスナップショット

## モード切替

- `lib/siteConfig.ts` が `SITE_MODE` / `NEXT_PUBLIC_SITE_MODE` を正規化
- `softeni-pick` と `score` で URL, サイト名, OGP を切替
- `score` モード時の `/matches*` は、`src/pages/beta/matches-results/*` の公開用ラッパとして動く

## データ更新フロー

1. 管理系ページまたはローカルツールで試合を入力
2. API が Supabase を更新
3. 公開向けには `public/data/beta-matches/**` を利用
4. 成長分析は静的 JSON と `lib/growthAnalysis.ts` ベースで表示

## Assumption

- `src/pages/api/matches/**` が現行バックエンドの主軸
- 認証・認可は厳密なユーザー認証ではなく、モード制御と開発向けフラグ中心
- 将来的に README 記載どおり Cloudflare への移行を見据えている

## Open Questions

- 本番で API Routes をどこまで使用しているか
- 書き込み API の利用者制御を何で担保しているか
- `public/data/beta-matches/**` の生成トリガーは何か
- `functions/` が別リポジトリに存在するのか
