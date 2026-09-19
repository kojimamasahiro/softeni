# チームID生成バグ調査メモ（アンダースコア過多問題）

`participants[].id` が `__長門_山口県` や `______JAPAN MIYAGI_JAPAN MIYAGI___` のように
アンダースコアが余分についてしまう不具合の調査結果。原因は1つではなく、**3種類の独立したバグ**が
組み合わさって発生している。

## 前提: 正しいID生成ロジック

`tools/shared/normalize-core.js` の `makeIdFromParts` が正:

```js
function makeIdFromParts(last, first, team, prefecture) {
  return [last || '', first || '', team || '', prefecture || '']
    .filter(Boolean)   // ← 空要素を除去してから join
    .join('_');
}
```

チーム参加者は `lastName`/`firstName` が `null` なので、`filter(Boolean)` が効いて
`"team_prefecture"`（例: `長門_山口県`）という正しい形になる。

以下のバグはいずれも、この「空要素を除去してから join する」というルールを守っていない箇所で発生している。

---

## バグ1: `team` フィールド自体への結合済み文字列の混入（三重連結）

**該当箇所**: `tools/tournament/index.html`, `tools/tournament2/index.html` の `getTeamLabel()` /
`splitMatchByTeams()`（`tools/tournament3/index.html` は本セッション中に修正済み）

トーナメント表からJSON出力する際、本来「素のチーム名」を渡すべき `team` フィールドに、
`${team}_${prefecture}` のように**結合済みの文字列**をそのまま渡していた。

```js
// バグのあるコード（tournament / tournament2 に現存）
function getTeamLabel(obj) {
  if (obj.team && obj.prefecture) return `${obj.team}_${obj.prefecture}`;
  ...
}
results.push({
  team: getTeamLabel(p1),   // ← "高田商_奈良県" のような結合済み文字列を team に渡してしまう
  ...
});
```

これが `normalize-core.js` に渡ると、`registerFromTeamString` が `team: "高田商_奈良県"` として
参加者を登録し、後段の再構築ステップで再度 `prefecture` が連結されて

```
高田商_奈良県 + _ + 奈良県 → 高田商_奈良県_奈良県
```

という三重連結IDになる。**同じ試合の中でも、対戦相手側（opponents経由）から登録された方は
正しいIDになり、自チーム側の行から先に登録された方だけ壊れる**ため、大会によって・チームによって
挙動が割れて見える。

**修正方針**: `tournament3` で採用した方式と同じく、`team` には素のチーム名のみを渡し、
都道府県は別フィールド `prefecture` として明示的に渡す（`tournament`/`tournament2` は未修正）。

---

## バグ2: 事後正規化スクリプトの `join('_')` に `filter(Boolean)` が無い（二重連結）

**該当箇所**: `scripts/normalize-team-names.mjs` 112行目

```js
const newId = [p.lastName ?? '', p.firstName ?? '', newTeam, newPref ?? ''].join('_');
```

チーム参加者は `lastName`/`firstName` が `null` → `?? ''` で空文字になるが、
`Array.prototype.join` は空文字を除去しない。そのため

```js
['', '', '長門', '山口県'].join('_')  →  "__長門_山口県"
```

となる。さらにこのスクリプトは「新IDが現在のIDと異なれば」問答無用でファイル内を文字列置換する仕様のため、
**チーム参加者は毎回必ず壊れた形へ書き換えられる**（`id` が元々正しい `長門_山口県` であっても、
再計算結果は必ず `__長門_山口県` になるので毎回不一致になり、置換が発火する）。

このスクリプトは `data/tournaments/details/highschool-japan-cup` 以外にも
`--scope=all` で全大会に対して複数回実行された履歴があり（`f23d03f6` 「チーム名名寄せ」コミット等）、
実行するたびにアンダースコアが積み増しされていく（2本→4本→6本…）。

**同一の未フィルタ `join('_')` を使っているスクリプト**（現状は自己防衛ガードがあるため新規破壊はしていないが、
バグ1・バグ2で壊れた後のデータに対しては壊れた状態を追認してしまう):
- `scripts/normalize-prefectures.mjs`（181, 183行目）
- `scripts/normalize-team-spacing.mjs`（54, 56行目）

**修正方針**: 3スクリプトすべての `join('_')` を `normalize-core.js` と同じ
`.filter(Boolean).join('_')` に統一する。

---

## バグ3（korea-cup限定・複合）: バグ1とバグ2が重ねて発生した結果の最悪ケース

`data/tournaments/details/international-korea-cup/2026/team-none-{boys,girls}.json` は
`______JAPAN MIYAGI_JAPAN MIYAGI___` のような特に酷い壊れ方をしている。これは:

