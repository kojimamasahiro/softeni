# Public Pages

## 概要

現時点では、`softeni-pick.com` と `score.softeni-pick.com` を別コードベースではなく、同一リポジトリ内のモード切替で運用する構成です。

確認根拠:

- `lib/siteConfig.ts`
- `README.md`
- `docs/beta-matches-results.md`

## 実装済み

### サイトモード切替

使用する主な環境変数:

- `SITE_MODE`
- `NEXT_PUBLIC_SITE_MODE`
- `NEXT_PUBLIC_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_SITE_NAME`
- `NEXT_PUBLIC_PUBLIC_OG_IMAGE`

モードごとの既定値:

- `softeni-pick`: `https://softeni-pick.com`
- `score`: `https://score.softeni-pick.com`

### ルーティング

`softeni-pick` mode:

- `/`
- `/players/**`
- `/teams/**`
- `/tournaments/**`
- `/beta/**`
- `/beta/matches-results/**`
- `/growth`（成長記録ハブ・公開/インデックス対象）
- `/growth/[slug]`（選手の成長記録ショーケース・公開/インデックス対象。対象は `data/growth-featured.json` の featured のみ。詳細は ADR-004）

補足（成長分析の公開境界・2026-06）:

- 公開・インデックス対象は `/growth`（運営キュレーションのショーケース）。
- `/beta/matches-results/growth` は内部ツール面で `noindex`（`/beta` は robots Disallow）。対象は公開試合の参加者（`targets.json`）。

高校カテゴリページ:

- `/highschool/[gender]`
- `/highschool/[gender]/[prefectureId]`
- `/highschool/[gender]/[prefectureId]/[teamId]`
- `/highschool/tournaments`（全国大会の歴代記録 入口）
- `/highschool/tournaments/[tournament]`（大会別 歴代記録、`tournament` = `championship` / `japan-cup`）

補足:

- `mixed` の高校大会結果は、boys / girls の両方の一覧と学校ページに表示する
- `mixed` は独立した高校トップページや切り替えタブを増やさない

高校カテゴリの公開ページ方針・全国大会の歴代記録ページの詳細は
[highschool.md](./highschool.md) に集約した（URL 一覧は上記のとおり）。

地域大会結果ページ:

- `/tournaments/local`
- `/tournaments/local/[federationId]`

関連:

- [Tournaments Local](./tournaments-local.md)

`/tournaments` 一覧のモバイル表示:

- カードで大会状態を判別できるようにする
- `開催予定` はラベルを表示し、横に日付と開催地を並べる
- 結果未反映で外部リンク導線のみの大会は `外部掲載` を表示する
- 一覧構造や既存URLは変更しない

大会ハブページ（`/tournaments/[generation]/[tournamentId]`、2026-06 追加）:

- 年度を含まない「ソフトテニス 大会名 結果」検索クエリの受け皿となる、1大会の歴代結果まとめページ
- `getStaticPaths` は `data/tournaments/details/{tournamentId}` 配下の年度ディレクトリを走査して生成し、`generation` は `index.json` / `local_index.json` の `generationId` から解決する（不明時は `unknown`）
- SEO（カニバリ集中、2026-06）: 高校全国大会 ID（`getHsNationalSlugByTournamentId` が解決）に該当するハブは `noindex, follow` にし、検索面を `/highschool/tournaments/[tournament]` へ集中させる。該当時はページ上部に高校歴代ページへの誘導バナーを表示する。それ以外の大会のハブは従来どおり index 対象。詳細は [seo.md](./seo.md) #3
- 実際に詳細データがある年度・種別のみをチップでリンク化し、年度降順で表示する。種別ラベルは `information/{tournamentId}.json` の `categories[].label` から解決する
- 各詳細 JSON から優勝ペア（`results[].tournament.rank.kind === 'winner'` のエントリーの選手名・所属）を抽出し、「歴代優勝者」表を表示する
- 構造化データは `CollectionPage` / `ItemList`（歴代優勝者）/ `BreadcrumbList` を出力する
- 大会一覧カード（`TournamentCard`）と年度別結果ページのパンくずからハブページへ内部リンクする。トップページの「最近追加された大会」カードのリンク先もこのハブページ（年度なし）とする（2026-06 変更。以前はカテゴリ別の年度別結果ページへリンクしていた）
- 年度別結果ページ（`/tournaments/.../[gender]`）には `SportsEvent` 構造化データと冒頭の説明文を追加し、title / description を「結果・トーナメント表」を含む形に改善する
- 実装: `src/pages/tournaments/[generation]/[tournamentId]/index.tsx`、`src/components/tournaments/TournamentCard.tsx`

`score` mode:

- `/matches`
- `/matches/[matchId]`
- `/matches/growth`

### トップページ（`/`）の SEO 方針（2026-06 改善）

実装: `src/pages/index.tsx`

