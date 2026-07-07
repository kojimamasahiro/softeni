# 01-inventory.md — 現状調査(インベントリ)

- ステータス: approved(D-005, 2026-07-04)
- 作成日: 2026-07-04
- フェーズ: Phase 1
- 記載ルール: **事実のみを記載する。評価・改善案は含めない**(rules.md R10)
- 記載テンプレート: D-003 で合意した7列(URL / ページ名 / 目的 / 主要データ種別 / ナビからの到達経路 / 主要UI要素・表示パターン / 備考)

## 1. 調査方法・情報源

- 情報源: softeni-pick リポジトリのソースコード(D-004)
- 調査対象: `src/pages/` 配下の全ルート、`src/components/` 配下の全コンポーネント、`lib/navigation.ts`、`data/` 配下、`public/robots.txt`、`redirects-map.json`、`docs/wiki/` の既存仕様書
- 調査日: 2026-07-04

## 2. サイト全体の前提(事実)

- フレームワーク: Next.js(Pages Router)。本番は `output: 'export'` による静的エクスポート、Cloudflare Pages で配信(`wrangler.toml`)
- URL 規則: `trailingSlash: true`(全 URL 末尾スラッシュ)
- **サイトモードが2つある**: 同一リポジトリを環境変数 `NEXT_PUBLIC_SITE_MODE` で切り替えて2ドメイン運用
  - `softeni-pick` モード → `https://softeni-pick.com`(本体サイト)
  - `score` モード → `https://score.softeni-pick.com`(スコア・試合記録サイト)
- robots.txt: `/api/`・`/beta/`・`/test-db` を Disallow(※ `/test-db` ページは現在ソースに存在しない)
- 旧 URL からのリダイレクト定義: `redirects-map.json`(旧 `/tournaments/east/2024` 等 → 新 6階層 URL)
- 計測: Google Analytics(Cookie 同意バナー `CookieConsent` 経由の Consent Mode)
- LLM クローラ向け案内: `public/llms.txt`
- サイトマップ: `next-sitemap` で生成。選手結果・大会結果ページに実データ由来の lastmod を出力

## 3. ページ一覧(softeni-pick モード・公開ページ)

### 3.1 トップ・静的情報ページ

| URL | ページ名 | 目的 | 主要データ種別 | ナビからの到達経路 | 主要UI要素・表示パターン | 備考 |
|-----|---------|------|--------------|------------------|------------------------|------|
| `/` | トップ | サイト入口。主要セクションへの導線提供 | 最近追加された大会、主要導線 | ロゴクリック | PageLayout, Breadcrumb, セクション見出し+カードリンク | h1→h2→h3 統一、JSON-LD(Organization/WebSite/ItemList)。2026-06 に SSG 本文出力へ改善済み |
| `/about` | このサイトについて | サイト説明 | 静的テキスト | フッター | PageLayout, Breadcrumb, 本文 | |
| `/privacy` | プライバシーポリシー | ポリシー掲示 | 静的テキスト | フッター | PageLayout, Breadcrumb, 本文 | |
| `/contact` | お問い合わせ | 問い合わせ導線 | 静的テキスト | フッター | PageLayout, Breadcrumb, 本文 | |
| `/faq` | よくあるご質問 | FAQ 掲示 | 静的テキスト | フッター | PageLayout, Breadcrumb, 本文 | |

### 3.2 大会(tournaments)

