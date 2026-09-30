# AdInsight Static Site

Android アプリ「AdInsight」（https://github.com/kojimamasahiro/adinsight ）の紹介・法務サイト。
**Softeni Pick 本体とは無関係**だが、独自ドメインの費用を避けるため `softeni-pick.com` の
サブドメインを間借りしており、ソースもこの repo が正（docs/ui/decisions.md D-027）。

https://adinsight.softeni-pick.com/

## 消さない・パスを変えない

`/privacy`、`/terms`、`/account-delete` は Google Play に登録済みの URL。
アプリがストアに出ている間は、このディレクトリを削除したりパスを変えたりしない。
アプリ側 repo に同じサイトの別版は置かない（二重管理になるため）。

## 変更するとき

- 文言（プライバシー・規約・課金の説明）はアプリの仕様に合わせる。アプリ側の変更に追従する。
- `config.js` はアプリの Supabase の公開値（URL・publishable key）と Functions の URL だけ。
  秘密値（service role key など）は置かない。

## デプロイ

Softeni Pick 本体とは別の Cloudflare Pages プロジェクト。

- Project name: `adinsight`
- Build command: `npm run build:adinsight`（このディレクトリを `out/` へコピーするだけ。この README と `config.js.example` は公開しないので除く）
- Build output directory: `out`
- Custom domain: `adinsight.softeni-pick.com`
- Production branch: `main`
- Build watch paths (include): `adinsight-site/*`, `scripts/build-adinsight-site.mjs`, `wrangler.adinsight.toml`
  （本サイトだけの更新で `adinsight` をビルドしないため）

Routes are provided as directory index pages to avoid clean URL redirect loops:

- `/privacy`
- `/terms`
- `/account-delete`

詳しくは docs/wiki/android.md。
