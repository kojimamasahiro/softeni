# 04-site-structure.md — サイト構造設計(IA)

- ステータス: approved(D-010, 2026-07-04)
- 作成日: 2026-07-04
- フェーズ: Phase 4
- 入力: 03-domain-model.md(approved D-008)、02-issues.md(approved D-006)。対応課題: I-01〜I-05
- 用語は glossary.md / 03-domain-model.md に従う

## 1. 設計方針

1. **エンティティ主導**: サイトの階層はドメインモデルのエンティティ(大会・選手・チーム・ランキング)に対応させる。ページはエンティティの「一覧 → ハブ → 詳細」の型に沿って配置する
2. **公開面と開発面の分離**(I-01): `/beta/**` は開発ツール専用に戻す。公開コンテンツの正規 URL に `/beta` を含めない
3. **グローバルナビはセクション入口のみ**(ADR-006 踏襲): 末端ページへの直リンクはグローバルナビに置かず、セクション入口・ローカルナビで案内する
4. **既存 URL の温存を優先**: 変更が必要なのは I-01 関連のみ。それ以外の既存 URL は変えない(SEO 資産保護)

## 2. サイトマップ(softeni-pick モード・目標構造)

```
/                                       ホーム
│
├── 成績・記録を調べる
│   ├── /tournaments                    大会入口(全世代検索)
│   │   ├── /tournaments/major          主要大会一覧
│   │   ├── /tournaments/local          地域大会入口
│   │   │   └── /tournaments/local/[federationId]
│   │   └── /tournaments/[generation]/[tournamentId]        大会ハブ
│   │       └── .../[year]/[discipline]/[age]/[gender]      大会年度別結果
│   │           └── .../matches/[matchId]                   対戦詳細(掲載面)
│   ├── /players                        選手入口(検索)
│   │   ├── /players/[id]/results       選手結果
│   │   └── /players/[slug]             選手プロフィール(curated)
│   ├── /rankings                       ランキング
│   └── /teams                          ★新設: チーム入口(一覧・検索)
│       └── /teams/[teamId]             チームページ
│           └── /teams/[teamId]/[year]/[gender]
│
├── 特集
│   ├── /highschool                     ★入口化: 高校特集トップ
│   │   ├── /highschool/[gender]                     男子/女子(都道府県一覧)
│   │   │   └── /highschool/[gender]/[prefectureId]
│   │   │       └── .../[teamId]                     学校ページ
│   │   └── /highschool/tournaments                  全国大会 歴代記録
│   │       └── /highschool/tournaments/[tournament]
│   └── /st-league                      STリーグ特集トップ
│       ├── /st-league/about, /teams, /champions
│       └── /st-league/[year] (+ /teams, /matches, /matches/[matchId], /analysis)
│
├── 試合記録
│   └── /matches                        ★正規化: 記録試合一覧(旧 /beta/matches-results)
│       ├── /matches/[matchId]          記録試合詳細
│       └── /matches/growth             成長分析(内部運用面は noindex 維持)
│
├── 読みもの・記録
│   ├── /news → /news/[articleId]       記事(大会展望)
│   └── /growth → /growth/[slug]        成長記録
│
├── サイト情報: /about /privacy /contact /faq
│
└── (開発専用・robots Disallow)
    └── /beta → /beta/matches/**        ポイント記録ツールのみ
```

- score モード: 変更なし(`/matches`, `/matches/[matchId]`, `/matches/growth` のみ・上部バー運用)

## 3. 主要な構造変更(課題対応)

| # | 変更 | 対応課題 | 内容 |
|---|------|---------|------|
| C-1 | 記録試合の公開 URL を `/matches/**` に正規化 | I-01 | softeni-pick モードでも `/matches/**` を公開面として有効化し(現在は score モード専用)、`/beta/matches-results/**` は `/matches/**` へ 301。`/beta` 配下は開発ツール(ポイント記録)のみ残す。score モードと URL が揃い、canonical 分岐も単純化される |
| C-2 | `/teams` 一覧の新設 | I-02 | チームマスタを情報源とするチーム入口(検索付き一覧)を新設し、グローバルナビ「成績・記録を調べる」へ「チーム」を追加。主要エンティティ(大会・選手・チーム・ランキング)の入口が揃う |
| C-3 | `/tournaments` 入口にローカルナビ追加 | I-03 | 大会入口ページ上部に「すべて / 主要大会 / 地域大会」のサブナビを置き、major・local を入口経由で到達可能にする。グローバルナビには増やさない(方針3) |
| C-4 | `/highschool` の入口化 | I-05 | 振り分け専用ページを廃し、男子・女子・全国大会歴代記録への入口ページにする。ナビの直指し(/highschool/boys)を /highschool に変更。男女の入口が対称になる |
| C-5 | 正規・別名 URL の文書化 | I-04 | 5章の対応表で正規 URL と別名(canonical 先)を明示。以後、同一実装を複数 URL で配信する場合は本書への追記を必須とする |

## 4. グローバルナビゲーション(改訂)

サイドバー構成(`lib/navigation.ts` を単一ソースとする点は不変):

