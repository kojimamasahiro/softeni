# 学連 prefecture 汚染(「中央大学_学連」表示)の根本修正プラン

日付: 2026-07-17
状態: 実施済み(同日実行。結果は末尾の「実施結果」参照)
症状報告: `tournaments/all/east-japan/2026/doubles/none/boys/` でチーム名が「中央大学_学連」と表示される。

## 症状

east-japan/2026 の participants に2パターンの汚染がある:

| パターン | 例 | 件数(boys+girls) |
|---|---|---|
| A: team に `_学連` 混入 + prefecture が `学連県` | `{"team": "中央大学_学連", "prefecture": "学連県"}` id=`中尾_彦斗_中央大学_学連_学連県` | team汚染 24チーム分 |
| B: team は正常だが prefecture が `学連県` | `{"team": "札幌学院大学", "prefecture": "学連県"}` id=`橋本_侑弥_札幌学院大学_学連県` | boys/girls 計136人が学連絡み |

UI は participants.team / prefecture をそのまま表示するため、データ汚染がそのまま画面に出ている。

## 根本原因(コード2箇所 + 防御の穴1箇所)

元データ(initialPlayers)は `prefecture: "学連"` だった(east-japan/2025、zennihon-university と同じ慣例。west-japan/2026 のみ `日本学連`)。
これを取り込む `tools/shared/normalize-core.js` に2つの欠陥がある:

### 原因1: `normalizePrefectureName()` が連盟値に `県` を誤付与

```js
// 除外は 日本学連 のみ。学連/高体連/中体連/日本連盟/フリー は素通りして 県 が付く
if (s.includes('日本学連')) return s;
return s + '県';   // 学連 → 学連県
```

→ パターンB(`学連県`)の直接原因。

### 原因2: `registerFromIdString()` が連盟値を prefecture と認識できない

id文字列 `姓_名_チーム_学連` を分解する際、末尾トークンが `/(?:都|道|府|県)$/` にマッチしないと
prefecture と見なさず **チーム名に吸収** する:

```js
if (rest.length >= 2 && /(?:都|道|府|県)$/.test(rest[rest.length - 1])) {
  prefecture = rest[rest.length - 1];
  team = rest.slice(0, -1).join('_');
} else {
  team = rest.join('_');   // → team = "中央大学_学連"
}
```

その後 `registerOpponent()` のマージで prefecture=`学連` が補完され、原因1で `学連県` 化、
id 再構築で `中尾_彦斗_中央大学_学連_学連県` が完成する。→ パターンAの直接原因。
(ペア文字列が詳細オブジェクトより先に登録された選手だけAになる。順序依存で A/B が混在した理由)

### 原因3(防御の穴): `scripts/normalize-prefectures.mjs` が `学連県` を救えない

クリーンアップスクリプトの誤付与除去マップが1エントリしかない:

```js
const FEDERATIONS = new Map([['日本連盟県', '日本連盟']]);  // 学連県 が無い
const FEDERATION_KEEP = new Set(['日本学連', '学連', '高体連', '中体連', '日本連盟', 'フリー']);
```

→ `学連県` は「未解決」警告どまりで修復されない。

### ルールとの関係

docs/wiki/data-import.md「ルール: 都道府県は省略しない」に
**「連盟値はそのまま保持し、誤付与された県だけ外す(日本連盟県→日本連盟)」** と明記済み。
つまり本件は仕様が曖昧だったのではなく、実装(normalize-core.js)がルール違反している状態。

## 汚染範囲の調査結果

participants フィールドレベル(team / prefecture)の汚染は **east-japan/2026 の2ファイルのみ**:

- `data/tournaments/details/east-japan/2026/doubles-none-boys.json`(team汚染15チーム、`学連県`)
- `data/tournaments/details/east-japan/2026/doubles-none-girls.json`(team汚染9チーム、`学連県`)

他ファイルの `_学連` / `_高体連` 等の grep ヒットは id の正当な構成要素(`姓_名_チーム_学連`)であり汚染ではない。

ただし派生データには `中央大学_学連` 等として **伝播済み**(いずれも prebuild で再生成される生成物):

- `data/rankings/2026-doubles-{boys,girls}.json`(`名前@中央大学_学連` キー)
- `data/players/_facts/*.json`(約190ファイル)
- `public/data/players-min20.json` / `players-search.json` / `players-lite/chunk-*.json`
- `public/data/beta-matches/**`(要確認)

## 修正プラン

### Step 1: 根本修正 — `tools/shared/normalize-core.js`

- 連盟トークン集合を定義: `日本学連 / 学連 / 高体連 / 中体連 / 日本連盟 / フリー`
  (+ 外国名 `韓国 / 台湾 / 中華台北 / モンゴル` も同様に県付与対象外とする)
- `normalizePrefectureName()`: 集合に含まれる値はそのまま返す(`日本学連` の includes 判定を置換)
- `registerFromIdString()`: 末尾トークンが `都道府県` で終わる **または連盟トークン集合に含まれる** 場合に
  prefecture として分離する

### Step 2: 防御強化 — `scripts/normalize-prefectures.mjs`

- 汎用化: `s.endsWith('県') && FEDERATION_KEEP.has(s.slice(0, -1))` なら県を外す
  (`学連県→学連`、`高体連県→高体連` 等。既存の `日本連盟県` マップも包含される)

### Step 3: データ修復 — 一回限りスクリプト `scripts/repair-gakuren-prefectures.mjs`

対象: east-japan/2026 の2ファイル。`repair-team-participant-ids.mjs` と同じ流儀で:

- `team` 末尾の `_学連` を除去
- `prefecture: "学連県"` → `"学連"`(east-japan/2025・zennihon-university の既存慣例に合わせる)
- id を `[lastName, firstName, team, prefecture].filter(Boolean).join('_')` で再計算し、
  `"id"` フィールドと `entries[].playerIds` 等の配列要素に限定してピンポイント置換
  (JSON全体は再シリアライズしない。裸の全文置換はしない)
- `--dry-run` 対応、冪等、修復後の id 重複(誤マージ)チェック付き
- 実行後 `node scripts/normalize-prefectures.mjs --dry-run` と
  `node scripts/check-identity-health.mjs` で残汚染ゼロを確認

### Step 4: 派生データ再生成

prebuild 相当を実行して伝播済み汚染を解消:

```
node scripts/generate-players-json.mjs
node scripts/generate-players-lite.mjs
npm run playerstats:facts
node scripts/generate-player-analysis.mjs
node scripts/generate-beta-matches-json.mjs
node scripts/generate-match-reverse-index.mjs
node scripts/generate-rare-events.mjs
npm run playerstats:rankings
```

再生成後、`中央大学_学連` / `学連県` が派生データから消えたことを grep で確認。
(次回ビルドの prebuild でも自然に直るため、このStepを省略する選択肢もある)

### Step 5: ドキュメント同期

- docs/wiki/data-import.md: 本件の追記(連盟値の県誤付与は normalize-core.js 側でも防止済み、
  `学連県` 等の誤付与除去が normalize-prefectures.mjs で汎用化された旨)
- 本ノートに Compile Log を追記

## やらないこと(スコープ外)

- `学連` と `日本学連` の統一: 現状 wiki のルールが両方を別値として保持すると明記しているため触れない。
  統一したくなったら別途判断(Open Question 候補)。
- チーム名の名寄せ一般(`normalize-team-names.mjs` の管轄)には触れない。

## Open Questions

- ~~prefecture の連盟値として `学連` と `日本学連` が大会により混在している。表示・集計上どちらかに
  寄せるべきか?(今回は既存慣例に従い `学連` で修復)~~
  → **決定(2026-07-17、ユーザー回答): 表示は `学連` のまま、集計上は `日本学連` に寄せてよい。**
  データ値の統一(id 張替を伴う移行)は今回は未実施。集計側で同一視が必要になった時点で対応する。

## 実施結果(2026-07-17)

- Step 1: `tools/shared/normalize-core.js` に `NON_PREFECTURE_TOKENS` を導入し、
  `normalizePrefectureName()` / `registerFromIdString()` を修正。スモークテストで
  pair 文字列 `中尾_彦斗_中央大学_学連` が team=`中央大学` / prefecture=`学連` に正しく分解され、
  `県` 誤付与も起きないことを確認
- Step 2: `scripts/normalize-prefectures.mjs` の FEDERATIONS を FEDERATION_KEEP から機械導出に変更。
  さらに実装中に発見した追加欠陥を修正: フィールド置換が固定文字列 `"prefecture": "`(スペース付き)
  だったため、コンパクト整形(`"prefecture":"..."`)の east-japan/2026 ファイルにはマッチせず
  置換漏れしていた → コロン前後の空白を許容する正規表現に変更
- Step 3: `scripts/repair-gakuren-prefectures.mjs` 作成・適用。
  boys: 465 箇所(team 15 種 / prefecture 1 種 / id 136 件)、girls: 342 箇所(team 9 種 / id 97 件)。
  再実行で「変更なし」(冪等)、id 重複ゼロ、playerIds 参照切れゼロ。
  `normalize-prefectures.mjs --dry-run` = 0 箇所、`check-identity-health.mjs` の残警告はすべて既存の別問題
- Step 4: 派生データ再生成済み(players json / players-lite / facts 759人 / player-analysis /
  match-reverse-index / rare-events / rankings)。`generate-beta-matches-json.mjs` のみ Supabase への
  ネットワーク接続が必要なため本環境では未実行(score系は Supabase 起点で本件と独立。次回ビルドで再生成)。
  再生成後の grep で `学連県` / `"team":"…_学連"` / `@…_学連` はすべてゼロ
- Step 5: docs/wiki/data-import.md 更新(normalize-core 側の強制、FEDERATIONS 汎用化、
  空白許容置換、連盟値の表示/集計の決定)
- 追記(2026-07-17): `scripts/repair-gakuren-prefectures.mjs` は適用・検証完了後にユーザー指示で削除。
  修復ロジック(team末尾 `_学連` 除去 / `学連県`→`学連` / id 再計算とピンポイント置換)は本ノートの
  Step 3 が記録として残る

## Compile Log

- docs/wiki/data-import.md「ルール: 都道府県は省略しない」節へコンパイル済み:
  根本原因2点と修正内容、repair スクリプトの存在、`学連`/`日本学連` の決定
- 除外(wiki に載せなかったもの):
  - パターンA/Bの発生順序依存の詳細メカニズム(registerFromIdString と registerOpponent の
    登録順で A/B が分かれる話) — 旧実装固有の挙動で修正後は再現しないため、本 raw ノート止まり
  - 派生データの伝播先一覧 — prebuild で機械的に再生成される生成物であり、恒久情報でないため
  - check-identity-health.mjs の既存警告(フリー未解決1件、2023高体連 id 重複1件、チーム別名201件) —
    本件と無関係の既存バックログで、既に同スクリプトの出力で追跡可能なため
