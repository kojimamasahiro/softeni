# 2026-07-19 手動修正が必要な箇所リスト

ビルド時間の調査（docs/raw/2026-07-19-cloudflare-build-time.md）と、その過程で見つかった
データ不整合（docs/raw/2026-07-19-asian-games-qualifier-2025-singles-correction.md）から
派生した、**人が判断して直す必要がある項目**のまとめ。

自動で直せるものは既に適用済み。ここに残っているのは、正解データを人が知っている必要が
あるもの、または方針判断を伴うものだけ。

**検出は `npm run check:entries` で自動化した**（`scripts/check-tournament-entries.mjs`）。
問題があれば終了コード1を返す。以下の 2-4〜2-7 と 7 はこのコマンドで再現できる。

---

## 1. package.json の prebuild 配線が未適用（最優先・影響大）

**状態**: 作業ツリーに未コミット。commit `ae7730ab` に `cache-sync.mjs` は入ったが
`package.json` の配線が漏れている。

**影響**: これが無いと `cache-sync` が一度も呼ばれず、Cloudflare のビルド時間は
**8分53秒のまま**（本来は約7分になる）。`generate-facts` が毎回フルビルド（約2分）に落ちる。

**修正箇所**: `package.json` の `scripts`

```diff
-    "prebuild": "node scripts/generate-players-json.mjs && ... && npm run playerstats:rankings",
+    "prebuild": "node scripts/playerStats/cache-sync.mjs restore && node scripts/generate-players-json.mjs && ... && npm run playerstats:rankings && node scripts/playerStats/cache-sync.mjs save",
+    "playerstats:cache-sync": "node scripts/playerStats/cache-sync.mjs",
```

先頭に `cache-sync.mjs restore &&`、末尾に `&& node scripts/playerStats/cache-sync.mjs save`
を足すだけ。`playerstats:cache-sync` は手動実行用のエイリアスなので任意。

**確認方法**: 次のビルドログに `[cache-sync] no cache found` が出て、
その次のビルドで `[cache-sync] restored from cache (saved at ...)` に変われば成功。
初回はキャッシュが無いのでフルビルドのままで正常。

---

## 2. ペアの相方が「本人の重複」になっている（3件は修正済み・**4件が新規発覚**）

### 済 修正済み（2026-07-19）

- `highschool-japan-cup/2022/doubles-none-girls` entryNo=29 → 岩元愛美 を設定
- `highschool-japan-cup/2023/doubles-none-girls` entryNo=69 → 岩元愛美 を設定
- `west-japan/2025/doubles-none-boys` entryNo=112 → 小川友貴 を設定

### 未 未修正 4件（**当初のリストから漏れていた**）

当初の調査は「出場数5以上の先頭200選手」をサンプルしていたため、
それ以外の選手が絡む分を取りこぼしていた。全 `data/tournaments/details/**` を
直接走査したところ、同じパターンが4件残っていた。

検出方法（今後はこちらを使う）:

```js
// entries[].playerIds に同一 ID が2回入っているものを全ファイルから探す
for (const e of j.entries ?? []) {
  const ids = e.playerIds ?? [];
  if (ids.length > 1 && new Set(ids).size !== ids.length) { /* 該当 */ }
}
```

#### 2-4. `data/tournaments/details/highschool-championship/2023/doubles-none-boys.json`

- `entryNo: 225` (`type: seed`)
- 現在: `["菅原_大馳_学法石川_福島県", "菅原_大馳_学法石川_福島県"]`
- 手掛かり: 学法石川（福島県）、シード。**3回戦敗退**（2回戦・3回戦の2試合）

#### 2-5. `data/tournaments/details/highschool-championship/2025/doubles-none-boys.json`

- `entryNo: 10` (`type: seed`)
- 現在: `["深浦_琉可_長崎南山_長崎県", "深浦_琉可_長崎南山_長崎県"]`
- 手掛かり: 長崎南山（長崎県）、シード。**2回戦敗退**（1試合）

#### 2-6. `data/tournaments/details/highschool-japan-cup/2023/doubles-none-girls.json`

- `entryNo: 44`
- 現在: `["森下_芹羽_上溝南_神奈川県", "森下_芹羽_上溝南_神奈川県"]`
- 手掛かり: 上溝南（神奈川県）。2試合（round 未設定、いずれも敗退）