- **本文を静的 HTML に含める**: 以前は全コンテンツを `{!isClient ? null : ...}` でクライアントマウント後のみ描画しており、`output: 'export'` の静的 HTML に h1・紹介文・カードが一切出力されていなかった。`isClient` ゲートを撤去し、SSG 時に本文を出力する
  - ゲートの目的だった `toLocaleDateString('ja-JP')` のハイドレーション不一致は、`getStaticProps` で `YYYY-MM-DD` から決定的に整形した `displayDate`（`YYYY年M月D日`）を渡すことで解消する。クライアントでロケール依存整形を行わない
- **内部リンクをクローラ可能にする**: 大会・選手・STリーグ・高校・チームへの導線は `<div onClick={() => (window.location.href = ...)}>` だったためクローラがたどれなかった。`next/link` の `<Link>` に置き換え、ハブページとして内部リンクを流す
  - チームカードは外部「公式サイト」リンクを内包するため、`<a>` の入れ子を避けるストレッチドリンク方式（カード `relative` + 内部 `Link` に `after:absolute after:inset-0` + 外部 `<a>` を `relative` で前面）にする
- **見出し階層**: `h1`（1個）→ セクション `h2` → カード `h3` に統一する。以前はカード内に `h2` が混在していた
- **title / description**: ブランド名「Softeni Pick」と主要キーワード（ソフトテニス / 大会結果 / 選手成績 / 全国大会 / 全日本選手権 / インターハイ）を含めて一意化する
- **構造化データ（JSON-LD）**: `Organization` / `WebSite` / `BreadcrumbList` / `ItemList`（最近追加された大会）を出力する。`WebPage` の `dateModified: new Date()`（ビルド日）は規約どおり撤去した（ビルド日は使わない）

### canonical / OGP / サイト名

`siteConfig.baseUrl`, `siteConfig.siteName`, `siteConfig.ogImage` を通して切り替える実装です。

確認根拠:

- `lib/siteConfig.ts`
- `src/components/MetaHead.tsx`

### 選手ページ（→ players-pages.md に分割）

選手 URL の 2 系統（`/players/{slug}` プロフィール系 と `/players/{id}/results` 結果ページ系）・
選手一覧ページ・選手ページの SEO 方針・選手結果ページの noindex 選別は、
[players-pages.md](./players-pages.md) に集約した。

### 試合詳細ページの SEO 方針（2026-06 改善）

対象は `src/pages/beta/matches-results/[matchId]/index.tsx`（実装本体）と、掲載大会配下のネスト URL（`/tournaments/.../matches/[matchId]`）。両者は同じ `PublicMatchDetailPage` を共有するため SEO も共通。

メタ:

- title / description は試合ごとに一意化する。`{チームA} vs {チームB}｜{大会名}{ラウンド} 試合詳細・スコア` を基本形とし、description にはゲームカウント・勝者・総ポイント数・分析観点を埋め込む
- canonical は `getPublicMatchDetailPath(match)` に末尾スラッシュを付けた実 URL（`trailingSlash: true` に一致）。siteLink 有無で本ネスト URL か一覧配下 URL かが切り替わる

構造化データ（JSON-LD、別 `<Head>` で出力）:

- `SportsEvent`：`sport: ソフトテニス` / `competitor`（両チーム）/ `startDate`（`match_date` 優先、なければ `created_at`。ビルド日は使わない）/ `superEvent`（掲載大会ページがある場合の大会）/ `location`（`court_name` がある場合）
- `BreadcrumbList`：ホーム → 試合一覧 → （大会）→ 試合

可視パンくず:

- `src/components/Breadcrumb.tsx` を使い、JSON-LD の `BreadcrumbList` と同じ階層・順序で画面上にも表示する（このページは `PageLayout` 対象外のため個別に配置）。大会階層は掲載大会ページがある場合のみ挿入する

sitemap:

- `next-sitemap.config.js` で選手結果ページに最新出場大会日、大会結果ページに開催日を `lastmod` として出力する

### SportsEvent 構造化データの推奨項目（2026-06 追加）

GSC「イベント」拡張レポートで `SportsEvent` の推奨項目不足の警告（`eventStatus` / `image` / `endDate` / `location.address` / `organizer.url` / `performer` / `offers` など）が出ていた。必須項目（`name` / `startDate` / `location`）は充足しておりリッチリザルト自体はブロックされない警告だが、データと矛盾しない範囲で補う。

- 共通ヘルパー `lib/sportsEventJsonLd.ts` に集約し、4 箇所（大会年度別結果ページ、大会ハブの歴代優勝者 ItemList、試合詳細ページ、ST リーグ試合ページ）で利用する。
- 常に付与: `eventStatus = EventScheduled` / `eventAttendanceMode = OfflineEventAttendanceMode` / `image`（`siteConfig.ogImage`）。
- `endDate` は無ければ `startDate` で補完（`resolveEventDates`）。
- `location` は常に出力し、`PostalAddress`（最低限 `addressCountry: 'JP'`、都道府県等が分かれば `addressRegion`）を含める（`buildEventPlace`）。
- `organizer` は `url` 付き（`buildEventOrganizer`、既定 Softeni Pick。ST リーグは日本ソフトテニス連盟）。
- `performer`: 出演者が一意に定まるページのみ付与する。試合詳細＝対戦両チーム、歴代優勝者＝優勝者。年度別結果ページは出演者が一意でないため付与せず、`performer` の警告は許容する。
- `offers` は付与しない。無料の結果ページにチケット販売情報を付けるのは実態とずれ、虚偽の構造化データは手動対策リスクがあるため。`offers` の警告は許容する。

