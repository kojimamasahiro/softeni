# docs/wiki 精査メモ（2026-08-01・2026-06-25以降分）

前回監査 `docs/raw/2026-06-25-wiki-audit.md`（wiki 全19ページ）の続き。今回は
2026-06-25〜2026-08-01の約5週間で活発に更新された9ページ（highschool / st-league /
news-context-blocks / rare-events / sns-story-platform / sns-day1-images /
tournaments-local / data-import / highschool-seo-m4-verification）と、
グローバル `open-questions.md` を対象にした差分監査。リポジトリ掃除（tools/tournament系の
アーカイブ、ルート直下の迷子ファイル整理）と同じセッションで実施。

## 結論（要約）

- 対象9ページのうち7ページ（highschool / st-league / news-context-blocks / rare-events /
  sns-story-platform / tournaments-local / highschool-seo-m4-verification）は高頻度に
  write-back されており実装と整合。特に highschool.md・news-context-blocks.md は
  当日（2026-08-01）付の更新まで反映済みで、write-backループが機能していることを確認。
- 明確なコードとの乖離が1件: `data-import.md` の「不戦勝どうしの対戦も1回戦入力後には
  通常どおり収束する」という記述が、実際には2026-08-01まで存在したバグの前提と食い違っていた
  → **修正済み**。
- `tools/tournament` / `tools/tournament2` への言及が、同セッションでの `tools/_archived/`
  移動を反映していなかった → **修正済み**。
- グローバル `docs/wiki/open-questions.md` の STリーグ節が、同じ内容を扱う
  `st-league.md` 側の「Open Questions / 未入力データ」節（正しく更新されている）から
  取り残されて陳腐化していた → **修正済み**（2件）。
- 純粋な write-back gap（docs/raw にあるが wiki のどこからも参照されていない）を2件検出
  → **修正済み**。

## 1. コードとの乖離

### 修正済み: `data-import.md`「ドロー入力（結果を入れる前）の扱い」

- 該当記述（旧）: 「1 回戦の結果を入れれば通常どおり 2 回戦以降が現れるので、最終的なデータは
  同じに収束する。」
- 実際: `docs/raw/2026-08-01-bug-bye-derived-matches-not-exported.md` の通り、
  `byeAdvanceToggle` の判定が `match.byeDerived` のみを見て勝者の有無を見ておらず、
  `extra`（足長）同士の対戦は勝者を入力しても永久にエクスポートされないバグが
  2026-08-01まで存在した（インターハイ2026女子ダブルスで70試合・70エントリーが欠落。
  下流の大会インサイト記事が誤った断定をして取り下げになる実害あり）。
  `shouldSkipByeDerived()` への統合で修正済み（`tools/tournament3`）。
- 対応: バグの経緯・修正・raw note へのリンクを追記。

### 修正済み: `data-import.md` の `tools/tournament` / `tools/tournament2` パス言及

- 記述内容自体（「共有パイプラインを経由しない旧ツール」）は妥当だったが、同セッションで
  両ツールと `tools/tournament4` を `tools/_archived/` へ移動したため、パスが古いままだった。
- 対応: 移動を反映する1文を追記。

### 修正済み: `docs/wiki/open-questions.md` のSTリーグ節（st-league.md との不整合）

- `st-league.md` 側「Open Questions / 未入力データ」節は2025（第3回）STリーグⅡ（女子）の
  入力状況・2023/2024データの実在を正しく反映していたが、グローバル `open-questions.md` は
  「STリーグⅡ（女子）の出場チーム・対戦データが未入力」「第1回（2023）・第2回（2024）の
  詳細データが未入力」という**事実と異なる**（実際は `hasMatchData: true`、
  `participants.json`/`matches.json` とも実在を確認済み）記述のまま残っていた。
- 対応: `st-league.md` の記述に合わせて修正。

### 乖離なしを確認（裏取り済み）

- `highschool.md`: 開催中大会表示・卒業生セクション・ランキング・地区大会の記述は
  raw note / git log と整合。
- `st-league.md`: `data/st-league/2025/league.json` の `divisions[].hasMatchData`
  （Ⅰ・Ⅱ: true、Ⅲ: false）を実データで確認、記述と一致。
- `news-context-blocks.md`: 団体戦対応・地区大会連携・世代フィルタ等、
  2026-07-26〜07-31の変更を細かく追跡済み。
