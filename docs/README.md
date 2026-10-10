# Docs 運用ガイド（人向けの入口）

`docs/` は、Softeni Pick の実装・対話ログ・設計判断を後から追えるようにするための Markdown ベース運用です。

**エージェント向けの規則の正は [AGENTS.md](../AGENTS.md)** です（読む順・層と優先順位・操作・不変条件）。
設計の経緯と理由は [ADR-024](./adr/ADR-024-llm-wiki-operating-model.md)、検討の記録は
[raw/2026-10-09-llm-wiki-redesign.md](./raw/2026-10-09-llm-wiki-redesign.md)。ここには、人が迷わないための地図だけを置きます。

## どこに何があるか

| 置き場所 | 何を置くか | 入口 |
|---|---|---|
| `raw/` | 生の記録（調査・提案・監査・作業ノート・wiki の圧縮前アーカイブ）。**追記のみ** | [raw/README.md](./raw/README.md) |
| `wiki/` | compile 済みの**現在の理解**。先頭に frontmatter、入口の `index.md` は生成物 | [wiki/index.md](./wiki/index.md) |
| `adr/` | 重要な決定の記録（いつ・なぜ）。wiki 層の「決定記録」 | [adr/README.md](./adr/README.md) |
| `prompts/` | wiki 操作の手順は skill（`.claude/skills/wiki-*`）へ移した。ここは旧リンクを守るリダイレクト | [prompts/README.md](./prompts/README.md) |
| `ui/` | UI/情報設計プロジェクトの成果物（層ではない・2026-07-04 完了） | [ui/PROJECT.md](./ui/PROJECT.md) |
| `sql/` | Supabase への差分 DDL と適用台帳 | [sql/APPLIED.md](./sql/APPLIED.md) |
| `story-yaml/` | 大会インサイトの YAML 仕様（ADR-012） | [story-yaml/](./story-yaml/) |
| `notes/` | インタビュー等のメモ | [notes/](./notes/) |
| **docs 直下** | **この README と、進行中の作業表だけ** | — |

進行中の作業表（終わったら消す）:

- [venue-input-worksheet.md](./venue-input-worksheet.md) — 会場データ入力の作業表（入力中）。
  文字数の検査からは除外している（`scripts/check-wiki-size.mjs` の `WORK_FILES`）

2026-09-19 に docs 直下の11本を仕分けして、この形になりました
（経緯は [raw/2026-09-19-docs-layer-cleanup.md](./raw/2026-09-19-docs-layer-cleanup.md)）。

## 人間がやること

- 対話ログ・調査メモの結論が、docs/raw に残っているかを見る（書き戻すのは実装したエージェントの仕事）
- 実装前に仕様の曖昧さを確認する
- エージェントが更新した wiki・ADR をレビューする。PR の「docs 同期」欄（更新したページ・status の変更・ADR・落としたもの）が入口
- 重要な判断を ADR 化するか最終判断する
- 月に一度、`wiki-lint` の結果（raw の lint ノート）を見て、要判断の項目に答える。
  ランブックの実施予定を過ぎていないかも、そこで確かめる

## よく使うコマンド

| やりたいこと | コマンド |
|---|---|
| docs の機械検査（ゲート） | `npm run check:wiki -- --strict` |
| 報告（文字数・孤立・Compile Log の欠落など） | `npm run check:wiki` |
| 触るコードから所有ページを引く | `npm run wiki:for -- <パス>` |
| `index.md` を作り直す（手で直さない） | `npm run wiki:index` |
| skill のリンクを張り直す | `npm run sync:skills` |
