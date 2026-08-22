# 調査メモ: 予選リーグ→決勝トーナメント大会で bracket-slot-parity が誤検知する

## 状況

`npm run build` の prebuild（`scripts/check-tournament-entries.mjs`）が出す
`[warn: bracket-slot-parity]` 3件を調査した。結論として **データ入力ミスではなく、
検証ロジック側が予選リーグ（roundrobin）→決勝トーナメント（knockout）形式の大会を
想定していないための誤検知**だった。まだ直していない（現状把握のみ）。

対象3件:

- `data/tournaments/details/highschool-japan-cup/2021/doubles-none-boys.json`
- `data/tournaments/details/highschool-japan-cup/2021/doubles-none-girls.json`
- `data/tournaments/details/zennihon-business-group/2026/team-none-girls.json`

## 背景（ブラケット復元の仕組み）

ブラケットの席順は `entries[].type` から復元する方式が [docs/raw/2026-07-26-idea-bracket-redesign.md](./2026-07-26-idea-bracket-redesign.md)
で確立していて、`lib/bracketLayout.ts`（表示側・本番）と `scripts/verify-bracket-layout.mjs`
（検証・実データ突合）に実装がある。入力側の健全性チェックは `tools/shared/validate-entries.js`
（`bracket-slot-parity` ルール）で、`scripts/check-tournament-entries.mjs` から prebuild 時に
毎回全データに対して走る。

`entries[].type` の値の意味（`tools/shared/normalize-core.js:1103` `calculateEntryType`）:

- `seed` / `extra`: 1回戦不戦勝の枠（本人＋bye で2枠）
- `packing`: 隣接2組で1試合（2枠）
- `null`: **予選リーグの試合にしか出ていない、または決勝トーナメントの席順情報が無い**
  （`calculateEntryType` は `if (rrMatches.length > 0) return null` と、round-robin の
  試合が1件でもあれば無条件で `null` を返す。決勝T進出者の `seed`/`packing` は、この
  自動計算ではなく別途手動入力された `entryTypeMap` で上書きされている）

3件のスクリプトはいずれも「`entries` を entryNo 順に並べ、type から2枠ずつ積んで
2の冪になるか」を見る点で共通している。

## 課題（真因）

予選リーグ→決勝トーナメント形式の大会では、`entries` に **予選敗退で決勝Tに
進めなかった組も残る**（`docs/wiki/data-import.md` に明記の設計: 「RRで敗退し
本戦へ進めなかった選手も `results` に残す」。`entries` も同様）。この非進出組は
`type: null` になるが、**入力ミスの `null`（型を入れ忘れた決勝T進出組）と
見分けが付かない**。

`tools/shared/validate-entries.js` の `bracket-slot-parity` チェックは、
`entries` 全件（予選リーグのみの参加者を含む）を対象に2枠ずつ積んでしまうため、
本来ブラケットに存在しない予選敗退組がノイズとして混入し、2の冪から外れる。

実データで確認（`entries` 総数 → 決勝T進出数 → 決勝T進出組だけに絞った場合の枠数）:

| ファイル | entries総数 | 決勝T進出数 | 絞った場合の枠数 |
|---|---|---|---|
| highschool-japan-cup/2021/doubles-none-boys | 72（type=null 48件） | 24 | 32（2^5、綺麗に揃う） |
| highschool-japan-cup/2021/doubles-none-girls | 72（type=null 48件） | 24 | 32（同上） |
| zennihon-business-group/2026/team-none-girls | 22（type=null 10件） | 12 | 16（2^4、同上） |

`data.matches` で `stage === 'knockout'` の試合に登場する entryNo だけに絞って
同じロジックを流すと、3件とも綺麗に2の冪になった。**真の意味での type 入力ミスは
無い**ことがこれで裏付けられる（もし本当に入力ミスがあれば、絞り込み後も
2の冪から外れるはず）。

## 副作用: 表示側も同じ理由で機能が欠落している

`lib/bracketLayout.ts` の `describeBracketLayout` も同じ「全 entries を type で
2枠ずつ積む」ロジックを持つ（意図的な二重管理。ファイル冒頭コメントに
「ロジックを変えたら両方直すこと」とある）。よってこの3大会（および同型の
予選リーグ→決勝T大会）では、表示側もブラケット復元に失敗し、
「◯回戦で当たる」の事前予測機能が**サイレントに丸ごと欠落**している。
誤った情報が出ているわけではない（`describeBracketLayout` は失敗時に
黙って諦める設計）が、機能としては動いていない。