| URL | ページ名 | 目的 | 主要データ種別 | ナビからの到達経路 | 主要UI要素・表示パターン | 備考 |
|-----|---------|------|--------------|------------------|------------------------|------|
| `/tournaments` | 大会一覧 | 全世代の大会を検索・一覧 | 大会(index.json) | サイドナビ「成績・記録を調べる > 大会」 | PageLayout, Breadcrumb, TournamentSearchTable(検索付きテーブル)、モバイルはカード表示(開催予定/外部掲載ラベル) | 世代別(国際/総合/大学/高校/ジュニア/シニア/実業団)を内包する総合入口 |
| `/tournaments/major` | 主要大会一覧 | 主要大会の一覧 | 大会 | (要確認: ナビ直リンクなし) | PageLayout, Breadcrumb, TournamentCard | |
| `/tournaments/local` | 地域大会一覧 | 都道府県連盟別の大会入口 | 連盟(federations.json)、地域大会(local_index.json) | (要確認: ナビ直リンクなし) | PageLayout, Breadcrumb, リンクリスト | 詳細仕様: docs/wiki/tournaments-local.md |
| `/tournaments/local/[federationId]` | 連盟別大会一覧 | 1連盟の大会結果一覧 | 地域大会 | 地域大会一覧から | PageLayout, Breadcrumb, TournamentCard | |
| `/tournaments/[generation]/[tournamentId]` | 大会ハブ | 1大会の歴代結果まとめ(年度なし URL) | 大会情報、年度別詳細、歴代優勝者 | 大会一覧カード、年度別結果ページのパンくず、トップの「最近追加された大会」 | PageLayout, Breadcrumb, TournamentContextBlocks, 年度×種別チップ、歴代優勝者表 | 高校全国大会 ID のハブは noindex(検索面を /highschool/tournaments へ集中)。JSON-LD: CollectionPage/ItemList |
| `/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]` | 大会年度別結果 | 1大会・1年度・1種別の結果、トーナメント表 | 試合結果、トーナメント表、出場チーム | 大会ハブのチップ | PageLayout, Breadcrumb, TournamentBracket, MatchResults, TeamResults, ResultContextBlocks, TournamentContextBlocks | URL は6階層(世代/大会/年度/種目/年齢区分/性別)。JSON-LD: SportsEvent |
| `/tournaments/[generation]/[tournamentId]/[year]/.../matches/[matchId]` | 大会配下 試合詳細 | 掲載大会に紐づく1試合の詳細 | 試合、ゲーム、ポイント | 大会年度別結果ページから | `/beta/matches-results/[matchId]` と同一実装(PublicMatchDetailPage 共有)。PageLayout 非使用、個別 Breadcrumb | canonical は siteLink 有無で切替。JSON-LD: SportsEvent/BreadcrumbList |

### 3.3 選手・ランキング

| URL | ページ名 | 目的 | 主要データ種別 | ナビからの到達経路 | 主要UI要素・表示パターン | 備考 |
|-----|---------|------|--------------|------------------|------------------------|------|
| `/players` | 選手一覧 | 選手検索の入口 | 選手インデックス(index.json / players-search.json 約8,174組) | サイドナビ「成績・記録を調べる > 選手」 | PageLayout, Breadcrumb, 検索ボックス+結果リスト。クエリ無し時は min20(73組)を SSR 表示 | 検索はクライアント JS。count>=5 のみ結果ページへリンク |
| `/players/[slug]` | 選手プロフィール | curated 選手(約23名)の手動整備プロフィール | プロフィール、通算成績、career-record、milestone | 大会ハブの curated 優勝者リンク等 | PageLayout, Breadcrumb, PlayerCareerHighlights | 識別子は **slug**(文字列)。実装ファイルは `players/[id]/index.tsx` だが中身は slug。URL 2系統は当面統合しない(2026-06 決定) |
| `/players/[id]/results` | 選手結果 | 収録試合の結果一覧(掲載選手全体) | 試合結果、対戦相手、ペア、年度別ランキング推移 | 学校ページ・高校歴代・チーム年度・news 等の選手名リンク | PageLayout, Breadcrumb, PlayerResults, PlayerSummaryStats, PlayerStatisticsSections, MajorTitles | 識別子は **数値 id**。count>=5 のみ実在。noindex 選別あり(players-pages.md) |
| `/rankings` | 選手ランキング | 年度別・種目別・男女別ランキングを1ページに集約 | ランキング JSON(2019〜2026、年度×種目×性別) | サイドナビ「成績・記録を調べる > ランキング」、トップのカード、/players 上部リンク | PageLayout, Breadcrumb, 年度/種目/男女のクライアント切替タブ、上位100位表、静的「年度別上位まとめ」 | 2026-07 追加。JSON-LD: ItemList |

### 3.4 高校(特集)

