# docs/wiki 精査メモ（2026-06-25）

docs/wiki 全 19 ページを読み、実装（`lib/` `src/` `scripts/` `data/`）と突き合わせた監査結果。
目的: コードとの乖離、低価値・重複ページの整理、分割候補の洗い出し。

## 結論（要約）

- wiki 本体は概ね実装と整合しており、「薄い」より「**重複と偏り**」が主問題。
- 明確な乖離は 1 件（score-site-link §6）→ 修正済み。
- 明確な重複は 1 件（Supabase スキーマの二重記載）→ 統合済み。
- 偏り（1 ページに詰め込み過ぎ）の最大要因は `public-pages.md`（347 行）→ 分割を提案（要承認）。

## 1. コードとの乖離

### 修正済み: score-site-link.md §6（共有ヘルパー統一は未実施）

- ページ冒頭は「実装済み（2026-06）」だが、仕様ドラフト §6「`generateTournamentUrlFromMatch` の二重実装を削除」は**未実施**。
- 実コード: `lib/tournamentHelpers.ts` / `lib/tournamentClientHelpers.ts` が両方残存し、`src/pages/beta/matches-results/index.tsx`・`.../[matchId]/index.tsx` で現役使用中。
- 対応: 「未了」節を追記し、ドラフト §6 がコードと乖離している旨を明記（実装が source of truth）。

### 乖離なしを確認（誤解されやすい記述の裏取り）

- `database.md`「`supabase/schema.sql` 未検出」→ 現在も未存在。記述は正。
- `data-import.md` / `score-site-link.md`「50 件上限・`ensureCleanDir` 撤廃」→ コードに該当定数なし。正。
- `data-model.md` Deprecated「`data/players/*/results.json` 削除済み」→ 実際に 0 件。正。
- `monetization.md`「AffiliateLink はコメントアウト」→ `_app.tsx` で現在もコメントアウト。正。
- 成長記録 `/growth` `/growth/[slug]`、`data/growth-featured.json` 等 → 実在。正。
- `backend.md` Open Question の `functions/` → 現在もリポジトリ内に無し（Open のままで妥当）。

補足: `score-site-link.md`「全 15 試合」「既存 15 試合」は現時点で `public/data/beta-matches/matches/*.json` が 15 件で一致。ただし**件数の直書きは将来ずれる**ため、増えたら「掲載済みの全試合」等に置き換えるのが望ましい（今回は数値が正しいので未変更）。

## 2. 重複

### 修正済み: Supabase スキーマの二重記載（database.md ⟷ data-model.md）

- `data-model.md` の「Supabase の主なテーブル」が `matches`/`games`/`points`/`match_video_sessions`/`match_point_candidates` の全列を `database.md` とほぼ逐語で再掲（約 108 行）。
- 対応: 列・リレーションは `database.md` を唯一の集約先にし、`data-model.md` は要約＋リンクに変更。`data-model.md` は本来の強みである静的 JSON（`data/**`・`public/data/**`）の記述に専念させた。

### 未対応（軽微・要判断）: モード切替ストーリーの三重記述

- `softeni-pick`/`score` の `SITE_MODE` 切替・静的 JSON＋Supabase API という説明が `project-overview.md`・`architecture.md`・`backend.md` で重複。
- それぞれ視点（全体像/構成/バックエンド）が違うので致命的ではないが、`backend.md` の「試合データ API」一覧と `architecture.md`「API 層」はほぼ同内容。将来 API が増えたとき二重更新になる。
- 提案: API エンドポイント一覧は `backend.md` に一本化し、`architecture.md` は要約＋リンクへ。今回は乖離ではないため未編集（承認後に実施可）。

## 3. 低価値・薄いページ

- `android.md`（44 行）: 大半が「このリポジトリでは未確認」。Android 本体が別リポジトリである事実の記録としては価値があるが内容は薄い。削除はせず（AGENTS ルール: 消さずに残す）、現状維持を推奨。`monetization.md` の AdInsight 言及と一部重複するが許容範囲。
- それ以外の wiki ページは情報密度が高く「薄い」とは言えない（むしろ濃すぎる public-pages が問題）。

## 4. 分割候補（要承認）

### public-pages.md（347 行）を分割

1 ページに以下が同居しており、入口（index）からの可読性と更新性が低い:

- サイトモード切替 / canonical・OGP / PageLayout / ナビ再設計（＝公開面の共通基盤）
- 選手まわり（選手 URL 2 系統・選手一覧・選手 SEO・結果ページ noindex 選別）
- 高校カテゴリ（高校ページ方針・全国大会歴代記録ページ）
- 大会ハブ / トップページ SEO / 試合詳細 SEO / SportsEvent JSON-LD / llms.txt

提案する分割:

