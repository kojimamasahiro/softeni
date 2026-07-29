# 開催地・会場データ 手動入力ワークシート

生成日: 2026-07-26 / 出典: `data/local-sources/venue-candidates.json`

> **この文書は作業用です。入力が終わったら破棄して構いません。**
> スキーマとフィールドの記載ルールの正（source of truth）は
> [docs/wiki/data-model.md](./wiki/data-model.md) の「大会の会場データ（`venues`）」節です。
> 本文書には作業用に同じ内容を要約していますが、食い違った場合は wiki 側が正しいものとします。


## 1. どのファイルの、どこに入れるか

**編集するファイルは1種類だけです**: `data/tournaments/information/{tournamentId}.json`

各年レコード（`year` を持つオブジェクト）に、次の**2フィールドを追加**します。

```jsonc
{
  "year": 2025,
  "location": "東京都",          // ← 既存。消さない・変えない
  "startDate": "2025-11-06",
  "endDate": "2025-11-08",

  "venues": [                    // ★追加1
    { "prefecture": "東京都", "city": "江東区", "name": null }
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A12_10b.pdf",  // ★追加2

  "source": "...",
  "sourceUrl": "...",
  "label": "...",
  "categories": [ ... ]
}
```

### フィールドの決まり

| フィールド | 型 | 説明 |
|---|---|---|
| `venues` | 配列 | **必ず配列**。大会:会場は1:N（日別に会場が変わる／複数市区町村・複数県にまたがる）。1会場でも配列で書く |
| `venues[].prefecture` | string | 都道府県名。`location` と同じ値になることが多いが、複数県にまたがる場合はここが正 |
| `venues[].city` | string \| null | 市区町村。不明なら `null` |
| `venues[].name` | string \| null | **施設名。今回はすべて `null` のままでよい**（次フェーズで要項PDFから埋める） |
| `guidelineUrl` | string \| null | 大会要項PDFのURL。無ければ書かない |

### 要項PDFが読めた場合の拡張フィールド

`guidelineUrl` のPDFを開いて「4. 会場」節が読めたら、`venues[]` の各要素に以下を足します。
**読めた項目だけ書き、書いていない項目のキーは作らない**（推測で埋めない）。

| フィールド | 例 | 備考 |
|---|---|---|
| `name` | `"高知県立春野総合運動公園テニスコート"` | 要項の表記をそのまま。略さない |
| `aliases` | `["高知市東部総合運動場テニスコート"]` | **ネーミングライツ等の別名**。要項に併記されていたら必ず拾う |
| `postalCode` | `"781-0311"` | ハイフン付き |
| `address` | `"高知県高知市春野町芳原2485"` | 都道府県から書く |
| `tel` | `"088-841-3105"` | |
| `courts` | `16` | 数値。面数 |
| `surface` | `"砂入り人工芝"` | **末尾の「コート」を落として正規化する**（下記参照） |
| `usage` | `"競技（男女70歳・75歳・80歳）"` | **自由文**。どの日・どの種目に使われたか |

実例は `information/zennihon-senior.json` の2026年度を参照。

**`usage` を自由文にしている理由**: 会場は日付だけでなく**種目（年齢区分・男女）ごとにも分かれます**。
`categories[].categoryId` と機械的に紐付けたくなりますが、年度によっては `categories` が空
（例: zennihon-senior の2026年度）で参照先がありません。実態が固まる前に構造を作ると壊れるので、
**当面は要項の原文をそのまま自由文で保存**します。構造化は用途が決まってからで間に合います。

**`indoor` は書きません**: 要項に屋内/屋外の明記がないことが多く、施設名からの推測になるためです。
必要になった時点で別途調べます。

### `surface` だけは原文のままにしない

要項の表記は揺れています——「クレー**コート** 22面」「砂入り人工芝16面」「ハード**コート**23面」
「木床フローリング4面」。**末尾の「コート」の有無が統一されていません**。

