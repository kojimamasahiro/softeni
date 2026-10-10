# raw メモ置き場

`docs/raw/` は、**AI との対話ログ**、未整理メモ、調査メモ、実装前の案を置く場所です
（どのアシスタントのログでも構いません）。

## ルール

- 整理されていなくて構いません
- 完全でなくて構いません
- 後で `docs/wiki/` に整理するための材料として残します
- 原則として削除・上書きせず、必要なら追記します

## 推奨ファイル名

- `YYYY-MM-DD-topic.md`

例:

- `2026-05-23-score-domain-split.md`
- `2026-05-23-youtube-point-link.md`
- `2026-05-23-score-analysis-ui.md`

## kind（2026-10-10 以降の新規ノート）

新しいノートの先頭に、`kind` を1行だけ書く。既存のノートは追記のみの原則に従い触らない。

```markdown
---
kind: research
---
# 題
```

| kind | 何のノートか | Compile Log |
|---|---|---|
| `research` | 調査・実測・監査・実装の記録 | 要る |
| `idea` | 発展候補・ブレスト | 要る |
| `plan` | 実装計画・設計の検討 | 要る |
| `worklist` | 作業リスト・チェックリスト（wiki へ載せる中身が元々無い） | 要らない |
| `archive` | wiki ページの圧縮前の全文（compile の「先」） | 要らない |

迷ったら `research`。機械は `npm run check:wiki`（値が上の語彙の外ならゲートで止まり、新規ノートに無ければ報告に出る）。
`kind` を持たない旧ノートの免除は、これまでどおりファイル名（`wiki-archive` / `-review` / `-checklist` / `-todo`）で決める。
