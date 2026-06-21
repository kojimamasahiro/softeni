# 文脈ブロック / 速報・プレビュー機能

## 概要

時事系（速報・プレビュー）流入を、運用負荷を上げずに獲得するための機能群。本機能の本質的価値は「記事生成」ではなく **「文脈ブロック生成」** にある。競合のテンプレ SEO サイトでも結果記事は生成できるが、Softeni Pick の大会・選手・試合データを横断して生成する文脈情報は再現が難しい。よって**文脈ブロックを一次成果物**とし、記事はその再利用先の一つとして扱う。

状態: **一部実装済み（2026-06-21）**。優先度A 3ブロックの生成ロジック、大会ハブ・選手ページへの差し込み、`/news` 記事（プレビュー/結果）まで実装（Step1-7）。head-to-head（Step8）と承認 UI は未実装。詳細設計は raw を参照: [親仕様](../raw/2026-06-21-news-auto-draft-design.md)、[Step1](../raw/2026-06-21-historical-winners-logic.md)、[Step2](../raw/2026-06-21-milestone-logic.md)、[Step3](../raw/2026-06-21-career-record-logic.md)。

実装状況（実装が source of truth）:

- 実装済み:
  - `lib/tournamentRecords.ts`（historical-winners・連覇判定。`readYearDetail` / `buildParticipantMap` / `resolveEntryToChampion` を export し、優勝者以外の試合＝敗退試合の参照を可能にしている）
  - `lib/milestones.ts`（repeat-title / first-title / champion-defeat。career-wins / best4-first / first-appearance は名寄せ整備まで保留）
    - `champion-defeat`（王者撃破）: 前回王者（対象年より前で直近に優勝者が判明している開催の優勝ペア/校）が対象年に**出場し試合で敗退した**場合のみ、撃破した側を subject にしたイベントを返す。当年 `matches` から `championKey`（所属＋名前）一致で前回王者エントリを特定し、敗戦試合の勝者を解決する。不出場・無敗（連覇）は出さない。`getChampionDefeat()` として優勝者視点の `getChampionMilestones()` とは分離（主役が優勝者ではないため）。confidence は `confirmed`（試合の勝敗は確定）だが「前回王者」認定は掲載範囲依存のため scopeNote を添える。
  - `lib/careerRecord.ts`（analysis.json＋優勝歴。CareerTitle に categoryId を保持）
  - 大会ハブ差し込み: `src/components/TournamentContextBlocks.tsx` ＋ `src/pages/tournaments/[generation]/[tournamentId]/index.tsx`（最新年度の milestone と curated 優勝者の通算成績）
  - 結果ページ差し込み（年度×種目）: `src/components/ResultContextBlocks.tsx` ＋ `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx`（その年・種目の repeat-title / first-title / champion-defeat を「注目ポイント」バッジで表示。historical-winners を共有して二重走査を回避）
  - 選手ページ差し込み: `src/components/PlayerCareerHighlights.tsx` ＋ `src/pages/players/[id]/index.tsx`（通算成績・優勝歴・優勝歴由来の連覇/初優勝 milestone。curated 選手のみ）
  - `/news` 記事（プレビュー/結果）: `lib/newsArticle.ts`（記事レコード＋ビュー組み立て）、`src/pages/news/[articleId].tsx`、`src/pages/news/index.tsx`、生成 `scripts/generate-news-drafts.mjs`。記事レコードは `data/news/<articleId>.json`（state: draft→review→published、公開は published のみ）。プレビューは前回王者＋シード中 curated 注目選手＋歴代、結果は優勝者＋milestone＋歴代。プレビュー→結果は同一 articleId で type を昇格。
  - `/news` 記事の OGP 画像（`summary_large_image` / 1200×630）: `tools/sns-images/news_og.py` が **ローカル生成**し `public/og/news/<articleId>-<hash>.png` を git にコミット（本番ビルドに依存を増やさない方針）。対象は `state==="published"` かつ `type==="result"` のみ。生成時に記事レコードへ `ogImage` を書き戻し、`src/pages/news/[articleId].tsx` が `ogImage` のある記事だけ large カードを出す（無ければ既定の `summary` カードへフォールバック）。`MetaHead` は `imageWidth`/`imageHeight` props で large と既定（192）を共存。preview のOGPは後回し。設計: [raw/2026-06-22-news-ogp-image-design.md](../raw/2026-06-22-news-ogp-image-design.md)。
