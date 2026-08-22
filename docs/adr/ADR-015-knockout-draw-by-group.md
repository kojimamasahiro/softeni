# ADR-015: 決勝トーナメントの席順は「予選リーグの組」に持たせる

## Status

Accepted（2026-08-22）

## Context

ブラケット（トーナメント表）の席順は [ADR 化されていない 2026-07-26 の設計](../raw/2026-07-26-idea-bracket-redesign.md)
以来、`entries[].type`（`seed` / `extra` / `packing`）から復元してきた。`entryNo` 昇順＝ドロー順で、
`seed`/`extra` は本人＋bye で2枠、`packing` は隣接2組で2枠、と積むと席順が決まる。
純トーナメント大会ではこれが実データと 100% 一致し、285大会・26,527試合で不一致0件だった。

**予選リーグ→決勝トーナメント形式の大会（90ファイル）ではこの方式が原理的に成立しない。**
2026-08-22 に `bracket-slot-parity` の誤検知3件を調べて判明した
（[調査メモ](../raw/2026-08-22-bracket-slot-parity-roundrobin-false-positive.md)）。

実データで確認した事実:

1. `matches` の `nextMatchId` から実際の決勝Tブラケットを復元し、各席を
   `results[].roundrobin` の (組, 組内順位) でラベルすると、**席順は完全に規則的**だった。

   ```
   secondaryschool-tohoku-block/2026 男子: A1 D2 C2 B1 C1 B2 A2 D1
   secondaryschool-tohoku-block/2026 女子: A1 B2 A2 B1 C1 D2 C2 D1
   zennihon-business-group/2026:          A1 D2 E2 B1 F2 C1 D1 A2 E1 B2 C3 F1
   zennihon-junior/2025 u14男子:           A1 B1 C1 D1 E1 F1 G1
   ```

   いずれも「1位通過 vs 別組の2位通過」のクロス配置。つまり**席は「A組1位の席」であって
   「◯番の組の席」ではない**。誰がそこに入るかはリーグが終わるまで決まらない。

2. `entryNo` 順に積む方式をこの形式の大会に適用すると、**90大会中17大会で誤ったブラケット**に
   なる。`highschool-japan-cup` が entryNo 順と一致して見えたのは、全組1位通過かつ組が
   entryNo 順に並んでいるという特殊ケースにすぎなかった。

3. 単位の取り違えは検証の誤検知だけでなく、次も同時に引き起こしていた。
   - 開催前に決勝Tの表を出せない（誰が入るか未定なので `type` を誰にも付けられない）。
   - 「誰が決勝Tに進んだか」を主張する系統が `entries[].type` / `results[].tournament` /
     `matches` の3つに分かれ、食い違っても検出できない。実際に
     `highschool-japan-cup/2021/doubles-none-boys` の予選21組で3系統が3通りのことを言っていた
     （type→62 / results→63 / matches→61。ゲーム得失と `normalize-core.js` の順位規則から
     61 が正しく、他2つは古い順位計算の残骸だった）。

## Decision

**予選リーグ→決勝トーナメント形式の大会は、決勝Tの席順を `knockoutDraw` として
details JSON に明示的に持つ。席は (組, 組内順位) で指定する。**

```json
"knockoutDraw": {
  "slots": [
    {"group":"A","rank":1},
    null,
    {"group":"D","rank":2},
    {"group":"E","rank":2}
  ]
}
```

- `slots` の並びがそのままブラケットの席順。長さは2の冪。`null` は空席（不戦勝）。
- 実際の `entryNo` は `results[].roundrobin.{group, rank}` を引いて解決する。
  まだ順位が確定していない席は空席のまま（結果未入力の大会と同じ扱い）。
- **`entries[].type` は予選リーグを含まない大会専用**と定義し直す。予選リーグ大会の
  `type` は席順の情報として読まない。

復元の優先順位は `knockoutDraw` →（無ければ）`entries[].type`。

完了済み大会の `knockoutDraw` は `matches` から機械的に起こせる。決勝から `nextMatchId` を
遡って木を組み、葉の位置を席に割り当てる。**書き込む前に「復元した席順で計算した合流ラウンドが
knockout の全試合と一致するか」を検算し、通らない大会には書き込まない。**
手入力が必要なのは開催前・進行中の大会だけになる。

起こす手順の実体は `tools/shared/knockout-draw.js`（Browser + Node 両対応の UMD）に置き、
**入力ツール（`tools/shared/normalize-core.js`）と一括生成スクリプト
（`npm run bracket:draw -- --apply`）が同じモジュールを共有する**
（`validate-entries.js` と同じ方針。ルールの二重管理を避けるため）。
入力ツールは保存時に `knockoutDraw` を出力に含めるので、新規入力の大会は生成スクリプトを
別途走らせなくてよい。

