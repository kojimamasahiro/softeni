# ADR-011: 選手集計を Player Statistics Engine（Facts + 純関数 fold + contentHash 増分）へ一本化する

## Status

Accepted。決定日: 2026-07-01（設計）、実装完了: 2026-07-02（P1–P7）。
現状仕様: `docs/wiki/players-pages.md`「選手統計エンジン」節。
設計の一次資料: `docs/raw/2026-07-01-player-statistics-engine.md` /
同 `-data-contract.md` / 同 `-implementation-plan.md`（歴史的記録として保全）。

## Context

選手ページを拡充するにあたり、集計ロジックが分散していた:
`scripts/generate-player-analysis.mjs`（独自の全大会スキャン）、`lib/careerRecord.ts`、
`lib/milestones.ts`、`lib/majorTitles.ts`、`lib/tournamentRecords.ts` がそれぞれ
生 JSON を別解釈しており、統計を 1 つ足すたびに解釈差・二重実装・全大会再スキャンが増える構造だった。
また約 8,200 選手 × 405 大会カテゴリの全再計算をビルドごとに行うのは、データ追加が続くほど破綻する。

## Decision

集計を単一エンジン `lib/playerStats/` に一本化する。

- **層構造**: L0 SourceAdapter（ファイル形式を知る唯一の層）→ L1 Facts（選手ごとの
  `PlayerMatchFact`/`PlayerEntryFact`・時系列昇順）→ L2 Aggregators（`(facts, config) => Section` の純関数）
  → L3 Facade `getPlayerStatistics()`（唯一の公開 API。SSR / 公開 JSON / SEO / 記事の 4 経路すべてがこれを呼ぶ）。
- **派生物のみ書く**: 生データ（`data/tournaments/**`・`data/players/index.json` 等)は読み取り専用。
  エンジンが書くのは `_facts` / `_index` / `_manifest.json` / `data/rankings` / `public/data/player-stats`（すべて `.gitignore`）。
  例外は curated 選手の `data/players/<slug>/analysis.json`（外部形は従来と byte 互換・コミット対象）。
- **増分ビルド（P7）**: `data/players/_manifest.json` が入力の contentHash を保持し、
  変更ファイル → 逆引き索引（選手→出場カテゴリ）→ **影響選手のみ**再生成する。
  下流（rankings / public JSON / analysis）は manifest の `lastRun` に従い増分実行。
  無変更ビルドは再計算ゼロ。`engineVersion`（`lib/playerStats/facts.ts`）を上げた時のみ全再計算。
- **調整値の集約**: 閾値・係数は `data/ranking-config.json` のみ（コードに数値を埋めない）。

## Alternatives

- **現状維持（スクリプトごとの独自集計）**: 統計追加のたびに解釈差と二重実装が増える。棄却。
- **DB（SQLite/Supabase）へ取り込んで SQL 集計**: 入力が静的 JSON でビルド時集計のみで足りるため
  運用コストに見合わない。将来 score データ合流時は L0 差し替えで対応可能。棄却。
- **増分なしの毎回全再計算**: 現状 ~24s だがデータ増に線形で悪化し、大半が無駄
  （1 大会追加の影響選手は数十名）。manifest 1 ファイルの管理コストの方が安い。棄却。
- **mtime ベースの増分**: git checkout / CI で mtime が信頼できない。contentHash を採用。

## Consequences

- 統計の追加は「純関数 aggregator 1 つ＋型フィールド追加」で済み、他セクションに影響しない。
- SSR とビルド JSON が同一 facade を通るため乖離しない。SEO 日付も実データ（coverage）由来。
- 勝率は `retired:true` を除外した実戦ベースに統一（placement 側には反映）。既存 analysis.json とは
  golden 検証で byte 一致を確認済み。
- 同姓同名は「1 名前 = 1 数値 id」の限界により当面融合を許容（`homonymRisk` で下流へ伝搬。
  詳細は `docs/wiki/open-questions.md`）。
- キャッシュ整合の検証責務が増える → `verify-golden-final.ts`（キャッシュ vs 再計算の一致）と
  `verify-performance.ts`（時間予算）を `playerstats:verify` / `playerstats:perf` として CI 運用する。

## Related Files

- `lib/playerStats/`（エンジン本体。`manifest.ts` が増分、`playerStatistics.ts` が facade）
- `scripts/playerStats/`（generate-facts / generate-rankings / generate-public-json / generate-analysis / verify-*）
- `data/ranking-config.json` / `data/players/_manifest.json`（生成物）
- `docs/wiki/players-pages.md`「選手統計エンジン」節

## Open Questions

- Elo レーティング（config `rating.enabled:false`）の有効化時期と年度末スナップショットの増分設計。
- 同姓同名の人物別 id 分離（保留中。再検討条件は open-questions.md）。