### llms.txt（2026-06 追加）

LLM / AI クローラ向けにサイト概要と主要 URL を案内する `public/llms.txt` を配置している（[llmstxt.org](https://llmstxt.org) 準拠）。`public/` 配下のため `https://softeni-pick.com/llms.txt` として静的配信される。

- 構成: H1（サイト名）+ ブロッククォート（要約）+ 概要段落 + H2 リンクリスト（主要ページ / 試合結果・分析 / データ構造 / サイト情報 / Optional）
- 掲載 URL は公開導線のみ。`robots.txt` で Disallow している `/api/`・`/beta/`・`/test-db` や記録管理導線は含めない
- 公開ページ追加・主要 URL 変更時は `public/llms.txt` も更新対象とする
- 実装: `public/llms.txt`

確認根拠:

- `public/llms.txt`
- `public/robots.txt`

### 共通ページレイアウト

公開ページ（`/beta/**` を除く）は `src/components/PageLayout.tsx` で統一しています。

- 外側ラッパー: 背景色・余白（`py-10 px-4`）を統一
- 内側コンテナ: `maxWidth` prop（`3xl`〜`6xl`、デフォルト `3xl`）で各ページの幅を指定
- `<main>` は `_app.tsx` 側でラップされるため、ページ側では使用しない（入れ子 `<main>` 解消済み）
- `/beta/**` は対象外（開発中のため）

確認根拠:

- `src/components/PageLayout.tsx`
- `src/pages/_app.tsx`

### ナビゲーション再設計方針（2026-06-22 決定 / 実装前）

Draft（方針確定・実装前）。回遊（大会 ↔ 選手 ↔ 年度 ↔ チーム）を深めるため、
現行の横並びヘッダー1本から左サイドバー型2ペインへ刷新する方針を採用。
親仕様: `docs/raw/2026-06-22-nav-two-pane-design.md`、決定記録: ADR-006。

確定方針:

- `softeni-pick` mode: PC は左サイドバー＋右コンテンツの2ペイン。サイドバーは
  折りたたみ可能（ピン留め・状態保持）。モバイルはハンバーガーでドロワー化。
- `score` mode: サイドバーは出さず**上部バーのみ**（現行の試合一覧/成長分析を維持）。
  分岐は `isScoreSiteMode()` を踏襲。
- グローバル区分（サイドバー第1階層）は「セクション入口」に限定し、末端ページ
  （学校ページ等）への重複リンクは張らない。
- コンテキスト第2階層は**本文上部のサブナビ**に置く（サイドバー内ではない）。
- コンテンツ最大幅は現状最大（`max-w-6xl`）まで取れるシェルとし、サイドバーが
  コンテンツを狭めない。各ページの `maxWidth` 指定は維持。
- 年度の前後ナビは全エンティティ共通の汎用コンポ（`YearPagerNav`・仮）に集約。
- 既存 SEO 内部導線（都道府県一覧→都道府県→学校、男女セグメント型切替
  `HighschoolGenderToggle`、都道府県ページの直近3年表示など）は作り直さず再利用し、
  重複リンク・パターン二重化・絞り込み意図の上書きを避ける。

実装前の残課題は親仕様の「残課題」を参照。

## 現時点での論点

### URL

- `score` 側は `/matches*` を正規公開 URL にする設計
- `softeni-pick` 側には従来の `/beta/matches-results*` が残る

### OGP / site name

- `score` mode の既定 site name は `Softeni Pick Score`
- OGP 画像 URL もモードで切り替わる

### ヘッダー/フッター切替

Assumption:

- モードによって導線の見せ方を切り替える意図は強い
- ただし、今回確認した範囲では専用ヘッダー/フッターを完全分離する設計文書までは未確認

更新（2026-06-22）: ナビ再設計で `softeni-pick`=2ペイン、`score`=上部バーのみと
方針確定（上記「ナビゲーション再設計方針」/ ADR-006）。現行 `Header.tsx` の
`isScoreSiteMode()` 分岐を踏襲する。

## Draft

- `score.softeni-pick.com` を本体サイトから情報設計レベルでどこまで切り離すか
- score 側専用のブランド/ナビゲーション設計

## Deprecated

- Host 判定や referer 判定でモードを切り替える方針
  現行実装は `siteConfig.mode` を基準にしています

## Open Questions

- 本番で 2 ドメインをどうデプロイ/管理しているか
- `score` 側のヘッダー/フッター差し替え方針
- OGP 文言・サイト名の正式運用ルール
- 高校カテゴリの注目校表示ロジックを将来的に手動編集可能にするか