施設名は識別子なので原文どおりに保ちますが、`surface` は将来の絞り込み（「人工芝だけ」等）に使う
**閉じた語彙**です。表記ゆれを持ち込むと後で名寄せが必要になるので、ここは入力時に正規化します。

| 要項の表記 | `surface` に書く値 |
|---|---|
| クレーコート | `クレー` |
| ハードコート | `ハード` |
| 砂入り人工芝 | `砂入り人工芝` |
| 木床フローリング | `木床フローリング` |

新しい表記が出てきたら、既存の値と揃うか確認してから追加してください
（現在使用中の値は `grep -rho '"surface": "[^"]*"' data/tournaments/information/ | sort -u` で確認できます）。

### 出典（要項PDF）が間違っている場合

**要項PDF自体に誤記があります。** 実例（zennihon-senior 2025年度）:

> 三段池科研電機（**福山市**三段池公園）テニスコート 〒620-0017 **京都府福知山市**字猪崎377-1

括弧書きの「福山市」は誤りで、正しくは福知山市。住所・郵便番号と矛盾しているので気づけます。
**これを鵜呑みにすると、広島県福山市（STリーグ プレーオフの開催地として実在する）に
誤って紐づく**という、静かに壊れる種類のバグになります。

対処は次の2フィールドで、**修正した値と原文の両方を残します**。

| フィールド | 用途 |
|---|---|
| `nameRaw` | 出典の表記を**そのまま**保存。`name` と異なるときだけ書く |
| `note` | 何をどう直したか、根拠は何かを1文で |

同様に、値が明らかに壊れている場合は**書かない**のが正解です
（例: TEL「0773-63-764」は9桁で桁落ちしているため `tel` を省略し、`note` に理由を残した）。
推測で補完しないでください。

**検算のコツ**: `address` の先頭の都道府県が `prefecture` と一致するかを見る。
上の誤記はこの1点で検出できました。

### 今回やらないこと（重要）

- **`data/venues/venues.json`（施設マスタ）はまだ作りません。** 施設名が集まっていない段階で
  IDを振ると二度手間になります。当面は上記のとおり `venues[]` にインラインで書いてください。
  - **切り出す判断基準**: 同じ施設が **3回以上**出てきたら、そこでマスタ化する。
    候補は市区町村の出現回数から見えていて、`千葉県白子町` 5回 / `大阪府大阪市` 4回 /
    `広島県広島市` 4回 / `東京都江東区` 3回 / `北海道札幌市` 3回。
    住所を3回手入力する前にマスタへ寄せる、という目安。
  - インラインで書いておけば後からマスタへ正規化できますが、逆（マスタ先行）は
    ID体系を情報不足のまま決めることになるので避けます。
- `location`（都道府県）は**書き換えないでください**。既存の絞り込み・逆引きが依存しています
  （`src/pages/tournaments/index.tsx` の `prefNameToId`）。
- 地方大会（`local_index.json` 側）と2023年度以前は今回の対象外です。

---

## 2. そのまま貼れる 45件（confidence 0.80以上）

大会名・開始日・都道府県すべて一致。目視不要と判断したものです。


### `information/asian-championship-qualifier.json`

**year: 2025**（2025-04-26 / jsta: 第9回 アジア選手権大会日本代表予選会）

```json
  "venues": [
    {"prefecture": "宮城県", "city": "仙台市", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A01_10c.pdf",
```


### `information/asian-games-qualifier.json`

**year: 2025**（2026-03-20 / jsta: 第20回 アジア競技大会日本代表予選会）

```json
  "venues": [
    {"prefecture": "福島県", "city": "棚倉町", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A16_10.pdf",
```


### `information/east-japan.json`

**year: 2026**（2026-07-18 / jsta: 第81回 東日本選手権大会）

```json
  "venues": [
    {"prefecture": "山形県", "city": "山形市", "name": null},
    {"prefecture": "山形県", "city": "天童市", "name": null},
    {"prefecture": "山形県", "city": "酒田市", "name": null}
  ],
```

