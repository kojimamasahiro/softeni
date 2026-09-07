# 王座決定戦2026 の participants に都道府県が無い問題 / 王座決定戦を「インカレ」と呼んでいた問題（2026-09-07）

## きっかけ

ユーザー指摘:

> 以下の王座決定戦がおかしい。tempIdがなく、prefectureがないため別のチームになっている。
> 日本学連にまとめてほしい。またインカレとなっているがインカレではない。
> data/tournaments/details/zennihon-university-ouza/2026

---

## 1. `prefecture` が null で、`id` が校名だけだった

### 事象

`data/tournaments/details/zennihon-university-ouza/2026/team-none-{boys,girls}.json` の
participants が全件（男子18・女子17）こうなっていた:

```json
{ "id": "法政大学", "lastName": null, "firstName": null, "team": "法政大学", "prefecture": null }
```

団体戦エントリーの識別子は本来 `校名_都道府県` の2項目（個人戦の
`姓_名_学校_都道府県` 4項目に対応するもの。[[feedback-tempid-four-parts]] と同じ規約）。
同じ大学連盟所属の他大会——例えば `zennihon-university`（全日本学生選手権大会）の
`versus-none-*`——は `"id": "東京理科大学_日本学連", "prefecture": "日本学連"` で揃っている。

`prefecture` が null だと、都道府県別の集計（`fieldOverview.prefectureCount`）や
トーナメント表の所属表示が空になり、他大会の同じ大学と**別チーム扱い**になる。

### 対応

両ファイルの participants を `id: "<校名>_日本学連"` / `prefecture: "日本学連"` に直し、
`entries[].playerIds` の参照も張り替えた（男子18件・女子17件）。
`matches` は `entryNo` 参照、`knockoutDraw` は `group`/`rank` 参照なので影響なし。

JSON 全体を再シリアライズせず**元テキストへピンポイント置換**して整形を保った
（`scripts/normalize-prefectures.mjs` と同じ方針）。置換前に
「participants は全件 team のみ（lastName/firstName が null）」「`id === team`」
「`prefecture` は全件 null」「各 entry の playerIds は 1 件」「dangling 参照なし」を
機械的に確認してから適用している。

`日本学連` は `normalize-prefectures.mjs` が「都道府県ではないが保持する連盟名」として
既に知っている値なので、正規化スクリプトを流しても書き換わらない（dry-run で 0 件を確認）。

### 検証

- `node scripts/check-tournament-entries.mjs` … 問題なし
- `node scripts/normalize-prefectures.mjs --dry-run --scope=zennihon-university-ouza` … 0 件
- ハブページ `/tournaments/university/zennihon-university-ouza/` の優勝者表示が
  「法政大学（日本学連）」「明治大学（日本学連）」になることを開発サーバーで確認
- 年度別結果ページのトーナメント表で各校の下に「日本学連」が出ることを確認
- `/news/zennihon-university-2026/` の「注目の選手」で王座決定戦由来の実績カードの表示名が
  「法政大学（日本学連）」形式になり、同じページの他ブロック（前回入賞者など）と表記が揃った

### 他の年度

`data/tournaments/details/zennihon-university-ouza/` は 2026 のみ。他年度に同じ問題は無い。

---

## 2. 王座決定戦を「インカレ」と呼んでいた

`data/tournaments/index.json` の `zennihon-university-ouza` に
`searchAliases: ["インカレ"]` が入っており、`lib/tournamentSearchNames.ts` の
`buildTournamentSearchNames` が `headingName` を
「インカレ（全日本大学ソフトテニス王座決定戦）」にしていた。ハブページの h1・title、
年度別結果ページの title がこの表記になる。

インカレは `zennihon-university`（全日本学生選手権大会）であって王座決定戦ではないので、
alias を削除した。経緯・判断の見直しは
[2026-09-03-incare-search-alias-seo.md](2026-09-03-incare-search-alias-seo.md) の追記と
[wiki/seo.md](../wiki/seo.md) を参照。

`searchNote` は残し、「全日本学生選手権大会（インカレ）**とは別の大会で**、同時期に開催される
大学対抗戦です。」に改めた。ハブページ h1 直下と meta description に出るテキストで、
混同を解く役に立つため。

### 検証

- ハブページ h1 が「全日本大学ソフトテニス王座決定戦 大会結果（歴代一覧）」に戻ることを確認
- 年度別結果ページ（`2026/team/none/girls`）に「インカレ」が 1 箇所も出ないことを確認
- ハブページに残る「インカレ」は `searchNote` の 1 文のみ（意図どおり）

---

## Compile Log

**取り込んだもの**
- 団体戦 participants の識別子規約（`校名_都道府県`）と `日本学連` の扱い →
  [wiki/data-import.md](../wiki/data-import.md) の該当節に追記。
- 王座決定戦の alias 撤回と、そこから出た `searchAliases` の適用条件 →
  [wiki/seo.md](../wiki/seo.md) の「インカレにも同じ対策を適用」節に取り消し線＋小節を追加。

**意図的に除外したもの**
- ピンポイント置換の実装詳細（事前チェックの内訳、置換関数の書き方）
  — 一度きりの手当てで、恒常的な手順は既に `normalize-prefectures.mjs` が体現している。
- 開発サーバーのポート回避（3000 が使用中で 49709 で起動した話）
  — 環境固有で durable でない。
- 王座決定戦の `tournamentId` が実際にどの大会に対応するかの未解決点
  — [open-questions.md](../wiki/open-questions.md) に既出のため重複させない。
