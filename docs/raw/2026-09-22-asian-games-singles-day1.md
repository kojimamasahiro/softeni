# アジア競技大会2026 シングルス一日目（予選リーグ）の結果取り込み

## 状況

2026-09-22、「ミックスダブルスとシングルスの一日目が終わった。残りは最終日のシングルス二日目だけ。
これまでの結果を反映してほしい」という依頼。混合は前回（[2026-09-22-asian-games-team-finals-and-mixed.md](./2026-09-22-asian-games-team-finals-and-mixed.md)）で
決勝まで入っていたので、今回は 9/22 の男女シングルス予選リーグと 9/23 の準々決勝の組み合わせだけを取り込んだ。

## 結果

- 予選リーグ 47試合（男子25・女子22）すべてに本数を入れた。棄権・不戦勝なし
- 日本: 男子 上松（A組 3-0）・黒坂（F組 3-0。KIM Jinwoong に 4-3）、女子 天間（A組 2-0）・宮前（F組 2-0）が全勝で1位
- 準々決勝（9/23 09:00）:

| 種目 | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| 男子 | A1 上松（不戦勝） | B1 LEE Haneul – C1 CHEN Po-yi | D1 MEENA – E1 NUGUIT | F1 黒坂 – G1 CHANG Yu-sung |
| 女子 | A1 天間 – B1 LEE Sujin | C1 RI So Hyang – D1 ZIEGLER | E1 CHIANG Min-yu – F1 宮前 | G1 RI Jin Mi – H1 HWANG Jeongmi |

男子の準決勝1は上松 対 準々決勝2の勝者、準決勝2は準々決勝3・4の勝者（公式の Brackets）。
上松は準決勝進出が決まり、3位決定戦が無いので銅メダル以上が確定。

## 推定が当たった

ADR-021 のシングルスの `format` は「各組1位が準々決勝」を、人数と組数の一致からの読み取りとして
`assumptions` に書いていた。準々決勝の顔ぶれ（男子7・女子8）は取り込みスクリプトが計算した各組1位と一致した。
→ 両種目の `assumptions` を外した。男子の不戦勝が A組の1位だったことを `summary` に足した（理由は非公開なので規則にしない）。

## 取り込みの変更

- `draw.json`: シングルス予選47試合に `score`、準々決勝7試合（`ms-qf2`〜`ms-qf4` / `ws-qf1`〜`ws-qf4`。
  `next: null`、結果なし）、`knockoutDraw` の男女シングルス（男子は2枠目が `null`）
- `build_details.py`: **不戦勝の席にいて、まだ試合を持たない選手**の成績を付けるようにした。
  これが無いと上松は決勝Tの試合を1つも持たず、「予選リーグで敗退」（`tournament: null`）扱いになった。
  `knockoutDraw` の枠数から最初のラウンドを決め（16→1回戦 / 8→準々決勝）、不戦勝の席は次のラウンドの
  進行中の成績（上松は「ベスト4進出」）。団体・混合の出力は変わらないことを確認
- `information/asian-games.json`: 男女シングルスの `format`（上記）と `checkedOn`

## 選手の通算成績への影響

prebuild の差分は `uematsu-toshiki` と `kurosaka-takuya` の `analysis.json` だけ。上松は +3試合 +3勝、
ゲーム +12-2（4-0・4-2・4-0）で転記と一致。天間・宮前は `data/players` にページが無いので差分なし（混合のときと同じ）。

## 検査

check:entries / check:team-match-details / check:orphans / check:placements /
bracket:verify（474大会＝前回の472＋男女シングルス・不一致0）/ check:upcoming / format:test、すべて問題なし。
highschool:pipeline と prebuild も流した。

## 関連

- [upcoming-tournaments-runbook.md](../wiki/upcoming-tournaments-runbook.md) S11
- [ADR-021](../adr/ADR-021-category-competition-format.md) / [ADR-015](../adr/ADR-015-knockout-draw-by-group.md)

## 参考文献

- https://results.asiangames2026.org/#/discipline/TST/schedule/daily/2026-09-22
- https://results.asiangames2026.org/#/discipline/TST/schedule/daily/2026-09-23
- https://results.asiangames2026.org/#/discipline/TST/competition/knock-out

## Compile Log

- **コンパイルした**: 状態と残作業・不戦勝の席の成績 → runbook S11 / 推定の確定 → ADR-021 の Implementation Status と `format`
- **出さなかったもの**:
  - 予選の本数・準々決勝の対戦表 … details と `knockoutDraw` が正。wiki に転記すると二重管理になる
  - 上松の成績の増分 … 検算の記録。wiki には不要
