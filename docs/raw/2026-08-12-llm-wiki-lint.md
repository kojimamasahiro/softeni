# LLM Wiki lint（リポジトリ全体ヘルスチェック）

実施日: 2026-08-12
対象: `docs/**`（.md 全125ファイル）＋ `AGENTS.md`、突き合わせ先は `src/**` / `lib/**` / `scripts/**` / `docs/sql/**`
種別: 定期ヘルスチェック（矛盾・孤立ページ・知識ギャップ・次に聞くべき問い）
前回の類似実施: `docs/raw/2026-08-01-wiki-audit.md`、`docs/exploration-cycle-audit-2026-08-10.md`

---

## 0. サマリー

- **構造は健全**。リンク切れの実害は1ファイル（絶対 `file:///` パス13件）だけで、修正済み。
  ADR の Status 運用は12本すべて記入済み、`docs/wiki/index.md` のカテゴリ分けも機能している。
- **最大の穴は Compile Log の欠落**。ルール成文化（AGENTS.md、2026-07-11）以降にコミットされた
  raw ノート26本に Compile Log が無く、「検討して除外した」と「まだ読んでいない」が区別できない。
- **索引の到達性は改善余地が大きかった**。`docs/ui/**`（20ファイル）と ADR 5本が
  どの索引からもリンクされておらず、コンパイルパスから実質不可視だった（本 lint で接続）。
- **実装先行のドリフトは1件**。`docs/sql/receive-order.sql` の適用状態が追跡されていない。

---

## 1. 修正済み（自明な機械的問題）

| 対象 | 内容 |
|---|---|
| `docs/tournament-data-structure.md` | `file:///Users/mkojima/...` の絶対パスリンク13件 → 相対パス `../src/types/tournament.ts` に置換（他人の環境・GitHub 上で全滅していた） |
| `docs/adr/README.md` | ADR 一覧表を追加。ADR-001 / 002 / 006 / 008 / 009 はどの索引からもリンクされていなかった |
| `docs/README.md` | 「上記3分類に属さない文書」節を追加。`docs/ui/**`・トップレベル調査文書・`docs/sql/`・`docs/notes/` の所在地インデックスを新設 |
| `docs/wiki/database.md` | `games.initial_receive_player_index` を追記／「`supabase/schema.sql` は未検出」→ `docs/sql/*.sql` の差分DDL運用という現状に更新／Open Question を差し替え |
| `docs/wiki/backend.md` | `DELETE /api/matches/[matchId]/games`（2026-08-11 追加）と `GET /api/tournament-entries` を追記 |
| wiki 5ページ | `lib/growthAnalysis.ts` / `lib/matchAnalysis.ts` はディレクトリ化済み → `lib/growthAnalysis/` / `lib/matchAnalysis/` に表記修正 |

残った「リンク切れ」5件は誤検知（見出しに `players/[id]` と丸括弧の説明を並べた、
Markdown リンク風の地の文）。修正不要。

---

## 2. 矛盾・ドリフト（要判断）

### 2-1. `docs/sql/receive-order.sql` の適用状態が追跡されていない ★実害あり

`docs/raw/2026-08-11-score-input-auto-inference.md` に「**DB migration の適用が必要**」とあるが、
適用したかどうかを記録する場所がリポジトリに無い。未適用なら本番でレシーブ選手の自動推定が
機能しない（`games.initial_receive_player_index` が常に null）。
`docs/sql/` には他に3本（`growth-analysis` / `point-youtube-review` / `video-review`）あり、
同じ問題を抱える。→ `database.md` の Open Questions に起票済み。

### 2-2. 2026-05-24 で止まっている4ページの位置づけ

