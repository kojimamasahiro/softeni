# 高校カテゴリページの説明

このドキュメントでは、`src/pages/highschool` 配下のページについて、その内容や処理内容を説明します。

## 1. `index.tsx`

### 概要
- **URL**: `/highschool` (リダイレクト -> `/highschool/boys`)
- **目的**: 高校カテゴリのアクセスポイント。`/highschool/boys` へリダイレクトする。

### 主な処理
- 静的ページとして `meta refresh` を出し、`/highschool/boys` へ即時遷移。
- JavaScript に依存せず、静的エクスポート環境でも動く構成。

---

## 2. `[gender]/index.tsx`

### 概要
- **URL**: `/highschool/:gender` (`boys` or `girls`)
- **目的**: 高校カテゴリのトップページとして、都道府県別に男子・女子の成績を表示する。
- **主な機能**:
  - 男子・女子の切り替えタブ（リンク）。
  - 都道府県を地域ごとにグループ化して表示。

### 主な処理
- `getStaticPaths`:
  - `boys`, `girls` のパスを生成。
- `getStaticProps`:
  - `data/prefectures.json` を読み込み、都道府県データを地域ごとにグループ化してページに渡す。
  - URLパラメータから `gender` を受け取る。
- **コンポーネント**:
  - `Breadcrumbs`: パンくずリストを表示。
  - `MetaHead`: SEO用のメタ情報を設定。

---

## 3. `[gender]/[prefectureId]/index.tsx`

### 概要
- **URL**: `/highschool/:gender/:prefectureId`
- **目的**: 指定された都道府県の男子または女子の高校成績を表示する。
- **主な機能**:
  - 都道府県ごとの成績を表示。
  - 最新の大会情報や、ベスト8以上の学校数を表示。
  - 学校一覧を「より良い成績 → 新しい年度 → 学校名」で表示。

### 主な処理
- `getStaticPaths`:
  - `data/prefectures.json` を使用して、すべての都道府県と性別の組み合わせのパスを生成。
- `getStaticProps`:
  - `data/highschool/prefectures/:prefectureId/summary.json` を読み込み、指定された性別のデータをフィルタリング。
  - 最新の大会情報や、チームごとの成績を計算。
  - 同一年同大会の複数結果がある場合は、最良成績のみを採用。
- **コンポーネント**:
  - `Breadcrumbs`: パンくずリストを表示。
  - `MetaHead`: SEO用のメタ情報を設定。

---

## 4. `[gender]/[prefectureId]/[teamId].tsx`

### 概要
- **URL**: `/highschool/:gender/:prefectureId/:teamId`
- **目的**: 指定されたチームの成績詳細を表示する。
- **主な機能**:
  - チームの大会ごとの成績を年度別に表示。
  - 種目別の最高成績や出場回数を分析して表示。
  - 大会は主要大会順、種目は団体戦 → ダブルス → シングルスの順で表示。

### 主な処理
- `getStaticPaths`:
  - `data/highschool/prefectures/:prefectureId/summary.json` を使用して、すべてのチームIDと性別の組み合わせのパスを生成。
- `getStaticProps`:
  - `data/highschool/prefectures/:prefectureId/summary.json` を読み込み、指定されたチームIDと性別のデータをフィルタリング。
  - `data/highschool/prefectures/:prefectureId/:teamId/:gender/analysis.json` を読み込み、チームの分析データを取得。
- **コンポーネント**:
  - `Breadcrumbs`: パンくずリストを表示。
  - `MetaHead`: SEO用のメタ情報を設定。

---

## データ構造

### `data/prefectures.json`
- 都道府県の基本情報を格納。
- **例**:
  ```json
  [
    {
      "id": "tokyo",
      "name": "東京都",
      "region": "関東"
    },
    {
      "id": "osaka",
      "name": "大阪府",
      "region": "近畿"
    }
  ]
  ```

### `data/highschool/prefectures/:prefectureId/summary.json`
- 都道府県ごとの高校成績データを格納。
- **例**:
  ```json
  [
    {
      "team": "東京高校",
      "teamId": "tokyo-high",
      "prefecture": "東京都",
      "prefectureId": "tokyo",
      "result": "優勝",
      "category": "team",
      "tournamentId": "highschool-championship",
      "year": 2025,
      "gender": "boys"
    }
  ]
  ```

### `data/highschool/prefectures/:prefectureId/:teamId/:gender/analysis.json`
- チームごとの分析データを格納。
- **例**:
  ```json
  {
    "totalAppearances": 10,
    "byCategory": {
      "singles": 5,
      "doubles": 3,
      "team": 2
    },
    "resultsByCategory": {
      "singles": {
        "recentlyResult": {
          "year": 2025,
          "tournamentId": "highschool-championship",
          "category": "singles",
          "result": "ベスト8"
        },
        "historicalBest": {
          "year": 2023,
          "tournamentId": "highschool-japan-cup",
          "category": "singles",
          "result": "優勝"
        }
      }
    },
    "uniquePlayers": 15,
    "topPlayers": [
      { "id": "player1", "appearances": 8 },
      { "id": "player2", "appearances": 7 }
    ]
  }
  ```

---

## 注意点
- 各ページは静的生成（SSG）を使用しており、ビルド時にデータを取得します。
- データファイルの構造が変更された場合、対応するコードの修正が必要です。
- SEO 文言は安全寄り方針として、商標語をページ主ラベルにせず、`全国高等学校総合体育大会` や `高校総体` など正式名称・一般名称を優先して使用します。
