# sns-images: X投稿用画像の自動生成ツール

大会データ（`data/tournaments/details/**`）からX投稿用の画像を生成する。
依存は Pillow のみ（`.venv` にインストール済み）。

```bash
source .venv/bin/activate  # または python3 を直接
```

## 0. 集客特化 1日目投稿（ハイスクールジャパンカップ向け）

種目別の「1日目終了時点」を集客向け4枚構成で生成する。仕様は
`docs/wiki/sns-day1-images.md`。共通ロジックは `day1lib.py`、キャプションは `captions.py`。

```bash
# シングルス1日目（ベスト4確定）: 表紙+CTA / ベスト4一覧 / 準決勝確定カード（最大3枚）
python tools/sns-images/day1_singles.py \
    data/tournaments/details/highschool-japan-cup/2026/singles-none-boys.json \
    --next-date "6/27(土)9:00〜" --tournament highschool-japan-cup --year 2026 --out out/sns

# ダブルス1日目（予選リーグ終了）: 表紙+CTA / 本選進出ペア一覧（1〜2枚）
python tools/sns-images/day1_doubles.py \
    data/tournaments/details/highschool-japan-cup/2026/doubles-none-boys.json \
    --next-date "6/28(日)9:00〜" --tournament highschool-japan-cup --year 2026 --out out/sns

# シングルス完結報告（土・優勝〜ベスト4）
python tools/sns-images/result_singles.py \
    data/tournaments/details/highschool-japan-cup/2026/singles-none-boys.json --out out/sns

# 4カテゴリ一括＋キャプション（captions/<カテゴリ>.txt）
python tools/sns-images/day1_all.py --tournament highschool-japan-cup --year 2026 \
    --singles-next "6/27(土)9:00〜" --doubles-next "6/28(日)9:00〜" --out out/sns
```

ポイント:

- 画像は主役カットのみ。サマリ・番狂わせ・結果ダイジェストは `out/captions/<カテゴリ>.txt`（本文）
  と `_thread.txt`（スレッド返信）にテキスト出力。氏名はフルネーム。
- 画像サイズはX向けに 16:9 / 1:1 / 4:5（幅1200固定）に統一、中身は縦中央寄せ。
- ダブルス本選進出は各グループ1位（勝数→ゲーム差→総得ゲーム）を match群から自前計算。
- 「番狂わせ」は前年ベスト8以上の選手の生存/敗退（選手id単位・前年のみ）。
- CTAの会場は information JSON、2日目日付は `--next-date`（種目で日が異なる）。
- リーグ星取表は出さない（進出ペア一覧重視）。確定カードは前段決着済みの試合のみ。

## 1. 1日目終了時点の結果画像（day1_results.py）

勝ち残りドロー画像と回戦別結果一覧画像を生成する。未消化の試合は
`winnerEntryNo: null` であることが前提（入力途中のdetails JSONをそのまま渡す）。

```bash
python tools/sns-images/day1_results.py \
    data/tournaments/details/highschool-japan-cup/2026/doubles-none-boys.json \
    --title "ハイスクールジャパンカップ2026 男子ダブルス" \
    --subtitle "1日目終了時点" \
    --out out/sns
```

- 勝ち残りが17以上の場合はドローを自動で複数枚に分割（`--max-leaves`で調整、既定16）
- 結果一覧は1500px縦に収まるよう自動でページ分割
- `--rounds 3回戦,4回戦` で結果一覧の対象回戦を絞れる（1・2回戦を省いて枚数削減）
- 個人戦・団体戦どちらも対応。リーグ戦（roundrobin stage）は未対応

X投稿の目安: ドロー画像（1〜2枚）＋勝ち残り上位の結果（1〜2枚）で計4枚以内に収める。

## 2. 勢力図画像（power_map.py）

過去データを集計し、都道府県タイルマップ＋都道府県/学校TOP8を1枚に描画する。
大会開始の数日前に投稿する想定。

```bash
python tools/sns-images/power_map.py \
    --tournament highschool-championship \
    --category doubles-none-boys doubles-none-girls \
    --years 2021-2025 \
    --metric points \
    --title "インターハイ個人戦 勢力図（過去5年・男女）" \
    --out out/sns
```

- `--metric points`: 勝利数＋上位進出ボーナス（優勝10/準優勝6/ベスト4 4/ベスト8 2）
- `--metric titles`: タイトルポイントのみ（優勝3/準優勝2/ベスト4 1）
- 重み付けは `power_map.py` 冒頭の `BONUS_POINTS` / `TITLE_POINTS` で変更可
- `--tournament` `--category` は複数指定可。`--category` 省略で全カテゴリ集計

## 3. 対戦成績カード（h2h.py ＋ 生成AI）

次の対戦が決まったときに投稿するカード。データ抽出だけスクリプトで行い、
画像は生成AIに作らせる。手順とプロンプトは `matchup-card-prompt.md` を参照。

```bash
python tools/sns-images/h2h.py --pair-a "水木・松田" --pair-b "丸山・内田" \
    --event "全日本選手権2026" --round "準決勝" > matchup.json
```

## 共通の注意

- フォントはmacOSのヒラギノ→Noto Sans CJKの順で自動検出。見つからない場合は
  `snslib.py` の `_FONT_CANDIDATES_*` にパスを追加する
- 配色・ロゴ文言は `snslib.py`（NAVY/YELLOW、フッターの`softeni-pick.com`）で一括変更
- 動作テスト: 完了済み大会のJSONから上位回戦の `winnerEntryNo` を null にした
  ファイルを作ると「1日目途中」を再現できる
