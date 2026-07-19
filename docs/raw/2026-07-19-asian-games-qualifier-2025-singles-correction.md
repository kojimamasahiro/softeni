# 2026-07-19 アジア競技大会日本代表予選会2025 のカテゴリ訂正（doubles → singles）

## 発端

ビルド時間調査の副産物として `verify-facts-golden.ts` の失敗を追っていたところ、
選手ページのパートナー別テーブルで「相方を特定できない試合」が大量に出ることが分かった。
当初は「国際大会のローマ字表記の選手が名寄せできていない」と推測したが、**外れ**。

## 実際の原因

`data/tournaments/details/asian-games-qualifier/2025/` の6ファイルは
`doubles-*` というカテゴリ名だったが、`entries[].playerIds` が**全て1人**だった。

```json
{ "entryNo": 1, "playerIds": ["上松_俊貴_NTT西日本_広島県"], "type": "seed" }
{ "entryNo": 2, "playerIds": ["齋藤_龍二_太平洋工業_岐阜県"], "type": "packing" }
```

つまり相方が記録されていなかったのではなく、**そもそもシングルス戦だった**
（同大会の2022年は最初から `singles-none-boys` / `singles-none-girls`）。

全大会データを走査した結果（ペア戦カテゴリで entries が1人のもの）:

| 件数 | ファイル |
|---|---|
| 52/52 | asian-games-qualifier/2025/doubles-tournament-girls |
| 51/51 | asian-games-qualifier/2025/doubles-tournament-boys |
| 8/8 | asian-games-qualifier/2025/doubles-semifinal-boys / girls |
| 4/4 | asian-games-qualifier/2025/doubles-final-boys / girls |
| 1/187 | zennihon-championship/2022/doubles-none-boys |
| 1/167 | zennihon-championship/2022/doubles-none-girls |
| 1/19 | zennihon-workers/2024/doubles-over35-girls |

アジア大会予選2025は127エントリー全部が1人。他3件は真のダブルス大会での単発の欠落。

## 旧実装がこれを隠していた

`/players/[id]/results` の旧集計は、相方が見つからない試合を**シングルスとして計上**していた。

| | 旧 byPartner.singles | エンジンの singles | 差 |
|---|---|---|---|
| 黒坂卓矢 (10) | 53 | 47 | 6 |
| 上松俊貴 (19) | 60 | 50 | 10 |
| 内本隆文 (17) | 27 | 24 | 3 |

パートナー別テーブルの合計が試合数と一致していたのは正しかったからではなく、
ダブルスの試合をシングルスに混ぜて辻褄を合わせていたため。
今回のカテゴリ訂正で、この分は「本当にシングルス」になり整合した。

## 対応

1. `data/tournaments/information/asian-games-qualifier.json` の2025年カテゴリ6件を
   `categoryId: doubles-* → singles-*`、`category: "doubles" → "singles"` に訂正。
   label（男子決勝/男子準決勝/男子トーナメント）と age（final/semifinal/tournament）は据え置き。
2. detail ファイル6件を `git mv` でリネーム。
3. `public/_redirects` に旧 URL からの 301 を12行追加（末尾スラッシュ有無の両方）。
   例: `/tournaments/international-qualifier/asian-games-qualifier/2025/doubles/final/boys/`
   → `.../2025/singles/final/boys/`
4. `generate-facts`（増分・185選手再生成）→ `generate-player-analysis` → `generate-rankings` を実行。

## 効果

200選手サンプルでの「パートナー別合計が試合数に満たない選手」:

| | 修正前 | 修正後 |
|---|---|---|
| 該当選手 | 77人（39%） | **3人** |
| 欠落試合の合計 | 222 | **15** |

種目別の内訳も正された（例: 黒坂卓矢 singles 47→52 / doubles 111→106）。

## 残っているもの

### 相方なしのペア戦 15件（3選手）

出所は以下。上の「entries が1人」の3ファイルとは一致しないため、
entries には2人いるが相方を人物として解決できていないケース（別要因）。

- highschool-japan-cup/2022/doubles-none-girls: 5件
- zennihon-championship/2022/doubles-none-boys: 4件
- west-japan/2025/doubles-none-boys: 4件
- highschool-japan-cup/2023/doubles-none-girls: 2件

未調査。影響は小さい（200人中3人）。

### verify-facts-golden の2件失敗は未解決

funemizu-hayato / kurosaka-takuya の失敗は**今回の訂正では変わらない**（数値も同一）。
あれは analysis.json の凍結された集計値と、エンジンが retired を含めて素朴集計した値の差で、
別問題。docs/raw/2026-07-19-cloudflare-build-time.md 追記2の「副産物」節を参照。

### docs/raw の既存記述

`docs/raw/2026-07-19-result-coverage-notice-design.md` の49行目・66行目が
`asian-games-qualifier/2025/doubles-tournament-boys.json` を参照している。
raw は append-only の方針のため書き換えていない。現在のファイル名は
`singles-tournament-boys.json`。

## Compile Log

docs/wiki/data-import.md に反映するもの:

- 「ペア戦カテゴリなのに entries が1人 = カテゴリ誤りかデータ欠落のサイン」という
  データ品質チェック観点（再発検知に使えるので最も再利用価値が高い）

意図的に wiki へ載せないもの:

- 選手別の before/after 数値 — 一度きりの検証値で陳腐化する
- リネームしたファイル名の一覧 — git 履歴が一次情報
- 旧実装がシングルスに混ぜていた件 — `results.tsx` の修正で解消済み。
  経緯はこの raw に残す
- 残存15件の内訳 — 未調査で結論が無い。調査したら別途起票する