#### 2-7. `data/tournaments/details/highschool-japan-cup/2023/doubles-none-girls.json`

- `entryNo: 62`
- 現在: `["小林_紗依_山形市立商_山形県", "小林_紗依_山形市立商_山形県"]`
- 手掛かり: 山形市立商（山形県）。2試合（round 未設定、いずれも敗退）

※ 2-6 と 2-7 は同じファイル内の別エントリー。

---

### 修正前の記録（2-1〜2-3）

**症状**: `entries[].playerIds` に同じ選手IDが2回入っている。相方欄に本人をコピーした入力ミス。
統計エンジンは相方を特定できず、パートナー別集計からその試合が落ちる。

正しい相方の名前は元の大会結果を見ないと分からないため、手動修正が必要。

### 2-1. `data/tournaments/details/highschool-japan-cup/2022/doubles-none-girls.json`

- `entryNo: 29`
- 現在: `"playerIds": ["岩元_望美_和歌山信愛_和歌山県", "岩元_望美_和歌山信愛_和歌山県"]`
- 2つ目を**正しい相方のID**に差し替える
- 手掛かり: 和歌山信愛。**ベスト4**（2回戦→3回戦→4回戦→準々決勝→準決勝の5試合）
- 情報源: https://www.gosen-sp.jp/hjs/

### 2-2. `data/tournaments/details/highschool-japan-cup/2023/doubles-none-girls.json`

- `entryNo: 69`
- 現在: `"playerIds": ["岩元_望美_和歌山信愛_和歌山県", "岩元_望美_和歌山信愛_和歌山県"]`
- 手掛かり: 和歌山信愛。2試合（round 未設定）
- 情報源: https://www.gosen-sp.jp/hjs/

### 2-3. `data/tournaments/details/west-japan/2025/doubles-none-boys.json`

- `entryNo: 112`
- 現在: `"playerIds": ["平山_綾一_UBE_山口県", "平山_綾一_UBE_山口県"]`
- 手掛かり: UBE（山口県）。**4回戦敗退**（1〜4回戦の4試合）
- 情報源: https://www.soft-tennis.com/nara/

---

## 3. 済 ペア戦なのに entries が1人しかいない 3件（2026-07-19 修正済み）

全ファイル再走査で該当ゼロを確認済み。以下は記録用。

- `zennihon-championship/2022/doubles-none-boys` entryNo=93 → 中本圭哉 を追加
- `zennihon-championship/2022/doubles-none-girls` entryNo=9 → 小松﨑茉代 を追加
- `zennihon-workers/2024/doubles-over35-girls` entryNo=3 → 世古早織 を追加

### 修正前の記録

**症状**: ダブルスのカテゴリなのに `playerIds` が1人だけ。相方が未入力。
2 と違い、そもそも配列に1要素しかない。

※ アジア競技大会予選2025 の6ファイルも同じ症状だったが、あれは「実際はシングルス戦」
だったため `singles-*` へのカテゴリ訂正で解決済み。以下の3件は真のダブルス大会。

### 3-1. `data/tournaments/details/zennihon-championship/2022/doubles-none-boys.json`

- `entryNo: 93` (`type: seed`)
- 現在: `"playerIds": ["高月_拓磨_ヨネックス_東京都"]`
- 手掛かり: ヨネックス（東京都）、シード。**5回戦敗退**（2〜5回戦の4試合）
- 情報源: https://www.jsta.or.jp

### 3-2. `data/tournaments/details/zennihon-championship/2022/doubles-none-girls.json`

- `entryNo: 9` (`type: packing`)
- 現在: `"playerIds": ["山岡_衣織_ダンロップ_福島県"]`
- 手掛かり: ダンロップ（福島県）。**1回戦敗退**（1試合）
- 情報源: https://www.jsta.or.jp

### 3-3. `data/tournaments/details/zennihon-workers/2024/doubles-over35-girls.json`

- `entryNo: 3` (`type: null`)
- 現在: `"playerIds": ["川島_真織_ＥＡＳＴＣ_静岡県"]`
- 手掛かり: ＥＡＳＴＣ（静岡県）。**予選リーグA組3位**（2試合、いずれも敗退）
- 情報源: https://www.jsta.or.jp

