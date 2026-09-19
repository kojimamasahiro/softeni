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

---

## 追記（2026-09-19）: 点検で残った4件を直した

ユーザーの依頼:「宿題がよくわからないが、修正してほしい」。**4件とも「昨日決めたルールが守られていない箇所」**で、
直したうえで**同じことが起きたら機械が言う**ようにした（`scripts/check-wiki-size.mjs` の「規約チェック」節）。

| 件 | 前 | 後 |
|---|---|---|
| 適用範囲の行 | 13/41 ページ | **41/41**。24ページに内容に合わせて付けた（汎用9・学校スポーツ共通3・ソフトテニス固有7・混在5） |
| wiki の孤立 | 3ページ（android / architecture / project-overview） | **0**。deployment → architecture / data-model → architecture / architecture → project-overview / project-overview → android を追加 |
| ADR の Status | 23本中、素の状態語は5本 | **23/23**。`## Status` 直下を状態語1行にし、決定日・補足は次の行へ送った（本文は消していない）。テンプレートにも書式を明記 |
| Compile Log | 欠落34本 | 免除の条件を明文化し、機械チェックは 2026-09-19 以降のノートだけを見る形に。**現在0件** |

### Compile Log の免除をどう決めたか

`open-questions.md` に「作業リスト型には求めない例外を書くか、除外のみ1行で必ず書かせるか」という未決があった。
**例外を書く**側を採った。理由は、`*-review` / `*-checklist` / `*-todo` は wiki へ載せる durable な中身が
元々無く、「除外のみ1行」を書かせても情報が増えないため。あわせて `*-wiki-archive-*` も免除した
（compile の「元」ではなく「先」なので、落としたものを書く相手がいない）。

過去の未記入（免除を除くと 2026-07〜08 の idea / plan ノート13本）は**遡って書かない**。
AGENTS.md の「再 compile するとき以外は retrofit しない」に従う。数字が毎回同じまま報告され続けると
検査が形骸化するので、機械チェックの開始日を 2026-09-19 に切った。

### 検査に足したもの

`npm run check:wiki` の「規約チェック」節（すべて報告のみ。ゲートはリンク切れだけのまま）:

- 適用範囲の行が無い wiki
- index.md 以外から参照されていない wiki（孤立）
- `## Status` 直下が状態語だけになっていない ADR
- Compile Log が無い raw（開始日以降・免除を除く）

## Compile Log（追記ぶん）

- → `docs/prompts/update-wiki.md`（Compile Log の免除条件）、`docs/wiki/open-questions.md`（4件を消し、
  残る判断＝ゲートに上げるかだけ残した）、`docs/adr/ADR-000-template.md`（Status の書式）、
  各 wiki ページ（適用範囲の行・相互リンク）、各 ADR（Status の整形）。
  - 反映しなかったもの: 24ページぶんの適用範囲の判定理由（各ページの冒頭に1行で書いてあるので重複）、
    ADR 16本の整形前後の文字列（git の差分で読める）、過去の Compile Log 未記入13本の一覧
    （遡って書かない方針なので、一覧を wiki に置くと「やるべき残件」に見えてしまう）。