**決勝が1試合だけの大会にはドローを作らない。** リーグ→リーグ→優勝決定戦のような形式では
ブラケットが存在せず、2枠のドローは席順の情報を何も持たないため。実例:
`zennihon-university-ouza/2026/team-none-boys`（予選リーグ6組 → 準決勝リーグ2組 → 優勝決定戦）、
`zennihon-senbatsu/2026/singles-none-{boys,girls}`。検証ルールもこの形式には
`knockoutDraw` を要求しない。

## Alternatives

### 案A: 入力検証（`bracket-slot-parity`）だけ直す

予選リーグ大会では決勝T出場者だけに絞ってから枠を積む。全データでシミュレートすると
誤検知3件が0件になり副作用も無かったが、**ビルドの警告が消えるだけ**で、席順のモデルが
間違っているという本体は残る。開催前の表も出せないまま。採らない。

### 案B: 同じ絞り込みを表示側（`describeBracketLayout`）にも適用する

「◯回戦で当たる」を予選リーグ大会でも復元できるようにする案。実データで検証したところ
**90大会中17大会で誤ったブラケットを出す**（上記 Context 2）。「誤ったラウンド名を断定口調で
出す方が無害な欠落より悪い」という 2026-07-31 の判断に反するので採らない。

### 案C: 「席順が entryNo 順か再抽選か」を大会ごとのフラグで持つ

A型（entryNo 順）とB型（再抽選）を区別する1フィールドを足す案。しかし実測の結果
A型は「全組1位通過かつ組が entryNo 順」という偶然の一致であってフラグで表せる区別ではなく、
またB型では席順そのものが分からないままなので機能が復活しない。採らない。

### 案D: 完了大会は `matches` の木をそのまま使い、席順は持たない

データ追加はゼロで済むが、開催前・進行中の大会（`nextMatchId` が付かない）では
何も出せない。`knockoutDraw` は完了大会では案Dと同じ情報を持ち、加えて開催前にも使える。

## Consequences

- ブラケット復元の適用が **285大会 → 372大会**、突合した試合が **26,527件 → 27,633件**に増え、
  **不一致は0件のまま**（`npm run bracket:verify`）。復元不可は93大会→9大会。
- `bracket-slot-parity` の誤検知3件が消え、`npm run check:entries` は警告0件になった。
- 予選リーグ大会でも新描画（`BracketSheets`）と記事の「◯回戦で当たる」が使えるようになる。
- **開催前に決勝Tの表を出せる余地ができた**が、未確定席の見せ方（「A組1位」と書くか空欄か）は
  未設計。現状は空席として描かれる。
- 二重管理が1箇所増えた。`lib/bracketLayout.ts` の `layoutFromKnockoutDraw` と
  `scripts/verify-bracket-layout.mjs` の `layoutFromDraw` は同じ手順を別実装で持つ
  （検証の意味を保つための意図的な重複）。**片方を変えたら両方直すこと。**
- `entries[].type` は予選リーグ大会では読まれなくなったが、既存データには残っている
  （90ファイル中26ファイルに値が入っている）。読み手が誤解しないよう定義をここに記す。
  削除は別途。

## Related Files

- `tools/shared/knockout-draw.js` — 席順を起こす手順の実体（入力ツールと生成スクリプトで共有）
- `scripts/generate-knockout-draw.mjs` — 全データを走査して書き戻す（`npm run bracket:draw`）
- `tools/shared/normalize-core.js` — 入力ツールの保存時に `knockoutDraw` を出力へ含める
- `lib/bracketLayout.ts` — `layoutFromKnockoutDraw` / `describeBracketLayout`
- `scripts/verify-bracket-layout.mjs` — 全データ突合（`npm run bracket:verify`）
- `tools/shared/validate-entries.js` — `knockout-draw-missing` / `-parity` / `-unresolved`
- `lib/tournamentRecords.ts`（`RawKnockoutDraw`）／ `src/types/tournament.ts`（`KnockoutDraw`）
- `lib/packedPageData.ts` — ページに渡す packed 形式は**ホワイトリスト方式**なので、
  `knockoutDraw` を載せないと本番だけ復元できない。`bracketLayout.test.ts` に round-trip テストがある
- [調査メモ](../raw/2026-08-22-bracket-slot-parity-roundrobin-false-positive.md)

## Open Questions

- `zennihon-university-ouza/2026/team-none-boys` は**予選リーグ→準決勝リーグ→優勝決定戦**の
  2段リーグ形式で、決勝Tが無いためドローは不要（対象外）。ただし
  `results[].roundrobin` は予選の組しか持てず、**準決勝リーグの順位が記録されていない**。
  「ベスト4」「ベスト8」の根拠が `matches` にしか無い状態。`roundrobin` を段ごとの配列に
  するかは、この形式が現状1大会だけなので保留。
- 開催前・進行中の大会で未確定席をどう見せるか（「A組1位」と書くか空欄のままか）。
- 予選リーグ大会に残っている `entries[].type` を消すか。表示・検証はもう読まないが、
  投入ツール（`tools/tournament3` の `buildEntriesMeta`）が今も書いている。
