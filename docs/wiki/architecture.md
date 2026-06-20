# Architecture

## 全体像

このリポジトリは Next.js Pages Router を中心に、静的データ配信と一部 Supabase API を併用する構成です。

主要な構成要素:

- フロントエンド: `src/pages/**`, `src/components/**`
- 型と集約ロジック: `src/types/**`, `src/utils/**`, `lib/**`
- 静的データ: `data/**`, `public/data/**`
- 試合 API: `src/pages/api/matches/**`
- 生成スクリプト: `scripts/**`

## フロントエンド

### 本体ページ

- `src/pages/index.tsx`
- `src/pages/players/**`
- `src/pages/teams/**`
- `src/pages/tournaments/**`
- `src/pages/highschool/**`

補足:

- `src/pages/highschool/index.tsx` は静的エクスポート互換のため、サーバー redirect ではなく静的 HTML の `meta refresh` で `/highschool/boys` へ遷移する

これらは `data/**` 配下の JSON を読み、静的ページとして公開する構成が中心です。

### score 公開ページ

- `src/pages/beta/matches-results/**`
- `src/pages/matches/**`

`src/pages/matches/**` は score 用の公開 URL を提供する薄いラッパで、表示ロジックの実体は `src/pages/beta/matches-results/**` を再利用しています。

成長記録の公開ショーケース（`/growth`）は独立した区画です（2026-06 追加。詳細は ADR-004）。

- `src/pages/growth/index.tsx`（ハブ `/growth`）
- `src/pages/growth/[slug].tsx`（選手ショーケース `/growth/[slug]`・インデックス対象）
- 共通ロジック: `lib/growthShowcase.ts`（featured・targets・レポート・もとにした試合の整形）
- 対象設定: `data/growth-featured.json`

確認根拠:

- `src/pages/matches/index.tsx`
- `src/pages/matches/[matchId]/index.tsx`
- `src/pages/matches/growth/index.tsx`

## データ層

### 静的 JSON

- 大会/選手データ: `data/**`
- score 公開データ: `public/data/beta-matches/**`

score 公開データは一覧・詳細・成長分析で分かれています。

- `public/data/beta-matches/meta.json`
- `public/data/beta-matches/index.json`
- `public/data/beta-matches/matches/*.json`
- `public/data/beta-matches/growth/targets.json`
- `public/data/beta-matches/growth/reports/*.json`

成長分析の運用設定（手動メンテ）:

- `data/growth-featured.json`（ショーケース対象の allowlist）
- `data/growth-exclusions.json`（成長分析の撤回リスト・生成段で除外）

### Supabase

動的な試合作成・更新・動画レビューでは Supabase を使用します。

主要参照:

- `lib/supabase.ts`
- `lib/supabaseClient.ts`
- `src/pages/api/matches/**`
- `src/types/database.ts`

## API 層

試合 API:

- `src/pages/api/matches/index.ts`
- `src/pages/api/matches/[matchId]/index.ts`
- `src/pages/api/matches/[matchId]/games/**`
- `src/pages/api/matches/[matchId]/points/index.ts`
- `src/pages/api/matches/[matchId]/video-sessions/**`

主な責務:

- match / game / point の CRUD
- ゲームスコア再計算
- 動画レビュー用セッションと候補ポイント管理
- score モードでの書き込み抑止

## 生成スクリプト

主要スクリプト:

- `scripts/generate-players-json.mjs`
- `scripts/generate-beta-matches-json.mjs`
- `scripts/generate_entries.py`
- `scripts/generate_roundrobin.py`
- `scripts/extract-players.mjs`

役割:

- `data/**` の生成・正規化
- `public/data/beta-matches/**` の生成
- 成長分析レポートの静的生成

## デプロイ構成

- Next.js 本体: `next.config.mjs`
- Cloudflare Pages 設定: `wrangler.toml`
- AdInsight 用 Pages 設定: `wrangler.adinsight.toml`

`NODE_ENV=production` では `output: 'export'` が有効です。

## Assumption

- 本番の主経路は静的配信で、Supabase API はローカル運用または限定運用の比重が高い
- `public/data/beta-matches/**` は score 公開面向けの中間成果物として扱われている

## Open Questions

- 本番で `src/pages/api/matches/**` をどの環境で動かしているか
- `data/**` と Supabase のどちらが score 機能の正式ソースか