**year: 2025**（2025-07-19 / jsta: 第80回 東日本選手権大会）

```json
  "venues": [
    {"prefecture": "富山県", "city": null, "name": null}
  ],
```


### `information/highschool-japan-cup.json`

**year: 2026**（2026-06-25 / jsta: 第55回 ハイスクールジャパンカップ）

```json
  "venues": [
    {"prefecture": "北海道", "city": "札幌市", "name": null}
  ],
```

**year: 2024**（2024-06-19 / jsta: 第53回 ハイスクールジャパンカップ）

```json
  "venues": [
    {"prefecture": "北海道", "city": "札幌市", "name": null}
  ],
```


### `information/highschool-senbatsu.json`

**year: 2025**（2026-03-28 / jsta: 第51回 全日本高校選抜大会）

```json
  "venues": [
    {"prefecture": "愛知県", "city": "名古屋市", "name": null}
  ],
```

**year: 2024**（2025-03-28 / jsta: 第50回 全日本高校選抜大会）

```json
  "venues": [
    {"prefecture": "和歌山県", "city": "和歌山市", "name": null}
  ],
```


### `information/international-hiroshima-peacecup.json`

**year: 2025**（2026-03-14 / jsta: 第6回 平和カップひろしま国際大会）

```json
  "venues": [
    {"prefecture": "広島県", "city": "広島市", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_B15_10.pdf",
```


### `information/primaryschool-championship.json`

**year: 2025**（2026-03-29 / jsta: 第25回 全国小学生大会）

```json
  "venues": [
    {"prefecture": "千葉県", "city": "白子町", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_C01_10b.pdf",
```

**year: 2024**（2025-03-29 / jsta: 第24回 全国小学生大会）

```json
  "venues": [
    {"prefecture": "千葉県", "city": "白子町", "name": null}
  ],
```


### `information/secondaryschool-championship.json`

**year: 2025**（2025-08-19 / jsta: 第56回 全国中学校大会）

```json
  "venues": [
    {"prefecture": "熊本県", "city": "熊本市", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_B08_10.pdf",
```

**year: 2024**（2024-08-19 / jsta: 第55回 全国中学校大会）

```json
  "venues": [
    {"prefecture": "石川県", "city": "金沢市", "name": null},
    {"prefecture": "石川県", "city": "白山市", "name": null},
    {"prefecture": "石川県", "city": "津幡町", "name": null}
  ],
```


### `information/west-japan.json`

**year: 2026**（2026-07-04 / jsta: 第80回 西日本選手権大会）

```json
  "venues": [
    {"prefecture": "徳島県", "city": "徳島市", "name": null},
    {"prefecture": "徳島県", "city": "阿南市", "name": null}
  ],
```

**year: 2025**（2025-07-12 / jsta: 第79回 西日本選手権大会）

```json
  "venues": [
    {"prefecture": "奈良県", "city": "明日香村", "name": null},
    {"prefecture": "京都府", "city": "宇治市", "name": null}
  ],
```


### `information/world-championship-qualifier.json`

**year: 2024**（2024-04-27 / jsta: 第17回 世界選手権日本代表予選会）

```json
  "venues": [
    {"prefecture": "宮城県", "city": "仙台市", "name": null}
  ],
```


### `information/zennihon-business-group.json`

**year: 2026**（2026-07-31 / jsta: 男子第71回・女子第70回 全日本実業団選手権大会）

```json
  "venues": [
    {"prefecture": "宮崎県", "city": "宮崎市", "name": null},
    {"prefecture": "宮崎県", "city": "都城市", "name": null}
  ],
```

**year: 2025**（2025-07-26 / jsta: 男子第70回・女子第69回 全日本実業団選手権大会）

```json
  "venues": [
    {"prefecture": "青森県", "city": "青森市", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A04_10b.pdf",
```