---

## 7. 済 同一人物が表記ゆれで二重登録（2026-07-19 修正済み）

`data/tournaments/details/highschool-championship/2025/doubles-none-girls.json` で、
鹿児島実の同じ選手が姓違い・県名有無の2通りで participants に登録されていた。
**正しい姓は「荒田」**（他大会 zennihon-primaryschool/2019・zennihon-singles/2025・
highschool-japan-cup/2024・2025 は全て `荒田_空愛` で登録済み）。

| 誤ったID | 状態 |
|---|---|
| `新田_空愛_鹿児島実_鹿児島県` | participants のみ（どの entry にも未使用） |
| `荒井田_空愛_鹿児島実` | entryNo=49 で使用、prefecture が null |

対応: participants の2件を `荒田_空愛_鹿児島実_鹿児島県` 1件に統合し、
entryNo=49 の playerIds と matches の名前キーを追随（差分17行）。

### 未 7-1. `data/players/index.json` に幽霊選手が2件残る

上記の修正で、以下2件は**どの大会データからも参照されなくなった**（count が 0 になる）。

- `id=10919 荒井田空愛`
- `id=13239 新田空愛`

正しい `id=2915 荒田空愛` は count 4 → 5 に増える。

`index.json` は ID を再利用しない追記型で git 管理下のため、自動では消えない。
**放置しても実害は小さい**（`information.json` を持たないのでプロフィールページは生成されず、
count<5 なので結果ページも生成されない）。ただし検索インデックスには残る。

注意: `node scripts/extract-players.mjs` で count は再計算されるが、
**同時に未登録の新規選手654人が追記され、ファイル全体が並び替わる**（2,070行の差分）。
この修正とは無関係の変更が混ざるので、別途タイミングを決めて実行するのが良い。

### 済 7-2. 同じ試合が二重登録されていた（2026-07-19 修正済み）

`check:entries` の `match-entry-not-found` 2件の原因は、**同じ試合が2通りで登録されていた**こと。

| 正しい方 | 削除した残骸 |
|---|---|
| `match-83` 2回戦 `entries:[49,48]` `w:49` | `match-82` 2回戦 `entries:[48,null]` `w:null` |
| `match-202` 3回戦 `entries:[49,46]` `w:46` | `match-201` 3回戦 `entries:[46,null]` `w:46` |

`match-82` / `match-201` は entryNo が採番される前に取り込まれた残骸だった
（entries に null、勝者を記録できず `winnerEntryNo: null`、scores が名前キー）。

**残骸だと断定できた根拠**: この大会の4回戦は全て `prevMatchIds` が2要素なのに、
`match-261` だけが3要素（`["match-200","match-201","match-202"]`）だった。
重複が1本余計にぶら下がっていた証拠。

実施した7ステップ:

1. `match-82`・`match-201` を削除
2. `match-9.nextMatchId`: `match-82` → `match-83`
3. `match-81.nextMatchId`: `match-201` → `match-202`
4. `match-83.prevMatchIds`: `[]` → `["match-9"]`（`prevMatchId` も）
5. `match-202.prevMatchIds`: `["match-83"]` → `["match-83","match-81"]`
6. `match-261.prevMatchIds`: `["match-200","match-201","match-202"]` → `["match-200","match-202"]`
7. JSON 妥当性・参照整合を検証

結果: matches 319 → 317、`prevMatchIds` の要素数分布から3要素が消滅、
next/prev の参照切れ 0件、**`check:entries` が exit 0（問題なし）**。

荒田空愛(id=2915) の facts にも正しく反映された。

```
2回戦 win  4-1 partner=須ケ牟田友菜
3回戦 lose 0-4 partner=須ケ牟田友菜
```

300選手を検査して「相方なしのペア戦」は **0件**。

---

## 4. 済 `verify-facts-golden.ts` の2件失敗（2026-07-19 解決）

**症状**: `npm run playerstats:verify` の一部として走る golden 突合が2件失敗する。
ビルドは止まらない（prebuild / build / postbuild のいずれにも含まれていない）。

```
✗ funemizu-hayato (id=3)  facts M=113 W=96 L=17 G=442-183 vs golden M=113 W=96 L=16 G=441-179
✗ kurosaka-takuya (id=10) facts M=175 W=142 L=32 G=663-306 vs golden M=175 W=141 L=32 G=659-305
```

