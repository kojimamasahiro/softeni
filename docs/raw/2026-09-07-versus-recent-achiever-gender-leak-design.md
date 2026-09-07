# 「直近大会の好成績者」が団体戦（versus）で性別を跨いで混入する — 修正設計書

起票日: 2026-09-07
種別: 設計書（未実装・実装前のドラフト仕様）
状態: 2026-09-07 実装完了（下の「実装記録」節を参照。起票時点の本文はそのまま残している）
対象: `lib/newsArticle/contextBlocks.ts`
発端: ユーザー指摘「news/zennihon-university-2026 の注目の選手に、女子が混ざっている。ジャンルが
versus なので考慮されていないかもしれない」

---

## 1. 事象（確認済み）

`/news/zennihon-university-2026/` を `next dev` の実データで確認すると（`out/` の静的ビルドは
2026-09-03 時点のもので `versus-none-*` を含む新データ反映前だったため要注意）:

- **男子対抗**（`versus-none-boys`）の「注目の選手」カード「日本体育大学」に、
  `全日本大学ソフトテニス王座決定戦2026 女子団体戦 準優勝` という実績行が付いている。
- **女子対抗**（`versus-none-girls`）の「法政大学」「早稲田大学」「関西学院大学」「中京大学」
  各カードに、`全日本大学ソフトテニス王座決定戦2026 男子団体戦 ...` という実績行が付いている。

いずれも男女両方のチームを持つ大学。個人戦（シングルス/ダブルス）4 種目は正常（混入なし）。

**「性別混入」の意味の確認（2026-09-07 追記）**: これは男子チームと女子チームが対戦した
という話ではない（そのような試合データは存在せず、ソフトテニスの団体戦に男女混合の対戦は
無い）。実際に起きているのは**表示の取り違え**で、「日本体育大学 女子団体の準優勝」という
事実が、`versus-none-boys`（男子対抗）セクションの「日本体育大学」カードに**誤って**添えられている
——本来は同じ女子対抗セクションの「日本体育大学」カードに出るべき実績行が、学校名だけで
照合するキーのせいで男子側にも出てしまっている。対戦記録そのものが壊れているのではなく、
「この実績はどちらの性別のチームのものか」という属性が照合キーから欠落しているのが原因。

## 2. 原因

