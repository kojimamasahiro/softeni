# アーカイブ済みツール

現行は `tools/tournament3/`（共有パイプライン `normalize-core` / `tool-bridge` 経由、
`validate-entries.js` によるチェック組み込み済み）。以下は旧版のため使用しないこと。

- `tournament/`, `tournament2/` — 共有パイプラインを経由しない旧ツール。
  team-id のアンダースコア変換バグ等が未修正のまま残っている
  （詳細: `docs/team-id-underscore-bug.md`）。
- `tournament4/` — `initialPlayer.js` のみが残る未完成の実験コピー（HTML/JS 本体なし）。

2026-08-01、リポジトリ整理の一環でルート直下から `tools/_archived/` に移動。
削除はせず参照用として残す。
