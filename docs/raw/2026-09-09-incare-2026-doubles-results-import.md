# インカレ2026 選手権（ダブルス）の結果取り込み（2026-09-09）

## 経緯

ユーザーが `data/tournaments/details/zennihon-university/2026/` の
`doubles-none-boys.json` / `doubles-none-girls.json` を更新（結果入力）。
本ノートは、その後に回した処理と、その過程で見つかったデータの問題の記録。

会期は 2026-09-05〜09-09（悪天候で選手権ダブルスが 9/9 に延長）。
**シングルスは 2026-09-09 時点で未確定**（`rank.kind` が全件 `ongoing`）なので、
今回の取り込みは対抗戦（既取り込み）＋ダブルス2種目まで。

## 取り込み後の結果

| 種目 | results | matches | 決着済み | 状態 |
|---|---:|---:|---:|---|
| doubles-none-boys | 585 | 584 | 584 | 確定 |
| doubles-none-girls | 332 | 331 | 331 | 確定 |
| singles-none-boys | 92 | 28 | 0 | 進行中 |
| singles-none-girls | 84 | 20 | 0 | 進行中 |
| versus-none-boys | 96 | 95 | 95 | 確定 |
| versus-none-girls | 59 | 58 | 58 | 確定 |

上位入賞:

- 男子ダブルス: 優勝 川﨑康平・黒坂卓矢（日本体育大学） / 準優勝 植田璃音・安達宣（早稲田大学） /
  ベスト4 野口快・安部蓮生（日体大）、水木洸・森良輔（日体大）
- 女子ダブルス: 優勝 前田梨緒・中谷さくら（明治大学・**2連覇**） /
  準優勝 吉木理彩・岩田愛美（日本体育大学） /
  ベスト4 江口咲礼紗・西村ひよ（関西大学）、天間美嘉・高橋ひかる（日体大）

外部照合: 男子決勝のカード（川﨑・黒坂 vs 植田・安達）は softtennishitting の
速報ページの記載と一致。女子決勝は当日確定のため外部の索引にまだ載っておらず、
独立した裏取りはしていない（機械チェックは全て通過）。

## 回した処理

`prebuild` のうち、追跡対象の生成物に効く段だけを順に実行した。

1. `node scripts/normalize-team-spacing.mjs` … 0件（正準化対象なし）
2. `node scripts/check-tournament-entries.mjs` … 問題なし
3. `node scripts/check-tournament-insights.mjs` … 公開34件すべて照合済み
4. `node scripts/check-name-splits.mjs --strict` … [A][B][C] すべて0件
5. `node scripts/check-highschool-pipeline-freshness.mjs` … **赤**
   → `npm run highschool:pipeline` を実行して解消
6. `node scripts/generate-players-json.mjs` … featured 200 / all 1959
7. `node scripts/generate-match-reverse-index.mjs`
8. `node scripts/generate-rare-events.mjs`
9. `npm run secondaryschool:build`

検証:

- `npm run bracket:verify` … 449大会・39,946試合が一致／**不一致0件**
- `npm run check:placements` … 123大会×年、重複した最終成績なし
- `npm run check:orphans` … 474種目、どの試合にも現れないエントリーなし

## 見つかった問題: 「北科大」が高校と大学で衝突していた

高校パイプラインの再実行で `data/highschool/` の差分が**減る**方向に出たので追った。

```
data/highschool/prefectures/hokkaido/kitakadai/boys/analysis.json
  totalAppearances 63 → 61   doubles 45 → 43   uniquePlayers 56 → 52
data/highschool/prefecture-summary.json  … 北科大の doubles 2行が消える
```

原因: 今回の更新で、ユーザーが男子ダブルスの4選手の `team` を
**`北科大` → `北海道科学大学`** に直していた。

`data/teams/teams.json` の `kitakadai` は `{"name": "北科大", "prefecture": "北海道"}`
＝**北科大高（北海道科学大学高校）**。一方、大学の北海道科学大学も現場では「北科大」と
書かれる。素の表記が一致するため、**インカレ（大学）の出場が高校の実績として
集計されていた**。参加者側の `prefecture` は `日本学連` なのに高校側に寄っていた。

つまり今回消えた2行は**データの損失ではなく誤帰属の解消**。

alias 表の `scope`（[ADR-013](../adr/ADR-013-scoped-team-name-aliases.md)）では防げない型で、
素の表記がマスタの canonical と完全一致するので alias を書く機会自体が無い。

残りの `北科大` の出現も確認した:

| 大会 | 年 | participants | 判定 |
|---|---|---:|---|
| highschool-championship / japan-cup / senbatsu | 2016〜2026 | 多数 | 高校。正しい |
| east-japan | 2025 | 2（`prefecture: 北海道`） | 高校生の東日本選手権出場。正しい |
| zennihon-championship | 2019 | 4（`prefecture: 北海道`） | 高校生の全日本選手権出場。正しい |

**誤帰属は今回の1件だけで、他に残っていない。**

## 残っている宿題

- **シングルス2種目が未確定**。確定後にもう一度取り込み＋同じ処理一式が要る。
  そのとき年度別ページの title は `組み合わせ` → `結果・組み合わせ` に自動で切り替わる
  （同PRの SEO 変更）
- **同型の機械検出は未実装**。`participants[].prefecture` が `日本学連` / `学連` なのに
  `data/teams/teams.json`（高校マスタ）に同名がある参加者を洗えば列挙できるはずだが、
  今回は手で確認しただけ。`check-identity-health.mjs` に足すのが自然な置き場所

## Compile Log

| 項目 | 扱い | 理由 |
|---|---|---|
| 「北科大」が高校マスタの canonical と大学名で衝突する型・alias の `scope` では防げないこと・対処は大学側を正式名称で入れること | wiki `team-player-identity.md` に新節「略称そのものが高校と大学で衝突する」として採用 | `scope` の3パターンでは表現できない4つ目の型で、次に同型が出たときの判断材料になる |
| 同型の機械検出の手がかり（`prefecture` が `日本学連` なのに高校マスタに同名がある） | 同節に「未実装」として採用 | 実装していないことを明示しないと「検討していない」と区別が付かない |
| 残りの `北科大` 出現の全数確認結果 | 同節に1行だけ採用（全数表は raw に残す） | 「他に誤帰属は無い」という結論だけが durable で、内訳は再実行すれば出る |
| 上位入賞者・種目別の件数表 | 採らない（この raw に残す） | サイトが表示するデータそのもので、wiki に転記すると二重管理になる |
| 実行したコマンドの並びと検証結果 | 採らない（この raw に残す） | 手順は [data-import.md](../wiki/data-import.md) と `package.json` の `prebuild` が正。ここに書くと3つ目のコピーになる |
| シングルス未確定という一時状態 | 採らない（この raw に残す） | 数日で解消する一時情報 |