### `information/zennihon-championship.json`

**year: 2026**（2026-11-06 / jsta: 第81回 天皇賜杯・皇后賜杯全日本選手権大会）

```json
  "venues": [
    {"prefecture": "東京都", "city": "江東区", "name": null}
  ],
```

**year: 2025**（2025-11-06 / jsta: 第80回 天皇賜杯・皇后賜杯 全日本選手権大会）

```json
  "venues": [
    {"prefecture": "東京都", "city": "江東区", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A12_10b.pdf",
```

**year: 2024**（2024-11-08 / jsta: 第79回 天皇賜杯・皇后賜杯全日本選手権大会）

```json
  "venues": [
    {"prefecture": "東京都", "city": "江東区", "name": null}
  ],
```


### `information/zennihon-club.json`

**year: 2026**（2026-10-24 / jsta: 第33回 全日本クラブ選手権大会）

```json
  "venues": [
    {"prefecture": "千葉県", "city": "白子町", "name": null}
  ],
```


### `information/zennihon-indoor.json`

**year: 2026**（2027-02-07 / jsta: 第72回 全日本インドア選手権大会）

```json
  "venues": [
    {"prefecture": "大阪府", "city": "大阪市", "name": null}
  ],
```

**year: 2025**（2026-02-08 / jsta: 第71回 全日本インドア選手権大会）

```json
  "venues": [
    {"prefecture": "大阪府", "city": "大阪市", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A15_10.pdf",
```

**year: 2024**（2025-02-02 / jsta: 第70回 全日本インドア選手権大会）

```json
  "venues": [
    {"prefecture": "大阪府", "city": "大阪市", "name": null}
  ],
```


### `information/zennihon-mixed.json`

**year: 2026**（2026-06-06 / jsta: 第7回 全日本ミックスダブルス選手権大会（一般））

```json
  "venues": [
    {"prefecture": "茨城県", "city": "北茨城市", "name": null}
  ],
```

**year: 2025**（2025-06-14 / jsta: 第6回 全日本ミックスダブルス選手権大会）

```json
  "venues": [
    {"prefecture": "広島県", "city": "広島市", "name": null},
    {"prefecture": "広島県", "city": "安芸郡", "name": null},
    {"prefecture": "広島県", "city": "福山市", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A03_10b.pdf",
```

**year: 2024**（2024-06-15 / jsta: 第5回 全日本ミックスダブルス選手権大会）

```json
  "venues": [
    {"prefecture": "奈良県", "city": "明日香村", "name": null}
  ],
```


### `information/zennihon-primaryschool.json`

**year: 2026**（2027-03-25 / jsta: 第43回 全日本小学生選手権大会）

```json
  "venues": [
    {"prefecture": "千葉県", "city": "千葉市", "name": null}
  ],
```

**year: 2025**（2025-08-01 / jsta: 第42回 全日本小学生選手権大会）

```json
  "venues": [
    {"prefecture": "茨城県", "city": "神栖市", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A05_10c.pdf",
```

**year: 2024**（2024-08-02 / jsta: 第41回 全日本小学生選手権大会）

```json
  "venues": [
    {"prefecture": "岡山県", "city": "岡山市", "name": null}
  ],
```


### `information/zennihon-secondaryschool-club.json`

**year: 2026**（2026-11-21 / jsta: 第1回 全日本中学生クラブ選手権大会）

```json
  "venues": [
    {"prefecture": "千葉県", "city": "白子町", "name": null}
  ],
```


### `information/zennihon-secondaryschool-club-pre.json`

**year: 2025**（2025-09-14 / jsta: 全日本中学生クラブ選手権プレ大会）

```json
  "venues": [
    {"prefecture": "千葉県", "city": "白子町", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A07_10c.pdf",
```


### `information/zennihon-secondaryschool-versus.json`

**year: 2025**（2026-03-27 / jsta: 第37回 都道府県対抗全日本中学生大会）

