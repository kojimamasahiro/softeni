# 2026-09-19 `information` の `note` が `__NEXT_DATA__` に出ていた

## 何が起きていたか

`docs/wiki/data-model.md` は `information[].note` を「入力時のメモ。**公開ページには出さない**」と
定めており、`src/types/tournament.ts` の型コメントも同じことを書いていた。描画は実際にしていない。

にもかかわらず、年度別結果ページ
（`src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx`）が
`infoForYear`（`information` の年エントリ**そのもの**）を props に渡していたため、Next.js が props を
`__NEXT_DATA__` として配信HTMLに埋め、`note` の全文がHTMLソースに入っていた。

**「描画していない＝公開していない」ではない**、というのがこの件の核心。

### 実測（修正前 / アジア競技大会 2026 混合ダブルス）

`/tournaments/international/asian-games/2026/doubles/none/mixed/` の `__NEXT_DATA__` →
`props.pageProps.infoForYear` のキー:

```
['year','location','startDate','endDate','venues','guidelineUrl','source','sourceUrl',
 'scheduleSource','scheduleSourceUrl','scheduleCheckedOn','label','note','categories']
```

- 年エントリ直下の `note`（会期のずれと『予定』表記についての入力判断）が全文あった
- `venues[0].note`（「コート面数・サーフェスは一次情報が確認できないため未記録（推測で埋めない方針）。…」）も全文あった

`venues[].note` も同時に漏れていたのは、`venues` が年エントリの一部として丸ごと載っていたから。
こちらは wiki の会場テーブルでは「出典の誤りを直した根拠」としか書いておらず、非公開だと明示されていなかった。

## 調べた範囲（どのページが `information` を props に載せるか）

`information/*.json` を読む経路を全部当たった結果、**年エントリを丸ごと props に入れていたのはこの1ページだけ**。
他は元から「出したいフィールドだけ明示的に詰める」形になっていて `note` は載っていない:

- 大会ハブ `tournaments/[generation]/[tournamentId]/index.tsx` — `upcoming.venues` を
  `name / city / address / postalCode / tel / courts / surface / usage` に絞って map、`categoryLabels` も再構成
- 大会一覧 `tournaments/index.tsx`、`tournaments/major/index.tsx`、
  `tournaments/block/[blockId]/index.tsx`、`tournaments/local/[federationId]/index.tsx` — いずれもフィールド選択
- `lib/highschoolNationalTournaments.ts`（`upcoming` / `cancelled` を再構成）、`lib/majorTitles.ts`、
  `lib/tournamentRecords.ts`、`lib/tournamentHelpers.server.ts`、`src/utils/team-data-aggregator.ts`、
  `src/pages/beta/matches/create.tsx`、`src/pages/highschool/[gender]/[prefectureId]/**` — props へは派生値のみ
- `delegations` の `note` も `lib/delegation.ts` の `getDelegationBlock()` が
  `label / announcedOn / source / sourceUrl / groups` しか返さないので漏れていない

## 直し方

`lib/tournamentInformationPublic.ts` を追加し、`getStaticProps` で `toPublicInformationEntry()` を通す。

- **描画時ではなく `getStaticProps` で落とす**。描画側で出し分けてもペイロードには載るので意味がない
- 型で再発を止めるには**2つ要る**。最初 `Omit<…, 'note'>` だけ書いたが、それでは止まらなかった:
  - `Omit` は**余剰プロパティを拒まない**（検査が効くのはオブジェクトリテラルだけ）。
    `note` を持つ生の値が普通に代入できる → `note?: never` にして代入不能にした
  - この年度別結果ページは `getStaticProps` の戻り値が `Record<string, unknown>` だったため、
    props の型自体が参照されていなかった → `GetStaticProps<TournamentYearResultPageProps>` と
    IIFE の戻り値型を付けた。実際に `toPublicInformationEntry()` を外すと TS2322 が出ることを確認
- `note: undefined` を代入せず**キーごと `delete` する**。Next.js は props に `undefined` があると
  シリアライズできずビルドが落ちる

## 検証（`next dev` で `__NEXT_DATA__` を直接見る）

`getStaticProps` は dev でも同じものが走り `__NEXT_DATA__` に入るので、フルビルドせずに確かめられる。

- 修正前: 上記のとおり `note` / `venues[].note` が全文あった（差し戻して再現を取った）
- 修正後: `infoForYear` のキーから `note` が消え、`venues[]` からも消えた。
  表示に使っている `location` / `startDate` / `source` / `sourceUrl` / `categories` は残っている
- `information` 全ファイルの `note` 32件について、先頭18文字での grep を **26ページ**
  （大会ハブ11・大会一覧2・年度別結果7・ブロック/都道府県ほか）にかけて **ヒット0**。
  `delegations` の `note` 1件も0件

## Compile Log（wiki へ落とさなかったもの）

- 実測したキー配列・ページごとのバイト数・fetch したURL一覧 — 日付つきの実測なので raw に置く
- 「どのページを当たって安全だと確認したか」の網羅リスト — wiki には
  「props には出したいフィールドだけを明示的に詰める」という規約だけ残した。個別ページ名は実装が正
- `next dev` で `__NEXT_DATA__` を見る検証手順 — 一般的な手口で data-model の仕様ではない
- `note: undefined` ではなく `delete` する理由 — `lib/tournamentInformationPublic.ts` のコメントが正
