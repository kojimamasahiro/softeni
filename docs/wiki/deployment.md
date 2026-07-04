# Deployment

## 概要

このリポジトリは Next.js を本体にしつつ、Cloudflare Pages 向け設定ファイルが存在します。

確認根拠:

- `next.config.mjs`
- `wrangler.toml`
- `package.json`
- `docs/cloudflare-migration-analysis.md`

## 確定情報

### Next.js ビルド設定

- `NODE_ENV=production` のとき `output: 'export'`
- `trailingSlash: true`
- `images.unoptimized: true`

### Cloudflare Pages 設定

`wrangler.toml`:

- `name = "softeni-pick"`
- `pages_build_output_dir = "out"`

補足: `wrangler.adinsight.toml`(AdInsight 紹介サイト向け設定)は 2026-07-04 に
`adinsight-site/` ごと削除した(docs/ui/decisions.md D-016)。

### package.json scripts

- `dev`: `next dev`
- `prebuild`: players JSON と beta-matches JSON の生成
- `build`: `next build`
- `postbuild`: sitemap 生成とソート

## 推測を含む整理

### Cloudflare Pages

Assumption:

- `next.config.mjs` と `wrangler.toml` から、Cloudflare Pages への静的配信を現在の主要候補または現行構成として想定している

### Vercel

Assumption:

- `docs/cloudflare-migration-analysis.md` の記述から、Vercel 運用または Vercel 由来の検討履歴がある
- ただし、この turn では Vercel 用設定ファイルそのものは確認していません

## score 公開面との関係

- `score` mode は静的公開を前提とする設計
- 公開データは `public/data/beta-matches/**`
- 編集系 API は `score` mode で 404 にする実装

## Open Questions

- 現在の本番が Cloudflare Pages か、移行途中か
- 2 ドメインを同じビルド成果物で配るか、別 build するか
- 静的 export で使えない API Routes を本番でどこまで利用しているか