| グループ | 項目 | リンク先 | 変更 |
|---------|------|---------|------|
| 成績・記録を調べる | 大会 / 選手 / チーム / ランキング | /tournaments, /players, **/teams(新)**, /rankings | チーム追加(C-2) |
| 特集 | 高校 / STリーグ | **/highschool(変更)**, /st-league | 直指し廃止(C-4) |
| ~~試合記録~~ | (出さない・D-011) | — | URL 正規化(C-1)は実施するが、ナビ露出は見送り。導線はトップ・関連ページの内部リンクのみ |
| 読みもの・記録 | ニュース / 成長記録 | /news, /growth | 変更なし |
| 開発(DEV時のみ) | [DEV] ポイント記録 | /beta/matches | 変更なし |

- ローカルナビ(本文上部サブナビ): 大会入口(すべて/主要/地域)、高校(男子/女子/歴代記録)、STリーグ(年度・about 等)、選手(一覧/ランキング相互リンク)
- パンくず: 全公開ページ必須(詳細は Phase 5)

## 5. URL 命名規則

1. すべて小文字 kebab-case のslug。末尾スラッシュあり(trailingSlash 継続)
2. コレクションは複数形(`/tournaments`, `/players`, `/teams`, `/matches`, `/rankings`)
3. エンティティ階層は「コレクション → 識別子 → サブリソース」の順(例: `/teams/[teamId]/[year]/[gender]`)
4. 大会年度別結果は6階層を維持: `[generation]/[tournamentId]/[year]/[discipline]/[age]/[gender]`(既存 URL 温存。セグメント名の概念は glossary の 種目/年齢区分/性別)
5. 公開コンテンツの URL に `beta`・内部用語を含めない(I-01 の再発防止)
6. 新カテゴリ(例: 中学特集)を追加する場合: 世代の切り出し特集は `/junior-highschool` のようにトップレベル特集とし、大会データ自体は `/tournaments/[generation]/**` に置く(高校特集と同じ関係)

## 6. 全ページ対応表(現行 → 新構造)

| 現行 URL | 措置 | 新 URL / 備考 |
|----------|------|--------------|
| `/` | 維持 | — |
| `/about` `/privacy` `/contact` `/faq` | 維持 | — |
| `/tournaments` | 維持+サブナビ追加 | C-3 |
| `/tournaments/major` `/tournaments/local` `/tournaments/local/[federationId]` | 維持 | 入口経由で到達可能に |
| `/tournaments/[generation]/[tournamentId]`(ハブ) | 維持 | — |
| `/tournaments/.../[gender]`(年度別結果) | 維持 | — |
| `/tournaments/.../matches/[matchId]` | 維持 | 対戦詳細の掲載面。canonical は本 URL(siteLink あり時) |
| `/players` `/players/[slug]` `/players/[id]/results` | 維持 | 2系統は N-01 により統合しない |
| `/rankings` | 維持 | — |
| `/teams`(現在404) | **新設** | チーム一覧(C-2) |
| `/teams/[teamId]` `/teams/[teamId]/[year]/[gender]` | 維持 | 一覧からの導線が付く |
| `/highschool` | **入口化** | 振り分け廃止(C-4) |
| `/highschool/[gender]/**` `/highschool/tournaments/**` | 維持 | — |
| `/st-league/**` | 維持 | — |
| `/news` `/news/[articleId]` | 維持 | — |
| `/growth` `/growth/[slug]` | 維持 | — |
| `/beta/matches-results` | **301** | → `/matches`(C-1) |
| `/beta/matches-results/[matchId]` | **301** | → `/matches/[matchId]` |
| `/beta/matches-results/growth` | **301** | → `/matches/growth`(noindex 維持) |
| `/beta` `/beta/matches/**` | 維持(開発専用) | robots Disallow 継続 |
| score モード `/matches/**` | 維持 | softeni-pick モードと同一 URL 体系になる |

- 削除するページ: なし(すべて維持・統合・リダイレクトのいずれか)

## 7. 主要導線の検証

| 導線 | ステップ |
|------|---------|
| 大会 → 対戦 → 選手 | /tournaments → ハブ → 年度別結果 → 対戦詳細 → 選手結果(3〜4クリック) |
| 選手 → 大会 | 選手結果 → 出場大会リンク → 大会ハブ(2クリック) |
| チーム → 選手 / 大会 | /teams → チームページ → 年度別 → 選手・大会(2〜3クリック) |
| 高校 学校 → 選手 | 特集トップ → 男女 → 都道府県 → 学校 → 選手結果 |

## 8. 拡張ルール

- 新エンティティの公開: 「入口(一覧)→ ハブ → 詳細」の3層を基本形とし、グローバルナビへはグループ単位で追加を検討(項目数がグループ7個を超えないこと)
- 特集の追加基準: 独自データまたは SEO 上の独立需要がある世代・領域のみ。特集は総合入口(/tournaments 等)の代替ではなく切り出しである、という現行の関係(navigation.ts コメント)を維持する

## 9. 未決事項(→ project-status.md)

| # | 内容 |
|---|------|
| ~~O-009~~ | 解消(D-011: ナビに出さない) |
| O-010 | /teams 一覧の検索仕様(全4,352チーム対象か、count 下限を設けるか) |

- 改訂記録: 2026-07-04 D-011 反映(§4 試合記録グループの見送り)
