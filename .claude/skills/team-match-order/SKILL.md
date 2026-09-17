---
name: team-match-order
description: 団体戦・対抗戦の「オーダー」（第1〜第3対戦に誰が出て何ゲームだったか）を公式記録PDFから読み取り、`data/tournaments/details/<大会>/<年>/team-*.json` の各試合へ `matches` として入れる。「オーダーを入れたい」「対戦ごとの出場ペアを入れたい」「団体戦の中身を出したい」「第1対戦は誰か」「高校選抜の別の年度も反映したい」「他の大会の団体戦にも広げたい」といった依頼で必ず使うこと。年度や大会名＋団体戦の記録PDFを渡されただけの場合も同様。既に入っているオーダーをPDFで検算する用途にも使う。勝敗・スコア（学校対学校の本数）そのものの取り込みは tournament-pdf-to-results が担当で、このスキルはその後に重ねる。
---

# 団体戦のオーダー → details の `matches`

## このスキルの位置づけ

団体戦のファイル（`team-*.json` / `versus-*.json`）は、学校対学校の本数（`scores`、2-0 など）を
`tournament-pdf-to-results` で入れる。このスキルは**その上に重ねる**もので、
1試合の中の第1〜第3対戦（出場ペアとゲーム数）を `matches` として足す。

- データの形と決定の経緯: [ADR-020](../../../docs/adr/ADR-020-team-match-rubber-details.md)
- 現在の仕様: [data-model.md](../../../docs/wiki/data-model.md)「団体戦の対戦ごとの記録」
- 取り込みの知見: [data-import.md](../../../docs/wiki/data-import.md)「団体戦の対戦ごとの記録（オーダー）の取り込み」
- 表示: [public-pages.md](../../../docs/wiki/public-pages.md)「大会結果ページの対戦詳細」

**前提**: その年度の団体戦ファイルが既にあり、`matches[].scores` が入っていること。
無ければ先に `tournament-pdf-to-results` を通す。エントリーの並び（entryNo）がドローの席順と
一致していることに全面的に依存している。

## いちばん多い依頼: 高校選抜の別の年度

全日本高校選抜（`highschool-senbatsu`）で、出典が **JSTA の記録**（`t_records/<年>/<年>_B17_40.pdf`）なら
既存スクリプトがそのまま通る。2022・2025 で検証済み。

```bash
# 1. 出典を確認（information の sourceUrl。JSTA 以外の年度は「様式が違う年度」を参照）
python3 -c "import json;print([(y['year'], y.get('sourceUrl')) for y in json.load(open('data/tournaments/information/highschool-senbatsu.json'))])"

# 2. まず書き込まずに実行して、割り当てと勝敗の一致を目で見る（p1 が男子・p2 が女子）
python3 scripts/pdf/highschool_senbatsu_team_matches.py <PDF> --page 1 \
    --details data/tournaments/details/highschool-senbatsu/<年>/team-none-boys.json

# 3. 問題が無ければ書き込み、整形して検査
python3 scripts/pdf/highschool_senbatsu_team_matches.py <PDF> --page 1 \
    --details data/tournaments/details/highschool-senbatsu/<年>/team-none-boys.json --write
npx prettier --write data/tournaments/details/highschool-senbatsu/<年>/team-none-*.json
npm run check:team-match-details
```

`--write` が無ければ表示だけ。**冪等**なので、何度実行しても結果は同じ（既存の記録は置き換わる）。

### スクリプトが止まったら

止まるのは**設計どおり**で、片側が間違っている合図。`--write` を付けていても書き込まない。

| 止まり方 | 意味 | やること |
|---|---|---|
| `PDF (0, 3) / details 0-2` | PDFと既存データの本数が違う | **PDFを人が見て確認**。既存が誤りなら直す（2022 で実際に2件あった）。PDF側の誤記もありうる |
| `2校に割り当てられた選手` | 塊と試合の対応を取り違えた | 様式が想定と違う。下記「様式が違う年度」へ |
| `エントリー行 N件 / details M件` | エントリー数が合わない | ページ指定の間違いか、別様式 |
| `塊 N件 / 試合 M件` | 3対戦の塊として読めていない | 別様式。1文字ずつの語の結合幅（`MERGE_GAP`）が効いていない可能性 |

## 別の大会・別の様式へ広げるとき

**まず「その大会の公式記録にオーダーが載っているか」を確かめる。** 載っていない大会のほうが多い。

