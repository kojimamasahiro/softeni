# アジア競技大会 前回（第19回・杭州）の結果の取り込み

## 状況

2026-09-23、「アジア競技大会の前回の19回を反映して欲しい」という依頼。第20回（2026・名古屋）は
会期中に取り込んでいたので、前回大会の5種目を同じ形で `details/asian-games/2023/` に入れた。

## 出典

- 大会公式サイト `info.hangzhou2022.cn` は 2026-09-23 時点で名前解決できない（Wikipedia の出典リンクも同じサイト）
- **Asia Soft Tennis Federation が大会公式の結果PDFを公開している**（Timing and Results provided by Bornan）。
  1種目1本で、予選リーグの対戦表（Group Results）・決勝Tの Draw・準決勝以降の Match Statistics が入る
  - 男子団体 https://www.astf.asia/files/2023/2023_R04_TM_Result_c.pdf
  - 女子団体 https://www.astf.asia/files/2023/2023_R04_TW_Result_c.pdf
  - 混合 https://www.astf.asia/files/2023/2023_R04_MX_Result_b.pdf
  - 男子シングルス https://www.astf.asia/files/2023/2023_R04_SM_Result_c.pdf
  - 女子シングルス https://www.astf.asia/files/2023/2023_R04_SW_Result_b.pdf
- Wikipedia（Soft tennis at the 2022 Asian Games と種目別ページ）は、PDFで略された名の補完にだけ使った

PDFに無いもの: 予選リーグの試合時刻・コート・試合順、予選リーグの団体戦のオーダー、個人種目のゲームごとの得点
（決勝Tは Draw に載っているが、個人種目の details はゲームごとの得点を持たない）。

## 判断

- **year は 2023**（開催年度）。大会名は「2022」だが1年延期で 2023-10-03〜07 に開催された。
  `year` は年度で持つ規約（players-pages.md「年区切り = 年度」）
- **範囲は5種目すべて全組・全試合**（2026年と同じ。決勝Tの席が (組, 組内順位) で決まるため）
- 大会情報は `location: "中国"`、`venues` なし（国外の会場。コリアカップと同じ）。種目ごとの `format` を入れた
- 組内順位は**公式の順位表を正とする**。女子シングルスH組は尾上・CHENG・RI が1勝1敗で並び、本数の得失は
  +2・-1・-1、公式は CHENG を2位にしている（得点の得失 +4・-4 で並べたとみられる）。2026 のスクリプトの
  「勝ち数 → 本数の得失 → 取った本数」だと RI が2位になり公式と食い違う。予選の得点は PDF に試合ごとには無いので、
  規則を推測で足さず順位表を転記した。あわせて勝ち数・取った数・取られた数を試合から数え直して公式と照合する
- 男子シングルスE組: BAYARMAA が 船水・CHANG に不戦敗（公式 `(WO) 0-0`）、DOEUM 戦は途中棄権（公式 `1-0 (RET)`）。
  不戦勝は既存データの慣例（`retired: true`＋勝者が満点。コリアカップ等で 0-4 が861件）に合わせて 4-0、
  途中棄権は公式どおり 1-0。検算では不戦勝を公式どおり 0-0 で数える
- 女子団体 準決勝 中国–チャイニーズ・タイペイの第3対戦は、中国側が空欄（中国は3人しか登録がない）。
  2-0 で決着済みのため、不戦勝にはせず第3対戦を持たない（入れると本数が 3-0 に読める）。
  予選の 中国–ベトナム が 2-0 なのも同じ理由とみられる（**Assumption**）

## 名前

- 日本代表10人は 2023年度の全日本選手権・全日本シングルス・西日本の表記に揃えた
  （船水＝稲門クラブ、尾上＝`尾上_胡桃_日体桜友会_東京都`、渡邉＝`渡邉_絵美菜_ヨネックス_東京都`。
  渡辺表記も2件あるが2023年度は渡邉だけ）。団体戦だけに出た 内本・広岡・久保・尾上（団体）・渡邉 はオーダーの中だけ
- 外国選手は公式PDFのローマ字。**2026年大会にも出た選手は2026年の表記に揃える**
  （HUTAURUK Tio Juliandi → `HUTAURUK/Tio`、RI Jinmi → `RI/Jin Mi`、MAÑALAC Noelle C C → `MANALAC/Noelle`、SAÑOSA → `SANOSA`）。
  チャイニーズ・タイペイは2026の公式と同じくハイフンでつなぐ（YU Kai Wen → `YU/Kai-wen`）
- 混合の対戦表だけ名が略されている（`THONG N S` `GANBOLD K` `KANN S` など）。同じ選手の個人種目・団体の表記、
  無ければ Wikipedia で補った: THONG-NGIU Sippakorn（**Assumption**。PDFは折り返しで姓の全体が読めない）・
  GANBOLD Khongorzul・KANN Sophorn・ARCILLA Joseph・SANOSA Christy・METH Mariyan
- KANN Sophorn（2023）と KAN Sophorn（2026）は同一人物の可能性が高いが、綴りが違うので揃えていない
- `GER A Prasitt Anawat` は PDF の文字詰めの崩れとみて `GERAPRASITT/Anawat`（Wikipedia は Anawat Geraprasitt）

## 結果（公式と一致）

| 種目           | 優勝          | 準優勝                 | 3位                           |
| -------------- | ------------- | ---------------------- | ----------------------------- |
| 男子団体       | 日本          | チャイニーズ・タイペイ | 韓国・インドネシア            |
| 女子団体       | 日本          | チャイニーズ・タイペイ | 韓国・中国                    |
| 混合           | 上松・高橋    | 内田・志牟田           | LIN・HUANG / KIM Hyunsoo・MUN |
| 男子シングルス | 上松          | CHANG Yu-sung          | YOON・CHEN Yu-hsun            |
| 女子シングルス | MUN Hyegyeong | 高橋                   | LI Denglin・MA Yue            |

上松は予選C組で RI Ryonghae（北朝鮮）に負けて2位通過、1回戦で船水（E組1位）に 4-3 で勝っている。

## 実装

- `tools/asian-games-2023/draw.json`（144試合）と `build_details.py`。後者は 2026 の `build_details.py` を
  importlib で読み込み、日本選手の対応表・国名（中国・ベトナム）・組内順位（公式の standings）・予選の `retired` だけ差し替える
- 検査: check:entries / check:team-match-details / check:orphans / check:placements / bracket:verify（479大会・不一致0）/
  check:upcoming / format:test / check-name-splits --strict / check:team-id-alignment、すべて問題なし。highschool:pipeline と prebuild も流した
- prebuild の差分: 上松 +11試合（シングルス6・混合5。+10勝1敗）、船水・内田も個人種目の分だけ増えた。
  団体戦のオーダーは選手の通算に入らない（2026と同じ）。ランキングは `asian-games` を除外済みなので動かない

## Compile Log

- wiki（upcoming-tournaments-runbook.md S11 の節）へ: 出典・year の置き方・公式順位を正とする判断・不戦勝/棄権の持ち方を1段落で
- 落とした: 名前の個別の補い方（draw.json の `_names` と本ノートにあれば足りる）、優勝者の表（details から分かる）、
  prebuild の差分の数値（検算の記録なので raw だけ）

## 関連

- [upcoming-tournaments-runbook.md](../wiki/upcoming-tournaments-runbook.md) S11
- [2026-09-22-asian-games-singles-day1.md](./2026-09-22-asian-games-singles-day1.md)（2026 の取り込み）
