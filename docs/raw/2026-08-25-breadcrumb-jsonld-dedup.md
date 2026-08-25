# BreadcrumbList JSON-LD の重複解消（2026-08-25）

## 事象

全公開ページで `"@type":"BreadcrumbList"` の JSON-LD が 2 回出力されていた。

確認（当時の dev サーバ）:

```
curl -s http://localhost:3000/tournaments/ | grep -o '"@type":"BreadcrumbList"' | wc -l
# => 2
```

`/tournaments/`, `/tournaments/all/zennihon-championship/`,
`/tournaments/international/asian-games/` などで再現。

## 原因

出力元が 2 系統あった。

1. `src/components/Breadcrumb.tsx` — `crumbs` prop から `BreadcrumbList` を生成（共通コンポーネント）
2. `src/pages/` 配下の 26 ファイル — それぞれ `<Head>` 内に同じ `BreadcrumbList` を手書き

26 ファイルはすべて `<Breadcrumbs>` コンポーネントも併用していたため、必ず 2 個出ていた。
直近の変更が原因ではなく、コンポーネント化する前の手書き JSON-LD が
ページ側に残ったまま累積した既存不具合。

## 決定

**`Breadcrumb.tsx` を唯一の出力元とし、ページ側 26 ファイルの手書き JSON-LD を削除する。**

理由:

- 可視パンくずと JSON-LD が同じ `crumbs` 配列から生成されるので、両者がずれない
  （実際に下記のずれが発生していた）
- ページ側は階層を配列で渡すだけでよく、記述量が減る

## 1件ずつ突き合わせて見つかった差分

削除前に 26 ファイルすべてで「手書き JSON-LD」と「コンポーネントに渡す `crumbs`」を比較した。
項目数・ラベルはほぼ一致していたが、以下が食い違っていた。

| 箇所 | 内容 | 扱い |
| --- | --- | --- |
| `src/pages/players/[id]/index.tsx` | 手書き側だけ 4 件目に「試合結果」（配下ページ）を足していた。コンポーネント側は 3 件 | コンポーネント側（3 件）を正とした。`BreadcrumbList` は現在ページまでの**祖先**を並べるものなので、配下ページを末尾に足すのは誤り |
| `src/pages/privacy.tsx` | 可視パンくずのリンク先が `href: '/players'`（コピペ由来と思われる誤り）。手書き JSON-LD 側は `/privacy/` で正しかった | `href: '/privacy'` に修正。修正しないと一本化で誤リンクだけが残るところだった |
| 末尾スラッシュ | 手書き側は `https://softeni-pick.com/about/` と canonical に揃っていたが、`buildSiteUrl('/about')` は `.../about`（スラッシュなし）を返す | コンポーネント側で `trailingSlash: true` に合わせて付与するよう修正 |

## 一本化の過程で判明した別の既存バグ

`crumb.href` に**絶対 URL** を渡しているページがあり、`buildSiteUrl()` がそれをパス扱いして
ベース URL を二重に付けていた。

```
"item":"https://softeni-pick.com/https://softeni-pick.com/tournaments/block/tohoku/"
```

該当 3 ページ（いずれも `pageUrl` という絶対 URL の定数をそのまま渡していた）:

- `/tournaments/block/[blockId]`
- `/tournaments/local/[federationId]`
- `/teams/[teamId]/[year]/[gender]`

このうち前 2 つは手書き JSON-LD を持っておらず、コンポーネント出力だけだったため
**重複ではなく単純に壊れた URL が 1 個出ている**状態だった。
`Breadcrumb.tsx` 側に正規化を入れて解消した（絶対 URL はそのまま通す）。

`beta/matches-results/[matchId]` は正当な理由で絶対 URL（`seoCanonicalUrl`）を
crumb に渡しているので、この正規化はコンポーネント側に置くのが妥当と判断した。

## 実装

