---
name: "tournament-venue-data"
description: "大会要項PDF・開催地情報から、当プロジェクトの `data/tournaments/information/*.json` に `venues`（会場の構造化データ）を入力する。「会 場」節のテキスト、施設名、コート数、サーフェス、住所、開催地、開催都道府県、会場データ、venues、guidelineUrl といった語が出たら必ずこのskillを使う。要項PDFの一部を貼られて「これはどうする？」「どう入れる？」と聞かれた場合も同様。日程・開催地一覧PDF（taikai_alle.pdf）の構造化、venue-candidates.json のレビュー、施設マスタを切り出すかの判断にも使う。出典（要項PDF）自体に誤記があるため、鵜呑みにせず検算する手順を含む。"
---

# 大会の会場データ入力

`information/*.json` の各年レコードに `venues` を入れる作業。

**この作業の肝は、出典を信用しないこと。** 要項PDFには実際に誤記がある。しかも
「福山市」（広島県に実在・STリーグ開催地）のように**もっともらしい誤り**なので、
そのまま入れると静かに別県へ紐づく。検算の手順を必ず通す。

仕様の正（source of truth）は `docs/wiki/data-model.md` の「大会の会場データ（`venues`）」節。
本skillと食い違ったら wiki を優先し、ついでに本skillを直す。

## どこに何を書くか

編集するのは `data/tournaments/information/{tournamentId}.json` だけ。
各年レコードの `endDate` の直後に `venues` と `guidelineUrl` を足す。

```json
{
  "year": 2025,
  "location": "宮城県",
  "startDate": "2025-04-26",
  "endDate": "2025-04-27",
  "venues": [
    {
      "prefecture": "宮城県",
      "city": "仙台市",
      "name": "仙台市青葉山公園庭球場",
      "aliases": [],
      "postalCode": "980-0863",
      "address": "宮城県仙台市青葉区川内追廻地内",
      "tel": "022-263-7486",
      "courts": 22,
      "surface": "クレー"
    }
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A01_10c.pdf",
  "source": "...",
  "categories": [ ... ]
}
```

`location`（都道府県）は**絶対に書き換えない**。`src/pages/tournaments/index.tsx` の
`prefNameToId[info.location]` が開催地フィルタの逆引きに使っている。
`"兵庫県、京都府"` のような壊れた値も残す。整理は読み取り側を `venues` へ移すときにまとめて行う。

`venues` は会場が1つでも配列。大会と会場は 1:N で、次の3パターンが実在する。

- 日別に変わる（全日本選手権: 開会式・競技1〜2日目・3日目で別施設）
- 種目・年齢区分別に分かれる（全日本シニア: 年齢区分ごとに3〜4施設）
- 複数市区町村・複数都道府県にまたがる（兵庫県神戸市／京都府福知山市・舞鶴市）

## フィールド

| フィールド | 必須 | 書き方 |
|---|---|---|
| `prefecture` | ○ | 複数県開催ではここが正（`location` ではない） |
| `city` | ○ | 市区町村。不明なら `null` |
| `name` | ○ | 施設名。要項未取得なら `null` |
| `aliases` | | 別名。**ネーミングライツの旧称・新称**を入れる |
| `nameRaw` | | 出典の表記そのまま。`name` と異なるときだけ |
| `postalCode` / `address` / `tel` | | `address` は都道府県から書く |
| `courts` | | 面数（数値） |
| `surface` | | 正規化語彙（下記） |
| `usage` | | どの日・どの種目か。**自由文** |
| `note` | | 出典を直した根拠、値を書かなかった理由 |

## 判断が要る4点

### 1. `surface` は原文のままにしない

要項の表記は揺れる ——「クレー**コート** 22面」「砂入り人工芝16面」「ハード**コート**23面」
「木床フローリング4面」。末尾の「コート」の有無が統一されていない。

施設名は識別子なので原文を保つが、`surface` は将来の絞り込みに使う**閉じた語彙**。
表記ゆれを持ち込むと後で surface の名寄せという余計な仕事が生える。

| 要項 | 書く値 |
|---|---|
| クレーコート | `クレー` |
| ハードコート | `ハード` |
| 砂入り人工芝 | `砂入り人工芝` |
| 木床フローリング | `木床フローリング` |

新しい表記が出たら既存と揃うか確認する:
`grep -rho '"surface": "[^"]*"' data/tournaments/information/ | sort -u`

### 2. `indoor` は持たない

要項に屋内/屋外の明記がないことが多く、施設名からの推測になる。
「体育館」「アリーナ」でも屋外コートを併用する大会がある。必要になった時点で別途調べる。

### 3. `usage` は構造化しない

`categories[].categoryId` と紐付けたくなるが、年度によっては `categories` が空で
参照先がない（例: `zennihon-senior` の2026年度）。実態が固まる前に構造を作ると壊れる。
当面は要項の原文をそのまま自由文で保存すれば足りる。

### 4. 推測で埋めない

値が壊れていれば**書かない**。`note` に理由を残す。

例: 東舞鶴公園のTEL「0773-63-764」は9桁で桁落ちしている。1桁足して推測するより、
`tel` を省略して「桁落ちのため未記録」と書くほうが安全。あとで正しい値を入れられる。

