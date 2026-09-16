# docs drift レビュー（2026-09-17）

実施日: 2026-09-17
手順: [docs/prompts/review-docs-drift.md](../prompts/review-docs-drift.md)
対象: 前回の [2026-09-02-llm-wiki-lint.md](./2026-09-02-llm-wiki-lint.md) 以降のコミット約80本
（小学生・大学生カテゴリ、チーム名寄せの自動統合廃止、GA4 同意の地域分け、トップページ改修、
インカレ2026、アジア競技大会の日程など）と `docs/wiki` / `docs/adr` の突き合わせ。

## 機械チェック

| 項目 | 結果 |
|---|---|
| リンク切れ | 0件（検出3件は前回と同じ `docs/adsense-ui-proposal.md` の誤検知） |
| `wiki/index.md` への掲載 | 全ページ掲載済み |
| ADR の Status 記入 / `adr/README.md` への掲載 | 19/19（テンプレート含む） |
| 9/2 以降の raw（42本）の Compile Log | 41本あり / 1本なし（`2026-09-13-primaryschool-teamid-review.md`＝作業リスト型） |
| 9/2 以降の raw で wiki/ADR から未リンク | 1本（`2026-09-13-club-verify-monotonic-scope.md`）→ 修正 |
| 9/2 以降に追加された `scripts/**` `lib/**` で docs 未言及 | 3本。`toPlayer/list.py` は使い捨てとみなし対象外、残り2本 → 修正 |
| `backend.md` の API 一覧 | `src/pages/api/**` の11ルートと一致 |

## 実装と一致している内容

- `consentRegion.ts`（日本は同意なしで granted）と開発環境で GA4 を読まない件 → `monetization.md`・ADR-018 と一致
- トップページの構成・ナビ「カテゴリから探す」 → `public-pages.md` と一致
- `/primaryschool/**`・`/university/**` のルート → `primaryschool.md`・`university.md` と一致
- チーム名寄せの自動統合廃止・規則改定・誤統合の復元 → `team-player-identity.md` に反映済み
- 選手ページの最高成績タイルの中学生・小学生の分離 → `players-pages.md` と一致

## 実装と矛盾していた内容（修正済み）

| 対象 | ずれ | 修正 |
|---|---|---|
| `deployment.md` | prebuild を「15段」とし、末尾の `primaryschool:build`・`university:pathways` が抜けていた（実際は18段） | 18段に更新 |
| `adr/README.md` | ADR-001 が Accepted のまま（本文は 2026-09-12 に Deprecated） | Deprecated に |
| `ranking.md` | `excludeTournaments` にアジア競技大会を足したことが書かれていなかった（9/17 の raw の Compile Log は「ranking.md へ」と書いていた） | 追記 |
| `open-questions.md` | 「インカレ団体戦の `tournamentId` が未定義」が残っていたが、実際は `zennihon-university` の `versus-none-*` として2022〜2026年度が投入済み | 解決済みへ移動 |
| `open-questions.md` | 「skill の置き場」で「個人 skill 側は削除した」とあるが、`~/Library/Application Support/Claude/.../skills-plugin/.../skills/` に4つとも残っている | 訂正を追記（原因は Assumption） |
| `data-import.md` | `scripts/pdf/zennihon_university_results.py` の記載が無かった | 追加 |
| `team-player-identity.md` | 誤統合の実測に使った `scripts/spot-check-team-decisions.mjs` の記載が無かった | 追加 |
| `public-pages.md` | `club:verify` の範囲変更の raw へのリンクが無かった | 追加 |

## 実装で確認できない内容

- 個人 skill 側が再び現れた理由（アカウント側からの再同期か、削除自体が行われていなかったか）。ファイルの存在だけを確認した

## Deprecated にすべき内容

- なし（ADR-001 は本文側で既に Deprecated。索引だけ直した）

## 更新すべき wiki ページ（未対応・要判断）

- **エリアページの「発展候補アイデア一覧」の表のセルも長い。** `open-questions.md` の「AIが自律的に…」行は
  1セル約9,000字。同じ日に索引（`idea-backlog.md`）では書き方を制限したが、エリアページの表は
  「状況・目的（1行）」を名乗りながら同じ追記の仕方をしている。表のセルは要約にして本文は raw に寄せるか
- `open-questions.md` の「プロジェクトの skill が2箇所に分かれている」は見出しに「同日解決」とあるのに
  本文中にあり、「解決済み（記録）」へ移すという運用に反している。今回の訂正で未解決に戻ったとも読めるので、
  扱いの判断と合わせて整理する
- `2026-09-13-primaryschool-teamid-review.md` の Compile Log の欠落は、既存の Open Question
  （作業リスト型の raw に Compile Log を求めるか）の判断待ち

## ADR 化すべき判断

- **チーム名寄せの自動統合の廃止（2026-09-12）。** 名寄せのデータの流れが「機械が自動OKと判定したものは適用」から
  「人が判断したものだけを適用」に変わった。AGENTS.md の「データフローの変更」に当たる。
  ADR-017 の Decision は自動統合がある前提で書かれている（「選手共有シグナルは自動マージしない」）。
  ADR-017 を Superseded にするほどではなく（選手共有シグナル自体は現役）、新しい ADR で
  「自動統合の廃止」と「名前を出場大会のジャンルより優先する」を記録するのがよい（**未作成・要判断**）

## Compile Log

- **wiki に載せたもの**: 上の「矛盾していた内容」の8件（各ページに直接反映）/ インカレ団体戦の解決・skill の訂正 → `open-questions.md`
- **載せなかったもの**:
  - 機械チェックの件数表 … その時点の測定で、wiki に置くと古くなる
  - 「一致している内容」の一覧 … 変更が無いため反映先が無い
  - ADR 化の提案・エリアページの長いセル … 判断待ちなので、決めてから wiki/ADR に書く
