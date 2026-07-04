# 07-components.md — コンポーネント体系

- ステータス: approved(D-010, 2026-07-04)
- 作成日: 2026-07-04
- フェーズ: Phase 7
- 入力: 05-page-structure.md, 06-design-principles.md(いずれも in-review・D-009)、01-inventory.md(approved)。対応課題: I-14、I-15、I-18
- 用語は glossary.md に従う

## 1. 分類体系

コンポーネントを4分類する。命名は PascalCase、分類はディレクトリで表す。

| 分類 | ディレクトリ | 責務 | 例 |
|------|-------------|------|-----|
| 基礎(base) | `components/base/` | 見た目の最小単位。ドメイン知識を持たない | Card, Badge, Chip, SegmentedControl, Tabs |
| ナビゲーション(nav) | `components/nav/` | 場所の把握と移動 | AppShell, SideNav, Breadcrumb, SubNav, YearPagerNav |
| データ表示(data) | `components/data/` | エンティティの表示。ドメイン知識を持つ | PlayerLink, TeamLink, ResultsTable, TournamentBracket, RankBadge |
| 複合(feature) | `components/feature/` | 特定ページ群専用の組み立て | TournamentSearchTable, GrowthReportView, PlayerStatisticsSections |

- 依存方向: feature → data → base(逆依存禁止)。nav は base のみに依存可
- 色・サイズは 06 のトークンのみ使用(P4)

## 2. 既存コンポーネントの統廃合方針

| 現行 | 措置 | 移行先分類 | 備考 |
|------|------|-----------|------|
| AppShell, SideNav, YearPagerNav, Breadcrumb, ScrollToTop | 維持 | nav | |
| Header.tsx | **削除** | — | 未使用(I-07) |
| PageLayout, MetaHead, CookieConsent, Footer | 維持 | base(PageLayout)/ site 共通 | PageLayout は全公開ページ適用(I-13) |
| TournamentBracket, MatchResults, TeamResults, Statistics(Tournament/) | 維持 | data | |
| ResultsTable, DrawTable, EntryOverview | 維持 | data | |
| TournamentSearchTable, TournamentCard | 維持 | feature / data | カードとテーブルの使い分けは 05 §6 に従う |
| PlayerResults, PlayerSummaryStats, PlayerStatisticsSections, PlayerCareerHighlights, MajorTitles | 維持 | feature | 選手結果ページ専用群 |
| PlayerLiteLink | **改名 → PlayerLink** | data | 出し分けルールを本書 §4 に固定(I-18) |
| TeamsRanking, TeamsYearlySummary, TeamsEventSummary | 維持 | feature | STリーグ・チーム系 |
| TournamentContextBlocks, ResultContextBlocks | 維持 | feature | |
| HighschoolGenderToggle | **一般化 → SegmentedControl(base)+ラッパー** | base + feature | 切替 UI の統一(§3) |
| GrowthReportView, YouTubeRangePlayer, ServeSelection | 維持 | feature | |
| AffiliateLink | **削除** | — | D-013。コメントアウト中の死にコードを M1 で削除 |
| EntryOverview, MajorTitles 等の重複疑い | 統合しない | — | 責務が異なることをインベントリで確認済み |
| **新規: TeamLink** | 新設 | data | チーム名リンクの出し分け(§4)。/teams 一覧新設(C-2)に伴い必要 |
| **新規: SubNav** | 新設 | nav | 本文上部サブナビ(05 §3 T2/T3)。セグメント型リンク |
| **新規: StatusBadge** | 新設 | base | 開催予定/外部掲載/優勝などの状態表示を統一(P2) |

## 3. 切替 UI の使い分け(I-15 の解決)

| UI | 使う場面 | URL | 実装 |
|----|---------|-----|------|
| SegmentedControl(リンク型) | **URL が変わる**切替(男女、すべて/主要/地域) | 変わる(`<Link>`) | base/SegmentedControl |
| Tabs(状態型) | **同一ページ内**のデータ切替(ランキングの年度・種目) | 変わらない | base/Tabs |

- 判断基準: 「その状態を URL として共有・ブックマークできるべきか」。Yes → SegmentedControl、No → Tabs
- ランキングのように SEO 上クロール可能な静的まとめを併設する場合の規則は現行 /rankings 方式を標準とする

## 4. エンティティリンクの出し分けルール(I-18 の解決)

| コンポーネント | ルール |
|---------------|--------|
| PlayerLink | (1) 選手プロフィール(curated)が解決できる → `/players/[slug]`、(2) 結果ページが実在(count>=5)→ `/players/[id]/results`、(3) いずれもなし → 名前のみ表示(デッドリンク禁止)。優先順位は文脈による: 成績文脈では (2) を優先(players-pages.md の現行原則を追認) |
| TeamLink | (1) チームページ(STリーグ集計あり)→ `/teams/[teamId]`、(2) 高校チーム → 学校ページ、(3) いずれもなし → 名前のみ。高校チームとチームマスタの id 未統合(O-007)のため、当面は文脈(高校特集内か否か)で分岐 |

- このルールは実装内コメントではなく本書を正とし、変更時は本書を改訂する

## 5. ページタイプ × コンポーネント対応表

| ページタイプ | 必須 | 任意 |
|--------------|------|------|
| T1 ホーム | AppShell, PageLayout, MetaHead | Card, StatusBadge |
| T2 セクション入口 | AppShell, PageLayout, Breadcrumb, MetaHead, SubNav(絞り込みがある場合) | TournamentSearchTable, TournamentCard, 検索フォーム |
| T3 エンティティハブ | 同上+Chip(年度・カテゴリ) | TournamentContextBlocks, MajorTitles |
| T4 結果詳細 | 同上+ResultsTable 系 | TournamentBracket, Statistics, YearPagerNav |
| T5 単体詳細 | 同上+対戦カード | YouTubeRangePlayer, 分析ブロック |
| T6 記事 | AppShell, PageLayout, Breadcrumb, MetaHead | ContextBlocks, GrowthReportView |
| T7 ユーティリティ | AppShell, PageLayout, Breadcrumb, MetaHead | — |

- 全タイプで PlayerLink / TeamLink を選手名・チーム名表示に必ず使用する(直接 `<Link>` を書かない)

## 6. 新規コンポーネント追加の基準

1. まず既存の data / base で組めないか確認する(P2)
2. 同じ表示が**2ページ以上**で必要になったら共通化する(1ページ限りは feature 直書き可)
3. 追加時は本書の分類表に登録し、責務を1文で書けること(書けなければ分割か統合を再検討)
4. トークン外の色・サイズが必要になった場合はコンポーネント側で解決せず、06 の改訂を提案する

## 7. 未決事項(→ project-status.md)

| # | 内容 |
|---|------|
| ~~O-014~~ | 解消(D-013: 削除) |

- 改訂記録: 2026-07-04 D-013 反映(§2 AffiliateLink)
