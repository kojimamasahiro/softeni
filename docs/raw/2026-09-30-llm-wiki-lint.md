# LLM Wiki lint（リポジトリ全体ヘルスチェック）

実施日: 2026-09-30
対象: `docs/wiki/**`（42ページ）・`docs/raw/**`（2026-09-02 以降の新規）・`docs/sql/APPLIED.md`、
突き合わせ先は `src/types/database.ts` / `scripts/generate-beta-matches-json.mjs` / 2026-09-20 以降のコミット
前回の実施: [2026-09-02-llm-wiki-lint.md](./2026-09-02-llm-wiki-lint.md)（28日前）

---

## 0. サマリー

- **機械チェックはほぼ緑**（`npm run check:wiki`）。リンク切れ0・適用範囲の行の欠落0・孤立 wiki 0・
  ADR Status 書式0・Compile Log 欠落0。予算超過は `public-pages.md` の1ページ（12,529字 / 12,000字）だけ。
  前回の宿題だった「lint の機械化」は 2026-09-19 に `check:wiki` として実装済みで、効いている。
- **write-back は定着している**。2026-09-20 以降の実装コミットはほぼすべて同じコミットで wiki / raw を更新している。
- **抜けたのは「台帳」と「列の一覧」**。直近の `point-pick.sql`（2026-09-29）が
  `docs/sql/APPLIED.md` に載っておらず、`database.md` の `points` 列にも無かった。
  機能の説明（`score-feature.md`）は書かれていたので、**書き戻し先が複数あるときに主ページ以外が漏れる**型。
- **Open Question の滞留が4件**。すでに解けているのに「未解決」として残っていた。

---

## 1. 修正済み（本 lint で直したもの）

| 対象 | 内容 |
|---|---|
| `docs/sql/APPLIED.md` | `point-pick.sql` の行を追加（本番適用日は未確認）。「SQL を追加したら同じコミットで行を足す」のルール違反 |
| `docs/wiki/database.md` | `points.is_pick` / `pick_note` を追加（公開 JSON から除外される旨も）。突き合わせ日を 2026-09-30 に。Open Questions の「状態遷移」「result_type の enum」を確定済みとして整理 |
| `docs/wiki/data-model.md` | Open Questions の同じ2件を確定済みとして整理（`database.md` と重複していた） |
| `docs/wiki/open-questions.md` | 「ドキュメント運用」から解決済み2件を外した（下の §3）。適用未確認の SQL に `point-pick.sql` を追加 |
| `docs/wiki/public-pages.md` | 孤立していた `2026-09-23-hub-latest-results-chips.md` への出典リンクを戻した |

## 2. 機械チェックの結果

| 項目 | 結果 |
|---|---|
| wiki ページ数・総字数 | 42ページ・306,736字（前回 32ページ） |
| 予算超過（12,000字） | 1ページ（`public-pages.md` 12,529字）。1万1千字台が5ページ（`data-model` / `st-league` / `players-pages` / `team-player-identity` / `seo`） |
| リンク切れ | 0件 |
| 適用範囲の行 / 孤立 wiki / ADR Status / Compile Log | すべて0件 |
| `src/types/database.ts` と `database.md` の列 | `points.is_pick` / `pick_note` の1件だけ差分（修正済み） |

## 3. 滞留していた Open Question（解けていた）

| 項目 | 判定根拠 |
|---|---|
| Compile Log の運用（作業リスト型に求めるか） | 2026-09-19 に `docs/prompts/update-wiki.md` へ免除条件を明文化し、`check:wiki` が同じ条件で判定している |
| 2026-05-24 の4ページを「現行仕様」へ昇格させるか | `backend` / `database` / `project-overview` / `score-analysis` の4ページとも冒頭がすでに「現行仕様。2026-08-12 に突き合わせ済み」 |
| `matches.status` / `processing_status` の状態遷移（`database.md` / `data-model.md`） | 2026-09-02 lint の追記で書き込み箇所から確定済み。問いは「死んだ値を落とすか」に形を変えて `open-questions.md` に移っていた |
| `result_type` の正式な語彙（同上） | 同上。残る問いは「3箇所の重複定義」 |

**型**: `open-questions.md` 本体は解決時に更新されても、**個別ページ末尾の Open Questions が取り残される**。
同じ問いが複数ページに書かれているときに起きる。