```json
  "venues": [
    {"prefecture": "三重県", "city": "伊勢市", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_B16_10.pdf",
```

**year: 2024**（2025-03-27 / jsta: 第36回 都道府県対抗全日本中学生大会）

```json
  "venues": [
    {"prefecture": "三重県", "city": "伊勢市", "name": null}
  ],
```


### `information/zennihon-senior.json`

**year: 2026**（2026-10-10 / jsta: 第30回 全日本シニア選手権大会）

```json
  "venues": [
    {"prefecture": "高知県", "city": "高知市", "name": null},
    {"prefecture": "高知県", "city": "黒潮町", "name": null}
  ],
```

**year: 2025**（2025-09-20 / jsta: 第29回 全日本シニア選手権大会）

```json
  "venues": [
    {"prefecture": "兵庫県", "city": "神戸市", "name": null},
    {"prefecture": "京都府", "city": "福知山市", "name": null},
    {"prefecture": "京都府", "city": "舞鶴市", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A08_10.pdf",
```


### `information/zennihon-singles.json`

**year: 2026**（2026-05-15 / jsta: 第33回 全日本シングルス選手権大会）

```json
  "venues": [
    {"prefecture": "岐阜県", "city": "岐阜市", "name": null}
  ],
```

**year: 2025**（2025-05-17 / jsta: 第32回 全日本シングルス選手権大会）

```json
  "venues": [
    {"prefecture": "宮崎県", "city": "宮崎市", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A02_10c.pdf",
```

**year: 2024**（2024-05-18 / jsta: 第31回 全日本シングルス選手権大会）

```json
  "venues": [
    {"prefecture": "福島県", "city": "会津若松市", "name": null}
  ],
```


### `information/zennihon-university.json`

**year: 2025**（2025-08-29 / jsta: 2025 全日本学生選手権大会）

```json
  "venues": [
    {"prefecture": "千葉県", "city": "千葉市", "name": null}
  ],
```

**year: 2024**（2024-09-10 / jsta: 全日本学生選手権大会）

```json
  "venues": [
    {"prefecture": "沖縄県", "city": "沖縄市", "name": null}
  ],
```


### `information/zennihon-workers.json`

**year: 2026**（2026-08-29 / jsta: 第54回 全日本社会人選手権大会）

```json
  "venues": [
    {"prefecture": "大阪府", "city": "大阪市", "name": null}
  ],
```

**year: 2025**（2025-08-30 / jsta: 第53回 全日本社会人選手権大会）

```json
  "venues": [
    {"prefecture": "北海道", "city": "苫小牧市", "name": null},
    {"prefecture": "北海道", "city": "室蘭市", "name": null},
    {"prefecture": "北海道", "city": "札幌市", "name": null}
  ],
  "guidelineUrl": "https://www.jsta.or.jp/wp-content/uploads/t_records/2025/2025_A06_10.pdf",
```

**year: 2024**（2024-09-14 / jsta: 第52回 全日本社会人選手権大会）

```json
  "venues": [
    {"prefecture": "石川県", "city": "金沢市", "name": null},
    {"prefecture": "石川県", "city": "小松市", "name": null}
  ],
```


---

## 3. 目視で判断が必要な 8件

confidence が 0.80 未満のもの。**同日開催の別大会と取り違えている可能性**があります。