| 大会 | 状況 |
|---|---|
| 高校選抜（JSTA 記録） | **全試合**にある。対応済み |
| インターハイ（公式記録報告書） | **ベスト8以降だけ**。ゲームごとのポイント（`4 - ⑥`）まである。**未対応** |
| 全中・インカレ（ドローPDF） | 敗者の本数だけ。オーダーは無い。別資料の有無は未確認 |

新しい様式に当たるときは、既存スクリプトを**コピーして足す**（共通化は2つ目が通ってから）。
`scripts/pdf/highschool_senbatsu_team_matches.py` の docstring に様式の見極めが全部書いてある。
読む順序は次の4つ。

1. **1対戦がどう印字されるか**（「ペア・ペア 本数 － 本数 ペア・ペア」の1行か、2行に分かれるか）。
   高校選抜は1行、インターハイはペアの2人が縦に並び「・」が無い。
2. **勝者の見分け方**（丸数字が取った側か、色か、位置か）。
3. **塊と試合の対応**（高校選抜は「両校とも初戦なら2校の行の中間、以降は選手の重なり」。
   位置だけで決めると準々決勝の塊を別の試合と取り違える。実際に起きた）。
4. **左右がどちらの学校か**（高校選抜は左＝エントリー番号の小さい学校。**全塊で成立するか必ず確かめる**）。

`matches` に入れる形（`type` / `status` / `winner` / `scoreA` / `scoreB` / `playersA` / `playersB`）は
ADR-020 が正。ゲームごとのポイントを持つ様式（インターハイ）は**器がまだ無い**ので、
持ち方を決めるところから（ADR-020 の Open Questions）。

## 検算（ここが本体）

読み取り誤りは静かに紛れ込むので、機械が確かめられるものは全部使う。

- **勝ち数＝既存の本数**（スクリプトが自動で確認。合わなければ止まる）。
- **同じ選手が2校に現れない**（同上。取り違えがあれば必ずここに出る）。
- **`npm run check:team-match-details`**（prebuild にも入っている）。
  形・親との一致・姓名の実在・2校への重複を見る。
- **学校の2試合目以降で、前の試合と選手が重なるか**。高校選抜 2025 では 34/34 だった。
  極端に低ければ塊の対応が崩れている。

## 選手の結び付け

- 同じ氏名・同じ学校の**個人戦の出場記録**があれば `{ lastName, firstName }`、無ければ `{ name }`。
- **名前だけの選手を `participants` に足さない**。足すと選手一覧に新しい選手として採番される。
- 結び付かない主な理由は2つ。
  - 個人戦に出ていない（1年生など）。そのままでよい。後で出れば再実行で姓・名に変わる。
  - **学校名の表記違い**（`近大高専` と `近畿大学高専` が別チーム）。
    チームの統合は人が判断する（[ADR-019](../../../docs/adr/ADR-019-team-merge-human-only.md)）ので、
    スクリプトで吸収しない。気付いたら統合候補として報告する。

## 落とし穴

- **ファイル全体を JSON で書き直さない**。Prettier が元の改行位置を手がかりに折り返しを決めるため、
  触っていない `entries` まで数千行の差分になる（実測 6,758 行）。各試合へ差し込む。
- **`--write` の後は必ず `npx prettier --write`**。差し込んだ部分は1行のまま。
- **入力ツール（`tools/`）で details を作り直すと `matches` は消える**。ツールはこの項目を知らない。
  作り直したらこのスキルをもう一度通す。
- **打ち切り・未実施を「無かったこと」にしない**。スコアが空なら `not_played`（ペアだけ出ている）、
  丸数字の無い途中の本数なら `unfinished`。どちらも X で聞かれる「誰が出る予定だったか」の答えになる。
- **姓名の分割を直したら `node scripts/normalize-name-splits.mjs` を流す**。
  対戦の記録の姓・名も対象になっている。取り残すと prebuild が止まる。

## 書き戻し

`AGENTS.md` の LLM Wiki 運用に従う。

- `docs/raw/<日付>-<大会>-<年>-team-match-order.md` に実施記録（様式・検算・止まった箇所・未了）。
- 次の年度でも使える知見だけ `docs/wiki/data-import.md` へ compile。
- 収録範囲が変わるので `docs/wiki/data-model.md` の「現在は◯◯」を更新する。
- 新しい様式に対応したら、このスキルの表も更新する。
- raw の末尾に Compile Log（何を載せ、何を意図的に載せなかったか）。
