# 選手ページ順位改善 設計ドラフト

日付: 2026-06-12
状態: 実装反映済み（2026-06 更新）。P1（内部リンク）・P3（メタ/構造化データ）・P4（自動生成サマリー）は実装済み。P2（URL統合）は条件付き先送り（curated 23選手のみが対象でスコープが小さく、301・コンテンツ移植に伴う毀損リスクがあるため。GSC でカニバリ損失が確認できた場合のみ着手）。P5（sitemap lastmod）は next-sitemap で対応済み。最新の正は docs/wiki/public-pages.md「選手ページの SEO 方針」を参照。以下の本文は当時の設計議論として保全（再実装の指示ではない）。

## 背景

GSC 28日間データの分析結果:

- 選手結果ページ: 534ページで733クリック(1.4/ページ)。534中277ページがクリック獲得済みでロングテールは機能している。
- 選手名クエリの大半が掲載順位 8〜11位に滞留(例: 「片岡暁紀」274表示・8.8位・8クリック)。
- 9位→3位なら CTR 3%→20%超。既存ページの順位改善だけで 4〜6倍の伸びしろ。

## コード監査で判明した問題

1. 内部リンク欠如(最重要)
   - 大会結果ページ(`src/pages/tournaments/**`)の選手名がリンクされていない。
   - 高校・学校ページ(`src/pages/highschool/**`)から選手ページへのリンクなし。
   - 選手結果ページへの内部リンクは `PlayerResults.tsx`(パートナー)と `PlayerSummaryStats.tsx` のみ。
2. エンティティ分裂
   - curated 23選手: `/players/{slug}/`(プロフィール)と `/players/{id}/results/`(結果)が同一名クエリで競合。
   - プロフィール→結果のリンクはあるが逆方向なし。
3. 構造化データ
   - `results.tsx`: `Article` 型、`datePublished`/`dateModified` = `new Date()`(ビルド日)。ビルドごとに変わる偽の鮮度シグナル。
   - `Person` / `ProfilePage` 型未使用。
4. メタ情報の汎用性
   - title: `${fullName} 試合結果・経歴 | ソフトテニス情報`(全ページ同型、チーム名なし)。
   - description も定型文のみ。
5. sitemap
   - 全ページ一律 `changefreq: daily` / `priority: 0.7`、lastmod なし。

## 設計(優先順)

### P1: 内部リンク網の構築(効果最大)

- 大会結果ページの全選手名を `/players/{id}/results/` にリンクする。
  - participants の姓名 → `data/players/index.json` の id 解決。同姓同名は既存の「最初のIDを使う」規約に従う(要確認: players/index.tsx と同様)。
  - ページを持たない選手(count<5)はリンクしない。
- 高校学校ページの掲載選手名をリンク(該当者のみ)。
- 選手ページに「関連選手」セクション: 同チーム選手・主要ペア相手。
- 効果: アンカーテキスト=選手名の内部リンクが大会数×試合数分発生し、1,785ページの孤立が解消。

### P2: エンティティ統合(カニバリ解消)

- curated 23選手の 2URL を 1URL に統合。
- 推奨案: slug 側(`/players/{slug}/`)を正とし、プロフィール+全戦績を1ページに統合。`/players/{id}/results/` から 301(`redirects-map.json` の仕組みを利用)。
- 代替案: numeric 結果ページを正とし slug→301(結果ページの方がクリック多い選手がいるため)。
- 要決定: どちらを canonical にするか。

### P3: 構造化データ・メタ刷新

- JSON-LD を `ProfilePage` + `Person` に変更:
  - `name`、`alternateName`(かな)、`affiliation`(チーム)、`height`(curated のみ)、`mainEntityOfPage`。
- `datePublished` / `dateModified` は実データ由来(初出大会日 / 最新出場大会日)に変更。
- title 改善: `${姓名}(${チーム})の戦績・試合結果 | Softeni Pick`。
- description 動的生成: 直近大会・勝率・主要タイトルを埋め込み(全ページ一意化)。
- パンくず3階層目を `${fullName}` に。

### P4: ページ固有コンテンツ強化

- 自動生成サマリー文(テンプレ+変数): 「{name}({team})は{直近大会}で{成績}。直近1年で{n}大会出場、勝率{x}%。主なペアは{partner}。」
- 年度別成績テーブル、ペア別成績の表示(analysis 系データは既存)。
- curated 層に FAQ 構造化データ(身長・所属・ペア)。身長クエリ需要は GSC で実証済み。

### P5: 鮮度シグナル

- sitemap `lastmod` = 選手の最新試合日(`transform` で算出)。
- `changefreq` / `priority` の一律設定を見直し。

## 効果見込み

- 順位 8〜11位 → 3〜5位で CTR 3〜5% → 15〜25%。同表示回数でも 4〜6倍。
- 内部リンクにより表示回数(クエリカバレッジ)自体も増加。

## 測定

- GSC でページ種別ごとの position / CTR を週次確認。
- 可能なら P1 → P3 → P4 の順で間隔を空けてデプロイし効果を分離。

## Open Questions

- P2 の canonical 方向(slug 案 vs numeric 案)。
- 同姓同名選手の id 解決ポリシーの明文化。
- count>=5 閾値の引き下げ(3〜4 の 3,018人)は別件(ページ数拡大)として扱う。