`backend.md` / `database.md` / `project-overview.md` / `score-analysis.md` は最終更新 2026-05-24。
内容を実装と突き合わせた結果、**列・エンドポイントの記述自体はほぼ正しい**（本 lint での差分は
上表の2件のみ）。ズレているのは自己申告の方で、`database.md` は今も「復元した初期メモ」と
名乗り、`backend.md` の Open Questions 4件は現在 `data-import.md` / `deployment.md` を読めば
答えられるものが混じっている。**内容が古いのではなく、格付けが古い。**

### 2-3. 未コミットの変更が docs と実装にまたがっている

`git status` に `docs/wiki/score-feature.md` を含む12ファイルの変更＋7ファイルの新規追加（うち
raw 4本、`docs/sql/receive-order.sql`、`lib/pointInference.ts`）が未コミットで残っている。
write-back 自体は完了しているが、実装とドキュメントが同一コミットに乗らないと、次回の lint や
`review-docs-drift` が「実装だけ進んだ」と誤検知する。

### 2-4. Idea Backlog 索引の遅れ

`docs/wiki/idea-backlog.md` の score機能行の一言サマリは 2026-08-04 が最新だが、実際には
2026-08-11 に入力UX 4件が実装され `score-feature.md` に反映済み。索引だけが1週間遅れている。
なお raw 側の Compile Log は「単独では粒度が小さいので、次に入力UXをまとめて検討する際に
`2026-07-11-idea-score-recording-semiauto.md` と合流させる」と判断を明記している。
判断としては筋が通っているが、**実装が4本先行した以上、合流を待つ前提はもう成り立たない**。

---

## 3. 孤立ページ

Markdown リンクでの被リンクが0だったのは（修正前）51ファイル。ただし wiki は raw を
バッククォートのパス表記で参照する慣習があるため、ファイル名の言及も含めて数え直すと
**真の孤立は7件**まで減る。

| ファイル | 判定 |
|---|---|
| `docs/notes/2026-07-26-user-interview-sdk.md` | **意図的**。冒頭に「別製品なので索引に載せない」と明記あり。対応不要 |
| `docs/notes/idea-intake-skill-requirements.md` | 要判断。skill 要件定義（559行）。実装先が別環境のため宙に浮いている |
| `docs/raw/st-league-page-structure.md` | 2026-06 の構成案。`wiki/st-league.md` に吸収済みなら Deprecated 明記が要る |
| `docs/raw/st-league-seo-page-candidates.md` | 同上（`st-league-seo-gap-analysis-2026-06.md` は被参照あり） |
| `docs/ui/reports/phase-{2,3,4-8}-report.md` | **実質OK**。`ui/PROJECT.md` が `reports/phase-N-report.md` とパターンで参照している |

**慣習上の論点**: wiki からの raw 参照が「バッククォート表記」と「Markdown リンク」で
混在している。前者は機械的な到達性チェックに引っかからない。どちらかに寄せると
孤立検出の精度が上がる（リンクなら GitHub 上でも辿れる）。

---

## 4. 知識ギャップ

### 4-1. Compile Log 欠落 26件 ★最重要

AGENTS.md が Compile Log を要求し始めたのは 2026-07-11。それ以降にコミットされた raw ノートの
うち26本に Compile Log が無い。直近のアイデア系にも及ぶ:

- `2026-08-08-idea-zenchu-block-tournament-data.md`
- `2026-08-07-idea-player-results-page-hierarchy.md`
- `2026-08-06-idea-match-result-style-commentary.md`
- `2026-08-04-idea-growth-hint-self-vs-population.md`
- `2026-08-01-in-progress-tournament-seo.md` / `2026-08-01-story-text-verification.md` ほか

（2026-08-11 の score-input 4本と `2026-08-08-idea-players-index-redesign.md`、
`2026-08-11-idea-general-category-prefecture-pages.md` は Compile Log あり。運用は最近の分ほど良い。）

これは AGENTS.md 自身が言うとおり「レビュー済みで除外」と「未レビュー」が
どちらも沈黙として見える状態で、将来のコンパイルパスが同じ材料を再走査する原因になる。

