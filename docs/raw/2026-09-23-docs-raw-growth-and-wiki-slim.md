# docs/raw の増加の点検と、予算超過した wiki 6ページの再圧縮（2026-09-23）

ユーザーの問い「docs/raw がかなり多くなってきたが問題ないか」への回答と、その場で頼まれた2つの作業の記録。

## 点検の結果（raw の量）

- 210ファイル・3.8MB（2025-11〜2026-02 に計3、2026-06: 11 / 07: 36 / 08: 66 / 09: 90）。増えるペースは上がっている。
- **結論: 今の量は問題にならない。** AGENTS.md の読み順が「wiki → 必要なときだけリンク先の raw」なので、
  1回の作業で読む量は raw の件数に比例しない。git にとっても小さい。
- 実害が出るとしたら **grep の雑音**（raw の古い値・棄却案が現行仕様と取り違えられる）。
  リポジトリ全体を検索するときは `docs/raw` を外すのが効く（運用上の注意。仕組みはまだ入れていない）。
- wiki / ADR / skill から辿れない raw を数えた。**最初の数え方（13件）は誤り**で、`.claude/worktrees/` の中にある
  古い wiki の写しまで検索対象に入っていた。正しくは wiki / ADR / prompts / skills から**直接**リンクされていない raw が約55件。
  そのほとんどは圧縮時のアーカイブ（`*-wiki-archive-*.md`）など**別の raw 経由で辿れ**、どこからも辿れないのは2件だけだった。
  両方とも下記で解消した。
- 命名規約（`YYYY-MM-DD-topic.md`）外が3件（`st-league-*.md`）。リンクの張り替えが要るので**そのまま**にした。
- 見送ったもの: raw の削除・統合（追記のみの規約に反し、利点も無い）、月別サブフォルダ化
  （wiki からの約140本のリンクを張り替えることになる。数千件規模になってから考える）。

## やったこと 1: wiki / ADR から直接リンクされていない raw にリンクを足した

最初の（誤った）数え方で見つけた13件に直接リンクを足し、そのあと正しく数え直して見つかった2件にも足した。

| raw | リンク元 |
|---|---|
| 団体戦のオーダーの年度別実施記録 8件（インターハイ 2019・2021・2024・2026、高校選抜 2020・2021・2023・2024） | ADR-020 の Related Files（他年度のぶんも1行にまとめた） |
| `2026-09-16-pdf-to-players-tempid-four-parts.md` | pdf-import.md「表記の扱い」の tempId の行 |
| `2026-08-20-zennihon-workers-2022-pdf-entries-ocr-finding.md` | pdf-import.md「関連」 |
| `2026-08-12-secondaryschool-release-checklist.md` | secondaryschool.md「検討の経緯」 |
| `2026-09-17-docs-drift-review.md` | open-questions.md（docs の検査の行） |
| `2026-02-27-tournament-requirements.md` | public-pages.md「経緯」（新設） |
| `2026-07-09-team-id-underscore-bug.md`（どこからも辿れなかった） | tournament-data-structure.md「命名規約」の参加者 ID の行 |
| `2026-08-02-bug-verify-streak-unbounded-by-article-year.md`（どこからも辿れなかった） | tournament-insights.md「関連」 |

## やったこと 2: 予算（12,000字）を超えた wiki 6ページの圧縮

手順は [docs/prompts/slim-wiki-page.md](../prompts/slim-wiki-page.md)。圧縮前の全文は各 `2026-09-23-wiki-archive-<page>.md`。

| ページ | 前 | 後 | やり方 |
|---|---|---|---|
| deployment.md | 12,059 | 5,799 | 全面書き直し（2026-09-18 の圧縮対象外だった） |
| highschool.md | 12,286 | 11,315 | 重複した箇条（表と同じ内容）と日付つきの経緯を削る |
| players-pages.md | 12,458 | 11,835 | 経緯の文を1行に |
| public-pages.md | 14,181 | 11,913 | ADR-020 と重なる団体戦表示の詳細、開催前の大会の箇条を圧縮 |
| data-model.md | 14,396 | 11,932 | JSON の例を削除、会場データの出典の扱いはスキル `tournament-venue-data` へ寄せる |
| data-import.md | 15,257 | 9,167 | 団体戦のオーダーの節を新ページ team-match-order-import.md（7,083字）へ**分割** |

### 圧縮のついでに直したもの（実装と照合して古かった記述）

- **deployment.md**: CI の「報告のみ」に `verify-bracket-layout` があった → 実際はゲートに昇格済み（`checks.yml`）。
  ゲート一覧も増えていた（popular / career / player-title / records のテスト、team-grouping、docs のリンク切れ、skill 同期）。
  wiki に一覧を持つとずれるので、**一覧は `checks.yml` が正**と書き換えた。
- **data-model.md**: 団体戦の `games` が「表示はしていない」 → ADR-020 追記8 で対戦詳細に表示済み。

### 分割の判断（data-import.md）

オーダーの節（約7,000字）は、スキル `team-match-order` が「取り込みの知見の正」「compile 先」として名指ししていた。
削ると知見が消えるので、**圧縮ではなく分割**にした。スキルの参照3か所（知見の置き場・機関誌様式の注意・書き戻し先）も
新ページへ張り替えた。`公式サイト（SPA）から読むとき` はオーダーに限らない話なので data-import.md に残し、`##` に上げた。

## Compile Log

- → `docs/wiki/{deployment,highschool,players-pages,public-pages,data-model,data-import}.md`（圧縮）、
  `docs/wiki/team-match-order-import.md`（新規）、`docs/wiki/index.md`、`docs/wiki/{pdf-import,secondaryschool,open-questions,tournament-data-structure,tournament-insights}.md`（リンク追加）、
  ADR-020 の Related Files、`.claude/skills/team-match-order/SKILL.md`（参照先の張り替え）。
  - 落としたもの: deployment.md のビルド時間の内訳表・出力ファイル数の推移・nft の glob 件数の実測（アーカイブにある。判断を変える数ではない）。
  - 落としたもの: deployment.md の Open Question「本番が Cloudflare Pages か移行途中か」と Vercel の Assumption
    （`wrangler.toml` と CI の運用から本番は CF で確定。問いとして残す理由が無い）。
  - 落としたもの: data-model.md の `schedule` / `format` の JSON 例（型 `src/types/tournament.ts` と実データが正）、
    会場データの出典検算の細部（スキル `tournament-venue-data` が正。wiki には守ることだけ残した）。
  - 落としたもの: public-pages.md の反映状況の文言例・`club:verify` の判定マーカー一覧（実装 `lib/clubTransition.ts` が正）、
    トップページのSEO方針の理由づけ、GA4 取り込みの画面操作の逐一。
  - 落としたもの: highschool.md の地区大会メンバーの実測（361ページ・1,383名）と主な卒業生の掲載規模（raw/2026-09-14 とアーカイブにある）。
  - 反映しなかったもの: 辿れるかの判定方法（wiki/ADR/prompts/skills を起点に raw のリンクを推移的にたどる。worktrees は除く）。
    `check:wiki` に入れるかは未判断で、一度きりの点検としてここに残す。
  - 反映しなかったもの: raw 点検の数字（件数・容量）。時点の値で、wiki に置くと次の更新で古くなる。