`describeBracketLayout` には既に「予選リーグ→決勝T」を意識した分岐が1つある
（コメント: 「全件 packing になるため…出場数の2冪チェックが必須」、
`zennihon-senior/2025/doubles-over80-girls` の実例つき）。ただしこれは
**「予選リーグ参加者の entries 自体が別ファイル/別枠で存在しない」ケース**
への対処であり、今回のような「予選リーグ参加者の entries が同じ `entries[]`
に type=null で混在する」ケースは想定されていない。

## ゴール（未決定・2案）

### 案A: 入力検証のみ直す（小さい）

`tools/shared/validate-entries.js` の `bracket-slot-parity` チェックを、
`entries` 全件ではなく「決勝Tの席順情報を持つべき組」だけに絞ってから
2枠ずつ積むよう修正する。絞り込み方法の候補:

- type が `seed`/`extra`/`packing` のいずれか（= type 未入力を機械的に除外）
- または `data.matches` で `stage === 'knockout'` に登場する entryNo（=
  実際に決勝Tへ進んだ組を実績ベースで特定）

後者の方が「型は入っているが決勝T不出場」のような将来のケースにも頑健。
この案だけなら**ビルドの誤warnが消えるだけ**で、サイトの表示は変わらない。

### 案B: 表示側（`lib/bracketLayout.ts`）も同じ発想で直す（大きい）

案Aの絞り込みを `describeBracketLayout` にも適用し、予選リーグ→決勝T大会でも
「◯回戦で当たる」の事前予測を復元できるようにする。効果は大きい（現状
欠落している機能が使えるようになる）が、以下が必要になる:

- `lib/bracketLayout.ts` と `tools/shared/validate-entries.js`
  （および検証用の `scripts/verify-bracket-layout.mjs`）の3箇所を同じロジックに揃える
  （ファイル冒頭コメントの既存の運用ルール）
- `npm run bracket:verify` で実データ全件を再検証し、
  既存の「復元適用173大会・18,901試合・不一致0件」の実績を壊していないか確認
- 予選リーグ→決勝Tの大会が他に何件あるか洗い出し（今回の3件で全てとは限らない）

## 次の一歩

案A・案Bのどちらを・いつやるかはユーザー判断待ち（本メモ作成時点で未決定）。
着手する際はこのメモを更新し、`docs/wiki/open-questions.md` の該当項目を解消する。

---

## 追記（2026-08-22・同日の実データ検証）

上の「ゴール（未決定・2案）」を実データで検証した結果、**案Bは採用できない**ことと、
**真因は案A・案Bのどちらとも別のところにある**ことが分かった。以下は全 381 ファイル
（うち予選リーグ→決勝T形式は 90 ファイル）に対する実測。

### 検証1: 案A（入力検証のみ）は副作用なしで成立する

「予選リーグを含む大会では、決勝T出場者（`matches` の `stage === 'knockout'` に登場する
entryNo）だけに絞ってから2枠ずつ積む」に変えてシミュレートした結果:

- `bracket-slot-parity` の警告: **3件 → 0件**
- 新たな検出漏れ・新規誤検知: **0件**
- 「予選リーグ有りだが決勝T試合がまだ無いためスキップ」になる大会: **0件**

### 検証2: 案B（表示側も復元）は 90 大会中 17 大会で誤ったブラケットを出す

同じ絞り込みで席順を復元し、実際の `matches` の対戦ラウンドと突合した:

| 結果 | 件数 |
|---|---|
| 一致 | 28 |
| **不一致（誤復元）** | **17** |
| 復元不可（絞り込み後も枠数が2の冪でない） | 45 |

誤復元の例（`zennihon-business-group/2026/team-none-girls`）:

```
実データ 1回戦: [12,18] [7,20] [3,16] [6,10]
案Bの復元:      (3,6)   (7,8)  (10,12) (16,18)
```

なお「一致」28件のうち枠数16以上の意味のある規模は5件だけで、残りは枠4〜8＝偶然一致
しうる大きさ。案Bの見返りは想定より小さく、代償（17大会で誤った断定）は許容できない。

### 検証3: 真因 — 決勝Tの席は「エントリー」ではなく「予選リーグの組」に属する

`matches` の `nextMatchId` から実際の決勝Tブラケットを復元し、各席を
`results[].roundrobin` の (組, 組内順位) でラベルすると、**席順は完全に規則的**だった:

```
secondaryschool-tohoku-block/2026 男子: A1 D2 C2 B1 C1 B2 A2 D1
secondaryschool-tohoku-block/2026 女子: A1 B2 A2 B1 C1 D2 C2 D1
zennihon-business-group/2026:          A1 D2 E2 B1 F2 C1 D1 A2 E1 B2 C3 F1
zennihon-junior/2025 u14男子:           A1 B1 C1 D1 E1 F1 G1
zennihon-mixed/2025 over70:             1-1位 2-1位 3-1位 … 15-1位（組順）
```

いずれも「1位通過 vs 別組の2位通過」のクロス配置。**A型（entryNo 順に見える大会）と
B型（無関係に見える大会）は別物ではなく、同じ規則の特殊ケース**だった。
`highschool-japan-cup` が entryNo 順に一致したのは、全組1位通過かつ組が entryNo 順に
並んでいるためにすぎない。

つまり `entries[].type` に決勝Tの席を持たせている現在のモデルが**間違った単位で持って
いる**。席は組に属し、そこに入るエントリーはリーグ終了後に決まる。この取り違えが以下を
同時に引き起こしている:

- 開催前に決勝Tのブラケットを出せない（誰が入るか未定なので `type` を誰にも付けられない）。
  席が組に属していれば「A組1位 vs D組2位」として開催前から図が出せる。
- 「誰が通ったか」の認識がファイル内で食い違っても検出できない（下記の hjc2021 の実例）。
- `bracket-slot-parity` が予選敗退組を巻き込む（本メモ冒頭の誤検知）。

参考: 1組あたりの決勝T進出数は 1 または 2 が大半で、`results[].roundrobin.{group, rank}`
は 90 ファイルすべてに入っている。

### 検証4: 現行チェックが隠していた実データの誤り（hjc2021 男子）

`highschool-japan-cup/2021/doubles-none-boys` の予選リーグ21組（61・62・63）は三つ巴:

```
61-62 → 3-4 で 62 勝 / 61-63 → 4-1 で 61 勝 / 62-63 → 1-4 で 63 勝
ゲーム得失: 61 = +2 / 63 = ±0 / 62 = -2
```

この組の「決勝T進出者」について、同じファイル内の3箇所が**それぞれ違うことを言っている**:

| 情報源 | 進出者 |
|---|---|
| `matches`（`[59,61]` 1回戦・`[57,61]` 2回戦） | **61** |
| `results[].roundrobin.rank` / `results[].tournament`（「2回戦敗退」） | 63 |
| `entries[].type`（`packing`） | 62 |

ゲーム得失（61 が +2 で最上位）と `matches` の記録が一致するので **61 が正しい**と考えられる。
`results` と `type` は古い順位計算の結果が残ったものと推測される（ユーザー談: 順位計算が
誤っていて 61 に手で直した可能性）。要確認: 元資料での組21の順位。

全データで「`results[].tournament` を持つ集合」と「決勝T出場集合（`matches`）」を突合すると
不一致は2件のみ:

- `highschool-japan-cup/2021/doubles-none-boys`（上記。results のみ=63 / matches のみ=61）
- `zennihon-university-ouza/2026/team-none-boys`（results のみ=4,7,10,13。別途要確認）

### 検証5: 表示側の前提の訂正

本メモ冒頭の「表示側の機能がサイレントに丸ごと欠落」は正確でない。
`src/components/Tournament/TournamentBracket.tsx` に 2026-07-31 のユーザー決定として
「復元できない大会（予選リーグ 81・type 未入力 15・席ずれ 10）→ 従来描画。これらは
`matches` の `nextMatchId` から木を作れるので従来経路で足りる」と明記があり、
**トーナメント表そのものは出ている**。欠けているのは新描画（`BracketSheets`）と、
記事の「◯回戦で当たる」（`lib/newsArticle/contextBlocks.ts`）だけ。

### 副次的な発見: 予選リーグ大会 20 件の `type` 汚染

RR→KO の 90 ファイルのうち 20 ファイルは**全 entries に `packing` が入っている**
（予選リーグのみの参加者を含む）。この `type` は決勝Tの席を意味していない。
`scripts/backfill-entry-type.mjs` は予選リーグ大会を明示的にスキップするので、
投入ツール（`tools/tournament3` の `buildEntriesMeta`）由来と思われる。
表示側は「出場数が2の冪か」のチェックで守られているが、
`zennihon-senior/2025/doubles-over80-girls`（31組 → 32枠）はすり抜け寸前だった。