## 4. 孤立・出典リンク

2026-09-02 以降の raw で、wiki / ADR から一度も参照されていないのは Compile Log 付きのもので21本。
ほとんどは PDF 取り込みの作業記録（`*-results-from-pdf` / `*-entries-import`）で、他の raw やスキルからは
参照されている。**どこからも参照されていない真の孤立は1本**（`2026-09-23-hub-latest-results-chips.md`）で、
Compile Log は「public-pages へコンパイルした」と書いているのに wiki 側に戻りリンクが無かった。
前回 lint §4 と同じ「片道の write-back」型。

## 5. 次に聞くべき問い

1. **`receive-order.sql` と `point-pick.sql` は本番 Supabase に適用済みか。** `receive-order` は前々回から持ち越し。
2. **`public-pages.md` を圧縮するか。** 超過は529字で、`slim-wiki-page.md` の手順で足りる。
   1万1千字台の5ページも近く超える。
3. **SQL を足すときのチェックリストを機械化するか。** `docs/sql/*.sql` のファイル名が `APPLIED.md` に
   全部載っているかは `check:wiki` で見られる（今回の漏れはこれで防げた）。
4. **個別ページ末尾の Open Questions を `open-questions.md` に一本化するか。** 同じ問いが2か所にあると
   片方が取り残される（§3）。個別ページには「open-questions.md の該当節」へのリンクだけ置く案。
5. wiki → raw の参照がバッククォート表記で残っている箇所（`open-questions.md` の既存項目）は今回未確認。

---

## 追記: §5 の問いへの対応（同日・ユーザー判断で実施）

### 5-1. SQL の本番適用 → 5本とも適用済み

本番 Supabase の REST に anon キーで**列だけを select** して確かめた。RLS で行は返らない（`[]`）が、
列が無ければ 400（`42703`）、あれば 200 になる。対照に存在しない列名 `zz_no_such_column` を投げて 400 が返ることも確認。

| SQL | 確認した列・テーブル | 結果 |
|---|---|---|
| growth-analysis | `matches.match_date` ほか7列 | 200 |
| video-review | `match_video_sessions` / `match_point_candidates` | 200 |
| point-youtube-review | `matches.youtube_*` 3列 / `points.video_start_ms` / `video_end_ms` | 200 |
| receive-order | `games.initial_receive_player_index` | 200 |
| point-pick | `points.is_pick` / `pick_note` | 200 |

`APPLIED.md` を「適用済み（日付不明）」に更新し、確認方法を同ページに書いた。
`receive-order.sql` の「未確認」は 2026-08-12 lint から持ち越していた問いで、これで閉じた。

### 5-2. `public-pages.md` の圧縮 → 12,529字 → 11,991字

全文を [2026-09-30-wiki-archive-public-pages.md](./2026-09-30-wiki-archive-public-pages.md) に退避。落としたものは下の Compile Log。

### 5-3. SQL 台帳の漏れ → ゲート化

`scripts/check-wiki-size.mjs` に「`docs/sql/*.sql` がすべて `APPLIED.md` にリンクされているか」を追加し、
`--strict` で終了コード1にした。CI（`checks.yml`「docs のリンク切れ・SQL 台帳」）で赤になる。
ダミーの `zz-test.sql` を置いて終了コード1、消して0になることを確認。

### 5-4. Open Questions の一本化

wiki 18ページ（`open-questions.md` 以外）の `## Open Questions` 節を、`open-questions.md` の該当節へのリンク1行に置き換えた。
新設した節は「収益化・計測」「ビルド・デプロイ」。既存の節に足したのは seo の効果測定7件・rare-events 8件・
news-context-blocks 3件・sns-story-platform の残り・STリーグの未入力データ・RLS・公開用 matchId。

移す途中で**解けていた／重複していた**ものは落とした:

| ページ | 項目 | 判定 |
|---|---|---|
| architecture / deployment | 本番で API Routes をどこまで使うか | 本番は `output: 'export'`（`next.config.mjs`）で使っていない。`backend.md` 本文に既述 |
| score-feature | `edit_token` の正式な利用箇所 | `src/**` / `lib/**` に0件。残る問いは「列をいつ落とすか」で既に集約済み |
| score-site-link | 逆引き表は全選手1ファイルで足りるか | 2026-09-02 lint で「足りている」と確認済み |
| score-general-availability | 差別化の核 | 2026-08-03 に決着（取り消し線のまま残っていた） |
| backend / project-overview / score-analysis / data-import / data-model / database | 各1〜3件 | `open-questions.md` に同じ問いがすでにあった（重複） |

