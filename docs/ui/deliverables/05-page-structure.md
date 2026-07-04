# 05-page-structure.md — ページ構造設計

- ステータス: approved(D-010, 2026-07-04)
- 作成日: 2026-07-04
- フェーズ: Phase 5
- 入力: 04-site-structure.md(in-review・D-009 による一括作業)、02-issues.md(approved)。対応課題: I-06、I-13、I-14(基準定義)
- 用語は glossary.md に従う

## 1. 設計方針

1. 全公開ページを**7つのページタイプ**のいずれかに割り当てる。例外ゼロを目指し、割り当て不能は保留として記録する
2. 共通シェル(AppShell)+ PageLayout を**全公開ページに適用**する(I-13)。score モードも同様
3. パンくずは**全公開ページ必須**(I-06)。唯一の例外はホーム(パンくずの起点のため)
4. 各タイプは「領域の並び順=情報の優先順位」を固定し、ページ個別の判断で並びを変えない

## 2. 全ページ共通構造

```
AppShell(サイドバー+ヘッダー)
└─ PageLayout(maxWidth はタイプで既定)
   ├─ ① パンくず(必須。ホームのみ省略)
   ├─ ② ページヘッダー(h1 + 補足説明 1〜2文)
   ├─ ③ サブナビ(該当タイプのみ。本文上部・セグメント型)
   ├─ ④ 本文領域(タイプ別に定義)
   └─ ⑤ 関連導線(下部。関連エンティティへの内部リンク)
```

- 見出し階層: h1(1個)→ セクション h2 → カード内 h3(トップページで確立済みの規則を全ページへ)
- MetaHead(title / description / canonical / OGP)と JSON-LD は全ページ必須(既存 SEO 運用を継承)

## 3. ページタイプ定義

### T1 ホーム

| 項目 | 定義 |
|------|------|
| 目的 | サイト全体の入口。各セクションへの誘導 |
| maxWidth | 6xl |
| 領域(優先順) | ヒーロー(サイト説明)→ 主要セクションカード → 最近追加された大会 → 特集導線 |
| 該当 | `/` |

### T2 セクション入口(一覧・検索)

| 項目 | 定義 |
|------|------|
| 目的 | 1エンティティ種の一覧・検索・絞り込み |
| maxWidth | 6xl(テーブル中心のため広幅) |
| 領域(優先順) | サブナビ(絞り込み)→ 検索/フィルタ → 一覧本体(テーブルまたはカード)→ 補足(scope 注記等) |
| サブナビ | あり(例: 大会=すべて/主要/地域、高校=男子/女子/歴代記録) |
| 該当 | `/tournaments`, `/tournaments/major`, `/tournaments/local`, `/players`, `/teams`(新設), `/matches`, `/news`, `/growth`, `/highschool`, `/highschool/[gender]`, `/st-league/teams`, `/tournaments/local/[federationId]`, `/highschool/tournaments` |

### T3 エンティティハブ

| 項目 | 定義 |
|------|------|
| 目的 | 1エンティティの概要と配下コンテンツへの入口(年度・カテゴリ・関連) |
| maxWidth | 4xl |
| 領域(優先順) | エンティティ概要(名前・基本属性)→ 配下ナビ(年度チップ・カテゴリ)→ 代表コンテンツ(歴代優勝者等)→ 関連導線 |
| 該当 | 大会ハブ `/tournaments/[generation]/[tournamentId]`, チーム `/teams/[teamId]`, 学校 `/highschool/[gender]/[prefectureId]/[teamId]`, 選手プロフィール `/players/[slug]`, STリーグ `/st-league`, STリーグ回 `/st-league/[year]`, 都道府県 `/highschool/[gender]/[prefectureId]` |

### T4 結果詳細(データ面)

| 項目 | 定義 |
|------|------|
| 目的 | 1エンティティ×期間/カテゴリの結果データ本体 |
| maxWidth | 6xl(トーナメント表・大型テーブルのため) |
| 領域(優先順) | 結果サマリ(優勝等)→ データ本体(トーナメント表/結果テーブル)→ 統計 → 文脈ブロック → 関連導線 |
| 該当 | 大会年度別結果, 選手結果 `/players/[id]/results`, チーム年度別 `/teams/[teamId]/[year]/[gender]`, `/st-league/[year]/teams・/matches・/analysis` |

### T5 単体詳細(1対戦・1記録試合)

