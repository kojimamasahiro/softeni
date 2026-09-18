# 利益を増やす案の洗い出しと、wiki の圧縮（2026-09-18）

## きっかけ

ユーザーの依頼: 「なんでもいいから利益を増やす方法を考えて」。続けて
「固定費はこのclaudeの費用が一番高くほとんどを占めている」「他に今までなかった別の角度からのアイデアはない？」。
最終的に「A-1はやって欲しい」「B-2に関しても進めたい」「まずはA-1に合わせて他に適用しやすい形にしてほしい」。

## 出した案（会話での一覧）

収益 = ページビュー × 1ページあたりの収益 ＋ 広告以外の収入、の3方向で考えた。

1回目（既存の延長）:

| # | 案 | 評価 |
|---|---|---|
| 1 | 団体戦のオーダーなど「誰も答えていない需要」でページビューを増やす | 最優先。別の会話で着手済み（[2026-09-18-idea-team-match-order.md](./2026-09-18-idea-team-match-order.md)） |
| 2 | メーカー・地域企業への広告枠の直販（大会期間の協賛） | 利益率は最も高い。営業が要る |
| 3 | 用品アフィリエイトの再開 | 中。中高生は自分で買わないので成約率は低めと推定 |
| 4 | 過去の大会結果のデータ提供 | まずは掲載してページビューに変えるのが先 |
| 5 | score 機能の有料化 | 既存案。競合は月300円程度で支払意欲が低い |

2回目（別の角度。固有費の大半が Claude と分かった後）:

| # | 案 | 評価 |
|---|---|---|
| A-1 | **wiki を圧縮して毎回の読み込みコストを下げる** | **実施（本ノート）** |
| A-2 | 決まった手順の skill を安いモデルで動かす（今は5つの skill すべてでモデル未指定） | 未着手 |
| A-3 | 契約形態（API 従量か定額か）の確認 | 未確認 |
| B-1 | 「AI でスポーツデータサイトを運営する」ノウハウを開発者向けに売る | 未着手 |
| B-2 | **同じ仕組みを他競技へ広げる** | **起票**（[2026-09-18-idea-multi-sport-expansion.md](./2026-09-18-idea-multi-sport-expansion.md)） |
| B-3 | 大会主催者に「PDF を送れば結果ページができる」を提供する | 未着手 |
| B-4 | 応援・寄付の窓口 | 未着手 |
| B-5 | 戦績カードの受注生産（本人・保護者の注文に限る。ADR-004 と関わる） | 未着手 |

## 判明したこと

- `docs/wiki` は合計 **約49万字**（36ページ）。会話中に「約95万字」と言ったのはバイト数で、誤り。
- 予算 12,000字を超えるページが10個: data-import 68,361 / team-player-identity 41,198 / public-pages 38,142 /
  open-questions 34,780 / players-pages 34,127 / news-context-blocks 32,312 / data-model 17,110 /
  monetization 15,006 / secondaryschool 13,775 / upcoming-tournaments-runbook 13,749（seo 39,029 は圧縮済み）。
- 太った原因は「追記（YYYY-MM-DD）」の段落を足し続けたこと。Idea Backlog 索引で起きたこと
  （[2026-09-17-idea-backlog-index-cleanup.md](./2026-09-17-idea-backlog-index-cleanup.md)）と同じ型が、ページ本文でも起きていた。
- AGENTS.md の「コードを書く前に関連 wiki を読む」により、ページの長さはそのまま毎回のコストになる。

## やったこと

- **手順書** [docs/prompts/slim-wiki-page.md](../prompts/slim-wiki-page.md): 残すもの/移すもの、ページの形、適用範囲の決め方。
- **レポート** `scripts/check-wiki-size.mjs`: ページごとの文字数、冒頭の適用範囲の有無、wiki・prompts 発のリンク切れ（ファイルと見出し）。
  壊したリンクを置いて検出できることを確認した。`package.json` への登録は見送った（下記）。
- **試験的に seo.md を圧縮**: 39,029字 → 9,245字（−76%）。全文は [2026-09-18-wiki-archive-seo.md](./2026-09-18-wiki-archive-seo.md)。
  - 中学カテゴリの状態「実装済／未公開」（2026-08-12 の記述）は、実装で noindex が無く他ページからリンクされていることを確認し「対策済」にした。
  - `TWO_LABEL_MAX = 26` が残っていることを確認し、選手ページの title 問題は「未修正」のまま。
  - raw から見出しアンカーで張られている2つの見出し（「大会名の表記と検索語の乖離…」「計測の原則…」）は、raw を書き換えないため文字列を変えずに残した。
- **wiki の入口 index.md に適用範囲の印**（汎用 / 学校 / 固有 / 混在）を35ページに付けた。ページ冒頭だけを見た初回判定。
- **AGENTS.md**: 1ページ12,000字の予算、wiki は現在の仕様だけ、日付つき追記をしない、適用範囲の行、を追加。

## 進め方の判断

- **別の会話が同じ作業ツリーで wiki を編集中だった**（data-import / data-model / deployment / idea-backlog /
  open-questions / public-pages / score-general-availability / team-player-identity と ADR-020）。
  衝突を避けるため、`origin/main` から別の worktree（ブランチ `wiki-slim-2026-09-18`）で作業し、
  圧縮の試験対象は編集中でない `seo.md` にした。
