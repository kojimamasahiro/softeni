---
type: overview
scope: 汎用
status: current
summary: "Android アプリは無いという記録と、同じリポジトリで間借りしている別アプリ AdInsight のサイトの扱い"
code:
  - "scripts/build-adinsight-site.mjs"
---
# Android

> **適用範囲: 汎用**。このリポジトリに Android 実装は無いという記録と、間借りしている別アプリのサイト。競技に依存しない。


## 概要

このリポジトリ内では、Softeni Pick 本体の Android アプリ実装は確認できません。

## 別アプリ「AdInsight」のサイト（間借り）

`adinsight-site/` は Softeni Pick とは**無関係な** Android アプリ「AdInsight」の紹介・法務サイト。
独自ドメインの費用を避けるため `adinsight.softeni-pick.com` を間借りしており、ソースもこの repo が正
（docs/ui/decisions.md D-027。2026-07-04 に一度削除し（D-016）、2026-09-30 に復元）。

- アプリ本体: https://github.com/kojimamasahiro/adinsight （同じサイトの別版は置かない）
- ページ: `/`、`/privacy`、`/terms`、`/account-delete`。Google Play に登録済みの URL なので**パスを変えない・消さない**
- 配信: 本体とは別の Cloudflare Pages プロジェクト `adinsight`（[deployment.md](./deployment.md)）。production branch は main、
  Build watch paths の include を `adinsight-site/*`、`scripts/build-adinsight-site.mjs`、`wrangler.adinsight.toml` に絞り、本サイトだけの更新ではビルドしない
- `config.js` はアプリの Supabase の公開値（URL・publishable key）と Functions の URL だけ。アプリ側で切り替えたら合わせる
- 文言（プライバシー・規約・課金の説明）はアプリの仕様に従う。本体の UX ルール（[ux-writing.md](./ux-writing.md)）の対象外

経緯と調査: [raw/2026-09-30-adinsight-site-restore.md](../raw/2026-09-30-adinsight-site-restore.md)

## Assumption

- Softeni Pick 本体の Android 実装は別リポジトリ管理の可能性が高い
- Pages `adinsight` は Git 連携で、production branch は削除済みの `cloudflare` のまま（未確認。上の設定へ変更が要る）