**中身**: golden は `data/players/<slug>/analysis.json` の集計値。これが内部矛盾している。

| | totalMatches | 勝 + 敗 |
|---|---|---|
| funemizu golden | 113 | 96 + 16 = **112** |
| kurosaka golden | 175 | 141 + 32 = **173** |

`generate-player-analysis.mjs` は `latestMatch` などしか書き換えず、
totalMatches / wins / losses / games は昔の値のまま凍結されている。

**判断が必要な点**: golden を「エンジンが retired 込みで素朴集計した値」に更新するのか、
それとも verify スクリプト側の比較基準（`naiveAggregateAll` は retired を含む）を
方針（ADR-011: retired は勝率・ゲーム率から全除外）に合わせるのか。

なお `/players/[id]/results` の表示側は既にエンジンに寄せ済みなので、
**この2件を放置してもサイトの表示は正しい**。verify が赤いままになるだけ。

---

## 5. 済 docs/raw の旧ファイル名参照（2026-07-19 対応）

`docs/raw/2026-07-19-result-coverage-notice-design.md` の **49行目・66行目** が
`asian-games-qualifier/2025/doubles-tournament-boys.json` を参照している。
現在のファイル名は `singles-tournament-boys.json`。

docs/raw は append-only の方針なので書き換えていない。追記で補足するか、
このまま履歴として残すかは判断次第。

---

## 6. 作業ツリーに残っている派生ファイルの差分（コミット可否の判断）

調査中に prebuild を実行したため再生成された。内容は最新データを反映した正しい状態で、
`npm run build` を回せば同じものが出る。

- `data/players/funemizu-hayato/analysis.json`
- `data/players/kurosaka-takuya/analysis.json`
- `data/ratings/current.json`
- `data/ratings/upsets.json`
- `public/data/players-min20.json`

---

## 修正後の確認手順

1. `npx ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/generate-facts.ts`
   （2・3 を直した場合。増分で走る）
2. 下記でパートナー別の欠落が減ったことを確認（現状は200人中3人・15試合）

```js
// 検査スクリプトの骨子
const total = st.career.overall.matches.total;
const singles = st.career.byDiscipline?.singles?.matches.total ?? 0;
const withId = st.byPartner.filter(r => r.partnerId != null)
                 .reduce((a, r) => a + r.matches.total, 0);
const gap = total - singles - withId;  // 0 が理想
```

3. `npm run build` でビルドが通ること
4. 1 を直した場合は Cloudflare のビルドログで `[cache-sync]` の行を確認

---

## 追記: 検出の自動化（2026-07-19）

手動チェックリストの多くは自動検出できるようにした。

### `npm run check:entries`（全データ一括）

`scripts/check-tournament-entries.mjs`。`data/tournaments/details/**` を全走査。
問題があれば終了コード1。`temp/` 配下は入力途中の作業ファイルなので除外。

### 入力ツール側（保存前）

`tools/shared/validate-entries.js` にルールの実体を置き、Node スクリプトと
入力ツールが同じモジュールを共有する。`ToolBridge.normalize()` が成形直後に検証し、
`ToolBridge.renderValidation(el)` が結果を表示する。

組み込み済み: `tools/tournament3/`、`tools/roundrobin/`。
未対応: `tools/tournament/`、`tools/tournament2/`（共有パイプラインを経由しない旧ツール）。

ツール側では `categoryId` を渡さず、entries の多数派人数から種目を推定する。
保存ファイル名は localStorage 由来で前回の種目が残る可能性があり、
誤判定（ダブルス入力中に singles と見なす等）を避けるため。

### 検出ルールと発見時の件数

| ルール | 初回検出 | 備考 |
|---|---|---|
| `duplicate-player-id` | 4 | 修正済み |
| `match-entry-not-found` | 2 | **未修正**（item 7） |
| `orphan-participant` | 1 | **未修正**（item 7）。このルールが item 7 を発見した |
| `pair-single-player` | 0 | item 3 修正後 |
| `singles-multi-player` | 0 | |
| `unknown-participant` | 0 | |
| `result-entry-not-found` | 0 | |

### prebuild への組み込みは保留

