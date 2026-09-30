# adinsight-site の復元（2026-09-30）

> 適用範囲: 汎用（Softeni Pick 本体とは無関係な別アプリのサイト）

## 背景

- オーナー: 別の Android アプリ「AdInsight」（repo: https://github.com/kojimamasahiro/adinsight 、
  ローカル `~/Desktop/admob`）を 2026-09-30 に再始動。目標はストア公開状態の維持。
- Google Play に登録したプライバシー・規約・アカウント削除の URL は `https://adinsight.softeni-pick.com/` 配下。
  独自ドメインは費用がかかるため、softeni-pick.com のサブドメインを間借りし続ける。
- この repo では 2026-07-04 に `adinsight-site/` を削除していた（docs/ui/decisions.md D-016）。

## 調べたこと

- 公開中のサイトは `server: cloudflare`、Vercel 特有のヘッダは付いていない。
- 公開中の HTML / CSS / JS を取得して比べると、この repo のコミット `964ac897`（2026-05-17「adinsight」）と一致した。
  違いは Cloudflare のメールアドレス難読化（`/cdn-cgi/l/email-protection`）による書き換えだけ。
- `964ac897` の後の `b3e5767c`（2026-06-22 lint。整形のみ）は公開に反映されていない。
- ローカルに `cloudflare` ブランチが残っており、`origin/cloudflare` を追跡する設定だった。
  リモートのブランチは既に無い。最後のコミットは 2026-05-17 で、`adinsight-site/` の最新は `964ac897`。
  → Pages プロジェクト `adinsight` は `cloudflare` ブランチと Git 連携していて、ブランチ削除で
  デプロイが止まった、と推測（**Assumption**。ダッシュボード未確認。wrangler は未導入で確認できず）。
- アプリ側 repo にも同じサイトの別版 `account-deletion-site/`（Vercel 用、`*.html` + `vercel.json`）があり、
  wiki には「Vercel で公開中」と書かれていた。内容はこの repo の版より古い（2026-05-02 の初版）が、
  `config.js` だけは 2026-09-30 に legacy anon key から publishable key へ切り替え済みだった。

## 決めたこと

- ソースの正はこの repo の `adinsight-site/` に一本化（D-027）。アプリ側の `account-deletion-site/` は削除。
- 削除直前（`694b9d23~1`）の状態から `adinsight-site/`・`wrangler.adinsight.toml`・
  `scripts/build-adinsight-site.mjs`・package.json の `build:adinsight` を復元。
- `config.js` はアプリ側の publishable key 版に合わせた。

## 残っていること（オーナー側）

- Cloudflare Pages `adinsight` の Git 連携と production branch を確認する。`cloudflare` ブランチのままなら
  main へ付け替える（付け替えないと、この repo の変更が公開されない）。
  ビルドコマンド `npm run build:adinsight`、出力先 `out`（`adinsight-site/README.md`）。
- 付け替え後は main への push ごとに `adinsight` も再ビルドされる。

## Compile Log

- wiki/android.md・wiki/deployment.md へ: 間借りの事実、ソースの場所、アプリ側 repo との関係、削除しない理由。
- 落とした: 公開版とコミットの diff 行数などの検算（再現手順はこの節の「調べたこと」で足りるため）。
- 落とした: Vercel 版との細かな差分（アプリ側の版は削除したため、今後参照しない）。