1. 国際大会のチームは `prefecture` が空文字 `""`（falsy）のため、当時の `tournament3/index.html`
   （修正前）の `getTeamLabel()` が `obj.team && obj.prefecture` の分岐に入れず、
   `if (obj.team) return \`${obj.name}_${obj.team}\`;` の分岐に落ちて
   **チーム名を自分自身と連結**（`JAPAN MIYAGI` → `JAPAN MIYAGI_JAPAN MIYAGI`）。
   しかもこの値が `id` だけでなく **`team` フィールドそのもの**に格納されてしまった（バグ1と同系統）。
2. その後 `normalize-team-names.mjs`（バグ2）が **`--scope=all` で3回実行**され、
   壊れた `team` を元に毎回アンダースコアを2本ずつ積み増し（`__` → `____` → `______`、
   末尾も `_` → `__` → `___`）。

結果、最初の1回の連結ミスが、3回の正規化パスを経て6本+3本の異常な連結になった。

---

## 影響範囲

`"id": "__` パターンで現在も壊れている参加者データファイル: **27ファイル**
（`data/tournaments/details/**/*.json` 配下）

```
international-korea-cup/2026/team-none-{boys,girls}.json  ※バグ3（特に重症）
zennihon-secondaryschool-club-pre/2025/team-{upper,lower,qualifying}-{boys,girls}.json
international-hiroshima-peacecup/2025/team-none-{boys,girls}.json
secondaryschool-championship/2025/team-none-{boys,girls}.json
highschool-senbatsu/2025/team-none-{boys,girls}.json
zennihon-university-ouza/2026/team-none-{boys,girls}.json
highschool-championship/{2021,2022,2023,2024,2025}/team-none-{boys,girls}.json（一部年度は片方のみ）
zennihon-business-group/2025/team-none-{boys,girls}.json
```

## 対応状況（2026-07-09 対応済み）

再検証により当初の記述へ以下の補正を加えた上で、修正・修復を完了した。

**検証で判明した補正点:**
- 壊れていたのは 27 ではなく **28 ファイル**（highschool-championship は 2021〜2025 全年度・両性別）。
- さらに、末尾アンダースコア型（`内田_陽斗_法政大学_` = prefecture 空の個人参加者に対する
  未フィルタ join）という別系統の破損が **計94ファイル / 12,501箇所** で見つかった。
- 「実行のたびにアンダースコア積み増し」の真因は、`normalize-team-names.mjs` の
  **裸の `"${oldId}"` 全文置換**が `team` フィールド値 == `id` のケース（prefecture 空のチーム参加者）で
  team フィールド自体を壊れた id で上書きしてしまうこと。通常のチーム参加者は初回破壊後は冪等。
- team フィールド汚染は korea-cup 限定ではなく、zennihon-secondaryschool-club-pre（qualifying）、
  zennihon-business-group（girls）、zennihon-university-ouza でも発生していた（計7ファイル）。
- korea-cup 含め汚染パターンは機械的に復元可能だった（人手復元は不要だった）。

**実施した修正:**
1. `tools/tournament/index.html`, `tools/tournament2/index.html` を tournament3 と同じ
   `getPlainTeamName()` + `prefecture` フィールド方式に修正
2. `normalize-team-names.mjs` / `normalize-prefectures.mjs` / `normalize-team-spacing.mjs` の
   `join('_')` を `filter(Boolean).join('_')` に統一。あわせて id 置換を
   `"id"` フィールドと配列要素（playerIds / pair 等）に限定（team/name 巻き込みの根絶）
3. `scripts/repair-team-participant-ids.mjs` を新規作成し実行。
   全 details（temp 除く）で id を `makeIdFromParts` と同一ロジックで再計算し、
   汚染 team フィールドの復元（重複トークン畳み込み + 都道府県トークン分離）と
   `entries[].playerIds` の参照追従を実施。94ファイル / 12,501箇所を修復。冪等。
4. `data/teams/teams.json` を `build-team-master.mjs` で再生成

**修復後の検証（全285ファイル）:** id 再計算不一致 0 / 破損パターン残存 0 / playerIds 未解決参照 0。

**残課題:**
- `zennihon-championship/2023/doubles-none-boys.json` に修復前から存在する同一ペアの
  二重登録（`笹井_悠月_木更津総合_高体連`）が1件。今回の破損とは別件（要手動確認）。
- `highschool-senbatsu/2025/temp/results/` 配下にバグ1由来の汚染済み中間ファイルが残存
  （temp は修復対象外。再生成時は修正済みツールを使うこと）。
- `normalize-team-names.mjs --scope=all` の dry-run に正当な別名寄せ
  （高田商業高校→高田商 等、4ファイル / 184箇所）が滞留中。適用は別途判断。