現時点で3件検出＝終了コード1のため、prebuild に入れるとデプロイが止まる。
item 7 を修正してから配線する。

```
"prebuild": "... && node scripts/check-tournament-entries.mjs && ..."
```

---

## 追記2: item 7 修正完了と prebuild 配線（2026-07-19）

### 全項目クリア

出場5以上の**全1,917人**（サンプリングではなく全員）で確認:

| | 結果 |
|---|---|
| `npm run check:entries` | exit 0（問題なし） |
| 相方なしのペア戦 | 0人 0件 |
| ブラケット参照切れ | 0 |
| `prevMatchIds` 3要素以上 | 0（残骸削除の副作用なし） |
| `generate-facts` | `no changes`（派生データ最新） |

### prebuild に配線した

0件になったので `check-tournament-entries.mjs` を prebuild の**先頭**に入れた。
データ不整合があればビルドが即座に止まる（生成処理を無駄に回さない）。

```
1.  node scripts/check-tournament-entries.mjs      ← 追加
2.  node scripts/playerStats/cache-sync.mjs restore
3.  node scripts/generate-players-json.mjs
...
11. node scripts/playerStats/cache-sync.mjs save
```

### cache-sync の fail-safe 動作を実地確認

サンドボックス環境では `.next/cache` への書き込みが権限で弾かれるが、
`[cache-sync] failed (non-fatal): EACCES ...` を出して **exit 0** で継続した。
設計どおり「キャッシュ層の障害でビルドを落とさない」が働いている。

### item 1（package.json の配線）は解消

`prebuild` に cache-sync の restore / save が入った状態で確定。
次のビルドログで確認すること:

- 初回: `[cache-sync] no cache found; generate-facts will do a full rebuild`
- 2回目以降: `[cache-sync] restored from cache (saved at ...)` かつ
  `[generate-facts] incremental: ...`

### 残っている項目

- **item 4**: `verify-facts-golden` の2件失敗（方針判断）。サイト表示は正しいので緊急性なし
- **item 5**: docs/raw の旧ファイル名参照（軽微）
- **item 6**: 派生ファイルの差分（コミット可否の判断）

---

## 追記3: item 4 と item 5 の決着（2026-07-19）

### item 4 は「方針判断」を待たずに解決していた

`verify-facts-golden.ts` は現在 **exact=22 / failed=0**。

原因の見立てが間違っていた。「`generate-player-analysis.mjs` は latestMatch などしか
書き換えず、totalMatches / wins / losses は凍結されている」と書いたが、**実際には
エンジン由来で集計値も再生成する**（実行ログ `wrote analysis.json for N players (engine-sourced)`）。

一連の作業で prebuild を回した際に analysis.json が更新され、内部矛盾が解消した。

```
funemizu-hayato: totalMatches=113 wins=96 losses=17 → 勝+敗=113（一致）
```

つまり golden が古かっただけで、方針の食い違いではなかった。
**item 4 で提起した「golden を更新するか、verify の比較基準を変えるか」という判断は不要。**

### item 5 は本文に注釈を追記した

`docs/raw/2026-07-19-result-coverage-notice-design.md` を修正。
docs/raw は原則 append-only だが、依頼を受けて本文に `【2026-07-19 訂正】` を併記した
（元の記述は削除していない）。ファイル末尾に「訂正記録」節も追加。

調べたところ**2箇所とも陳腐化していた**（当初は1箇所だけのつもりだった）。

| 箇所 | 状態 |
|---|---|
| `asian-games-qualifier/2025/doubles-tournament-boys.json` | `singles-` にリネーム。試合数 43/47 は現在も正 |
| `highschool-championship/2025/doubles-none-girls.json` の「318/319・未決定1件」 | 未決定の正体は二重登録の残骸。削除済みで現在 317/317 |

後者は ResultCoverageNotice の設計根拠そのものだったため、**設計判断が揺らがないか確認した**。
`decided/total` 比ではなく `ongoing` を主軸にする判断は有効。
前者が現在も 43/47 で残っており、根拠として機能するため。

### 残っている項目

- **item 6**: 派生ファイルの差分（コミット可否の判断）
- **item 7-1**: `data/players/index.json` の幽霊選手2件（`extract-players.mjs` 実行タイミング待ち）
