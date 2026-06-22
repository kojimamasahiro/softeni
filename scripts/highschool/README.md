# 高校ソフトテニスデータ処理スクリプト

このディレクトリには、高校ソフトテニスの大会データを処理し、Webサイト用のデータを生成するスクリプトが含まれています。

## 前提条件

- Python 3.x
- 仮想環境 (`.venv`) がプロジェクトルートに設定されていること

## ディレクトリ構成

```
scripts/highschool/
├── 01team/           # チーム情報の生成
├── 02result/         # 大会結果の抽出
├── 03list/           # 都道府県別サマリーの生成
├── 04summry/         # 都道府県ごとのサマリーファイル生成
└── analysis/         # 学校別の分析データ生成
```

## 実行順序

データ処理は以下の順序で実行してください:

### 1. 大会結果の抽出 (`02result/extract.py`)

大会データから結果を抽出し、`results.json` を生成します。

```bash
cd scripts/highschool/02result
../../../.venv/bin/python extract.py
```

**処理内容:**

- `data/tournaments/index.json` に載る大会のうち、`data/tournaments/details` に実体がある大会データを読み込み
- チーム名と都道府県のマッピングを構築
- トーナメント結果とラウンドロビン結果を抽出
- ラウンドロビンで敗退した選手も「予選敗退」として登録
- 性別情報 (boys/girls/mixed) を自動判定

**出力:** `results.json` (全大会結果のリスト)

### 2. 都道府県別サマリーの生成 (`03list/summary.py`)

結果データを都道府県×種目ごとに整理します。

```bash
cd scripts/highschool/03list
../../../.venv/bin/python summary.py
```

**処理内容:**

- `results.json` を読み込み
- 都道府県別、種目別にデータを集計
- チーム情報とプレイヤー情報を紐付け

**出力:** `prefecture-summary.json`

### 3. 都道府県ごとのサマリーファイル生成 (`04summry/generate_prefecture_summaries.py`)

都道府県ごとに個別のサマリーファイルを生成します。

```bash
cd scripts/highschool/04summry
../../../.venv/bin/python generate_prefecture_summaries.py
```

**処理内容:**

- `prefecture-summary.json` を読み込み
- 各都道府県のデータを抽出
- 重複を除去して個別ファイルに保存

**出力:** `data/highschool/prefectures/{prefectureId}/summary.json`

### 4. 学校別分析データの生成 (`analysis/generate_school_analysis.py`)

各学校の成績分析データを生成します。

```bash
cd scripts/highschool/analysis
../../../.venv/bin/python generate_school_analysis.py
```

**処理内容:**

- 各都道府県の `summary.json` を読み込み
- 学校×性別ごとにデータを集計
- 総出場回数、種目別出場回数、最高成績、トッププレイヤーなどを算出

**出力:** `data/highschool/prefectures/{prefectureId}/{teamId}/{gender}/analysis.json`

## 一括実行

すべてのスクリプトを順番に実行する場合:

```bash
cd scripts/highschool/02result
python extract.py && \
python ../03list/summary.py && \
python ../04summry/generate_prefecture_summaries.py && \
python ../analysis/generate_school_analysis.py
```

## データ構造

### 性別の扱い

- ファイル名から性別を自動判定 (`boys` / `girls` / `mixed`)
- 全データに `gender` フィールドが付与される
- 分析データは性別ごとに別ディレクトリに保存

### ラウンドロビンの扱い

- `tournament` フィールドが `null` でも `roundrobin` フィールドがあれば処理
- ラウンドロビンで敗退した選手は「予選敗退」として登録
- `roundRobin` と `roundrobin` の両方のフィールド名に対応

## トラブルシューティング

### エラー: `'NoneType' object has no attribute 'get'`

- 原因: JSONデータの構造が想定と異なる
- 対処: 該当のJSONファイルを確認し、データ構造を修正

### 結果の件数が少ない

- 原因: ラウンドロビン敗退者が登録されていない可能性
- 対処: `extract.py` が最新版か確認

### 重複データが発生する

- 原因: 同じ選手が複数の都道府県で登録されている
- 対処: `generate_prefecture_summaries.py` の重複除去ロジックを確認

## 注意事項

- スクリプトは必ず指定された順序で実行してください
- データ更新後は必ずWebサイトをビルドして動作確認してください
- 大会データの追加・更新時は、すべてのスクリプトを再実行してください