### 4-2. CI スクリプト2本が docs で未言及

`scripts/**` 62本のうち、`check-highschool-pipeline-freshness.mjs` と `check-orphan-entries.mjs`
だけが docs のどこにも登場しない。ビルドで何を守っているのかの記録が無い
（他60本は `data-import.md` / `deployment.md` 等でカバー済み）。

### 4-3. 解決済み Open Question の扱いが未定

`wiki/open-questions.md` の「「全国大会」判定の二重基準（2026-07-20 追加 → 同日 解決）」は
解決済みだが節として残っている。解決済み項目を Deprecated 化するか wiki 本体へ移すかの
運用が決まっていないため、ページが「未解決の一覧」として読めなくなりつつある（全251行・17節）。

### 4-4. 中断案件の再開トリガー欠落（監査レポートの指摘が未適用）

`docs/exploration-cycle-audit-2026-08-10.md` §1-7 が「全ての中断案件に再開条件を統一フォーマットで
持たせる」と提言しているが、2日後の現時点で適用されていない。実例:
`docs/ui/**` プロジェクトは「M5 着手可」のまま 2026-07-04 から1ヶ月以上停止、再開条件の記載なし。

---

## 5. 次に聞くべき問い

1. **`docs/sql/receive-order.sql` は本番 Supabase に適用済みか。** 未適用なら自動推定は動いていない。
   適用状態をどう追跡するか（`docs/sql/APPLIED.md` に日付を追記する / migration ツールに寄せる）。
2. **2026-05-24 の4ページを「現行仕様」に昇格させるか。** 内容は概ね正しいので、
   `database.md` の「復元した初期メモ」という自己申告と `backend.md` の解決済み Open Questions を
   落とすだけで昇格できる。それとも `architecture.md` 等へ統合して Deprecated にするか。
3. **Compile Log 欠落26件は遡って埋めるか、打ち切るか。** 埋めるなら記憶が残っている
   2026-08 分（6本）だけでも価値がある。打ち切るなら AGENTS.md に「2026-07-11 以降に作成した
   raw に適用」と明記して、以前の沈黙を「未レビュー」でなく「対象外」と読めるようにする。
4. **入力UX 4件を Idea Backlog にいつ合流させるか。** raw の Compile Log は「次にまとめて検討する時」
   としているが、実装が先に4本走った。索引を先に更新する運用に変えるか。
5. **`docs/ui/**` プロジェクト（M5・トークン導入）の再開トリガーは何か。** 1ヶ月停止しており、
   中断案件の再開条件フォーマット（4-4）の最初の適用先にできる。
6. **この lint 自体を機械化するか。** リンク切れ・孤立ページ・Compile Log 欠落・
   Status 記入漏れは `scripts/check-docs-lint.mjs` として CI に載せられる。そうすれば
   人（と LLM）の判断は「矛盾」と「次に聞くべき問い」に集中できる。

---

## Compile Log

本ノートは lint の実行記録そのもののため、wiki へは以下だけを反映した（1節の表が全量）。

意図的に載せなかったもの:

- lint スクリプト本体（リンク走査・孤立判定の Python） — 使い捨て。機械化する場合は
  5-6 のとおり `scripts/` に実装し直すべきで、ここに貼っても再利用されない。
- 誤検知だったリンク切れ5件の詳細 — 修正不要と判定済み。再走査時に同じ結論になる。
- ADR 12本の Status 全文引用 — `docs/adr/README.md` の一覧表に集約したため重複。
- `src/types/database.ts` と `wiki/database.md` の列単位の突き合わせ結果 — 差分1件を除き
  全一致だったため、記録すべき情報がない（「一致していた」ことは wiki の内容が生きている
  根拠として 2-2 に要約）。
- 未コミット19ファイルのファイル名一覧 — commit すれば消える一時状態。2-3 に要点だけ残す。
