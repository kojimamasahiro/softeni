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

### ビルド時間の内訳（2026-07-19 実測）

teams 系の集計最適化により **22分41秒 → 8分53秒**（commit 0076636 → 2f34553）。

| フェーズ | 修正前 | 修正後 |
|---|---|---|
| clone + `npm ci` | 25秒 | 24秒 |
| prebuild（大半が `generate-facts`） | 2分15秒 | 2分6秒 |
| lint + 型チェック | 22秒 | 22秒 |
| webpack compile | 2分6秒 | 1分45秒 |
| Collecting page data | 1分49秒 | 10秒 |
| Generating static pages | 14分39秒 | 3分13秒 |
| upload + deploy | 34秒 | 40秒 |

出力は 3,717 HTML・7,945ファイル・379MB あるが、**アップロードは30秒台で問題ではない**。

その後 `generate-facts` を増分化（下記）。詳細は
docs/raw/2026-07-19-cloudflare-build-time.md。

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

ただし**ページ生成には数百msの床がある**。getStaticProps を持たない純粋な静的ページでも
1ページ約470msかかる（React の SSR レンダリング + フレームワークのオーバーヘッド）。
1ページあたりが1秒を切っているルートは、データ取得を最適化しても頭打ちになる。

### generate-facts の増分ビルドとビルドキャッシュ

`data/players/_facts`（130MB / 18,485ファイル）・`_index`・`_manifest.json` は
`.gitignore` 対象のため、Cloudflare では clone 直後に存在せず `generate-facts` が
毎回フルビルド（約2分）に落ちていた。ローカルでは増分（数秒〜10秒）が既定。

`scripts/playerStats/cache-sync.mjs` がこれらを `.next/cache/playerstats/` に退避し、
次回ビルドで復元する。prebuild の先頭で `restore`、末尾で `save` を実行する。

Cloudflare Pages のビルドキャッシュは、Next.js プロジェクトに対して **`.next/cache`** と
package manager のグローバルキャッシュを保存・復元する（公式ドキュメント Build caching）。
**保持期間は最終読み出しから7日、上限はプロジェクトあたり10GB。**

安全側の設計:

- manifest は mtime ではなく**入力ファイルの内容ハッシュ**ベースなので、
  復元物が古くても内容が変われば再生成される（git clone で mtime が失われても無害）
- キャッシュが無い・不完全・ファイル数が合わない場合は復元を拒否してフルビルドに落ちる
- save は一時ディレクトリ + `rename` で原子的に差し替える
- cache-sync は例外を握り潰して常に成功終了する（キャッシュ障害でビルドを落とさない）
- 作業コピーが存在する場合 restore はスキップするため、ローカル開発は影響を受けない

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
- webpack compile の1分45秒を Turbopack（`next build --turbopack`）で短縮できるか（未検証）

解決済み:

- ~~`generate-facts` の増分 manifest を Cloudflare のビルドキャッシュに乗せる方法~~
  → `scripts/playerStats/cache-sync.mjs` で解決（上記）
- ~~`/players/[id]/results` に同種の非効率が残っていないか~~
  → 調査の結果、構造的な非効率は無く**最適化対象外**と判断（2026-07-19）。
  データ取得は約80ms、props も平均25.2kBで無駄が無い。報告値1.24秒の大半は
  React の SSR レンダリングとページ生成の床。