## 検算（必ず通す）

**`address` 先頭の都道府県と `prefecture` が一致するか。** これ1点で実際の誤記を検出できた。

```bash
python3 - <<'PY'
import json,glob,re
PREF=re.compile(r'^(北海道|東京都|京都府|大阪府|..[県])')
for f in glob.glob('data/tournaments/information/*.json'):
    for e in json.load(open(f)):
        for v in e.get('venues') or []:
            a=v.get('address')
            if a and not a.startswith(v['prefecture']):
                print('NG', f, e['year'], v.get('name'), a)
PY
```

### 出典が間違っていた場合

実例（`zennihon-senior` 2025年度の要項）:

> 三段池科研電機（**福山市**三段池公園）テニスコート 〒620-0017 **京都府福知山市**字猪崎377-1

括弧書きの「福山市」は誤りで、正しくは福知山市。住所・郵便番号と矛盾している。
**福山市は広島県に実在し、STリーグ プレーオフの開催地でもある**ため、
鵜呑みにすると「正しそうな見た目のまま」別県へ紐づく。

対処は3点セット。**原文を必ず残す**ことで、後から判断を検証できる。

```json
{
  "prefecture": "京都府",
  "city": "福知山市",
  "name": "三段池科研電機テニスコート",
  "aliases": ["福知山市三段池公園テニスコート"],
  "nameRaw": "三段池科研電機（福山市三段池公園）テニスコート",
  "note": "要項の括弧書き「福山市三段池公園」は誤記。記載の住所（京都府福知山市字猪崎377-1）および郵便番号620-0017は福知山市三段池公園のもの"
}
```

### ネーミングライツ

施設は命名権で改称される。要項が旧称を併記していることが多いので、**必ず `aliases` に拾う**。

> INOUE・東部スポーツパークテニスコート（**高知市東部総合運動場テニスコート**）

同じ施設が別の年に別名で出てくるため、ここを捨てると後で名寄せができなくなる。

## 施設マスタはまだ作らない

`data/venues/venues.json` は未作成。施設属性は当面 `venues[]` にインラインで持つ。

**切り出す基準: 同一施設が3回以上出現したとき。** 住所を3回手入力する前に寄せる、という目安。
出現見込みは `千葉県白子町` 5回 / `大阪府大阪市` 4回 / `広島県広島市` 4回 /
`東京都江東区` 3回 / `北海道札幌市` 3回。

インライン → マスタの正規化は後からできるが、逆はID体系を情報不足のまま決めることになる。
`aliases` を貯めておくことが、切り出し時の名寄せコストを下げる。

## データの取得元

- **開催地（市区町村）**: `data/local-sources/jsta-yearly-events/{年度}.json`
  日本連盟の「大会日程及び開催地一覧」PDF を構造化したもの。2024・2025・2026年度が存在。
  原本は `https://www.jsta.or.jp/wp-content/uploads/t_records/{年度}/{年度}_taikai_alle.pdf`
- **施設名・住所・面数・サーフェス**: 各大会の要項PDF の「4. 会場」節。
  URLは `.../t_records/{年度}/{年度}_{分類コード}_10.pdf`（末尾に `b` `c` の改訂版がある）
- **照合状況**: `data/local-sources/venue-candidates.json`（レビュー用候補ストア）

### venue-candidates.json を扱うとき

`detected-documents.json` と同型で、人が `status` を `new` → `accepted` / `rejected` に
確定してから `information` へ書き戻す。自動確定はしない。

**日付だけの照合は同日開催の別大会と誤マッチする。** 実測で、開始日が完全一致した46件のうち
7件が別大会だった（例: 2025-07-25 山口県の全日本高校選手権に対し、jsta の同日行は
青森県の実業団選手権）。大会名の正規化類似度を併用すると誤マッチは confidence 0.5前後に落ち、
正しいマッチ（0.80以上）と分離できる。**0.80未満は必ず人が見る。**

## 進め方

要項テキストを渡されたら、いきなり全部書かずに次の順で進む。人が途中で気づけるようにするのが肝。

1. 「会 場」節から施設を数える。**日別・種目別に分かれていないか**を先に確認する
   （見落としやすい。全日本シニアは年齢区分ごとに4施設だった）
2. 1施設ぶんを書いて、`address` 先頭の県と `prefecture` を照合する
3. 矛盾があれば止めて、どちらが正しいかを住所・郵便番号・`jsta-yearly-events` の
   開催地と突き合わせる。**独断で直さず、根拠を示して確認を取る**
4. 残りを書き、最後に上の検算スクリプトを全ファイルに通す
5. JSONが壊れていないか確認する
   `for f in data/tournaments/information/*.json; do python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$f" || echo "NG: $f"; done`

## 関連

- `docs/wiki/data-model.md`「大会の会場データ（`venues`）」— 仕様の正
- `docs/venue-input-worksheet.md` — 45件分の貼り付け用断片（作業用・入力完了後は破棄可）
- `docs/raw/2026-07-26-idea-tournament-metadata-platform.md` — 経緯と調査結果
- 参考実装: `information/zennihon-senior.json`（種目別・複数県・出典誤記）、
  `information/asian-championship-qualifier.json`（単一会場の最小例）

