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
