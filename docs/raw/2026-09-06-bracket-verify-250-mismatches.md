# 調査メモ: `verify-bracket-layout` の 250 件不一致（2026-09-06）

## 状況

休眠していた検出器を GitHub Actions に載せた際（`.github/workflows/checks.yml`。
`aba144e7` → PR #85 で main へ）、`node scripts/verify-bracket-layout.mjs` が
**250 件の不一致で赤**になった。

```
復元適用: 443 大会 / 復元不可(no-seed-info): 9 大会
試合の一致: 38481 件 / 不一致: 250 件
  data/tournaments/details/highschool-championship/2013/doubles-none-boys.json — 2 件
  data/tournaments/details/zennihon-singles/2017/singles-none-boys.json — 248 件
```

2 ファイルとも 2026-09-04 の取り込み（`全日本シングルス 2017` / `インハイ2013`）。
検証スクリプト自体の最終変更は 2026-08-22（ラウンドロビン対応）なので、
**検証ロジックの回帰ではなく新規データ由来**であることは最初から分かっていた。

`docs/raw/2026-08-22-bracket-slot-parity-roundrobin-false-positive.md` に
「予選リーグ→決勝T形式は復元ロジック側の誤検知だった」という前例があるため、
まず「データが悪いのか、復元ロジックが未対応なのか」を 2 ファイルそれぞれで切り分けた。
**結論は 2 件で別々**だった。

---

## ケース1: zennihon-singles/2017 男子（248 件）— 復元ロジックが未対応の形式

### 事実確認

| 項目 | 値 |
|---|---|
| `entries` | 257 |
| `entries[].type` の内訳 | `seed` 1 / `packing` 2 / `extra` 254 |
| `matches` のラウンド | **予選 1** / 1回戦 128 / 2回戦 64 / 3回戦 32 / 4回戦 16 / 5回戦 8 / 準々 4 / 準決 2 / 決勝 1（計 256） |

`matches` の `nextMatchId` を決勝から逆に辿って実際の席順を復元すると、
**256 枠がちょうど埋まり、その並びは entryNo 昇順 `1, 2, 4, 5, 6, …, 257`** だった
（entryNo 3 だけが本戦の席に居ない）。つまり実データはこうなっている:

```
予選(match-1):  2 vs 3 → 2 が勝ち上がる
1回戦(match-2): 1 vs 2   ← 予選の勝者がここに入る
1回戦(match-3): 4 vs 5
1回戦(match-4): 6 vs 7 …（以降 256, 257 まで隣接ペア）
```

出場 257 名は 2 冪（256）をちょうど 1 つ超えている。bye を増やして 512 枠にする代わりに、
**本戦の前に「予選」を 1 試合だけ置いて 1 席を争わせる**形式だった。
`matches` は完全に整合しており、**データ（試合記録）に誤りは無い**。

誤っていたのは `entries[].type` のほうで、254 組が `extra`（＝1回戦不戦勝）になっているが、
その 254 組は全員 1回戦を戦っている。この type で席を積むと 512 枠・9 ラウンドのブラケットに
なり、実際の 1回戦が「9回戦相当」と判定される（これが 248 件の中身）。

### 真因: `type` の語彙に「予選敗者」を表す値が無い

`seed` / `extra` / `packing` はいずれも**本戦の枠を 2 つ消費する**値で、
「本戦の席を持たない組」を表せない。全件 `packing` にすると entryNo 3 が枠を 1 つ食って
以降の席が 1 つずつずれる（枠数も 258 になる）。この 257 名のケースでは、その手前の
「全件 packing なら出場数が 2 冪か」の判定（出場 257 は 2 冪でない）で `no-seed-info` として
復元を諦める形になり、誤ったブラケットは出ないが**表も出ない**。

