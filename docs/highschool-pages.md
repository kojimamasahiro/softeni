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
  - 都道府県を地域ごとにグループ化して表示。
  - 男子・女子の切り替えセグメント（リンク）。

### 主な処理

- `getStaticPaths`:
  - `boys`, `girls` のパスを生成。
- `getStaticProps`:
  - `data/prefectures.json` を読み込み、都道府県データを地域ごとにグループ化してページに渡す。
  - 各都道府県の `summary.json` を参照し、学校数・ベスト8以上経験校数・最新年度を集計する。
  - URLパラメータから `gender` を受け取る。
- **コンポーネント**:
  - `Breadcrumbs`: パンくずリストを表示。
  - `MetaHead`: SEO用のメタ情報を設定。
  - 男女切り替えは共通のセグメント型リンクを使用し、男子/女子トップページを切り替える。
  - FAQ 構造化データを出力する。

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
  - `data/tournaments/index.json` と大会情報ファイルを参照し、直近1年の主要大会結果ページに掲載された学校一覧を生成する。
  - 1回戦敗退や予選敗退も、主要大会掲載校として扱う。
- **コンポーネント**:
  - `Breadcrumbs`: パンくずリストを表示。
  - `MetaHead`: SEO用のメタ情報を設定。
  - 男女切り替えは共通のセグメント型リンクを使用し、同じ都道府県の男子/女子ページへ切り替える。
  - FAQ 構造化データを出力する。

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
  - インターハイ実績の掲載数・最新成績・最高成績を算出する。
- **コンポーネント**:
  - `Breadcrumbs`: パンくずリストを表示。
  - `MetaHead`: SEO用のメタ情報を設定。
  - Article / FAQ 構造化データを出力する。

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
- `インターハイ` は補助文脈として本文で扱い、主ラベルは `全国大会成績` を維持します。
- 大会名の表示は `data/tournaments/index.json` の `label` を優先し、未登録分のみ補助フォールバックを使います。
- 「直近1年の主要大会掲載校」カードでは、高校カテゴリの大会は除外します。
- 個人戦の学校名表記揺れは、`data/tournaments/index.json` に載る大会を横断して、`year + lastName + firstName` が一致する選手が別学校名で現れた場合に同一校として寄せる暫定ルールを使用します。
- 寄せ根拠は `scripts/highschool/03list/inferred-team-aliases.json` に `reasons` として出力します。
- 誤結合リスクがあるため、確認論点は `docs/wiki/open-questions.md` に残します。
