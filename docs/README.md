# Docs 運用ガイド

## 目的

この `docs/` は、Softeni Pick の実装・対話ログ・設計判断を後から追えるようにするための Markdown ベース運用です。

- `docs/raw/`: 対話ログ、未整理メモ、調査メモ
- `docs/wiki/`: 現在の仕様・設計・運用の整理
- `docs/adr/`: 重要な設計判断の記録

実装とドキュメントが衝突した場合は、実装を source of truth とします。

## 基本フロー

`docs/raw` に材料を残す
-> `docs/wiki` に現時点の整理を書く
-> 重要判断だけ `docs/adr` に残す

補足:

- `docs/raw` は削除・上書きしません
- 推測は `Assumption` と明記します
- 未確認事項は `docs/wiki/open-questions.md` に集約します
- 古い内容は消さずに `Deprecated` と明記します

## 人間がやること

- 対話ログ、未整理メモ、調査メモを `docs/raw/` に残す
- 実装前に仕様の曖昧さを確認する
- AI が更新した Wiki/ADR の妥当性をレビューする
- 重要な判断を ADR 化するか最終判断する

## AI がやること

- `docs/raw/` と実装を読み、`docs/wiki/` を整理する
- 実装で確認できる内容を優先して記述する
- `Assumption` / `Open Questions` / `Deprecated` を明示する
- 重要な設計判断が見つかった場合に ADR 候補を提案する

## 入口

- [raw/README.md](./raw/README.md)
- [wiki/index.md](./wiki/index.md)
- [adr/README.md](./adr/README.md)
- [prompts/README.md](./prompts/README.md)

## 上記3分類に属さない文書

`raw` / `wiki` / `adr` のどれでもない文書。どこからもリンクされていないと
将来のコンパイルパスから見えなくなるため、ここを所在地インデックスとする（2026-08-12 追加）。

### 仕様・データ構造（wiki に準じる扱い）

- [tournament-data-structure.md](./tournament-data-structure.md) — 大会データ JSON の型・構造（現行）
- [beta-matches-results.md](./beta-matches-results.md) — 記録試合の公開面仕様
- [story-yaml/](./story-yaml/) — 大会インサイトの YAML 仕様（ADR-012）
- [sql/APPLIED.md](./sql/APPLIED.md) — Supabase への差分 DDL（手動適用）とその適用台帳

### UI/情報設計 改善プロジェクト（2026-07-04 完了・移行実施中）

- [ui/PROJECT.md](./ui/PROJECT.md) — プロジェクト定義（まずこれ）
- [ui/project-status.md](./ui/project-status.md) — 現在の状態
- [ui/decisions.md](./ui/decisions.md) / [ui/rules.md](./ui/rules.md) / [ui/glossary.md](./ui/glossary.md)
- 成果物: [ui/deliverables/](./ui/deliverables/)、報告: [ui/reports/](./ui/reports/)

### 調査・提案（未整理。現行仕様の根拠には使わない）

- [adsense-ui-proposal.md](./adsense-ui-proposal.md)（2026-06）
- [cloudflare-migration-analysis.md](./cloudflare-migration-analysis.md)（2026-06）
- [highschool-pages.md](./highschool-pages.md)（2026-06。現行は [wiki/highschool.md](./wiki/highschool.md)）
- [tournament_requirements.md](./tournament_requirements.md) / [tournament_bracket_logic.md](./tournament_bracket_logic.md)（2026-06）
- [team-id-underscore-bug.md](./team-id-underscore-bug.md)（2026-07）
- [exploration-cycle-audit-2026-08-10.md](./exploration-cycle-audit-2026-08-10.md) — 探索循環・知識蓄積プロセスの監査
- [venue-input-worksheet.md](./venue-input-worksheet.md) — 会場データ入力の作業表
- [notes/](./notes/) — インタビュー等のメモ
