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

## docs の中身（2026-09-19 再定義）

**3層（raw / wiki / adr）が原則**で、それ以外は「層ではないもの」だけを置く。
2026-09-19 に docs 直下の11本を仕分けし、仕様は wiki へ、調査・提案・監査は raw へ移した
（経緯は [raw/2026-09-19-docs-layer-cleanup.md](./raw/2026-09-19-docs-layer-cleanup.md)）。

| 置き場所 | 何を置くか | 入口 |
|---|---|---|
| `raw/` | 生の記録（調査・提案・監査・作業ノート・wiki の圧縮前アーカイブ）。**追記のみ** | [raw/README.md](./raw/README.md) |
| `wiki/` | compile 済みの**現在の仕様**。1ページ12,000字以内 | [wiki/index.md](./wiki/index.md) |
| `adr/` | 重要な決定の記録（いつ・なぜ） | [adr/README.md](./adr/README.md) |
| `prompts/` | 繰り返し使う定型プロンプト（層ではない） | [prompts/README.md](./prompts/README.md) |
| `ui/` | UI/情報設計プロジェクトの成果物（層ではない・2026-07-04 完了） | [ui/PROJECT.md](./ui/PROJECT.md) |
| `sql/` | Supabase への差分 DDL と適用台帳 | [sql/APPLIED.md](./sql/APPLIED.md) |
| `story-yaml/` | 大会インサイトの YAML 仕様（ADR-012） | [story-yaml/](./story-yaml/) |
| `notes/` | インタビュー等のメモ | [notes/](./notes/) |
| **docs 直下** | **この README と、進行中の作業表だけ**。仕様は wiki、記録は raw へ置く | — |

進行中の作業表（終わったら消す）:

- [venue-input-worksheet.md](./venue-input-worksheet.md) — 会場データ入力の作業表（入力中）。
  文字数の検査からは除外している（`scripts/check-wiki-size.mjs` の `WORK_FILES`）

**新しいファイルを docs 直下に作らないこと。** 仕様なら `wiki/`、調査・提案・作業ノートなら `raw/`
（ファイル名は `YYYY-MM-DD-*.md`）。どちらか迷うものは raw に置いてから compile する。
