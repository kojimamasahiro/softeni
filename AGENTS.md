# AI Collaboration Rules

このファイルはどのエージェントでも読む共通ルール（Codex は直接、Claude Code は CLAUDE.md 経由、
Copilot は .github/copilot-instructions.md 経由）。設計と経緯は docs/adr/ADR-024。

## 読む順

1. このファイル
2. `docs/wiki/index.md` — 全ページを type 別に並べた一覧（各行に説明と適用範囲。`npm run wiki:index` で生成）
3. 選んだページを**全文**
4. 「なぜ」が要るときだけ docs/adr、経緯・証拠が要るときだけ docs/raw

ページの選び方: 意図は index の説明、触るコードは `npm run wiki:for -- <パス>`、語は `grep -rn "<語>" docs/wiki`。
既存の決定・制約と、Deprecated / Draft の記述を確認する。足りない要件を勝手に決めない（下の「要件の確認」）。

## 層と優先順位

This repository's docs/ follows an **LLM Wiki** pattern (Karpathy, 2026-04): raw sources are
**compiled** into interconnected wiki pages that are **written back and accumulated** over time.
wiki の主な読み手はエージェント。人間はレビュー役。

- **docs/raw** = 過程と証拠の記録。**追記のみ**（削除・書き換えは明示的に頼まれたときだけ）。
- **docs/wiki** = compile 済みの**現在の理解**。docs/adr（決定の記録）も wiki 層の一部。
- 優先順位は **コード・data ＞ raw ＞ wiki**。実装済みの挙動を書いたページは**実装が正**（食い違ったら wiki を直す）。
  未実装の仕様は `status: draft` として wiki が先行する。ADR の Context / Decision / Alternatives は歴史の記録なので例外（ADR rules）。
- wiki は**現在の仕様だけ**: 挙動・ルール・閾値・1行の判断＋リンク・棄却済みの事実（再調査を防ぐため1行）。
  日付つきの経緯・実測値・検算は raw へ。更新は「追記（YYYY-MM-DD）」ではなく、**該当の節を書き換える**。
- 各 wiki ページの先頭に frontmatter（`type` / `scope` / `status` / `summary`、任意で `code:`）。値と書き方は
  skill `wiki-compile` の `references/page-types.md`。`code:` はそのページが**定義・決定している対象**だけ。
  `docs/wiki/index.md` は**生成物**なので手で直さない。本文の「適用範囲」の行は任意（`scope` の説明が要る混在ページに書く。あれば `scope` と一致させる）。
- 1ページ1型。事実の所有者は1つ。新しいページは他のページから1本以上リンクする（孤立させない）。
- 1ページ12,000字が目安。圧縮はその1.3倍を超えてから（少しの超過は削らない）。
- 不確かなものは **Assumption**、古くなったものは **Deprecated** と書く（黙って消さない）。
- 未解決の問いは docs/wiki/open-questions.md にだけ書く。日本語で簡潔に書く。
- docs 直下に新しいファイルを作らない。仕様は wiki/、記録は raw/（`YYYY-MM-DD-*.md`）。迷ったら raw に置いてから compile する。
  新しい raw ノートは先頭に `kind`（research / idea / plan / worklist / archive）を書く。書き方は docs/raw/README.md。

## 操作

raw・実装 → wiki は **compile** と呼ぶ（「取り込み」は大会 PDF などを data に入れること）。

| 操作 | 契機 | 入口 | 完了 |
|---|---|---|---|
| Query | 実装・調査の前 | 上の「読む順」 | 所有ページを全文読んだ。足りない・違う箇所はその場で直した |
| Compile | 実装・調査・ブレストの後（実装と同じコミットで／raw が溜まったらまとめて） | skill `wiki-compile` | 所有ページを書き換え、Compile Log を書き、`npm run check:wiki -- --strict` が通り、ADR の要否を判断した |
| Lint | 大きめの実装の後・月次 | skill `wiki-lint`（機械は `npm run check:wiki`） | raw の lint ノート |
| 圧縮 | `check:wiki` の「圧縮」印 | skill `wiki-slim` | 現在の仕様だけになり、全文が raw に退避してある |

- 調査・ブレストの結論や大きめの実装を、チャットの中だけで終わらせない。docs/raw に残し、残す価値のある部分を wiki へ compile する。
  **書き戻すのは実装したセッション**（文脈が残っているうちに）。
- compile したら、**意図して落としたもの**を raw の「Compile Log」に「行き先: 内容」の1行ずつ、理由つきで書く
  （書式は skill `wiki-compile` の `references/compile-log.md`）。
- コードを変えたら、関連する wiki と adr の更新要否を確認する。特に backend、database、Android、課金、分析、score 機能、
  データモデル、公開ページ、デプロイ、取り込みスクリプト。変更したパスで `npm run wiki:for` を引き、
  ファイルを改名・削除したら「本文で言及」に出るページの旧パスを直す。
- PR の本文に「docs 同期」欄（更新したページ・status の変更・ADR・落としたもの）を書く。
- 機械検査 `npm run check:wiki -- --strict`: リンク切れ・SQL 台帳・frontmatter・`code:` の実在・index の鮮度・Compile Log の行き先が
  ゲート（pre-push と CI が見る）。文字数・孤立・ADR の Status 書式・Compile Log の欠落などは CI のサマリに出る報告。

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

## Skills

定型作業の手順は skill にまとめてある。実体は `.claude/skills/<name>/SKILL.md`、
Codex 用の `.agents/skills/<name>` はそこへのシンボリックリンク。wiki の操作は `wiki-compile` / `wiki-lint` / `wiki-slim`。

- skill を足す・消すときは `.claude/skills/` 側だけ触り、`npm run sync:skills` でリンクを張り直す
  （CI は `--check` でずれを検出する）。
- SKILL.md は特定エージェントの道具名（Read / Edit など）に依存しない書き方にする。

## 進め方

会話 → 仕様の下書き（新しい挙動や規則があるときだけ、所有ページを `status: draft` で） → 確認（人が下書きの diff を見る。ADR の要否も決める）
→ 実装（`code:` を更新） → compile（`draft` → `current`・Compile Log・index の再生成） → PR（docs 同期欄）