| URL | ページ名 | 目的 | 主要データ種別 | ナビからの到達経路 | 主要UI要素・表示パターン | 備考 |
|-----|---------|------|--------------|------------------|------------------------|------|
| `/highschool` | 高校トップ | 男女別ページへの振り分け | — | (直接到達なし) | PageLayout | `/highschool/boys` へ誘導(ナビは boys を直接指す) |
| `/highschool/[gender]` | 高校男子/女子 | 都道府県別の全国大会成績一覧 | 高校チーム、都道府県 | サイドナビ「特集 > 高校」 | PageLayout, Breadcrumb, HighschoolGenderToggle, 都道府県一覧 | gender = boys / girls |
| `/highschool/[gender]/[prefectureId]` | 都道府県別高校 | 1都道府県の学校・成績一覧 | 高校チーム、大会成績 | 高校男女ページから | PageLayout, Breadcrumb, HighschoolGenderToggle, 直近3年表示 | |
| `/highschool/[gender]/[prefectureId]/[teamId]` | 学校ページ | 1校の全国大会成績・メンバー | チーム、選手、大会成績 | 都道府県ページから | PageLayout, Breadcrumb, 成績表 | mixed の結果は boys/girls 両方に表示 |
| `/highschool/tournaments` | 高校全国大会 歴代記録 入口 | 全国大会の歴代記録への入口 | 大会 | (要確認: ナビ直リンクなし) | PageLayout, Breadcrumb, リンクリスト | |
| `/highschool/tournaments/[tournament]` | 大会別歴代記録 | 1大会の歴代優勝校・結果一覧 | 歴代優勝、次回開催 | 入口ページ、大会ハブの誘導バナー | PageLayout, Breadcrumb, 歴代記録表 | tournament = championship / japan-cup |

### 3.5 STリーグ(特集)

| URL | ページ名 | 目的 | 主要データ種別 | ナビからの到達経路 | 主要UI要素・表示パターン | 備考 |
|-----|---------|------|--------------|------------------|------------------------|------|
| `/st-league` | STリーグ トップ | STリーグ特集の入口 | エディション(editions.json) | サイドナビ「特集 > STリーグ」 | PageLayout, Breadcrumb | |
| `/st-league/about` | STリーグとは | リーグ説明 | 静的テキスト | STリーグトップから | PageLayout, Breadcrumb | |
| `/st-league/teams` | 掲載チーム一覧 | 実業団チーム一覧 | チーム | STリーグトップから | PageLayout, Breadcrumb | /teams 一覧ページが無いための代替入口(navigation.ts コメント) |
| `/st-league/champions` | 歴代優勝 | 歴代優勝チームの一覧 | 歴代優勝 | STリーグトップから | PageLayout, Breadcrumb | |
| `/st-league/[year]` | 年度別トップ | 1年度のリーグ概要 | 年度別リーグ戦績 | STリーグトップから | PageLayout, Breadcrumb | year = 2023〜2025 |
| `/st-league/[year]/teams` | 年度別チーム | 1年度の出場チーム・順位 | チーム、順位 | 年度別トップから | PageLayout, Breadcrumb, TeamsRanking, TeamsYearlySummary | |
| `/st-league/[year]/matches` | 年度別試合一覧 | 1年度の試合一覧 | 試合 | 年度別トップから | PageLayout, Breadcrumb | 入替戦の目安表示あり |
| `/st-league/[year]/matches/[matchId]` | STリーグ試合詳細 | 1試合の詳細 | 試合 | 年度別試合一覧から | PageLayout, Breadcrumb | JSON-LD: SportsEvent(organizer=日本ソフトテニス連盟) |
| `/st-league/[year]/analysis` | 年度別分析 | 1年度の分析 | 試合・戦績集計 | 年度別トップから | PageLayout, Breadcrumb | |

- ファイル配置の事実: `src/pages/st-league/` 直下に設計メモ `st_league_page_structure.md` がページファイルと同居している(ルーティング対象外)

### 3.6 チーム

| URL | ページ名 | 目的 | 主要データ種別 | ナビからの到達経路 | 主要UI要素・表示パターン | 備考 |
|-----|---------|------|--------------|------------------|------------------------|------|
| `/teams/[teamId]` | チームページ | 1チームの年度サマリ | STリーグチーム集計 | STリーグ関連ページから | PageLayout, Breadcrumb | **一覧ページ(/teams)は存在しない**(404)。そのためグローバルナビに「チーム」項目なし |
| `/teams/[teamId]/[year]/[gender]` | チーム年度別 | 1チーム・1年度・男女別の成績 | 大会別成績、選手 | チームページから | PageLayout, Breadcrumb, TeamsEventSummary, TeamsRanking, TeamsYearlySummary | |

### 3.7 ニュース・成長記録