- `rare-events.md`: scope変更（2026-07-12）・記録一覧ページまで反映。
- `sns-story-platform.md`: ADR-012・`scripts/verify-story-text.mjs`・`docs/story-yaml/`
  の実在ファイルと整合。
- `tournaments-local.md`: ブロック大会（2026-07-22）を正しく反映。venues追加は
  `data-model.md`「大会の会場データ」節に正しく集約されており二重記載なし。

## 2. 重複

- 重大な重複は検出されなかった。`sns-day1-images.md`（1日目SNS画像）と
  `sns-story-platform.md`（事実ベースストーリー生成基盤）は対象データが同じだが
  役割が明確に分離されており重複ではない。

## 3. 低価値・薄いページ

- 該当なし。

## 4. 分割候補

- 新規の分割候補なし。`news-context-blocks.md` は前回監査後さらに大幅増量しているが、
  内部見出しで整理されており致命的ではない。`sns-story-platform.md` の「5分類ストーリー」の
  表セルが非常に長大（1セルに設計議論の全経緯が入っている）で可読性が落ちているが、
  経緯の記録としての価値もあるため今回は現状維持とし、将来の分割候補として記録するに留める
  （要承認）。

## 5. 純粋な write-back gap（修正済み）

- `docs/raw/2026-08-01-bug-bye-derived-matches-not-exported.md` → `data-import.md` に反映（上記1参照）。
- `docs/raw/2026-08-01-sns-post-drafts-highschool-championship-2025.md`（zennihon版のみ
  `sns-story-platform.md` から参照され、highschool版が漏れていた）→ リンク追加。
- （軽微）`tools/sns-images/tournament_og.py` / `news_og.py` が `sns-day1-images.md`
  「関連」節に列挙されていなかった → 追記。

## 6. 相互リンク（index.md）の欠落

- `docs/wiki/st-league.md` が `index.md` に一件も掲載されていなかった（`seo.md` や
  `open-questions.md` からは参照されているため孤立ページではないが、Wiki Index経由では
  たどれない状態だった）。AGENTS.mdの「新規ページ追加時はindex.mdに追加」ルールに反する。
- ついでにページ数（27）が増えて `index.md` がカテゴリなしの単純列挙になっていたため、
  6カテゴリ（全体像・基盤 / Score機能 / 公開ページ / コンテンツ生成・ストーリー /
  データ運用 / 運用・その他）に再編成し、`st-league.md` を「公開ページ」に追加。

## 今回の編集

- `docs/wiki/index.md`: カテゴリ別に再編成、`st-league.md` を追加。
- `docs/wiki/data-import.md`: bye-derivedバグの経緯・修正を追記、`tools/tournament`系の
  アーカイブ移動を反映。
- `docs/wiki/open-questions.md`: STリーグ節を `st-league.md` の正しい記述に合わせて修正
  （STリーグⅡ2025年度は入力済み、2023/2024データは実在）。
- `docs/wiki/sns-story-platform.md`: highschool版投稿案へのリンクを追加。
- `docs/wiki/sns-day1-images.md`: `tournament_og.py` / `news_og.py` を関連ツールに追記。

未実施（要承認）: `sns-story-platform.md` の5分類ストーリー表セルの分割。

## Compile Log

- 対象9ページ中7ページ（highschool.md, st-league.md本文, news-context-blocks.md,
  rare-events.md, sns-story-platform.md本文, tournaments-local.md,
  highschool-seo-m4-verification.md）はレビューの上、乖離なしと判断し変更せず（理由:
  実装・raw note と逐一突き合わせて一致を確認済み）。
- `docs/raw/2026-07-19-manual-fix-checklist.md` はレビューしたが未リンクのまま維持（理由:
  `data-import.md` の `check:entries` 節が一般化して内容を吸収済みのため、個別リンクは
  冗長と判断）。
- `docs/raw/2026-07-19-result-coverage-notice-design.md` はレビューしたが未リンクのまま維持
  （理由: raw note内のCompile Logに「ADR-007が唯一の関連ドキュメント」と明記済みで、
  ADR-007側の反映を確認したため対応不要）。
- `sns-story-platform.md` の表セル分割は提案のみに留め、実施せず（理由: 実施には
  リンク追従が伴うため承認後に一括実施するのが安全。前回監査の `public-pages.md` 分割と
  同じ方針）。