- `src/components/Breadcrumb.tsx` に `toBreadcrumbItemUrl()` を追加
  - 絶対 URL はそのまま、相対パスは `buildSiteUrl()` で絶対化
  - `?` / `#` を保ったまま末尾スラッシュを付与（canonical と同じ形）
  - ページ側で `BreadcrumbList` を書かない旨をコメントで明記
- `src/pages/` 26 ファイルの手書き `BreadcrumbList` を削除
  - `src/pages/index.tsx` は `jsonLd` 配列の該当エントリを削除（`Organization` / `WebSite` / `ItemList` は残す）
  - `beta/matches-results/[matchId]` は `breadcrumbJsonLd` 定数と `<script>` を削除
  - 空になった `<Head></Head>` と未使用の `next/head` import を 7 ファイルで削除
- `src/pages/privacy.tsx` の crumb href を `/players` → `/privacy` に修正

## 確認

worktree 用に dev サーバ（:3001）を立てて全ページ種別で確認。すべて `BreadcrumbList` は 1 個。

| URL | 結果 |
| --- | --- |
| `/` | 1 |
| `/tournaments/` | 1 |
| `/tournaments/all/zennihon-championship/` | 1 |
| `/tournaments/all/zennihon-championship/2025/doubles/none/boys/` | 1 |
| `/tournaments/.../boys/matches/{matchId}/` | 1（4 階層、大会階層あり） |
| `/tournaments/block/tohoku/` | 1（URL 二重化が解消） |
| `/tournaments/major/` | 1 |
| `/privacy/` `/about/` `/faq/` `/contact/` | 各 1 |
| `/highschool/` `/highschool/boys/` `/highschool/boys/tokushima/` `/highschool/boys/tokushima/tsurugi/` | 各 1 |
| `/highschool/rankings/` `/highschool/tournaments/` `/highschool/tournaments/championship/` | 各 1 |
| `/secondaryschool/` `/secondaryschool/tokyo/` `/secondaryschool/tokyo/seimeigakuen/` `/secondaryschool/pathways/boys/` | 各 1 |
| `/teams/` `/teams/nssu/` `/teams/nssu/2025/boys/` | 各 1（年度ページの URL 二重化が解消） |
| `/players/` `/players/ando-kesuke/` `/players/122/results/` | 各 1 |

`npx eslint src/pages src/components` はエラー 0。

補足: `/tournaments/international/asian-games/` は worktree では 404 になるが、これは
`data/tournaments/information/asian-games.json` が本体リポジトリで未コミット（untracked）で
worktree に存在しないためで、本変更とは無関係。

## Compile Log

docs/wiki への書き戻し時に、このノートから取捨選択した内容。

- **含めた**: 「`Breadcrumb.tsx` が唯一の出力元」というルール、`crumb.href` の受け入れ形式と
  末尾スラッシュの扱い、`BreadcrumbList` に配下ページを足さない原則、2026-08-25 の経緯と
  解消した既存バグ 2 件 → `docs/wiki/public-pages.md`「パンくずの構造化データ（BreadcrumbList）」
- **含めた**: 試合詳細ページ節の「可視パンくずと JSON-LD は同じ `crumbs` から生成」への書き換え
  → `docs/wiki/public-pages.md`（旧記述は 2 系統ある前提の書き方だった）
- **含めた**: `seo.md` / `highschool.md` から新節への相互リンク（AGENTS.md の相互リンク規約）
- **除外**: 26 ファイルの個別ファイル名一覧 — git 履歴で追える。wiki に置くと更新漏れの元
- **除外**: 検証に使った具体的な URL 一覧と curl コマンド — 一度きりの確認手順で、wiki の
  現状記述としての価値が薄い
- **除外**: worktree に node_modules を symlink して :3001 で dev を立てた等の作業環境の話 —
  このリポジトリの仕様ではなく作業メモ
- **除外**: `asian-games.json` が untracked である件 — 本変更と無関係で、かつ一時的な状態
- **除外**: ADR 化 — アーキテクチャ上の決定というより既存不具合の修正なので、ADR は追加しない
