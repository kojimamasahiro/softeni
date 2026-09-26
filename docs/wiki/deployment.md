# Deployment

> **適用範囲: 汎用**。Cloudflare Pages への配信・ビルド設定は競技に依存しない。
> **2026-09-23 に現在の仕様だけへ圧縮した。** ビルド時間の内訳表・nft の実測・CI 導入時の経緯は
> [raw/2026-09-23-wiki-archive-deployment.md](../raw/2026-09-23-wiki-archive-deployment.md) にある。
>
> 全体の構成（何がどこで動くか）は [architecture.md](./architecture.md)、サイト全体の地図は
> [project-overview.md](./project-overview.md)。

## 概要

Next.js の静的 export を Cloudflare Pages で配る。CF は push 契機でビルドし、`prebuild` の先頭がゲートになる。
ゲートにできない検査・テストは GitHub Actions（`checks.yml`）で回す。

## ビルド設定

- `next.config.mjs`: `NODE_ENV=production` のとき `output: 'export'`、`trailingSlash: true`、`images.unoptimized: true`
- `wrangler.toml`: `name = "softeni-pick"`、`pages_build_output_dir = "out"`
- `prebuild` は**データ健全性チェック → 正準化 → 生成物ビルド**の直列チェーン（段数・順序は `package.json` が正）。
  1. **正準化・ゲート**: `normalize-team-spacing` → `check-tournament-entries` → `check-team-match-details`
     （[ADR-020](../adr/ADR-020-team-match-rubber-details.md)）→ `check-tournament-insights`
     （[ADR-012](../adr/ADR-012-llm-authored-insights-with-machine-verification.md) の公開条件）→
     `check-highschool-pipeline-freshness` → `check-name-splits --strict`。**ここで落ちるとビルドが止まる**（意図的な門番）
  2. **playerStats キャッシュの復元**: `playerStats/cache-sync.mjs restore`（生成の後で `save`）
  3. **生成**: players / playerStats facts / 分析 / beta-matches / 逆引き索引 / rare-events / rankings →
     `secondaryschool:build` → `primaryschool:build` → `university:pathways`
- `postbuild`: `next-sitemap` → `sort-sitemaps.mjs` → `filter-noindex-from-sitemap.mjs`
- `wrangler.adinsight.toml` は `adinsight-site/` ごと削除済み（docs/ui/decisions.md D-016）。

#### sitemap の出力先（2026-08-05 修正）

`next-sitemap.config.js` に **`outDir: 'out'` を明示する**。既定の `public/` だと、`next build` が `public/` を
`out/` にコピーした**後**に postbuild が書くため、配信される sitemap が常に1ビルド古くなる。

- `sort-sitemaps.mjs` / `filter-noindex-from-sitemap.mjs` も `out/` を見る。
- `public/sitemap*.xml` / `public/robots.txt` は生成物なので `.gitignore`（追跡すると古いものが out/ へ戻る）。
- 詳細: [raw/2026-08-05-seo-audit.md](../raw/2026-08-05-seo-audit.md) A-1

## GitHub Actions

| | Cloudflare Pages | `checks.yml` |
|---|---|---|
| 契機 | push のみ | push / PR / cron（毎週月 09:00 JST）/ 手動 |
| 置けるもの | ゲートのみ（失敗＝デプロイ停止） | **ゲートと報告を分ける**。報告はデプロイに影響しない |

- **ゲート**と**報告のみ**の一覧は `.github/workflows/checks.yml` が正（各ステップに追加日と理由のコメントがある）。
  docs のリンク切れと skill リンクの同期もゲート、docs の文字数・識別の要対応・大会情報の残タスクは報告のみ。
- 報告側に置いた検出器は、解消したらゲートへ昇格させる（`verify-bracket-layout` / `check-team-id-alignment` はこの経路で昇格済み）。
- `permissions: contents: read`。**リポジトリへ書き戻す仕事は `review-snapshot.yml` に分ける**（ゲートに push 権限を持たせない）。
- Python の回帰テスト（`scripts/pdf-to-players` / `scripts/venue-agent` の `test_regression.py`）は
  `scripts/requirements-test.txt` で依存を固定、Python 3.13。fixtures の PDF は追跡していないので
  **PDF に依る項目は CI で SKIP**（144項目中75だけカバー）。`scripts/pdf/` は回帰テストが無く依存も未固定。

### review-snapshot（`.github/workflows/review-snapshot.yml`）

- 毎週月曜 09:30 JST ＋手動。`record-review-snapshot.mjs` が `data/teams/review-history.json` に追記する。
- **数字が動いたときだけコミット**。メッセージに `[skip ci]` を入れて CF のビルドを飛ばす（実運用で飛ぶかは未確認）。
- 書き戻すのは「**再生成できない記録**」だけ。**生成物は書き戻さない**（`sitemap.yml` が生成物を戻す設計で廃れた）。