### 次の一歩（改訂）

案A・案Bの二択ではなく、**決勝Tのドローを (組, 組内順位) の並びとして持つ**方向で
根本解決を検討する（データモデル変更なので ADR 対象）。完了済み大会の分は `matches` から
自動生成できるため、手入力が必要なのは開催前・進行中の大会のみ。

---

## 実装（2026-08-22）

上記「次の一歩（改訂）」を実装した。決定は [ADR-015](../adr/ADR-015-knockout-draw-by-group.md)。

- `knockoutDraw`（(組, 組内順位) の並び）を details JSON に追加。89 大会分を
  `scripts/generate-knockout-draw.mjs` で `matches` から生成（`npm run bracket:draw`）。
  生成前に「復元した席順の合流ラウンドが knockout の全試合と一致するか」を検算している。
- `lib/bracketLayout.ts` に `layoutFromKnockoutDraw` を追加し、`describeBracketLayout` は
  `knockoutDraw` →（無ければ）`entries[].type` の順で復元するようにした。
  検証側 `scripts/verify-bracket-layout.mjs` にも同じ手順を反映（意図的な二重管理）。
- `tools/shared/validate-entries.js`: `bracket-slot-parity` を予選リーグ大会では適用しないようにし、
  `knockout-draw-missing` / `-parity` / `-unresolved` を追加。
- hjc2021 男子の予選21組を 61 に統一（`results` の順位・`tournament`、`entries[].type`）。
  ゲーム得失と `normalize-core.js` の順位規則（勝数→直接対決→直接対決のゲーム差→全体のゲーム差）
  のいずれでも 61 が1位になり、`matches` の記録とも一致する。

結果:

| | 変更前 | 変更後 |
|---|---|---|
| 復元適用 | 285 大会 | **374 大会** |
| 突合した試合 | 26,527 件 | **27,635 件** |
| 不一致 | 0 件 | **0 件** |
| 復元不可 | 96 大会（no-seed-info 93 / slot-parity 3） | **7 大会**（no-seed-info のみ） |
| `check:entries` の警告 | bracket-slot-parity 3件（誤検知） | **knockout-draw-missing 1件（実データの欠落）** |

残タスクは docs/wiki/open-questions.md 参照。

## Compile Log（2026-08-22）

このメモを docs/wiki / docs/adr へ書き戻した際の取捨。

書き戻したもの:

- 決勝Tの席は「予選リーグの組」に属するという単位の取り違え → **ADR-015**（Context/Decision）。
  案A・案B・案C・案D の比較も ADR の Alternatives に移した（判断の根拠として再利用されるため）。
- `knockoutDraw` のデータ形式と生成コマンド → **docs/wiki/data-import.md**（投入手順の一部なので）。
- 検証ルール3件（`knockout-draw-*`）と `bracket-slot-parity` の適用範囲変更
  → **docs/wiki/data-import.md** のルール表。
- 復元適用 285→374 大会の数字 → **docs/wiki/news-context-blocks.md** / **public-pages.md**
  （どちらも既存の実測値を持つ節があり、更新しないと古い数字が残るため）。
- 未解決3件（ouza 男子の試合欠落・未確定席の見せ方・`type` の掃除）→ **open-questions.md**。

意図的に書き戻さなかったもの:

- 検証2の「一致28 / 不一致17 / 復元不可45」の内訳表 — 却下した案Bの詳細で、wiki は現状を
  書く場所。ADR の Alternatives に結論（17大会が誤復元）だけ残した。
- 各大会の実ブラケット席順のダンプ（A1 D2 C2 B1 …）— ADR に4例だけ引用し、残りは省いた。
  再現手順（`matches` の `nextMatchId` を辿る）が ADR にあるので再生成できる。
- 検証5「表示側の前提の訂正」— 元メモの誤りの訂正であって、wiki には誤った記述が
  無かったため書き戻す先が無い。raw に残す。
- 「予選リーグ大会20件の `type` 汚染」の詳細 — open-questions に1行だけ残し、
  投入ツール側の原因調査は未着手なので wiki には書かない。
- hjc2021 の三つ巴のスコア詳細 — データ修正が済んだので現状の記述にはならない。raw に残す。

---

## 追記2（2026-08-22・2段リーグ形式と入力ツール対応）