`buildRecentAchieverIndex()` と `buildRecentAchievers()`（[contextBlocks.ts:631](../../lib/newsArticle/contextBlocks.ts#L631), [:706](../../lib/newsArticle/contextBlocks.ts#L706)）が
「直近大会の好成績者」ブロックを作る際、団体戦エントリーの照合キーに `teamMatchKey()`
（[contextBlocks.ts:162](../../lib/newsArticle/contextBlocks.ts#L162)）を使っている。このキーは
個人名を持たない団体戦エントリーでは **学校名のみ**（`teams.join('|')`）になり、性別・年齢区分を
一切含まない。

`buildRecentAchieverIndex` は直近大会（例: 全日本大学王座決定戦）の **全カテゴリを横断**して
1 つの `Map<string, RecentAchievementInfo>` に積む（644〜675行目）。王座決定戦は
`team-none-boys` と `team-none-girls` を別カテゴリとして持つが、どちらも同じ学校であれば
同じキー（例: `"日本体育大学"`）になるため、`better()` による成績比較で**片方がもう片方を
上書きしてしまう**。

続いて `buildRecentAchievers()` が、この汚染済み Map を**現在描画中のカテゴリ**
（例: `versus-none-boys` の `FieldIndex.championKeyToEntryNo`）と素朴に突き合わせる。
`FieldIndex.championKeyToEntryNo` 自体も学校名のみのキー（[contextBlocks.ts:219](../../lib/newsArticle/contextBlocks.ts#L219)、
`teamMatchKey` と同じ式をインライン重複実装）なので、同じ学校名を持つ男子チーム・女子チームの
どちらのフィールドからでもヒットしてしまう。

個人戦が無事なのは `playerMatchKey`（氏名＋所属）で実質一意になるため。団体戦だけが
「学校名」という性別非依存の弱いキーに依存しているのが根本原因。

### 参考: 同種の問題を正しく避けている既存コード

`lib/priorMeetings.ts` の「直近の対戦」ブロックは、同じく団体戦を校名ベース
（`校名@都道府県`）で照合するが、こちらは**呼び出し側で明示的に同一 `categoryId` に限定**
している（[priorMeetings.ts:206](../../lib/priorMeetings.ts#L206) のコメント「`categoryId` も揃える
（男子ダブルスの対戦を女子ダブルスの文脈に混ぜない）」）。今回のバグは、この設計原則が
`contextBlocks.ts` の「直近の好成績者」ブロックにだけ適用されていなかったケース。

## 3. 修正方針

**団体戦の照合キーに性別を含める**。個人戦（ペア/シングルス）のキーは氏名を含み既に
一意なので変更不要。

### 3.1 `teamMatchKey` にジェンダー引数を追加

```ts
// 変更前
function teamMatchKey(c: ChampionEntry): string | null

// 変更後
function teamMatchKey(c: ChampionEntry, gender: string | null): string | null
```

団体戦分岐（`names.length === 0`）でのみ `gender` をプレフィックスする
（例: `"girls::日本体育大学"`）。ペア/個人分岐は氏名で既に一意なため `gender` を使わない。

呼び出し元を洗い出すと 4 箇所:

| 箇所 | 現在の比較相手 | 性別を跨ぐ可能性 |
|---|---|---|
| [:282](../../lib/newsArticle/contextBlocks.ts#L282) `resolvePairFate` | 同一 `tournamentId`+`categoryId` の前年チャンピオン vs 今大会 `field` | ない（両者とも同じカテゴリ由来） |
| [:428](../../lib/newsArticle/contextBlocks.ts#L428) `buildReturningFormerChampions` | 同一カテゴリの歴代優勝者 vs 今大会 `field` | ない（同上） |
| [:662](../../lib/newsArticle/contextBlocks.ts#L662) `buildRecentAchieverIndex` | 直近大会の**全カテゴリ**を横断 | **ある（本バグの発生源）** |
| `FieldIndex` 構築時のインライン重複実装（[:219](../../lib/newsArticle/contextBlocks.ts#L219)） | 今大会 `field` 自身のキー空間 | — (基準側) |

282・428 は元々同一カテゴリ内の比較なので実害は無いが、`teamMatchKey` のキー形式を変える以上、
**すべての呼び出し元に一貫して同じ gender を渡す**必要がある（渡し忘れると片方だけ無印キー・
片方だけ `gender::` 付きキーになり、正しい一致まで壊れる）。

### 3.2 gender の受け渡し: `FieldIndex` に持たせる

呼び出し元ごとに `categoryId` を再取得させるより、`FieldIndex` 自体に確定済みの gender を
持たせて一緒に運ぶ方が取り違えにくい。

```ts
type FieldIndex = {
  // ...既存フィールド
  gender: string | null; // 追加。categoryPathParts(categoryId)?.gender
};
```

`buildFieldIndex(tournamentId, year, categoryId)` の冒頭で
`const gender = categoryPathParts(categoryId)?.gender ?? null;` を計算し、返り値に含める。

`championKeyToEntryNo`/`championKeySet` を作るインライン処理（219行目）は `teamMatchKey` と
同じ式（氏名ソート結合 or 学校名ソート結合）を重複実装しているため、**キー生成式そのものを
共通の小さなヘルパーへ切り出し、両方から呼ぶ**（当初「重複を許容するか関数呼び出しに統合するか」
を Open Question にしていたが、統合する方針で確定する。理由: 重複を残すと次に式を変えるときも
同じ「片方だけ直し忘れる」再発リスクを抱え続けるため、今回のバグと同じ種類の再発を構造的に
潰しておきたい）。

```ts
/** ペア/団体の照合キー本体（氏名 or 校名のソート結合。性別プレフィックスは団体のみ） */
function buildMatchKeyBody(names: string[], teams: string[], gender: string | null): string | null {
  const namesSorted = names.map(normPart).sort();
  const teamsSorted = teams.map(normPart).sort();
  if (namesSorted.length > 0) return `${namesSorted.join('|')}@${teamsSorted.join('|')}`;
  if (teamsSorted.length === 0) return null;
  const base = teamsSorted.join('|');
  return gender ? `${gender}::${base}` : base;
}
```

`ChampionEntry` をわざわざ組み立て直す必要はなく、`teamMatchKey` は
`c.display ? buildMatchKeyBody(c.players, c.teams, gender) : null` に、`buildFieldIndex` の
219行目は既にループ内で持っている `names`/`teams` 配列を渡して
`buildMatchKeyBody(names, teams, gender)` に置き換えるだけで済む（どちらも既存のローカル変数を
渡すだけなので diff は小さい）。

`resolvePairFate(c, field)` と `buildReturningFormerChampions(champions, field, year)` は、
`teamMatchKey(c)` を `teamMatchKey(c, field.gender)` に変えるだけで済む（比較相手は常に
同じ `field` なので、`field.gender` を使えば必然的に一致する）。

### 3.3 `buildRecentAchieverIndex`: 挿入キーに直近カテゴリの gender を使う

644行目のループは `cid`（直近大会側のカテゴリID）を持っているので、

```ts
const gender = categoryPathParts(cid)?.gender ?? null;
// ...
const key = teamMatchKey(ce, gender);
```

とする。これで同じ Map の中で `"boys::日本体育大学"` と `"girls::日本体育大学"` が別キーとして
共存し、`better()` による上書きが起きなくなる。

### 3.4 `buildRecentAchievers`: 照合キーの空間が両側で揃う

`buildRecentAchievers(field, recentIndex, alreadyShownNames)` 側は**変更不要**になる想定。
`recentIndex` のキーが `${直近カテゴリのgender}::学校名`、`field.championKeyToEntryNo` のキーが
`${今カテゴリのgender}::学校名` という同じ形式になるため、`field.championKeyToEntryNo.get(key)`
は gender が一致する場合だけ自然にヒットし、不一致なら黙って `undefined`（＝対象外）になる。
追加のフィルタ処理を書く必要がない、というのがこの設計の狙い（キー空間を揃えるだけで解決する）。

### 3.5 影響範囲の見積もり

- 個人戦（シングルス/ダブルス）: `playerMatchKey` 経路は無変更。影響なし。
- 団体戦（`versus-*` および今後増えうる `team-*` 系カテゴリ）: 同一大学の男女チームが**両方とも
  直近大会でベスト4以上**の場合のみ従来と挙動が変わる（片方の実績が誤って混入しなくなる）。
  実測（全日本大学王座決定戦2026）では 日本体育大学・法政大学・早稲田大学・関西学院大学・
  中京大学の 5 校で修正前後の差分が出る見込み。
- `resolvePairFate` / `buildReturningFormerChampions` の同一カテゴリ内比較は、`gender` を
  一貫して同じ値で渡す限り結果は変わらない（プレフィックスは定数なので相対的な一致判定に影響しない）。

## 4. 検証方法（実装後に実施）

1. `npx tsc --noEmit` / `npx eslint`。
2. `zennihon-university-2026` の男子対抗・女子対抗セクションで、他大学（王座決定戦を含む
   直近大会）の実績が **自セクションと同じ性別のものだけ**表示されることを目視確認
   （日本体育大学・法政大学など男女両チームを持つ校で特に確認）。
3. 既存の個人戦4種目（男女シングルス/ダブルス）の「注目の選手」表示に差分が出ないこと
   （スナップショット的に `next build` 後の該当 HTML を比較、または `get_page_text` で目視）。
4. 他の `versus`/`team` カテゴリを持つ大会（例: `zennihon-university-indoor`,
   `zennihon-university-ouza` 自身、インターハイ団体戦など）でも同様に男女混入が無いことを
   横展開で確認する。

## 5. Open Questions（解消済み）

いずれも設計段階で解消し、リスクを残さない方針にした。

- **キー生成式の二重管理**: 3.2 で `buildMatchKeyBody` に統合する方針を確定した。
  `teamMatchKey` とその重複実装（219行目）が別々に性別プレフィックスを持つ余地は無くなる。
- **`lib/priorMeetings.ts` にも同種のリスクがあるか**: ソースコードで確認済み。
  `buildPriorMeetingIndex` → `findPriorEditions` は、他大会を探索する際も常に**呼び出し元から
  渡された同一の `categoryId` 文字列**でしか `readYearDetail` を呼ばない
  （[priorMeetings.ts:276](../../lib/priorMeetings.ts#L276)）。`buildRecentAchieverIndex` のように
  他大会の**全カテゴリを列挙する**処理が無いため、性別の異なるカテゴリを一度も見に行かない＝
  構造的に本バグのクラスは発生し得ない。目視確認の追加タスクは不要と判断する。

---

## 実装記録（2026-09-07）

設計どおり `lib/newsArticle/contextBlocks.ts` のみを変更した。

- `buildMatchKeyBody(names, teams, gender)` を新設し、`teamMatchKey` と `buildFieldIndex` の
  championKey 生成（旧219行目のインライン重複実装）の両方をこれに統合した。
  設計案では所属の正規化を呼び出し側に任せる形だったが、`teamMatchKey` が
  `normalizeTeam`（末尾 `_<都道府県>` の除去）を掛けていたのに対し `buildFieldIndex` 側は
  ループ内で既に `normalizeTeam` 済みの配列を渡す形だったため、**ヘルパー内で
  `normalizeTeam` + `normPart` の両方を掛ける**ことにした（`normalizeTeam` は冪等なので
  二重適用しても安全）。これを怠ると `c.teams` を素通しした場合に表記揺れ吸収が壊れる。
- `FieldIndex.gender`（`categoryPathParts(categoryId)?.gender ?? null`）を追加。
- `resolvePairFate` / `buildReturningFormerChampions` は `teamMatchKey(c, field.gender)` に。
- `buildRecentAchieverIndex` はループ内で `categoryPathParts(cid)?.gender ?? null` を求め、
  それを挿入キーに使う。
- `buildRecentAchievers` は設計の想定どおり**無変更**で正しく動いた。

### 検証結果

`npx tsc --noEmit` / `npx eslint` はクリーン。全 preview 記事の文脈ブロック
（recentAchievers / returningPlacers / returningFormerChampions / titleDefense / pickPlayers）を
修正前後でダンプして diff を取った結果、**差分は「性別を跨いだ実績行の削除」のみ**で、
追加された行は 1 行も無かった（＝正しく一致していた既存の照合を壊していない）。

| 記事 / 種目 | 差分 |
|---|---|
| `zennihon-university-2026` `versus-none-boys` | 8 件 → 4 件（女子団体戦の 明治大学・日本体育大学・四国大学・福岡大学 が消える） |
| `zennihon-university-2026` `versus-none-girls` | 8 件 → 4 件（男子団体戦の 法政大学・早稲田大学・中京大学・関西学院大学 が消える） |
| `highschool-championship-2026` `team-none-girls` | 男子団体戦の 高田商（奈良県）・出雲北陵（島根県） が消える |
| 上記以外（個人戦4種目・他記事の全ブロック） | 差分なし |

設計 3.5 の見積もり（王座決定戦2026 で 5 校に差分）に対し、実際に差分が出たのは
`zennihon-university-2026` の 8 校＋`highschool-championship-2026` の 2 校だった。
見積もりが「日本体育大学ほか 5 校」に留まっていたのは、目視で確認できた範囲
（男子側1校・女子側4校）だけを数えていたためで、実際には男女両セクションが互いの
索引を丸ごと参照していたため両側に出ていた。また設計時に想定していなかった
インターハイ（`team-none-*`）にも同じ混入があり、設計 4-4「横展開で確認する」で
拾えた形になる。

---

## Compile Log

本ノートを `docs/wiki/news-context-blocks.md` へコンパイルした（2026-09-07）。

**取り込んだもの**
- 原因（団体戦の照合キーが校名のみで性別を含まない／`buildRecentAchieverIndex` が
  全カテゴリ横断で 1 Map に積むため上書きが起きる）→ 「直近大会の好成績者の再登場」節に
  「団体戦の照合キーに性別を含める（2026-09-07 修正）」として追記。
- 修正方針（団体戦のみ性別プレフィックス／`FieldIndex.gender` で運ぶ／キー空間が揃うので
  照合側は無変更）→ 同上。
- キー生成式の `buildMatchKeyBody` への統合（再発防止の構造的理由）→ 同上。
- `lib/priorMeetings.ts` が構造的に同バグを持たない理由 → 同上に 1 文で要約。
- 実測の差分（王座決定戦2026・インターハイ2026）→ 同上に効果として記載。

**意図的に除外したもの**
- 1章の事象再現手順（`next dev` で見る／`out/` の静的ビルドが 2026-09-03 時点で古い）
  — 一過性の調査環境の話で、wiki の恒常的な仕様記述には不要。
- 「性別混入の意味の確認」節（男女が対戦したのではなく表示の取り違え、という誤解の解消）
  — 起票時のやり取り固有の説明。wiki 側は原因を正確に書けば足りる。
- 3.1 の呼び出し元 4 箇所の表と「282・428 は実害が無いが一貫して渡す必要がある」議論
  — 実装の詳細であり、コード（`teamMatchKey(c, field.gender)`）とコメントを読めば分かる。
- 5章 Open Questions（設計段階で解消済み）
  — 結論だけを wiki に残し、検討過程は本ノートに置く。
- 上記「実装記録」の `normalizeTeam` を巡る設計との差異
  — 実装ローカルな判断で、wiki の読者が behavior を理解するのに不要（コード内コメントに残した）。
