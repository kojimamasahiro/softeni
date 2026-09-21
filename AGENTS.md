# AI Collaboration Rules

このファイルはどのエージェントでも読む共通ルール（Codex は直接、Claude Code は CLAUDE.md 経由）。

## Skills

定型作業の手順は skill にまとめてある。実体は `.claude/skills/<name>/SKILL.md`、
Codex 用の `.agents/skills/<name>` はそこへのシンボリックリンク。

- skill を足す・消すときは `.claude/skills/` 側だけ触り、`npm run sync:skills` でリンクを張り直す
  （CI は `--check` でずれを検出する）。
- SKILL.md は特定エージェントの道具名（Read / Edit など）に依存しない書き方にする。

## docs の構成

This repository's docs/ follows an **LLM Wiki** pattern (Karpathy, 2026-04): raw sources are
**compiled** into interconnected wiki pages that are **written back and accumulated** over time,
rather than re-derived from scratch each session. docs/raw = 生の記録（追記のみ）、
docs/wiki = compile 済みの現在の仕様、docs/adr = 重要な決定の記録。

- **docs/raw は追記のみ**。削除・書き換えは明示的に頼まれたときだけ。
- **docs/wiki は現在の仕様だけ**を持つ: 挙動・ルール・閾値・1行の判断＋リンク・棄却済みの事実
  （再調査を防ぐため1行だけ残す）。日付つきの経緯・実測値・検算は docs/raw へ。
  wiki は二次成果物なので、実装と食い違ったら**実装が正**
  （ADR の Context / Decision / Alternatives は歴史の記録なので例外。ADR rules 参照）。
- 更新は「追記（YYYY-MM-DD）」を足すのではなく、**該当の節を書き換える**。
  長くなったページは docs/prompts/slim-wiki-page.md の手順で圧縮できる。
  1ページ12,000字が目安。**この節の規約は `npm run check:wiki` が機械で見る**
  （文字数・リンク切れ・適用範囲の行・wiki の孤立・ADR の Status 書式・Compile Log の欠落）。
  CI の checks.yml ではリンク切れがゲート、残りは報告のみ。
- 各ページの冒頭に **`適用範囲`** の行（汎用 / 学校スポーツ共通 / ソフトテニス固有 / 混在）を置く。
  他競技へ持ち出せる部分を見分けるため（docs/raw/2026-09-18-idea-multi-sport-expansion.md）。
- 新しいページは必ずクロスリンクする（docs/wiki/index.md へ追加 ＋ 関連ページから1本以上）。
  孤立したページは次の compile で見えなくなる。
- 不確かなものは **Assumption**、古くなったものは **Deprecated** と書く（黙って消さない）。
- 未解決の問いは docs/wiki/open-questions.md に集める。
- 日本語で簡潔に書く。

## 書き戻し（write-back）

調査・ブレストの結論や大きめの実装を、チャットの中だけで終わらせない。

- docs/raw にノートを追加/更新し、残す価値のある部分を docs/wiki へ compile する
  （docs/prompts/summarize-raw.md → docs/prompts/update-wiki.md）。
- compile したら、**何を意図的に落としたか**を raw の「Compile Log」に1行ずつ理由つきで書く。
  適用範囲と例外は docs/prompts/update-wiki.md が正。
- 大きめの実装のあとは docs/prompts/review-docs-drift.md で wiki と実装のずれを見る
  （放置した結果は docs/raw/2026-06-25-wiki-audit.md）。
- コードを変えたら、関連する docs/wiki と docs/adr の更新要否を確認する。特に backend、database、
  Android、課金、分析、score 機能、データモデル、公開ページ、デプロイ、取り込みスクリプト。

## Before coding

- 関連する docs/wiki と docs/adr を読む。wiki が現在の仕様で、経緯や実測が要るときだけ
  リンク先の docs/raw アーカイブを開く。
- 既存の決定・制約と、Deprecated / Draft の記述を確認する。
- 足りない要件を勝手に決めない。

## 要件の確認

仕様が不完全・矛盾・曖昧なときは、実装前に質問する。前提は明示し、未解決は Open Questions へ。
黙って挙動を発明しない。

次の項目は**必ず先に確認する**: タイムゾーンの扱い、統計式、異常値の閾値、公開/非公開の扱い、
同期の衝突解決、リワードの解放期間。

## ADR rules

An ADR records _when and why_ a decision was made — it is not a description of the current code.

Create or update ADRs when changing: architecture / data flow / synchronization behavior /
timezone handling / monetization logic / public API contracts / analysis methodology.

How to keep ADRs accurate without losing history:

- Do NOT rewrite an ADR's Context / Decision / Alternatives to match the implementation —
  they are a historical snapshot of the reasoning.
- Manage state with the Status field (Draft / Accepted / Deprecated / Superseded).
  - While Draft, editing the body directly is fine.
  - After Accepted, if the decision changes, do NOT rewrite the body. Set Status to
    Superseded / Deprecated and record the new decision in a new ADR (or an appended note)
    so the decision history stays auditable.
- "Current-state" parts of an ADR (e.g. an Implementation Status section) SHOULD be kept in sync.
- If the implementation drifted unintentionally, fix the implementation, not the ADR.

## UI の表記

- **公開ページに絵文字を使わない**（`src/**` に eslint で強制。装飾が要るなら inline SVG か CSS）。
  対象範囲・許可される記号（→ ▲ ✓ ① © 等）・例外は docs/wiki/ux-writing.md が正。
- 装飾目的の SVG には `aria-hidden` / `role="presentation"` を付け、意味は必ずテキストで併記する。

## 進め方

会話 → 仕様の下書き → 確認 → wiki 更新 → 実装 → docs 同期
