# docs の層を整理する（2026-09-19）

## きっかけ

ユーザーの依頼:「LLM Wiki的に今のdocsの構成は問題ないか確認してほしい」→ 点検して報告 →
「CI登録とは？」→ 説明 →「入れて含めて」「『3層』と言いながら、実際には4層目があるのは修正不要か」→
「やって。highschool-pages.md は wiki に統合、venue-input-worksheet.md は入力は終わっていない」。

## 点検して分かったこと（2026-09-19 時点）

- **予算が守られていない。** 2026-09-18 に全ページを12,000字以内へ圧縮したのに、翌日には3ページが超過
  （data-import 15,257 / data-model 14,170 / public-pages 13,508）。増えたのは団体戦オーダーの取り込みが
  進んだ**正当な仕様**で、日付つき追記の積み増しではない。**普通に仕事が進めばページは育つ**。
  原因は `scripts/check-wiki-size.mjs` が CI にも package.json にも入っていなかったこと。
- **「3層」と言いながら docs 直下に11本あった**（性格は仕様・調査・提案・監査・作業表が混在）。
  うち5本は wiki からリンクも言及もされておらず、compile 済みの入口から辿れない状態。
  `tournament-data-structure.md`（17,465字）は `data-model.md` から**バッククォート表記**で参照されていて、
  実質 wiki なのに**字数予算の外**にいた（抜け道）。
- 適用範囲の行は 13/38 ページ、index 以外から参照されていない wiki が3ページ（android / architecture / project-overview）、
  Compile Log 欠落34本（うち10本は 2026-09-18 に作った wiki アーカイブ）、ADR の Status が自由文で機械判定できない。
- 健全な点: raw は追記のみが守られている。リンク切れは docs 全体で4件だけだった。

## やったこと

### 1. 検査を CI に登録し、対象を docs 全体へ（PR #154）

- `npm run check:wiki` を追加。`checks.yml` に**ゲート**（`--strict`＝リンク切れで赤）と
  **報告のみ**（文字数をサマリに出す）の2ステップ。既存の分け方（ゲート / 報告）に合わせた。
- リンク切れの対象を wiki+prompts から **docs 全体（278ファイル）** へ拡大。文字数は wiki＋docs直下＋docs/ui。
- 先行してリンク切れ4件を修正。うち1件は**前日の圧縮で見出しを変えて ADR-005 からの参照を壊していた**もので、
  この検査で初めて見つかった。残り3件は `### players/[id]` に続く丸括弧が Markdown のリンクと解釈されていたもの。

### 2. docs 直下の11本を仕分け（本ノート）

| 元 | 先 | 理由 |
|---|---|---|
| `tournament-data-structure.md` | `wiki/tournament-data-structure.md`（17,465→9,6xx字に圧縮） | 現在の仕様のリファレンス。全文は [アーカイブ](./2026-09-19-wiki-archive-tournament-data-structure.md) |
| `beta-matches-results.md` | `wiki/beta-matches-results.md` | 公開面の仕様。内容は当時のまま（実装との照合は未実施） |
| `tournament_bracket_logic.md` | `wiki/tournament-bracket-logic.md` | `buildBracket` は現役。`lib/bracketLayout.ts`（席順の復元）とは別物である旨を冒頭に足した |
| `highschool-pages.md` | `wiki/highschool.md` へ統合 | **実装より古く、現行7ページ中4ページしか書かれていなかった**。現行に合う表だけ残し、全文は [アーカイブ](./2025-12-13-highschool-pages.md) |
| `adsense-ui-proposal.md` | `raw/2026-06-12-*` | 提案（実装済みで Superseded） |
| `cloudflare-migration-analysis.md` | `raw/2025-11-30-*` | 調査 |
| `team-id-underscore-bug.md` | `raw/2026-07-09-*` | 調査 |
| `tournament_requirements.md` | `raw/2026-02-27-*` | 初期の要件整理 |
| `exploration-cycle-audit-2026-08-10.md` | `raw/2026-08-10-*` | 監査ノート |
| `venue-input-worksheet.md` | **そのまま** | 入力が終わっていない作業表。字数検査からは `WORK_FILES` で除外 |
| `README.md` | そのまま | 運用ガイド |

- `docs/README.md` を「docs の中身」として書き直し、**docs 直下には README と進行中の作業表だけ**を置くと定義した。
- 移動にともない参照を張り替えた。**raw 6本はパス文字列だけを直し、本文には触っていない**（追記のみの規約）。

## 事故と対処（記録）

参照の張り替えスクリプトが `.claude/worktrees/` 配下まで歩いてしまい、**他セッションの作業コピー5つ・
125ファイルを書き換えた**。さらに戻すときの逆置換が雑で、`docs/wiki/highschool.md` への正当な参照まで
`docs/highschool-pages.md` に書き換えてしまった。

- 各 worktree で「HEAD に私の変換を当てた結果 == 現在の内容」なら私の変更のみ、と判定して 27 ファイルを特定し、
  `git checkout --` で復元した。**相手の作業と混ざったファイルは0件**で、他セッションの未コミット作業は無傷。
- 教訓: **リポジトリを歩くスクリプトは `.claude/worktrees` を必ず除外する**（`node_modules` / `.git` と同列に扱う）。
  一括置換の前に対象一覧を出して数を確認する。

## Compile Log

- → `docs/README.md`（層の定義）、`docs/wiki/index.md`（新規3ページ）、`docs/wiki/tournament-data-structure.md`（新規・圧縮）、
  `docs/wiki/highschool.md`（ページ構成の表を統合）、`scripts/check-wiki-size.mjs`（作業表の除外）。
  - 反映しなかったもの:
    - 点検で見つかった残件（適用範囲 13/38・孤立3ページ・Compile Log 欠落34本・ADR Status の書式）→
      今回の作業と別件なので `open-questions.md` に項目として残す。
    - worktree の事故の詳細な経緯 → このノートの「事故と対処」に留め、wiki には出さない（運用の失敗談で仕様ではない）。
    - 移動した各ファイルの中身の要約 → ファイル自体が残っているので重複。
