# ADR-021: 競技方式は種目ごとに「1つの文章＋推定の断り」で持つ

## Status

Accepted（2026-09-19）

## Context

主催者が**競技方式を文章で公開していない大会**がある。きっかけは第20回アジア競技大会2026の
公式リザルトサイト（results.asiangames2026.org）で、ユーザーの問い
「公式サイトがわかりにくい。混合ダブルスはどういう試合形式なのか」から調べた。

実際に確認した事実（[raw/2026-09-19](../raw/2026-09-19-asian-games-mixed-doubles-format.md)）:

- 方式を説明する文章・PDF がどこにも無い。Reports にあるのは Entry List だけ。
- 形式は **Schedule / Groups / Brackets の3画面を突き合わせて初めて**組み立てられる。
  混合ダブルスなら「Groups に6組・計19組」「Brackets の1回戦8枠のうち4枠が BYE」を見て、
  やっと「12組が決勝トーナメントへ進む」と分かる。
- それでも決まらないことが残る。**各組から何組が通過するのか**、
  **どの組が1回戦免除になるのか**、**組内順位の決め方**はどこにも書かれていない。
- 日別日程はコートごとに縦に並ぶので、1つの組の3試合が別の見出しに散る。

当サイトはこの大会の結果を持っているので、**形式の1ブロックを引き受けられる位置にいる**。
一方で、書ける内容には「出典の転記」と「当サイトの推定」が混ざる。推定を断りなく書くと、
公式より読みやすいぶん誤りが広がりやすい。

検討した持ち方:

1. **構造化して持つ**（`groups: 6` / `advancePerGroup: 2` / `knockoutSlots: 12` …）。
   表示を機械生成でき、検算もできる。
2. **1つの文章で持つ**（`summary`）＋推定は別フィールド。
3. 既存の `note` に書く。`note` は**公開しない入力メモ**なので、表示には使えない。

## Decision

**種目ごとの `categories[].format` に、方式を1つの文章（`summary`）として持つ。
出典から決まらない点は `assumptions[]` に分けて書き、画面には「当サイトの推定」と明記して出す。**

- **構造化しない**（案1を採らない）。大会ごとに方式がばらばらで、フィールドを切っても再利用が
  効かない。それ以上に、**欄があると推測で埋める圧力がかかる**。当サイトは
  「出典に無い日は書かない」（`schedule`）「順位が並びきらなければ止める」（取り込みスクリプト）を
  積み重ねてきたので、方式でも同じ側に倒す。
- **出典（`source` / `sourceUrl`）が無ければ表示しない。** `schedule` と同じ規約。
  併記できないものを出すと、転記と推定の区別が画面から消える。
- 出典は**種目側**に持つ（`schedule` は年度レコードに1つ）。方式は種目ごとに違い、出所も
  国内大会の要項PDFと国際大会のリザルトサイトのように分かれるため。
- `checkedOn` は形式が変わり得る前提で持つ。壊れた値は表示しない。
- **書くのは「主催者が方式を公開しておらず、見る人が画面から形式を読み取れない大会」だけ。**
  ほとんどの大会は `format` を持たず、ブロックごと出ない。

## Consequences

- 公式が答えていない問いに当サイトが答えられる。同時に、**推定が推定として見える**。
- 方式が変わったら人が書き直す必要がある（機械では追えない）。`checkedOn` がその目印。
- 推定が後で誤りと分かったら、`assumptions` を消して `summary` を直す。
  推定していた事実そのものは raw に残る。

## Implementation Status

2026-09-19 時点。

- 型: `TournamentCategoryFormat`（`src/types/tournament.ts`）
- 整形: `lib/categoryFormat.ts`（`buildCategoryFormat` / `findCategoryFormat`）
- 表示: `src/components/Tournament/CategoryFormatNotice.tsx`。年度別結果ページの
  カテゴリ切り替えの下（＝広告より下。ADR-016 の配置を崩さないため）
- 検査: `npm run format:test`（`lib/__tests__/categoryFormat.test.ts`）
- データ: アジア競技大会2026 の混合ダブルス・男子シングルス・女子シングルスの3種目だけ。
  混合は「各組上位2組が通過」が推定、シングルスは推定なしで方式が決まる

## 関連

- [ADR-015](./ADR-015-knockout-draw-by-group.md)（決勝Tの席は (組, 組内順位)）
- [data-model.md](../wiki/data-model.md)「種目別の競技方式（`format`）」
- [public-pages.md](../wiki/public-pages.md)「競技方式」
- [raw/2026-09-19-asian-games-mixed-doubles-format.md](../raw/2026-09-19-asian-games-mixed-doubles-format.md)