- `public-pages.md` … 公開面の共通基盤（モード切替・レイアウト・ナビ・canonical/OGP）に縮約
- `players-pages.md`（新規）… 選手 URL 2 系統・選手一覧・選手 SEO・noindex 選別
- 高校は既存トップ `docs/highschool-pages.md`（実装解説）との整理も含め `highschool-pages-wiki` 化を検討（※ docs 直下の `highschool-pages.md` と内容が一部重複）

**注意（結合度が高く、機械的分割は不可）**: `public-pages.md` は外部から多数参照されており、見出しテキストでアンカー参照されている。分割時は下記すべての追従が必要:

- コード内コメント 4 箇所: `scripts/filter-noindex-from-sitemap.mjs` / `lib/navigation.ts` / `lib/sportsEventJsonLd.ts` / `src/pages/beta/matches-results/[matchId]/index.tsx`
- wiki 内リンク: `seo.md`（3 箇所、見出し名指定）・`news-context-blocks.md`・`index.md`
- ADR: `ADR-004`・`ADR-006`（参照リンク。本文 Decision は書き換えない）

このため分割は「実施可否の承認 → リンク追従込みで一括」を推奨。今回は未実施。

## 5. AGENTS.md は LLM Wiki の文脈で docs/wiki を正しく扱えているか

LLM Wiki（Karpathy, 2026-04）の要点＝**raw ソースを LLM が compile して wiki 化し、write-back して蓄積**（RAG の都度取得とは別）。この観点で AGENTS.md / docs/README を評価。

**整合している点（よくできている）**:

- `docs/raw`（未整理ソース）→ `docs/wiki`（compile 済み）→ `docs/adr`（重要判断）の三層は LLM Wiki の compile/accumulate と対応。
- 「`docs/raw` は削除・上書きしない」＝一次ソース保全。compile 元を壊さない LLM Wiki の前提に合致。
- 「実装が source of truth、衝突時は実装優先」＝compile 済み wiki が陳腐化し得る前提を明示。
- 「コード変更時に wiki/adr の更新要否を確認」「Documentation sync」＝write-back ループ。
- 「実装前に関連 wiki/adr を読む」＝蓄積知識の参照を強制。
- `Assumption` / `Deprecated` / `Open Questions` 明示＝compile 物の確信度マーキング。

**弱い点 / 改善余地**:

- 「LLM Wiki」という枠組み自体は明示されておらず、wiki が「**compile された二次成果物**（一次は raw＋実装）」である旨が読み手に伝わりにくい。冒頭に 1 文あると、read 時に「wiki を鵜呑みにせず実装で検証する」姿勢が徹底しやすい。
- write-back の実効性が運用依存。今回の score-site-link §6 のように「ドラフト→実装で計画変更」が wiki に書き戻されない乖離が実際に発生していた。`update-wiki` / `review-docs-drift` プロンプトは存在するので、**定期実行（例: 大きめ実装後に review-docs-drift を必ず回す）**をルール化すると蓄積の鮮度が保てる。
- wiki の相互リンク（interconnection）維持の指示が無い。LLM Wiki は「interconnected pages」が肝なので、「新規ページ追加時は index.md と関連ページから相互リンクを張る」を明文化すると良い（`seo.md` の重複マップ運用がこの良い先行例）。

**結論**: AGENTS.md は LLM Wiki のループ（raw→compile→write-back→蓄積、実装優先）を**実質的に正しく実装できている**。足りないのは「枠組みの明示」と「write-back の定期実行ルール化」「相互リンク維持の明文化」の 3 点。いずれも追記レベルで対応可能（要承認）。

## 今回の編集

- `docs/wiki/score-site-link.md`: §6 乖離の「未了」節を追記。
- `docs/wiki/data-model.md`: Supabase 列の逐語再掲（約 108 行）を `database.md` への集約リンクに置換。
- **`public-pages.md` 分割（347→249 行）**: 参照追従込みで実施。
  - 新規 `docs/wiki/players-pages.md`（選手 URL 2 系統・選手一覧・選手 SEO・noindex 選別）。
  - 新規 `docs/wiki/highschool.md`（高校カテゴリ方針・全国大会歴代記録ページ）。
  - 参照追従: `index.md`（2 ページ追加）、`seo.md`（3 リンク）、`news-context-blocks.md`（1 リンク）、
    コード `scripts/filter-noindex-from-sitemap.mjs` の仕様コメント。
  - 据え置き（移動なし＝コメント有効）: `lib/navigation.ts`（ナビ）、`lib/sportsEventJsonLd.ts`（SportsEvent）、
    `src/pages/beta/matches-results/[matchId]/index.tsx`（試合詳細 SEO）は public-pages に残した節を指す。
  - 検証: wiki 内リンク切れ 0、移動済み節への旧リンク残存 0 を確認。

未実施（承認待ち）: モード切替ストーリーの重複圧縮、AGENTS.md への LLM Wiki 文脈 3 点追記。