---

## 追記（同日）: 残存分の修正と、調査方法の反省

「残っているもの」に挙げた15件（3選手）は、原因が判明して修正済み。
`entries[].playerIds` に**同じ選手IDが2回入っていた**（相方欄に本人をコピーした入力ミス）。

- highschool-japan-cup/2022/doubles-none-girls entryNo=29 → 岩元愛美
- highschool-japan-cup/2023/doubles-none-girls entryNo=69 → 岩元愛美
- west-japan/2025/doubles-none-boys entryNo=112 → 小川友貴

また「ペア戦なのに entries が1人」の3件も修正済み（中本圭哉 / 小松﨑茉代 / 世古早織）。

200選手サンプルでの「相方なしのペア戦」は **0件** になった。

### 反省: サンプリングでの調査が取りこぼしを生んだ

この調査は一貫して「出場数5以上の先頭200選手を buildFacts して逆引きする」方法を
取っていたが、これは**サンプル外の選手が絡む不整合を構造的に見逃す**。
実際、全ファイルを直接走査したところ同じ「本人の重複」パターンが4件残っていた。

- highschool-championship/2023/doubles-none-boys entryNo=225（菅原大馳）
- highschool-championship/2025/doubles-none-boys entryNo=10（深浦琉可）
- highschool-japan-cup/2023/doubles-none-girls entryNo=44（森下芹羽）
- highschool-japan-cup/2023/doubles-none-girls entryNo=62（小林紗依）

**データ不整合の検出は、選手側から逆引きせず `data/tournaments/details/**` を
全走査すること。** この教訓は docs/wiki/data-import.md に反映した。

## Compile Log（追記分）

docs/wiki/data-import.md に反映:

- ペア戦 entries の壊れ方2パターン（1人だけ / 同一ID重複）と検出コード
- 「選手側からサンプリングして逆引きせず、details を全走査する」という調査方法の指針
  （今回の見落としの直接の教訓なので、最も再利用価値が高い）

wiki に載せないもの:

- 個別の entryNo と選手名 — 修正すれば消える一時情報。この raw と
  docs/raw/2026-07-19-manual-fix-checklist.md に残す

---

## 追記2（同日）: 検証スクリプト化と、最後に残っていた不整合

### `npm run check:entries` を追加

`scripts/check-tournament-entries.mjs`。`data/tournaments/details/**` を全走査し、
entries の入力ミスを7ルールで検出する（問題があれば exit 1）。
`check-identity-health.mjs` と同じ「取り込み後に実行する」位置づけ。

ルールは実データでの検出件数を測ってから採用した（全て低頻度＝ノイズにならない）。
詳細は docs/wiki/data-import.md。

このスクリプトが、サンプリング調査で見落としていた分を全て炙り出した。

### 最後に残った1件: 同一人物の三重表記

`highschool-championship/2025/doubles-none-girls.json` で、鹿児島実の同じ選手が
3通りの表記で存在していた。**正しい姓は「荒田」**（他4大会は全て `荒田_空愛` で登録済み）。

| 表記 | 場所 |
|---|---|
| `新田_空愛_鹿児島実_鹿児島県` | participants のみ（どの entry にも未使用） |
| `荒井田_空愛_鹿児島実` | entryNo=49 で使用、prefecture が null |
| `P:新田_空愛_鹿児島実_鹿児島\|...` | matches の scores キー（県名も短縮形） |

さらに**同じ試合が二重登録**されていた。entryNo 採番前に取り込まれた残骸
（`entries:[48,null]` / `[46,null]`）が、正しい `match-83` / `match-202` と併存していた。

残骸だと断定できたのは、この大会の4回戦が全て `prevMatchIds` 2要素なのに
`match-261` だけ3要素だったため。重複が1本余計にぶら下がっていた。

対応: participants を `荒田_空愛_鹿児島実_鹿児島県` 1件に統合し、
残骸2試合を削除してブラケットのリンクを6箇所繋ぎ直した（matches 319 → 317）。
結果、`check:entries` が exit 0、300選手検査で「相方なしのペア戦」0件。

### JSON を編集する際の注意（実作業でのつまずき）

このリポジトリの大会 JSON は Prettier の inline 整形が効いており、
`"entries": [2, 3]` や `"scores": { "2": 4, "3": 1 }` が1行に収まっている。

`JSON.parse` → 編集 → `JSON.stringify(x, null, 2)` で書き戻すと**この整形が失われ、
差分が5,794行に膨れる**（実際に一度やってしまった）。`prettier --write` でも
`scores` は展開されたままで完全には戻らない。

**大会 JSON の部分修正は、JSON 経由ではなく文字列置換で行うこと。**
今回は17行 / 44行の差分に収まり、レビュー可能な状態を保てた。

## Compile Log（追記2分）

docs/wiki/data-import.md に反映:

- `npm run check:entries` の存在と7つの検出ルール表、実行タイミング
- 「統計エンジンは不整合を黙って除外するので表示では気付けない」という理由づけ

wiki に載せないもの:

- 荒田空愛の個別事例 — 修正済みで再発しない一時情報
- 二重登録ブラケットの繋ぎ直し手順 — 一度きりの作業。手順は
  docs/raw/2026-07-19-manual-fix-checklist.md の 7-2 に残す
- Prettier 整形の注意 — 有用だが data-import ではなく編集作法の話。
  必要なら別途 AGENTS.md か docs/wiki に起票する（**未対応**）

まだ書き戻していないもの:

- 「大会 JSON の部分修正は文字列置換で行う」という編集作法。
  今のところこの raw にしか無い