| 判定 | 年度 | 開始日 | tournamentId | 現在の`location` | jstaの候補 | jstaの大会名 | conf | 見立て |
|---|---|---|---|---|---|---|---|---|
| ☐ | 2024 | 2024-10-05 | `zennihon-junior` | 広島県 | 広島県広島市 | 第31回 ジュニアオリンピックカップ 全日本ジュニア選手権大会 | 0.78 | **採用可**。名称に「JOC」が付くか否かの表記ゆれだけ。県も日付も一致 |
| ☐ | 2026 | 2026-10-24 | `zennihon-junior` | 広島県 | 広島県広島市 | 第33回 JOCジュニアオリンピックカップ 全日本ジュニア選手権大会 | 0.76 | **採用可**。同上 |
| ☐ | 2025 | 2025-10-18 | `zennihon-junior` | 広島県 | 広島県広島市 | JOCジュニアオリンピックカップ／第32回全日本ジュニア選手権大会 | 0.75 | **採用可**。同上 |
| ☐ | 2024 | 2024-07-25 | `highschool-championship` | 長崎県 | 長崎県長崎市 | 全日本高校選手権大会（女子） | 0.69 | **採用可**。ただし jsta は男女で行が分かれ会場・日程が違う（男子は 7/29〜8/1）。男女を1レコードで持つなら `venues` は両方分を入れる |
| ☐ | 2025 | 2025-06-20 | `highschool-japan-cup` | 北海道 | 北海道札幌市 | 第54回 ハイスクールジャパンカップ | 0.65 | **採用可**。jsta の会期は 6/18〜22 で当方の開始日 6/20 は範囲内 |
| ☐ | 2026 | 2026-07-31 | `highschool-championship` | 山口県 | 京都府福知山市 | 全日本高校選手権大会（女子） | 0.59 | **要調査。当方のデータが誤りの疑い**。jsta 2026年度は京都府福知山市、山口県宇部市は**2025年度**の開催地。開始日は jsta 女子行と完全一致するので、`location` が前年からのコピー漏れの可能性が高い |
| ☐ | 2026 | 2026-06-13 | `zennihon-university-ouza` | 滋賀県 | 茨城県北茨城市、水戸市、日立市 | 第7回 全日本ミックスダブルス選手権大会（35歳以上） | 0.55 | **却下**。全日本学生王座と全日本ミックスダブルスは別大会。日付が近いだけ |
| ☐ | 2025 | 2025-07-25 | `highschool-championship` | 山口県 | 青森県青森市 | 男子第70回・女子第69回 全日本実業団選手権大会 | 0.49 | **却下**。同日開催の別大会。全日本高校選手権(男子)の正しい jsta 行は 7/24〜27 山口県宇部市 |

**判定のしかた**: 「jstaの大会名」が、その `tournamentId` の大会と**同じ大会か**を見てください。

- 同じ大会 → 上の第2節と同じ形式で `venues` を追加
- **違う大会** → jsta の候補は捨てる。開催地は別途調べる

県が食い違っている行は、ほぼ確実に**別大会との誤マッチ**です。ただし
**2026年度の `highschool-championship` だけは例外**で、jsta 側が正しく当方のデータが誤っている疑いがあります。
ここは `venues` を足す前に `location` 自体を確認してください。


---

## 4. jsta では取れない 3件

| 年度 | 開始日 | tournamentId | 現在の`location` | 理由 |
|---|---|---|---|---|
| 2025 | 2025-11-03 | `zennihon-university-indoor` | （空） | 日本学生連盟主催。jsta一覧に載らない。`open-questions.md`記載の会場不明案件 |
| 2026 | 2026-04-04 | `zennihon-senbatsu` | 東京都 | jstaの年度一覧に該当行なし |
| 2026 | 2026-06-15 | `international-korea-cup` | 韓国 | 韓国開催。jsta一覧の対象外 |

別経路（主催団体サイト・Wikipedia）で個別に調べる必要があります。今回は空欄のままで構いません。

---

## 5. 入れ終わったら

1. 全 `information/*.json` が JSON として壊れていないか確認
   ```bash
   for f in data/tournaments/information/*.json; do python3 -c "import json,sys;json.load(open(sys.argv[1]))" "$f" || echo "NG: $f"; done
   ```
2. `data/local-sources/venue-candidates.json` の該当行の `status` を `new` → `accepted` / `rejected` に更新
3. 次フェーズ（要項PDFから施設名を取る）は、第2節で `guidelineUrl` を入れた**17件**が対象になります