| URL | ページ名 | 目的 | 主要データ種別 | ナビからの到達経路 | 主要UI要素・表示パターン | 備考 |
|-----|---------|------|--------------|------------------|------------------------|------|
| `/news` | ニュース一覧 | 大会**展望(preview)専用**の記事一覧 | ニュース記事 JSON(published & preview のみ) | サイドナビ「読みもの・記録 > ニュース」 | PageLayout, Breadcrumb, 記事リスト | 結果記事は廃止済み(ADR-010)。結果系は大会ハブ/高校歴代へ集約 |
| `/news/[articleId]` | ニュース記事 | 1記事(大会展望) | 記事本文、前回王者、出場校 | ニュース一覧から | PageLayout, Breadcrumb, 本文+コンテキストブロック | 詳細: docs/wiki/news-context-blocks.md |
| `/growth` | 成長記録ハブ | 運営キュレーションの成長記録一覧 | growth-featured.json | サイドナビ「読みもの・記録 > 成長記録」 | 記事カード一覧 | **PageLayout 非使用**。公開・インデックス対象 |
| `/growth/[slug]` | 成長記録詳細 | 1選手の成長記録ショーケース | 成長分析データ | 成長記録ハブから | GrowthReportView | **PageLayout 非使用**。featured のみ公開(ADR-004) |

## 4. ページ一覧(score モード)

score モード時のみ有効(softeni-pick モードでは notFound)。実装は beta 側ページを re-export。

| URL | ページ名 | 目的 | 主要データ種別 | ナビからの到達経路 | 主要UI要素・表示パターン | 備考 |
|-----|---------|------|--------------|------------------|------------------------|------|
| `/matches` | 試合一覧 | 記録済み試合の一覧 | 試合(Supabase 由来) | 上部バー「試合一覧」 | PublicMatchesListPage(beta/matches-results と同一実装) | score モードの正規公開 URL |
| `/matches/[matchId]` | 試合詳細 | 1試合の詳細・スコア・分析 | 試合、ゲーム、ポイント、動画区間 | 試合一覧から | PublicMatchDetailPage、YouTubeRangePlayer | |
| `/matches/growth` | 成長分析 | 対象選手の成長分析 | 試合集計 | 上部バー「成長分析」 | PublicGrowthAnalysisPage(GrowthReportView) | |

## 5. ページ一覧(ベータ・開発面 `/beta/**`)

robots Disallow・noindex。公開ナビには DEV モード時のみ「[DEV] ポイント記録」を表示。

| URL | ページ名 | 目的 | 主要データ種別 | ナビからの到達経路 | 主要UI要素・表示パターン | 備考 |
|-----|---------|------|--------------|------------------|------------------------|------|
| `/beta` | ベータ機能一覧 | ベータ機能の入口 | 機能定義(コード内配列) | (直接到達) | Breadcrumb, 機能カード(試作中/検証中/改善中バッジ) | PageLayout 非使用 |
| `/beta/matches-results` | 試合結果一覧 | 公開試合の一覧(本体モードでの実体) | 試合 | ベータ一覧から | 一覧テーブル/カード | score モード `/matches` の実装本体 |
| `/beta/matches-results/[matchId]` | 試合詳細 | 1試合の詳細・スコア・分析 | 試合、ゲーム、ポイント | 試合一覧から | YouTubeRangePlayer, Breadcrumb | 大会配下ネスト URL と実装共有 |
| `/beta/matches-results/growth` | 最近の成長 | 内部ツール面の成長分析 | 試合集計(targets.json) | ベータ一覧から | GrowthReportView | noindex。公開面は /growth |
| `/beta/matches` | ポイント記録 一覧 | 記録ツールの試合一覧 | 試合(Supabase) | サイドナビ「開発 > [DEV] ポイント記録」(DEV 時のみ) | 一覧+操作 | 記録・管理ツール |
| `/beta/matches/create` | 試合作成 | 記録対象試合の新規作成 | 試合 | ポイント記録一覧から | フォーム | |
| `/beta/matches/[matchId]` | ポイント記録 | 1試合のポイント記録(YouTube 連携) | ポイント、動画 | ポイント記録一覧から | YouTube プレイヤー+記録 UI | |
| `/beta/matches/[matchId]/input` | ポイント編集 | ポイント単位の編集 | ポイント | 記録画面から | フォーム | |
| `/beta/matches/[matchId]/video-review` | 動画レビュー | 動画区間の切り出し・確認 | 動画セッション、候補区間 | 記録画面から | YouTube プレイヤー+区間操作 UI | |

## 6. API ルート(`/api/**`、開発時のみ。本番静的エクスポートには含まれない)

