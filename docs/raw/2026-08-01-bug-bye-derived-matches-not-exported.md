# 不具合: 不戦勝どうしの対戦が JSON に出力されない（tools/tournament3）

## 状況

修正済み（2026-08-01）。`tools/tournament3/index.html`。
インターハイ2026 女子ダブルスの入力中に発覚。

## 症状

入力ツールでは結果を入力しているのに、エクスポートした JSON に試合が現れない。
その試合の**敗者はエントリーごと消え**、勝者は `prevMatchIds` が空のまま次のラウンドに現れる。

発見のきっかけ: 大会インサイトの生成で「就実は勝ち残りが無くなった」と誤った記事が出た。
就実は3組出場しているが、3組目（No.83 内田涼凪・実末彩奈）がどの試合にも現れなかった。

## 原因

`byeAdvanceToggle`（「不戦勝の勝ち上がりを出力しない」既定 ON）の判定が
**`match.byeDerived` だけを見ていて、その試合が行われたかどうかを見ていなかった**。

```js
// 修正前（4箇所）
if (match.byeDerived && byeAdvanceToggleEl?.checked) return [];
```

`byeDerived` は `reachedOnlyByByes()` が返す「**その枠に不戦勝だけで辿り着いたか**」であって、
「この試合が行われたか」ではない。`extra`（足長＝1回戦不戦勝で2回戦の相手も不戦勝上がり）
同士の対戦は、両者とも bye でその枠に来るため常に `byeDerived: true` になる。
結果として、**その対戦に勝者を入力しても永久に出力されない**。

トグルの意図は「ドロー表だけを入力した段階で、まだ行われていない対戦を出力しない」ことなので、
**勝者が入った時点で出力しなければならない**。

## 影響（インターハイ2026 女子ダブルス、3回戦終了時点）

| | 実測 |
|---|---|
| `extra` エントリー | 140 |
| うち JSON のどの試合にも現れない | **70**（全て `extra`） |
| 2回戦の試合数 | 58（ブラケット上は 128 あるべき） |
| 欠落していた2回戦 | **70 試合**（＝消えたエントリー数と一致） |

欠落した70試合はすべて `extra` 同士の2回戦。70組の敗者が JSON から消え、
70組の勝者は `prevMatchIds: []` で3回戦に現れていた。
未登場エントリー70組すべてについて、entryNo が隣接する `extra` が
「3回戦から登場」になっていることを確認済み（70/70）。

**下流への実害**: 大会インサイトが「就実は勝ち残りが無くなった」と誤って断定して公開された
（取り下げ済み）。集計から黙って落ちたエントリーが分母から消えたため。

## 修正

判定を1つのヘルパーに集約し、**未実施のときだけ省く**ようにした。

```js
function shouldSkipByeDerived(match) {
  if (!match?.byeDerived) return false;
  if (!byeAdvanceToggleEl?.checked) return false;
  return match.winner == null; // 勝者が入っていれば実施済みなので出力する
}
```

適用箇所は4つ（団体順位の集計 / 個人順位の集計 / `splitMatchByPlayerIds` /
`splitMatchByTeams`）。うち前2つは直前に `if (!match.winner) continue;` があるため、
この修正で実質的にスキップが無効化される（＝結果のある試合を落とさなくなる）。

トグルOFF時は従来どおり何も省かない。

## 再エクスポート（2026-08-01 完了）

修正版ツールで出し直した JSON を反映済み。**予測どおりの結果になった**。

| | 修正前 | 修正後 |
|---|---|---|
| 試合に未登場のエントリー | 70 | **0** |
| 2回戦の試合数 | 58 | **128**（ブラケット上あるべき数） |
| 確定済み試合 | 180 | 250 |

消えていた No.83（内田涼凪・実末彩奈／就実）は
**2回戦 `match-92` で 84（田中愛実・宮下慶／上伊那農）に 3-4 で敗退**していた。

なお結果として、取り下げた初版の「就実は勝ち残りが無くなった」という記述は
**事実としては正しかった**（3組とも敗退）。ただし当時のデータからは判断できず、
1組の勝敗が不明なまま断定していたので、取り下げの判断自体は正しい。
`unknown` ガードは「正しい結論をたまたま当てる」ことより
「根拠が無いのに断定しない」ことを担保するためのもの。

再エクスポートで新たに `嬉野`（1組が敗退・勝ち残りゼロ）が検出対象に加わった。
初版では嬉野の唯一の組が欠落していたため、学校ごと集計から漏れていた。

### 全大会を走査した結果（2026-08-01）

結果が1件でも入っている全種目を対象に「どの試合にも現れないエントリー」を数えたところ、
**該当は2種目のみ**だった。

| 種目 | 未登場 | type |
|---|---|---|
| `highschool-championship/2026/doubles-none-girls` | 70 / 314 | 全て `extra` ← 本不具合 |
| `zennihon-university-indoor/2025/doubles-none-boys` | 1 / 12 | `type` 未設定。別原因の可能性 |

過去の完了大会（`extra` を含むものを含む）には欠落が無い。今回の入力で初めて顕在化した
可能性が高く、**影響は開催中のインターハイ2026に限定される**見込み。
`zennihon-university-indoor/2025` の1件は `type` が付いていないため本不具合とは別で、
個別に確認が必要。

他の大会・種目も、`extra` を含むドローで結果を入力済みなら同じ欠落がある可能性がある。
`docs/story-yaml/README.md` の `unknown` 集計、または下記のチェックで洗い出せる。

```bash
# ある種目で「どの試合にも現れないエントリー」を数える
node -e "
const d=require('./data/tournaments/details/<tid>/<year>/<cat>.json');
const inm=new Set(d.matches.flatMap(m=>m.entries||[]).filter(x=>x!=null));
const miss=d.entries.filter(e=>!inm.has(e.entryNo));
console.log(miss.length, miss.map(e=>e.entryNo).slice(0,20));
"
```

## 関連

- `tools/tournament3/index.html`（`shouldSkipByeDerived` / `reachedOnlyByByes`）
- [docs/tournament-data-structure.md](../tournament-data-structure.md)（`seed` / `packing` / `extra` の定義）
- [2026-08-01-idea-news-fact-based-story-categories.md](2026-08-01-idea-news-fact-based-story-categories.md)（発見の経緯）
- [ADR-012](../adr/ADR-012-llm-authored-insights-with-machine-verification.md)（機械照合では防げない誤りの実例として追記済み）