`scripts/backfill-entry-type.mjs` の `inferTypes()` も、この形式では
`frames` が `[1,2] [3,null] [4,5] …` と 129 枠になり 2 冪から外れるため `null` を返して
書き込みを見送る。**逆算では埋められない**（安全側に倒れていた）。

なお実害は「復元できない」ではなく**誤ったブラケットが出る**方だった。
`TournamentBracket.tsx` は `describeBracketLayout` が成功すれば新描画に乗るので、
この大会は 2026-09-04 以降 **512 枠の誤ったトーナメント表を公開していた**。

### 対応: `type: 'preliminary'` を追加

「予選（本戦の1回戦より前の段）で敗れ、本戦のドローに席を持たないエントリー。**枠を消費しない**」
という値を 1 つ足し、席順を組む前に外す。予選の勝者は本戦の席に入るので普通の `packing`。

- `lib/bracketLayout.ts` の `describeBracketLayout`（表示側・本番）
- `scripts/verify-bracket-layout.mjs` の `buildLayout`（意図的な二重管理。同時に直す）
- `tools/shared/validate-entries.js` の `bracket-slot-parity`
- `scripts/backfill-entry-type.mjs` の `restorable()`
- `tools/shared/normalize-core.js` の `calculateEntryType()`
  （`round: "予選"` の試合を本戦の外として除外し、それしか無ければ `preliminary` を返す）

データ側は 257 件を `packing` 256 ＋ `preliminary` 1（entryNo 3）に直した。

**副作用（承知の上）**: 予選敗者は復元した席順に現れないので、
`meetingRoundIndex` はそのエントリーで `null` を返し、新描画のブラケット表にも
予選の 1 試合は描かれない。本戦のブラケットに席が無い以上「◯回戦で当たる」は
原理的に定まらないので、欠落側に倒すのが正しいと判断した。
`npm run bracket:verify:tree` はこの 1 試合を「ツリーに無い試合」として報告する
（同スクリプトは元から他 10 件で赤なので、ゲートには入れていない）。

### 検討して採らなかった案

- **全件 `packing` にして復元を諦めさせる**（パリティ検査に落として graceful に諦める）。
  検証は緑になるが、256 枠のトーナメント表が丸ごと出なくなる。
  しかも entryNo 3 を `packing` と書くこと自体が事実に反する（1回戦を戦っていない）。
- **`matches` から予選敗者を判定する**（`round: "予選"` の敗者を席から外す）。
  `describeBracketLayout` は「開催前に `matches` が無くても席順を出す」ために
  `entries` から復元する設計なので、`matches` 依存を持ち込むと前提が崩れる。
- **予選を「0回戦」として 512 枠に拡張する**。1回戦の位置が 1 つずれ、
  `roundLabelOf` と実データの round 名が全大会でずれる。割に合わない。

---

## ケース2: highschool-championship/2013 男子ダブルス（2 件）— データの二重登録

### 事実確認

`entries` は 314、`matches` は **315**。単純消去のトーナメントなら試合数は
出場数 − 1 ＝ 313 のはずで、**2 件多い**。

`playerIds` の重複を全データで走査すると、このファイルの
`長友_祐人_日向_宮崎県 / 寺田_侑世_日向_宮崎県` が **entryNo 136 と 277 の 2 箇所**に居た
（`participants` は 626 人 ＝ 313 ペア分しかなく、314 エントリーに対して 1 ペア足りない）。

不一致になっていた 2 試合は、どちらも 277 の試合の**複製**だった:

| 正 | 複製 | 内容 |
|---|---|---|
| `match-52` `[277,278]` 1回戦 4-2 | `match-53` `[278,136]` 1回戦 4-2 | 同じ試合 |
| `match-173` `[277,276]` 2回戦 1-4 | `match-172` `[276,136]` 2回戦 1-4 | 同じ試合 |

