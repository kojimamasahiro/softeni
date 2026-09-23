# アジア競技大会2026 個人種目のゲームごとのポイントとシングルス二日目の取り込み

適用範囲: ソフトテニス固有（取り込み）／汎用（個人戦のポイント表示）

## 状況

2026-09-23、「ミックスダブルスもポイントを表示してほしい。シングルスも途中まで結果が出ているので反映してほしい。
難しいようだったら止めて」という依頼。団体戦はオーダーの中にゲームごとのポイント（ADR-020 の `games`）を持って
表示していたが、個人種目（混合・シングルス）は本数だけだった。

## やったこと

- 試合オブジェクトに任意の `games`（`[entries[0], entries[1]]` を実施順に）を足した。団体の対戦の `games` と同じ形・同じ約束
  - `lib/packedPageData.ts`: PackedMatch の10番目。団体の枠（9番目）が無ければ `null` で埋める
  - `MatchResults.tsx`: 試合の行のすぐ下に、団体の対戦と同じ部品（`TeamMatchGames`）で並べる。取った側を太字。
    ページにポイントがある時だけ説明の注記を出す
- `draw.json` の行に `games`、`build_details.py` で details に写し、「取ったゲーム数＝本数」を検査に足した
- 混合33試合・男女シングルス予選47試合にポイント。9/23 の準々決勝7・準決勝4・女子決勝の結果とポイント、
  男子決勝の行（未実施）を足した

## 結果（9/23）

| 種目 | 優勝 | 準優勝 | 3位（準決勝敗退） |
|---|---|---|---|
| 女子シングルス | **天間**（決勝 4-3 RI Jin Mi） | RI Jin Mi（北朝鮮） | **宮前**・RI So Hyang（北朝鮮） |
| 男子シングルス | 決勝は**上松 対 黒坂**（取り込み時点で試合中） | | CHEN Po-yi・MEENA Jay |

## 公式サイトの API

これまでは画面から読んでいた。今回、裏の API を見つけた:

- `https://back.results.asiangames2026.org/s/AG2026/en/TST/schedule/daily/<YYYY-MM-DD>`（その日の全試合。`Key` / `Status` / 時刻・コート）
- `https://back.results.asiangames2026.org/s/AG2026/en/TST/results/<Key>`（1試合。`Results.ResDetail` が
  ホーム側から見た `"4-2, 3-5, …"`、`Competitors[]` にホーム・アウェイの順で国・氏名・本数）
- 応答は **zlib 圧縮のバイト列を文字列として返す**。`fetch(...).text()` の各文字コードを1バイトに戻し、
  `DecompressionStream('deflate')` で JSON になる
- **curl からは 403**（CloudFront）。ブラウザの中で取り出して転記した。転記の誤りは、ブラウザ側とファイル側で
  同じ整形の SHA-256 を取り、一致を確かめた（11,037 バイトで一致）

取り込みの突き合わせ（使い捨てスクリプト。リポジトリには置いていない）:

- 公式の試合を (種目, 予選の組 or 決勝Tのラウンド, 両側の選手) で `draw.json` の行に1対1で対応づけ（姓＋名の最初の語。
  `NUGUIT Sherwin Ray` / `ARASY Siti Nur` のように公式の名が長いことがある）、余りが出たら止める
- ホーム・アウェイが `sides` と逆なら左右を入れ替える
- **既存の本数80試合はすべて公式と一致**。取ったゲーム数も全試合で本数と一致した

## 選手の通算成績への影響

prebuild の差分は `uematsu-toshiki`（+1試合: 準決勝 4-2）と `kurosaka-takuya`（準々決勝・準決勝）の `analysis.json` ほか
生成物だけ。ポイントは成績集計に使っていない（本数だけ）。

## 検査

check:entries / check:team-match-details / check:orphans / check:placements /
bracket:verify（474大会・不一致0）/ check:upcoming / format:test / tsc / eslint、すべて問題なし。
highschool:pipeline と prebuild も流した。混合・男子シングルスのページで、スコアの下にポイントが出て、
相手側の行では左右が入れ替わることをスマホ幅で確認した。

## 関連

- [upcoming-tournaments-runbook.md](../wiki/upcoming-tournaments-runbook.md) S11
- [data-model.md](../wiki/data-model.md)（団体戦の対戦ごとの記録の節）
- [2026-09-22-asian-games-singles-day1.md](./2026-09-22-asian-games-singles-day1.md)

## 参考文献

- https://results.asiangames2026.org/#/discipline/TST/schedule/daily/2026-09-23

## Compile Log

- **コンパイルした**: 個人戦の `games` → data-model / 状態と残作業・`games` 列 → runbook S11 /
  API の読み方（圧縮・curl 403）→ data-import「公式サイト（SPA）から読むとき」（「JSON として見えない」を書き換え）
- **出さなかったもの**:
  - 試合ごとのポイント・メダル表 … details が正。wiki に転記すると二重管理
  - 突き合わせスクリプトの中身 … 使い捨て。考え方だけ raw に残した
  - ADR-020 への追記 … 団体戦の決定の記録。個人戦の `games` は同じ形を流用しただけで新しい判断が無い
