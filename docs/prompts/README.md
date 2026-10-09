# Prompts

`docs/prompts/` は、かつて **AI アシスタントに繰り返し渡す定型プロンプト**を置いていた場所です。
**wiki の操作（compile・lint・圧縮）の手順は 2026-10-10 に skill へ移しました**
（[ADR-024](../adr/ADR-024-llm-wiki-operating-model.md) の P3）。skill は説明文で自動的に選ばれ、
Claude Code は `.claude/skills/`、Codex は `.agents/skills/`（`.claude/skills/` へのリンク）から読みます。

| 旧プロンプト | 移し先 |
|---|---|
| [update-wiki.md](./update-wiki.md) / [summarize-raw.md](./summarize-raw.md) / [create-adr.md](./create-adr.md) | [wiki-compile](../../.claude/skills/wiki-compile/SKILL.md) — 実装・raw → wiki・ADR（Triage → Route → Write → Close） |
| [review-docs-drift.md](./review-docs-drift.md) | [wiki-lint](../../.claude/skills/wiki-lint/SKILL.md) — wiki と実装・raw・ADR のずれの点検 |
| [slim-wiki-page.md](./slim-wiki-page.md) | [wiki-slim](../../.claude/skills/wiki-slim/SKILL.md) — 肥大したページの圧縮 |

このディレクトリのファイルは、**docs/raw（追記のみ）や AGENTS.md からのリンクを壊さないために残した1〜3行のリダイレクト**です。
新しい手順を足すときは skill 側に書いてください。skill を足す・消すときは `.claude/skills/` だけを触り、
`npm run sync:skills` でリンクを張り直します（CI は `--check` でずれを検出します）。
