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

### ビルド時間の内訳（2026-07-19 実測、commit 0076636）

全体22.7分。内訳は clone+`npm ci` 25秒 / prebuild 2分15秒（うち `generate-facts` が
2分7秒）/ lint+型チェック 22秒 / webpack compile 2分6秒 / Collecting page data 1分49秒 /
**Generating static pages 14分39秒** / postbuild 3秒 / アップロード34秒。

出力は 3,717 HTML・7,945ファイル・379MB あるが、**アップロードは34秒で問題ではない**。
ボトルネックは静的ページ生成に集中する。

詳細は docs/raw/2026-07-19-cloudflare-build-time.md。

### 静的ページ生成のコスト特性

ページ生成コストはルートごとに極端に偏る。2026-07-19 時点の上位3ルート
（`/teams/[teamId]/[year]/[gender]`、`/players/[id]/results`、`/teams/[teamId]`）で
生成時間の95%を占めていた。

ビルド時にデータファイルを読むユーティリティは、**プロセス内キャッシュを必ず持たせること**。
`getStaticProps` はページ数ぶん（数千回）呼ばれるため、キャッシュの無い
`readFileSync` + `JSON.parse` は「ページ数 × データ件数」に膨らむ。

2026-07-19 に `src/utils/tournament-data-loader.ts`（`getAllTournamentFiles` /
`loadTournamentData`）へキャッシュを追加し、teams 系ルートの集計を約20倍高速化した。
`loadTournamentData()` の返り値は**プロセス内で共有される読み取り専用データ**であり、
呼び出し側で破壊的変更をしてはならない。

同種のキャッシュは `lib/tournamentData.ts`、`src/pages/players/[id]/results.tsx`、
`src/pages/players/[id]/index.tsx` にも入っている。関連: docs/wiki/players-pages.md。

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

## 動的機能（速報など）を足す時の選択肢

Assumption: 以下は 2026-07-19 の検討時点の整理であり、実装はしていない。

フルSSGとリアルタイム速報は本来ぶつからない。約3,700ページは過去戦績のアーカイブで
SSGが最適であり、速報は数ページだけなので、全体を動的基盤に移す理由にはならない。

- **A. 現状維持 + 速報だけクライアント購読（Supabase Realtime）** — デプロイ不要。
  初期HTMLに中身が無いため速報ページのSEO/OGPは弱い。
- **B. Cloudflare Pages Functions を足す（移行なし）** — 現構成のまま `functions/` を
  置けば動的エンドポイントが使える。静的 export で無効化されている `/api/matches/*` の
  代替置き場にもなる。ビルドログに `No functions dir at /functions found` と出ている。
- **C. Workers + OpenNext** — ISR / SSR が使え、ビルド時間がページ数に比例しなくなる。
  代償は KV/R2/キャッシュ設定の運用複雑度と Cloudflare 固有の Node API 制約。
- **D. Vercel** — ISR/PPR が最も素直。課金とロックイン。

推奨順序は「まずビルド最適化 → 速報が必要になったら B+A → C は SSG が再び破綻した時」。

注意: **C はビルド時間問題の解決策としては筋が悪い。** 重いページ生成コストは ISR に
してもユーザーの初回アクセス時に移るだけで、集計の非効率はどの構成でも先に直す必要がある。

## Open Questions

- 現在の本番が Cloudflare Pages か、移行途中か
- 2 ドメインを同じビルド成果物で配るか、別 build するか
- 静的 export で使えない API Routes を本番でどこまで利用しているか
- `generate-facts`（prebuild の2分7秒）の増分ビルド用 manifest を Cloudflare の
  ビルドキャッシュに乗せる方法。`data/players/_facts/` は `.gitignore` 対象で、
  Cloudflare がキャッシュするのは `node_modules` と `.next` のみ
- `/players/[id]/results`（1.24秒 × 1,917ページ）に同種の非効率が残っていないか