- 同じ理由で `package.json` は触らず、レポートは `node scripts/check-wiki-size.mjs` で直接実行する。
- 残りの9ページは1ページずつ別コミットで進める。編集中のページは、その作業が main に入ってから。

## 残り

- 予算超過9ページの圧縮（上の一覧。data-import が最大の効果）
- 各ページの適用範囲の確定（圧縮時に本文を読んで冒頭へ書く）
- A-2（skill のモデル指定）、A-3（契約形態の確認）

## Compile Log

- 2026-09-18 → docs/wiki/seo.md（圧縮）、docs/wiki/index.md（適用範囲の印）、docs/wiki/open-questions.md（Idea Backlog に1行）、
  docs/wiki/monetization.md と docs/wiki/idea-backlog.md（B-2 の行）、AGENTS.md（予算と規則）、docs/prompts/（手順書）。
  - 反映しなかったもの:
    - 1回目の案 2〜5 と、2回目の B-1・B-3〜B-5: ユーザーがまだ選んでいない。wiki に行を作ると「検討中」に見えるため、このノートにだけ残す。
    - A-2・A-3: 未着手で、手順も決まっていない。
    - 予算超過ページの文字数一覧: スクリプトで毎回出せるので wiki には書かない。
    - 「約95万字」の誤り: 会話内の誤りで、wiki に残す意味がない（このノートの「判明したこと」にだけ記録）。

---

## 完了（2026-09-18）

**予算超過ページは0になった。** docs/wiki は **471,677字 → 270,965字（−43%）**、36 → 38ページ。
確認は `node scripts/check-wiki-size.mjs`（リンク切れ0件）。

| ページ | 前 | 後 | 備考 |
|---|---:|---:|---|
| seo.md | 39,029 | 9,245 | 最初の試験台 |
| secondaryschool.md | 13,775 | 7,194 | |
| upcoming-tournaments-runbook.md | 14,774 | 5,383 | 完了項目を進捗表1行ずつに |
| monetization.md | 15,494 | 8,083 | 実装と照合し AffiliateLink の記述を訂正 |
| data-model.md | 18,471 | 11,891 | |
| news-context-blocks.md | 32,312 | 11,572 | |
| players-pages.md | 34,231 | 12,009→11,992 | |
| open-questions.md | 35,593 | 9,865 | 「解決済み（記録）」節ごとアーカイブへ |
| public-pages.md | 38,868 | 11,792 | OGP を sns-day1-images へ、SportsEvent を seo へ移設 |
| team-player-identity.md | 41,380 | 11,832 ＋ player-name-identity.md 4,635 | 分割 |
| data-import.md | 71,026 | 9,169 ＋ pdf-import.md 9,403 | 分割 |
| AGENTS.md | 5,900 | 3,239 | 重複を畳み、細部を ux-writing / update-wiki へ移設 |

### 圧縮のついでに直したもの

- **monetization.md**: 「AffiliateLink は実装ありコメントアウト」→ 実際は 2026-07-04 に削除済み（実装で確認）。
- **secondaryschool.md**: 中学カテゴリの状況「実装済／未公開」→ 公開済み（noindex なし・他ページからリンクあり）。
- **public-pages.md**: `highschool.md` からのアンカーリンクが切れないよう、パンくずの見出し文字列を維持した。

### 置き場所を動かしたもの（内容は捨てていない）

- 年度別結果ページの OGP 画像の生成仕様 → `sns-day1-images.md`（tools/sns-images のページ）
- `SportsEvent` の項目規約 → `seo.md`「構造化データの決めごと」
- 絵文字ルールの詳細 → `ux-writing.md` §3 / Compile Log の適用範囲 → `docs/prompts/update-wiki.md`
- 姓名の分割ゆれ・改名・同姓同名・pid 重複 → `player-name-identity.md`（新規）
- PDF の読み取りと検算 → `pdf-import.md`（新規）

### やってみて分かったこと

- **1ページ12,000字は「1トピック1ページ」の圧力になる。** 収まらないページ（team-player-identity・data-import）は
  実際に2つの話題が同居していた。字数制限は分割の合図として機能する。
- **圧縮は実装との照合を強制する。** 「未公開」「実装あり」のような状態を1行に畳もうとすると確認が要り、
  その過程で3件の古い記述が見つかった。review-docs-drift とは別の経路でドリフトが落ちる。
- **アンカーリンクは raw からも張られている。** raw は追記のみなので、参照されている見出しは文字列を変えられない。

## Compile Log（2026-09-18 追記2）

- → 各 wiki ページ（本文の圧縮）、`docs/wiki/index.md`（新規2ページの追加）、
  `docs/wiki/open-questions.md`・`docs/wiki/idea-backlog.md`（状況の更新）。
  - 反映しなかったもの: ページごとの前後の文字数（このノートの表が正。wiki に置くと次の更新で古くなる）、
    圧縮中に読んだが現状の仕様ではない記述（各ページの `2026-09-18-wiki-archive-*.md` が正）、
    「どの節をどう畳んだか」の逐一（差分を読めば足りる）。
