# Backend

> 現行仕様。2026-08-12 に実装（`next.config.mjs` / `lib/betaMatchesClient.ts` / `package.json`）と
> 突き合わせ済み。

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

**本番にサーバーは無い。** `next.config.mjs` が本番だけ `output: 'export'` を付けるため、
本番ビルドは完全な静的エクスポート（`out/` を Cloudflare Pages が配信、`wrangler.toml`）で、
`src/pages/api/**` は成果物に含まれない。

したがって API Routes と Supabase の読み書きは**ローカル開発時にだけ動く**。
`hasLiveMatchApi()`（`lib/betaMatchesClient.ts`）は `NODE_ENV === 'development'` そのもので、
真なら `/api/matches` を叩き、偽なら `public/data/beta-matches/**` の静的 JSON にフォールバックする。
`isDebugMode()`（`lib/env.ts`）は開発環境または `NEXT_PUBLIC_DEBUG_MODE=true` で、編集UIの表示可否を決める。

- 公開ページは `getStaticProps` / `getStaticPaths` でビルド時に確定
- 試合入力・動画レビューは masahiro のローカル環境から Supabase を直接更新する運用
- 公開面はその結果をビルド時にスナップショットした静的 JSON を読む
- `score` モードでは編集系ページ・書き込み API を閉じる（そもそも本番には API が無い）

## 主要バックエンド機能

### 1. 試合データ API

- `GET /api/matches`
- `POST /api/matches`
- `GET /api/matches/[matchId]`
- `PATCH /api/matches/[matchId]`
- `DELETE /api/matches/[matchId]`
- `POST /api/matches/[matchId]/games`
- `DELETE /api/matches/[matchId]/games`（`{ from_game_number }` で指定ゲーム以降を一括削除。
  2026-08-11 追加。詳細は [score-feature.md](./score-feature.md)「ゲーム単位のやり直し」）
- `PATCH /api/matches/[matchId]/games/[gameId]`
- `POST|PUT|DELETE /api/matches/[matchId]/points`
- `GET /api/tournament-entries`（大会エントリー参照。試合作成フォームの補助）

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
- 本番には API が無いため、閲覧に必要な全データをビルド時にスナップショットしておく

生成トリガー:

- `package.json` の `prebuild` が `scripts/generate-beta-matches-json.mjs` を実行し、
  Supabase から取得して `public/data/beta-matches/**` に書き出す
- したがって**ローカルで入力した内容は、次のビルドまで公開面に出ない**
- 詳細な生成パイプライン全体は [data-import.md](./data-import.md) / [deployment.md](./deployment.md)

## モード切替

- `lib/siteConfig.ts` が `SITE_MODE` / `NEXT_PUBLIC_SITE_MODE` を正規化
- `softeni-pick` と `score` で URL, サイト名, OGP を切替
- `score` モード時の `/matches*` は、`src/pages/beta/matches-results/*` の公開用ラッパとして動く

## データ更新フロー

1. 管理系ページまたはローカルツールで試合を入力
2. API が Supabase を更新
3. 公開向けには `public/data/beta-matches/**` を利用
4. 成長分析は静的 JSON と `lib/growthAnalysis/` ベースで表示

## 認可

ユーザー認証は無い。書き込み経路が本番に存在しないこと自体が唯一の防御線で、
`isDebugMode()` / `hasLiveMatchApi()` は UI の出し分けであって認可ではない。
score をツールとして外部に開く（UGC）場合はここが前提から崩れる — [ADR-003](../adr/ADR-003-score-media-tool-separation.md) を参照。

## Open Questions

- score をツール公開（UGC）する場合、書き込み経路と認可をどう作るか（ADR-003 の未決部分）

以前ここにあった「本番で API Routes をどこまで使うか」「書き込みの利用者制御」
「`public/data/beta-matches/**` の生成トリガー」「`functions/` の所在」は
2026-08-12 の lint で実装を確認して解決した（順に: 本番では使わない＝静的エクスポート／
本番に書き込み経路が無いこと自体が制御／`prebuild` の `generate-beta-matches-json.mjs`／
`functions/` はリポジトリに存在しない）。
