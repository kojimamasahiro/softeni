# HJC 2021 ダブルスの姓のみ id・列ずれの修正（2026-10-03）

> 適用範囲: 混在（pid の区切り数の規約は汎用、学校名・大会はソフトテニス固有）

## 症状

- `data/tournaments/details/highschool-japan-cup/2021/doubles-none-{boys,girls}.json` に、
  名が `null` の `姓_学校_県` 3区切り id が 13 名分あった。
- うち3名は列ずれ:
  - 男子 `田渕_北海道_北海道` / `加藤_北海道_北海道`（学校が `北海道` になっていた）
  - 女子 `佐々木_高松商業_香川県_香川県`（firstName=`高松商業`, team=`香川県`）
- `scripts/highschool/01team/teams.json` に架空校 `hokkaidou`(北海道) / `kagawaken`(香川県)
  が追加されていた（commit 9726325a「ハイジャパ2021」）。`summary.py` が pid の [2] を学校として読むため、
  列ずれでない3区切り（`安楽_滝川_北海道` 等）も `北海道` 校として数えられていた。

## 出典

- ドロー PDF（姓のみ・県：学校）: `http://www.gosen-sp.jp/hjs/result/up_img/1622093391-476838_{1..4}.pdf`
  （1=男子D, 2=女子D, 3=男子S, 4=女子S。現行の gosen.jp には 2023 年以降しか無く、Wayback から取得）
  - 男子 70: 田渕・加藤（北海道：旭川実業）/ 女子 55: 増田・佐々木（香川県：高松商業）
- 参加選手一覧（フルネーム）: `http://www.gosen-sp.jp/hjs/participant/`（Wayback 20210802100355）
  - 北北海道 (2) 北海道旭川実業 田渕 直・加藤 匠吾 / 香川 高松商業 増田 菜々・佐々木 安葉
  - 他: 原田 諒太・加藤 聖奈（伊勢工業）、植松 こころ・西田 美織（済美）、安楽 未渉・石黒 茉子（滝川）、
    下山 佳那琉（札幌龍谷学園）、本多 桃子・川村 未来（旭川東）、後藤 紗和・野村 遥（松阪）

## 対応

1. `scripts/fix-hjc-2021-surname-only-ids.mjs`（一回限り）で 13 名の参加者レコードと `entries[].playerIds` を
   4区切り id へ置換（team は PDF 表記）。
2. `node scripts/normalize-team-names.mjs`（既定スコープ HJC）で `旭川実業→旭川実` / `高松商業→高松商`。
3. `teams.json` から `hokkaidou` / `kagawaken` を削除し、`npm run highschool:pipeline`。
   パイプラインは古い出力を消さないので `data/highschool/prefectures/{hokkaido/hokkaidou,kagawa/kagawaken}` を手で削除。
4. `npm run prebuild`。副次効果: 下山 佳那琉が中学の記録と進路（pathways）でつながった。
   滝川・伊勢工業に学校別 analysis が初めて生成された。

## Compile Log

- wiki（player-name-identity.md）へ: 「個人戦 pid は4区切り」「名は別の公式資料で補う」「3区切りの検出 grep」を compile。
- 落とした: 個々の選手名と PDF の URL（この raw にだけ残す。一回限りの修復で仕様ではない）。
- 落とした: 03list/summary.py を3区切りに耐えるよう直す案（データ側で4区切りを守れば足り、今は3区切りが0件のため）。