| 項目 | 定義 |
|------|------|
| 目的 | 1対戦/1記録試合の詳細(スコア・分析・動画) |
| maxWidth | 4xl |
| 領域(優先順) | 対戦カード(両者・結果)→ スコア詳細 → 分析/動画 → 大会・選手への関連導線 |
| 該当 | 対戦詳細(大会配下), 記録試合詳細 `/matches/[matchId]`, `/st-league/[year]/matches/[matchId]` |

### T6 記事

| 項目 | 定義 |
|------|------|
| 目的 | 読みもの(時系列コンテンツ) |
| maxWidth | 3xl(可読幅) |
| 領域(優先順) | タイトル・日付 → 本文 → データ文脈ブロック(前回王者等)→ 関連導線 |
| 該当 | `/news/[articleId]`, `/growth/[slug]`, `/matches/growth`(レポート形式), ランキング `/rankings`(データボードだが1ページ集約のため本タイプの幅規則のみ準用: 6xl) |

### T7 ユーティリティ

| 項目 | 定義 |
|------|------|
| 目的 | サイト情報・静的ページ |
| maxWidth | 3xl |
| 領域 | 本文のみ(h2 区切り) |
| 該当 | `/about`, `/privacy`, `/contact`, `/faq`, `/st-league/about`, `/st-league/champions`(記録表つきユーティリティ) |

## 4. 全ページのタイプ割当(網羅)

| ページ | タイプ |
|--------|--------|
| `/` | T1 |
| `/tournaments`, `/tournaments/major`, `/tournaments/local`, `/tournaments/local/[federationId]`, `/players`, `/teams`(新), `/matches`, `/news`, `/growth`, `/highschool`, `/highschool/[gender]`, `/highschool/tournaments`, `/st-league/teams` | T2 |
| 大会ハブ, `/teams/[teamId]`, 学校ページ, `/players/[slug]`, `/st-league`, `/st-league/[year]`, `/highschool/[gender]/[prefectureId]` | T3 |
| 大会年度別結果, `/players/[id]/results`, `/teams/[teamId]/[year]/[gender]`, `/st-league/[year]/teams`, `/st-league/[year]/matches`, `/st-league/[year]/analysis`, `/highschool/tournaments/[tournament]` | T4 |
| 対戦詳細(大会配下), `/matches/[matchId]`, `/st-league/[year]/matches/[matchId]` | T5 |
| `/news/[articleId]`, `/growth/[slug]`, `/matches/growth`, `/rankings` | T6 |
| `/about`, `/privacy`, `/contact`, `/faq`, `/st-league/about`, `/st-league/champions` | T7 |
| `/beta/**`(開発面) | 対象外(公開設計の適用外。ただし将来の再設計時は T2/T5 を準用) |

- 割当不能の例外ページ: なし
- 境界の判断基準: 「一覧が主役」= T2、「配下への入口が主役」= T3、「データ表が主役」= T4、「1件の詳細が主役」= T5

## 5. 現行からの主な変更点

| 変更 | 対象 | 対応課題 |
|------|------|---------|
| PageLayout 適用 | `/growth`, `/growth/[slug]`, `/matches/**`(score 含む), 対戦詳細(大会配下), `/beta` 公開昇格分(`/matches/**`) | I-13 |
| パンくず追加 | `/growth`, `/growth/[slug]`, `/matches/**`, `/highschool`(入口化に伴い) | I-06 |
| サブナビ新設 | `/tournaments`(すべて/主要/地域), `/highschool`(男子/女子/歴代記録) | I-03, C-3/C-4 |
| 見出し階層の統一 | 全ページ(h1×1 → h2 → h3) | トップページ規則の展開 |

## 6. 一覧表現の使い分け基準(I-14 の基準定義)

| 表現 | 使う場面 | 例 |
|------|---------|-----|
| テーブル | 属性を比較して探す一覧(列が3つ以上意味を持つ) | 大会検索、ランキング、選手検索結果 |
| カード | 異種情報の混在、または状態ラベルが主役の一覧(モバイル主導線) | 大会一覧モバイル、ベータ機能一覧、成長記録 |
| リンクリスト | 項目数が少なく(目安20未満)属性比較が不要なナビ用途 | 連盟一覧、歴代記録入口 |

- 同一ページでの併用は「PC=テーブル、モバイル=カード」のレスポンシブ変換のみ許可(現行 TournamentSearchTable の型)

## 7. 未決事項(→ project-status.md)

| # | 内容 |
|---|------|
| O-011 | `/rankings` のタイプ(T6 準用)が適切か、将来「データボード」タイプを独立させるか(該当ページが3つ以上になった時点で再検討) |