| URL | 用途 |
|-----|------|
| `/api/matches`, `/api/matches/[matchId]` | 試合 CRUD |
| `/api/matches/[matchId]/games`, `.../games/[gameId]` | ゲーム CRUD |
| `/api/matches/[matchId]/points` | ポイント記録 |
| `/api/matches/[matchId]/video-sessions/**` | 動画レビューセッション(作成・区間・候補・確定) |
| `/api/tournament-entries` | 大会エントリー |

## 7. ナビゲーション構造(事実)

### 7.1 共通シェル

- `_app.tsx` → `AppShell`(+`Footer`)+ `CookieConsent`
- softeni-pick モード: **左サイドバー(280px・折りたたみ可・状態を localStorage 保持)+上部固定ヘッダー(64px)の2ペイン**。モバイルはハンバーガー→ドロワー(ADR-006)
- score モード: サイドバーなし、**上部バーのみ**(試合一覧/成長分析)
- `src/components/Header.tsx` は現在 **どこからも import されていない**(旧・横並びヘッダーの残存ファイル)

### 7.2 サイドバーのグループ構成(`lib/navigation.ts`・単一ソース)

| グループ | 項目 | リンク先 |
|---------|------|---------|
| 成績・記録を調べる | 大会 / 選手 / ランキング | /tournaments, /players, /rankings |
| 特集 | 高校 / STリーグ | /highschool/boys, /st-league |
| 読みもの・記録 | ニュース / 成長記録 | /news, /growth |
| 開発(DEV時のみ) | [DEV] ポイント記録 | /beta/matches |

- active 判定は matchPrefix の前方一致(`/` のみ完全一致)
- 「チーム」項目はなし(一覧ページ不在のため。navigation.ts コメントに明記)

### 7.3 フッター(`Footer.tsx`)

- softeni-pick モード: このサイトについて / プライバシーポリシー / お問い合わせ / よくあるご質問
- score モード: 試合一覧 / Softeni Pick(本体への外部リンク)

### 7.4 パンくず

- `src/components/Breadcrumb.tsx`。大半の公開ページで使用(JSON-LD BreadcrumbList と同一階層で可視表示)
- 未使用ページ: `/growth`・`/growth/[slug]`・`/matches/**`(score)・`/highschool`(トップ)

## 8. 使用中の UI 要素・表示パターン(`src/components/`)

### 8.1 レイアウト・共通

| コンポーネント | 責務 | 使用範囲 |
|---------------|------|---------|
| AppShell | 2ペインシェル(サイドバー+ヘッダー+ドロワー) | 全ページ(_app) |
| PageLayout | 背景・余白・最大幅(3xl〜6xl, 既定3xl)の統一ラッパー | 公開ページ 34 ファイル。**非使用**: /growth 系, /matches 系(score), /beta 系, 大会配下試合詳細 |
| MetaHead | title/description/canonical/OGP | ほぼ全ページ |
| Breadcrumb | パンくず(可視+構造化データと対) | 7.4 のとおり |
| Footer | フッター(モード分岐) | 全ページ |
| SideNav / YearPagerNav | サイドバー本体 / 年度前後ナビ(汎用) | AppShell / 年度系ページ |
| ScrollToTop | ページ上部へ戻る | AppShell |
| CookieConsent | Cookie 同意バナー | 全ページ |

### 8.2 データ表示

| コンポーネント | 責務 | 主な使用ページ |
|---------------|------|--------------|
| Tournament/TournamentBracket | トーナメント表 | 大会年度別結果 |
| Tournament/MatchResults / TeamResults / Statistics | 試合結果表 / チーム成績 / 統計 | 大会年度別結果 |
| tournaments/TournamentSearchTable | 検索付き大会テーブル(モバイルはカード) | /tournaments |
| tournaments/TournamentCard | 大会カード | /tournaments/major, /tournaments/local/[federationId] |
| ResultsTable / DrawTable / EntryOverview | 結果表 / 組み合わせ表 / エントリー概要 | 大会系 |
| PlayerResults / PlayerSummaryStats / PlayerStatisticsSections / PlayerCareerHighlights / MajorTitles | 選手結果一覧 / サマリ統計 / 統計セクション / キャリアハイライト / 主要タイトル | 選手系 |
| PlayerLiteLink | 選手名リンク(結果ページ有無で出し分け) | 各所 |
| TeamsRanking / TeamsYearlySummary / TeamsEventSummary | チーム順位 / 年度サマリ / 大会別サマリ | STリーグ・チーム系 |
| TournamentContextBlocks / ResultContextBlocks | 大会・結果の文脈説明ブロック | 大会ハブ・年度別結果 |
| growth/GrowthReportView | 成長分析レポート | /growth/[slug], growth 系 |
| highschool/HighschoolGenderToggle | 男女セグメント切替 | 高校系 |
| YouTubeRangePlayer | YouTube 区間再生 | 試合詳細 |
| MajorTitles / ServeSelection / AffiliateLink | 主要タイトル / サーブ選択 UI / アフィリエイト(現在 _app でコメントアウト) | 個別 |