### 2段リーグ形式には決勝Tが無い

`zennihon-university-ouza/2026/team-none-boys` を `knockout-draw-missing` として警告していたが、
実データを見ると**予選リーグ6組（A〜F、各3チーム）→ 準決勝リーグ2組（準A・準B、各3チーム）
→ 優勝決定戦1試合**という形式で、そもそも決勝トーナメントが存在しなかった。

```
予選リーグ A〜F: 各組1位が通過 → 1, 4, 7, 10, 13, 16
準決勝リーグ 準A: 1, 4, 7 → 1が2勝0敗で1位 / 準B: 10, 13, 16 → 16が2勝0敗で1位
優勝決定戦: 1 vs 16 → 1の優勝
```

決勝が1試合だけの大会には席順という概念が無い（2枠のドローは情報を持たない）ので、
**`knockoutDraw` を作らない・要求しない**ことにした。同じ理由で
`zennihon-senbatsu/2026/singles-none-{boys,girls}`（どちらも決勝1試合）にも作らない
（初回の一括生成で2枠のドローを書いてしまっていたので取り消した）。

これで `npm run check:entries` は**警告0件**になった。ブラケット復元は
372大会・27,633試合・不一致0件（senbatsu 2件ぶん減った）。

残る問題: `results[].roundrobin` は組を**1つしか持てない**ため、**準決勝リーグの順位が
どこにも記録されていない**。「ベスト4」（準決勝リーグ2位の 7・13）「ベスト8」（同3位の 4・10）
という成績ラベルの根拠が `matches` にしか無い状態。段ごとの配列にするかは、この形式が
現状1大会だけなので保留（open-questions 送り）。

### 入力ツールは未対応だったので対応した

`tools/index.html` →（`tournament3` / `roundrobin`）→ `tools/shared/normalize-core.js` の
出力に `knockoutDraw` が含まれていなかった。つまり**新しく予選リーグ大会を入力すると
毎回 `knockout-draw-missing` が出る**状態だった。

席順を起こす手順を `tools/shared/knockout-draw.js`（Browser + Node 両対応の UMD）に切り出し、
**入力ツール（`normalize-core.js`）と一括生成スクリプトが同じモジュールを共有**するようにした
（`validate-entries.js` と同じ方針）。ロジックの3重管理を避けるため、
`scripts/generate-knockout-draw.mjs` は自前の実装を捨ててこのモジュールを require している。
生成スクリプトの出力は切り出し前後で完全に同一（87大会・書き込み0件＝差分なし）であることを確認済み。

確認したこと:

- Node 経路（`require('./knockout-draw.js')`）とブラウザ経路（`window.KnockoutDraw`）の
  どちらでも解決できる（`NormalizeCore.getKnockoutDrawModule()` をテスト用に公開した）。
- `buildOutput` が生成スクリプトと同じ書式（1席1行）で `knockoutDraw` を吐き、再パースできる。
- `matches → knockoutDraw → describeBracketLayout` が一周することを単体テストで固定
  （`npm run bracket:test`、31件）。

なお `scripts/normalize-*.mjs`（チーム名・県名の正規化）は生テキストを書き換える方式で
`buildOutput` を通さないため、既存の `knockoutDraw` を落とす心配は無い。

## Compile Log（追記2・2026-08-22）

書き戻したもの:

- 「決勝1試合だけの大会にはドローを作らない」という判断と ouza の実形式 → **ADR-015**
  （Decision に追記）／ **docs/wiki/data-import.md**。検証ルールの発火条件が変わるため。
- 入力ツールが `knockoutDraw` を出力するようになったこと・共有モジュールの位置
  → **ADR-015**（Decision / Related Files）／ **data-import.md** / **public-pages.md**。
  「入力後に生成スクリプトを走らせる必要があるか」は運用手順そのものなので wiki に必要。
- 準決勝リーグの順位が記録されない件 → **open-questions.md** と ADR-015 の Open Questions。
- 数字の訂正（374→372 大会・27,635→27,633 試合）→ 4ページすべて。

意図的に書き戻さなかったもの:

- ouza の準決勝リーグの星取り詳細 — 個別データの話で、wiki の現状記述にはならない。
- `getKnockoutDrawModule()` をテスト用に公開した経緯 — コード内コメントで足りる。
- Node/ブラウザ両経路の確認手順 — 再現可能な単体テストに落としたので文章では残さない。