## 守ること（ビルド時間）

- **ビルド時にデータを読むユーティリティは、プロセス内キャッシュを持つ**。`getStaticProps` は数千回呼ばれる。
  `loadTournamentData()`（`src/utils/tournament-data-loader.ts`）や `lib/playersIndex.ts`
  （`getPlayerIndex` / `getPlayerNameToId` / `getPlayerIdToName`）の**返り値は共有の読み取り専用**。書き換えない。
- `data/players/index.json` は必ず `lib/playersIndex.ts` 経由で読む。
- **nft のワイルドカード走査を招く書き方をしない**。`output: 'export'` では trace 結果は使われないが、
  Next 15.5 には tracing を止める設定が無く、走査範囲を狭めるしかない。

```ts
// 悪い: process.cwd() 直書き + パス配列の spread → リポジトリ全体が glob される
fs.readFileSync(path.join(process.cwd(), ...DATA_DIR, file), 'utf-8');
// 良い: リテラルで書く（その配下だけ）/ さらに良い: 関数経由（resolveRoot()）で glob 自体が出ない
fs.readFileSync(path.join(process.cwd(), 'data', 'secondaryschool', file), 'utf-8');
```

  `readdirSync` してから `readFileSync` する形でも同じことが起きる。
  復活したら `.next/server/pages/**/*.nft.json` のうち `.venv/` `.claude/` `docs/` を含むものを探すと発生源が分かる。
- **ビルド生成物は `data/` の外に置く**（playerStats は `.playerstats/`）。`data/**/*` の glob が毎回列挙するため。
- ページ生成には約470ms/ページの床がある（SSR ＋フレームワーク）。1秒を切るルートはデータ取得を削っても頭打ち。
  `/players/[id]/results` はこの理由で最適化対象外と判断済み。

## ビルドキャッシュ（generate-facts の増分）

`.playerstats/_facts`・`_index`・`_manifest.json` は `.gitignore` 対象なので、CF では clone 直後に無く
フルビルド（約2分）に落ちる。`scripts/playerStats/cache-sync.mjs` が `.next/cache/playerstats/` に退避・復元する
（CF のビルドキャッシュは `.next/cache` を保存。保持は最終読み出しから7日、上限10GB）。

- manifest は mtime でなく**入力の内容ハッシュ**。復元物が古くても内容が変われば再生成される。
- キャッシュが無い・不完全・ファイル数不一致なら復元を拒否してフルビルド。save は一時ディレクトリ＋`rename`。
- cache-sync は例外を握り潰して常に成功終了する（キャッシュ障害でビルドを落とさない）。作業コピーがあれば restore しない。

## score 公開面との関係

- `score` mode は静的公開が前提。公開データは `public/data/beta-matches/**`、編集系 API は `score` mode で 404。

## Cloudflare 側の設定（リポジトリの外）

- **WAF カスタムルールで EEA・英国・スイスからのアクセスをブロック**（認証済みボットは除外）。式と理由は [ADR-022](../adr/ADR-022-block-eea-uk-ch-access.md)

## 動的機能（速報など）を足すときの選択肢

Assumption（2026-07-19 の検討・未実装）。アーカイブは SSG のままでよく、速報は数ページだけなので全体を動的基盤に移す理由はない。

- **A.** 現状＋速報だけクライアント購読（Supabase Realtime）。SEO/OGP は弱い
- **B.** Cloudflare Pages Functions（`functions/`）を足す。移行不要
- **C.** Workers + OpenNext（ISR/SSR）。運用が複雑。**ビルド時間の解決策としては筋が悪い**（生成コストが初回アクセスへ移るだけ）
- **D.** Vercel。課金とロックイン

推奨は「ビルド最適化 → 速報が要れば B+A → C は SSG が再び破綻したとき」。

## Open Questions

- 2 ドメインを同じビルド成果物で配るか、別 build するか
- 静的 export で使えない API Routes を本番でどこまで使っているか
- webpack compile（約1分45秒）を Turbopack で短縮できるか（未検証）
- nft の走査が CF 実機でどれだけのコストか（ローカル計測のみ）

## 経緯

- 圧縮前の全文（ビルド時間の内訳表・出力ファイル数の推移・nft の実測）: [raw/2026-09-23-wiki-archive-deployment.md](../raw/2026-09-23-wiki-archive-deployment.md)
- [raw/2025-11-30-cloudflare-migration-analysis.md](../raw/2025-11-30-cloudflare-migration-analysis.md) / [raw/2026-07-19-cloudflare-build-time.md](../raw/2026-07-19-cloudflare-build-time.md) /
  [raw/2026-08-28-build-time-nft-glob.md](../raw/2026-08-28-build-time-nft-glob.md) / [raw/2026-09-06-idea-autonomous-improvement-agent.md](../raw/2026-09-06-idea-autonomous-improvement-agent.md)
