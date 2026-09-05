# 連覇（repeat-title）が所属変更で切れる不具合

実施日: 2026-09-05
種別: 不具合調査＋修正
対象: `lib/milestones.ts`（`computePlayerStreak` / `buildIndividualMilestones`）
発端: `/tournaments/all/zennihon-mixed/2026/doubles/none/mixed/` で、2025・2026 と連続優勝した
天間麗奈に「混合ダブルス**1年ぶり2回目の優勝**」と表示されていた（本来は 2連覇）。

---

## 1. 事象

zennihon-mixed（全日本ミックスダブルス）doubles-none-mixed の優勝者:

| 年 | 優勝ペア |
|---|---|
| 2025 | 丸山海斗（one team）・**天間麗奈（東北）** |
| 2026 | **天間麗奈（日本体育大学）**・黒坂卓矢（日本体育大学） |

天間麗奈は 2025→2026 で連続優勝しており、ペアが替わっても
「個人戦は選手個人単位で判定する」（news-context-blocks.md）という設計上は **2連覇**。
しかし出力は `nth-title`（1年ぶり2回目の優勝）だった。

**「◯年ぶり」が 1 年、という時点で自己矛盾している**（ギャップ1年＝連続開催の連続優勝＝連覇）。
このラベル自体が不整合の検出器になっている。

## 2. 原因

`buildIndividualMilestones` の中で、**同じ「本人か？」の判定に2つの異なる照合基準**が使われていた。

- `computePlayerStreak`（連覇判定）: `playerKeys` 一致のみ
- `first-title` / `nth-title` の `priorWins`: `playerKeys` 一致 **または** `players`（フルネーム）一致

`playerKey` は `lib/tournamentRecords.ts` の `playerKey()`＝正規化済み「名前@所属」なので、
進学・移籍で所属が変わると年度をまたいだ照合が外れる。

天間麗奈は 2025 が `天間麗奈@東北`、2026 が `天間麗奈@日本体育大学` のため
連覇判定は外れ（＝連覇なし）、その直後の nth-title は名前フォールバックで拾ってしまい、
「連覇ではないが過去に優勝歴がある」＝ n回目の優勝、という結論になっていた。

つまり単独のバグではなく **2つの判定の非対称性**が原因。片方だけにフォールバックがある限り、
所属変更のたびに同じ矛盾が再発する。

## 3. 修正

照合述語を `championIncludesPlayer(c, key, name)` として切り出し、**連覇判定と first/nth 判定の
両方から同じものを使う**ようにした（`lib/milestones.ts`）。これで両者が食い違う経路が構造的に消える。

```ts
function championIncludesPlayer(c: ChampionEntry, key: string, name: string): boolean {
  return c.playerKeys.includes(key) || c.players.includes(name);
}
```

`computePlayerStreak` は `name` を追加で受け取る。

### 判断: 名前フォールバックを「足す」か、nth 側から「引く」か

厳密側に寄せる（nth からも名前照合を外す）選択肢もあったが、採らなかった。
所属変更は高校→大学→実業団で日常的に起きる（下記の実測5件すべてが該当）ため、
外すと「初優勝」「n回目」の側が今度は大量に誤る。名寄せ（`homonyms.json`）が
世代をまたいで使えるようになるまでは、緩い側に揃えるほうが実害が小さい。

**残リスク**: 同一大会・同一種目の歴代優勝者に同姓同名の別人がいると同一人物とみなす。
プレビュー側の所属変更フォールバック（2026-07-18、`uniqueEntryNoByName`）が持つ
「今大会で一意な場合のみ」という条件はここでは付けていない。照合対象が
「その大会・種目の歴代優勝者」という極めて狭い集合（1年1ペア）であり、
かつ nth-title が既に同じ割り切りで運用されていたため。

## 4. 検証

全 468 エディションを走査（`getChampionMilestones` 総当たり）:

- 修正前: `nth-title` かつ `gapYears === 1`（＝定義上ありえない出力）が **5件**
- 修正後: **0件**。5件すべてが `repeat-title` に変わった

変化した5件（いずれも所属変更を挟んだ実在の連覇。誤検出なし）:

| 大会 | 種目 | 年 | 選手 | 所属の変化 |
|---|---|---|---|---|
| zennihon-championship | doubles-none-girls | 2018 | 林田リコ | 文大杉並 →（卒業） |
| zennihon-championship | doubles-none-girls | 2018 | 宮下こころ | 文大杉並 →（卒業） |
| zennihon-championship | doubles-none-boys | 2019 | 船水颯人 | 早稲田大学 → NTT西日本 |
| zennihon-singles | singles-none-boys | 2019 | 船水颯人 | 早稲田大学 → NTT西日本 |
| zennihon-mixed | doubles-none-mixed | 2026 | 天間麗奈 | 東北 → 日本体育大学 |

`npx tsc --noEmit` / `npx eslint lib/milestones.ts` ともにクリーン。
milestone は SSG 時に算出しており `data/` / `public/` に焼き込まれた文字列は無いため、
再生成が必要な成果物は無い（`grep -rl "年ぶり" data/ public/` → 0件）。

## 5. 学び / 今後

- **同じ問いに対する照合基準は1箇所に集約する**。「本人か？」「同じ校か？」のような述語が
  複数箇所に手書きでコピーされると、片方だけが改良されて矛盾が生まれる。
- **矛盾を自己申告するラベルは有用**。「1年ぶり2回目」は人間が見て即おかしいと分かる。
  `gapYears === 1` は不変条件（invariant）なので、健全性チェックに入れておく価値がある。
  → Open Questions に「milestone の不変条件チェックをスクリプト化するか」を追加。
- `lib/newsArticle.ts` のプレビュー側は別途 2026-07-18 に所属変更フォールバックを入れており、
  今回の milestone 側と**方針は同じだが実装は独立**（照合の粒度が違うため統合はしていない）。

---

## Compile Log

- docs/wiki/news-context-blocks.md に反映: repeat-title / first-title の照合基準を
  「`playerKeys`」から「`championIncludesPlayer`（`playerKeys` または `players`）」に更新し、
  所属変更で連覇が切れる不具合とその修正日を追記。
- docs/wiki/open-questions.md に反映: milestone の不変条件（`nth-title` の `gapYears >= 2` 等）を
  機械チェックするかを Open Question として追加。
- 除外: 変化した5件の一覧表 → wiki には載せない（検証の記録であって現在の仕様ではない。
  再検証したければ本ノートの手順で再走査できる）。
- 除外: 「厳密側に寄せる／緩い側に揃える」の比較検討 → wiki には結論だけを載せる
  （経緯は本ノートと、必要になれば ADR に回す）。ADR は新設していない（既存の判定単位の
  決定〈2026-06-24〉を変更しておらず、その実装バグの修正に留まるため）。