`sns-story-platform.md` の OQ 節には**決定事項（2026-08-01、5分類ストーリーの範囲）が「→ 決着」として埋まっていた**ので、
本文に「決着済み」節を作って移した。うち「出力先は SNS のみ、サイトには載せない」は、その後
ADR-012 で年度別結果ページにも出すことになっていたので、その旨を併記した。

集約で `open-questions.md` が 12,816字に膨らんだので、同じページ内で言い回しを詰めて 11,999字に戻した。
落としたのは「なお〜はゲートに入っている」「prebuild が自動で再計算する」のような**仕様側に既にある補足**と、
経緯の日付（「2022〜2026 は投入済み」）。「同姓同名は当面融合を許容」は決定なので `players-pages.md`（既述）へのリンクにし、
問いは「人物別 id の払い出し」だけ残した。STリーグⅢ部の「対戦データを持たない方針」も問いではないので外した（`st-league.md` 本文に既述）。

---

## Compile Log

本ノートは lint の実行記録。§1 の表が wiki / `docs/sql` へ反映した全量。

意図的に載せなかったもの:

- 走査に使ったスクリプト（raw ごとの Compile Log 有無と被参照数の集計）— 使い捨て。§5-3 を採るなら `check:wiki` に入れ直す。
- wiki から参照されていない取り込み記録21本のファイル名一覧 — 他の raw・スキルから辿れ、wiki に載せる仕様を持たないため。
- 2026-09-20 以降のコミットと wiki 更新の対応表 — 抜けは `point-pick` の1件だけで、記録すべき差分がない。
- §5 の問い — 追記のとおり 1〜4 はすべて同日に実施したので起票しない。5（バッククォート表記）は未確認のまま、
  `open-questions.md`「ドキュメント運用」の既存項目に任せる。

追記ぶん（public-pages の圧縮）で意図的に落としたもの:

- 「表示回数の3割超が `?q=` 付き」— 2026-09-28 の GA4 修正前の二重計上を含む値で、測り直し待ち（open-questions に既出）。
- 「2026-09-09 より前は開発中の自分の閲覧が混ざる」— スクリプトが警告するので wiki に書かなくても踏まない。
- OGP 生成の落とし穴（`--changed` / `--only`、churn）の括弧書き — 正は sns-day1-images.md。リンクは残した。
- 「トップの5件は意図的な差」「下記参照」、llms.txt の仕様リンク、地域クラブ節の制度説明の前置き — 言い回しの圧縮。
- Open Questions 3件 — `open-questions.md` へ移した（「score 側のヘッダー/フッター」は既存項目と重複していたので統合）。
- API 確認に使った curl の全文と anon キー — キーは載せない。手順は `APPLIED.md`「確認のしかた」に残した。

## 追記2: 圧縮の基準を目安と分けた（同日）

public-pages / open-questions を目安ぎりぎりまで削った（最後は「あと25字」「あと6字」の往復）のを見て、
ユーザーから「文字数を短縮する作業の方がトークンを消費しそう」と指摘があった。実際、削って浮いたのは2ページ合わせて数百字
（1回読むごとに数百トークン）で、削る側は全文の読み直し・退避・測り直しで数万トークンかかった。元が取れるのは数十〜百回読まれてから。

決めたこと:

- 12,000字は**目安**のまま（報告のみ）。**圧縮するのは1.3倍（15,600字）を超えたページだけ**。
  `check-wiki-size.mjs` に `SLIM_THRESHOLD` を足し、該当ページに「圧縮」印を出す。
- `open-questions.md` は目安の対象外（未解決の問いの集約先なので、育つのは設計どおり）。
- `slim-wiki-page.md` の手順1・7、AGENTS.md、docs/README.md、checks.yml の報告文を合わせた。

今回削った分は内容として妥当なので戻していない。

### Compile Log（追記2）

- 1.3倍という倍率の根拠 — 厳密な計算ではなく「まとまった量を一度に削れる」ことを狙った目安。raw のこの節にだけ残す。
- トークンの損得の試算 — 上の概算で十分。wiki には「少しの超過は削らない」という規則だけ載せた。