### 8.3 表示パターン(観察された事実)

- 一覧表現が3系統ある: テーブル(TournamentSearchTable, ResultsTable)/ カード(TournamentCard, トップ・ベータのカード)/ リンクリスト(地域大会、歴代記録入口)
- 切替 UI が2系統ある: セグメント型(HighschoolGenderToggle)/ タブ型クライアント切替(/rankings の年度・種目・男女)
- スタイリング: Tailwind CSS(ユーティリティ直書き)。ダークモード対応クラス(`dark:`)は Footer・Header 等一部のみに存在 — **Deprecated(2026-07-07)**: M5-3(D-023)実施時の再調査で、実際には66ファイル・約1,437箇所と広範囲に存在することが判明。本記載は当時の観察不足によるもの。現状は 06-design-principles.md §3・decisions.md D-023 を参照

## 9. データ種別(`data/` 配下・事実)

| データ種別 | 置き場所 | 内容 |
|-----------|---------|------|
| 大会 | data/tournaments/(index.json, local_index.json, details/, information/, federations.json, genarations.json, team-name-aliases.json) | 大会インデックス、年度別詳細、開催情報、連盟、世代 |
| 選手 | data/players/(index.json, {slug}/, homonyms.json, _facts, _index) | 数値 id 全選手インデックス(約8,174組)+ curated 選手(約23名)の slug ディレクトリ |
| ランキング | data/rankings/{year}-{discipline}-{gender}.json | 2019〜2026、種目×性別 |
| 高校 | data/highschool/(prefectures/, teams.json, prefecture-summary.json) | 都道府県・学校・成績 |
| STリーグ | data/st-league/(editions.json, 2023/, 2024/, 2025/) | 年度別リーグデータ |
| チーム | data/teams/ | チーム情報 |
| ニュース | data/news/*.json | 記事(state: published, type: preview のみ公開) |
| 成長記録 | data/growth-featured.json, growth-exclusions.json | 公開対象のキュレーション |
| 都道府県 | data/prefectures.json | マスタ |
| 試合記録(スコア) | Supabase(lib/supabase.ts 経由) | beta/score 系の試合・ゲーム・ポイント・動画セッション |

- ファイル名の事実: `genarations.json` は "generations" のスペルと異なる綴りで存在する

## 10. 識別子・URL の事実(横断)

- 選手 URL は**2系統**: `/players/{slug}`(curated・文字列 slug)と `/players/{id}/results`(全体・数値 id)。統合しない方針が決定済み(2026-06)
- 大会年度別 URL は6階層: `[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]`
- 同一実装が複数 URL で配信されるページがある:
  - 試合詳細: `/beta/matches-results/[matchId]` と `/tournaments/.../matches/[matchId]`(+score `/matches/[matchId]`)
  - 試合一覧: `/beta/matches-results` と score `/matches`
  - 成長分析: `/beta/matches-results/growth` と score `/matches/growth`
- 高校の gender と大会 URL の gender は同じ boys/girls 表記。mixed は大会 URL のみに存在

## 11. 未調査項目(→ project-status.md 未決事項へ登録)

| # | 項目 | 理由 |
|---|------|------|
| 1 | `/tournaments/major`・`/tournaments/local`・`/highschool/tournaments` へのナビ導線の実配置(ページ内リンクの網羅確認) | ソースの静的調査ではページ本文内リンクを全数追跡していない |
| 2 | 各ページの実表示(スクリーンショットベースの表示パターン確認) | 本調査はコードベースのみ(D-004)。実レンダリングは未確認 |
| 3 | `adinsight-site/` ディレクトリの位置づけ | 本体サイトとの関係が本調査スコープ外 |
| 4 | Supabase 側のスキーマ詳細 | docs/wiki/database.md はあるが実データベースは未参照 |