- 公開フロー（human-in-the-loop）: 生成スクリプトは state:"draft" を作る。人が確認して `data/news/<articleId>.json` の state を "published" に変更すると公開される（承認 UI は未実装、当面 state 手書き運用）。
- 未実装: head-to-head ほか名寄せ依存ブロック（Step8）、career-wins / best4-first / first-appearance、承認 UI。

## 設計原則（確定）

データ取得は完全手動入力のまま維持し、自動化するのは生成のみ（外部速報元の自動クロールはしない）。本文は LLM を使わず**テンプレートのみ**で決定的に生成する（誤り混入ゼロ・低コスト・鮮度シグナル安定）。公開記事は **human-in-the-loop**（自動ドラフト→人が承認→公開）。既存ページへのブロック差し込みは決定的生成のためビルド時自動。

## パイプライン

```
大会データ
  ↓ イベント抽出（初優勝/連覇/王者撃破/通算節目/ベスト4初進出 など）
  ↓ 文脈ブロック生成（一次成果物）
  ↓ 再利用先：大会ページ / 選手ページ / ランキング / 記事
```

イベント抽出を上位概念に置くことで、抽出したイベント列を大会・選手・ランキング・記事の全面で再利用できる。`milestone` は実質その最初の具体例。

## 文脈ブロック（優先度）

データソースは `data/tournaments/details/**` 横断と `data/players/index.json`。詳細は [data-model.md](./data-model.md)。

優先度A（先行実装）は、その大会の歴代優勝者一覧を出す `historical-winners`（過去年度 `results` の `{kind:"winner"}` から機械的に算出。最も安全）、初優勝・連覇等の節目を出す `milestone`、対象ペア/選手の通算成績を出す `career-record`（「当サイト掲載大会分の通算」と明示）。優先度Bは、シードと到達ラウンドを対比する `seed-vs-result`（番狂わせ検出）。優先度Cは `head-to-head`（対戦履歴）で、同姓同名・名寄せ・ペア変更の誤判定リスクが高いため、名寄せ精度の検証が済むまで導入しない。

`historical-winners` の歴代優勝〜ベスト4抽出は、既存の高校歴代ロジック `lib/highschoolNationalTournaments.ts` を大会非依存に一般化して実装する（ゼロから作らない）。

## 出力先と URL

文脈ブロックは記事ページと既存ページ（大会・選手）の両方で再利用する。記事は `/news/<articleId>`（独立ツリー）に置く。`/tournaments/.../preview` のようなツリー内配置は既存大会ページとのカニバリ距離が近いため採らない。大会ページとの関連性は記事→大会/選手/歴代ページへの内部リンクで担保する。カニバリ制御の詳細は [seo.md](./seo.md) の重複マップ #8 を参照。

プレビュー記事は結果確定後に**同一 URL で結果記事へ昇格**させ（`articleId` 共有）、検索面を継続保有する。これは canonical 統一にも有利。

## 実装順序

記事機能が未完成でも既存ページの情報密度向上による SEO 効果を先取りできる順序にする。`historical-winners` → `milestone` → `career-record` → 大会ページ差し込み → 選手ページ差し込み → preview 記事（B）→ result 記事（A）→ `head-to-head`。B（プレビュー）を A（結果）より先にするのは、需要曲線（プレビューは大会前から需要が立ち結果へ育成できる）と品質リスク（結果は優勝者・スコア誤りが致命的）の両面から。

## 関連

- アーキテクチャ判断（なぜ文脈ブロックを一次成果物にするか）: [ADR-005](../adr/ADR-005-news-context-block-architecture.md)
- 親仕様（確定事項・全 Open Questions の決定）: [raw/2026-06-21-news-auto-draft-design.md](../raw/2026-06-21-news-auto-draft-design.md)
- Step1 詳細設計: [raw/2026-06-21-historical-winners-logic.md](../raw/2026-06-21-historical-winners-logic.md)
- データ構造: [data-model.md](./data-model.md) / [Data Import](./data-import.md)
- SEO カニバリ運用: [seo.md](./seo.md)
- 既存の歴代記録ロジック: `lib/highschoolNationalTournaments.ts`

## Open Questions

- `milestone` / イベント抽出の語彙確定（初優勝・連覇・3連覇・初出場・王者撃破・通算N勝・ベスト4初進出 のキー定義と判定条件）。
- `head-to-head` 導入可否を判断する名寄せ精度の検証方法。
- 記事 `articleId` の命名規約（プレビュー→結果で共有する安定 ID）。
- 大会改称をまたぐ歴代結合（エイリアス table を持つか tournamentId 単位で割り切るか）。