136 と 277 は**どちらも実在する席**である（136 は 137 と `packing` ペアで `match-26`、
277 は 278 と `packing` ペアで `match-52`。`entries[].type` から積んだ枠数は 512 でパリティも合う）。
したがって「片方が幽霊エントリー」ではなく、**136 の `playerIds` に 277 と同じ組が入っている**
＝ 136 の組の氏名が失われている、という状態。

`nextMatchId` の張り替えも巻き添えで壊れていた。`normalize-core.js` は
「次ラウンドで勝者の `playerIds` を含む試合」を探して繋ぐため、同じ `playerIds` が
2 席にあると解決が曖昧になる。実際 `match-52`（勝者 277）の `nextMatchId` が
`match-115`（`[136,138]`）を指しており、**勝者が次の試合に出てこない**唯一のリンクだった。

### 対応

複製 2 件を削除し、リンクを実際の勝ち上がりに合わせた。

- `match-53` / `match-172` を削除（315 → **313** ＝ 出場 314 − 1）
- `match-52.nextMatchId`: `match-115` → `match-173`
- `match-115.prevMatchIds`: `["match-26","match-52","match-53"]` → `["match-26"]`
- `match-173.prevMatchIds`: `[]` → `["match-52"]`
- `match-245.prevMatchIds`: `["match-172","match-173","match-174"]` → `["match-173","match-174"]`
- 供給元が1つになった `match-115` / `match-173` の `prevMatchId`（単数フィールド）も合わせた
  （このファイルの規約は「供給元が1つなら `prevMatchId` にその id、2つ以上なら null」）

修正後、ラウンド別の試合数が 1回戦 58（＝`packing` 116 組 ÷ 2）・2回戦 128（512 枠として正しい）
になり、`nextMatchId` と `prevMatchIds` の相互整合も全 313 件で取れた。

### 未解決: entryNo 136 の組が誰なのか分からない

複製の削除だけでは、136 と 277 が同じ `playerIds` を指す状態は解消しない。
**元資料（2013 インターハイ男子ダブルスのドロー表）が無いと復元できない**ので、
リポジトリ内のデータからは埋められなかった。周辺の entryNo に県のまとまりは無く
（ドローは県が散らばる並び）、推測もできない。

Assumption: **誤っているのは 136 の側**の可能性が高い。複製された 2 試合が
「277 の対戦相手（278・276）を持ちながら entryNo だけ 136」という形なので、
氏名で entryNo を解決する経路が `日向` を若い番号（136）に寄せた痕跡に見える。
ただし断定はできないので、136・277 のどちらの氏名が正しいかは元資料での確認が要る。

影響: この組の選手ページで、2013 インターハイの成績が「2回戦敗退」として
**2 件計上される**（136 と 277 の両方）。`scripts/check-duplicate-placements.mjs` は
「異なる categoryId 間」の二重計上を見るルールなので、同一ファイル内のこれは検出しない。

---

## 全データ走査で見つかった同種の異常（今回は未対応）

同じ 2 つの走査を全 details に流した結果:

| 症状 | ファイル |
|---|---|
| `entries[].playerIds` が重複 | `zennihon-university/2025/singles-none-boys.json`（1 組） |
| `nextMatchId` の先に勝者が居ない | `highschool-shikoku-block/2026/doubles-none-girls.json`（1 件）<br>`east-japan/2025/doubles-none-girls.json`（1 件） |

いずれも `verify-bracket-layout` は緑のままなので今回は触っていない。
どちらの走査も現状どの検出器にも入っていない（＝**次に起きても気付けない**）。

### 検査は存在するが、入力ツール経路には掛かっていない

`scripts/pdf/tournament_results_common.py` の `check(data)` は
「試合数がエントリー数−1と合わない」「勝者が次戦に現れない」「同一ラウンドに同じ entryNo が
2回出る」をすべて見ている。**2013 の 3 症状はどれもこれで捕まる**。
にもかかわらず素通りしたのは、この `check()` が Python の PDF パイプラインを通ったときしか
走らないためで、入力ツール（`tools/tournament3`）から入れたデータには掛からない。
「検出器はあるのに走る契機が無い」という、今回 GitHub Actions を用意した動機と同じ構図。
共通化するかは未決定（open-questions 送り）。

---

## 結果

```
復元適用: 443 大会 / 復元不可(no-seed-info): 9 大会
試合の一致: 38729 件 / 不一致: 0 件        （終了コード 0）
```

| | 変更前 | 変更後 |
|---|---|---|
| 一致した試合 | 38,481 件 | **38,729 件** |
| 不一致 | 250 件 | **0 件** |
| 復元適用 | 443 大会 | 443 大会（変わらず） |
| `bracket:verify:tree` の zennihon-singles/2017 | ラウンド不一致 248 件 | ツリーに無い試合 1 件（予選の 1 試合） |

`.github/workflows/checks.yml` の `verify-bracket-layout` を報告のみ → **ゲート**へ昇格させ、
TODO コメントを削除した（`if: always()` のサマリ出力をやめ、素の `run:` にした）。

`npm run check:entries` は警告 0 件のまま、`npm run bracket:test` は 33+7 件すべて成功
（`preliminary` の単体テストを 2 件追加）。

### 落とし穴: highschool-* の details を触るとパイプラインのマーカー更新が要る

最初の push で Cloudflare Pages / Vercel の両方が落ちた。原因は
`scripts/check-highschool-pipeline-freshness.mjs`（prebuild のゲート）で、
`data/tournaments/details/highschool-*` の**内容ハッシュ**と
`data/highschool/.pipeline-source-hash.json` を突き合わせるため、
2013 のファイルを直した時点で不一致になっていた。

紛らわしいのは、**パイプラインの生成物そのものは 1 バイトも変わらない**こと
（このパイプラインは `entries` / `results` を集計するもので、今回直したのは `matches` だけ）。
それでも `npm run highschool:pipeline` の再実行とマーカーのコミットは必要になる。
`data/tournaments/details/highschool-*` を触ったら、結果に影響が無さそうでも回すこと。

なお `npm run prebuild` は `public/data/beta-matches/**` の `generatedAt` も書き換えるが、
これは中身の変わらないタイムスタンプ差分なのでコミットしていない。

## Compile Log（2026-09-06）

書き戻したもの:

- `type: 'preliminary'` の意味・判定箇所・入力ツールが出せないこと
  → **docs/tournament-data-structure.md**（`type` の語彙表と判定表がそこにあるため）。
- 復元適用 443 大会・38,729 試合・不一致 0 件という実測値
  → **docs/wiki/public-pages.md** / **docs/wiki/news-context-blocks.md**
  （どちらも古い実測値（372 大会・27,633 試合）を持つ節があり、更新しないと古い数字が残る）。
- 「予選 1 試合を持つ形式」が新描画の対象になったこと → **docs/wiki/public-pages.md**。
- 未解決 3 件（entryNo 136 の氏名・入力ツールの予選未対応・全データ走査で見つかった 3 件）
  → **docs/wiki/open-questions.md**。

意図的に書き戻さなかったもの:

- `nextMatchId` を辿って席順を復元した手順のダンプ — 再現できる手順（決勝から `prevMatchIds` を
  辿る）が本メモにあり、wiki は現状を書く場所なので不要。
- 採らなかった 3 案の詳細 — 判断の根拠として再利用される可能性が低い（`preliminary` は
  語彙の追加であってアーキテクチャの選択ではないため ADR も立てていない）。raw に残す。
- highschool-championship/2013 の複製 2 試合のスコア詳細 — データ修正が済んだので
  現状の記述にならない。raw に残す。
- 「512 枠の誤ったトーナメント表を 2 日間公開していた」という経緯 — 復旧済みで、
  wiki の現状記述には入らない。検出器を止めていた構造の話は
  `aba144e7` のコミットメッセージと checks.yml 冒頭のコメントが持っている。
