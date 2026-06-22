# Tournament Data Structure Documentation

このドキュメントは、`data/tournament/` ディレクトリ配下のJSONファイルの構造と使用方法を説明します。

## ディレクトリ構造

```
data/tournament/
├── index.json                    # 大会マスタデータ
├── local_index.json              # 地方大会マスタデータ
├── federations.json              # 連盟情報マスタデータ
├── genarations.json              # 世代区分マスタデータ
├── information/                  # 大会開催情報
│   ├── {tournamentId}.json
│   └── ...
└── details/                      # 大会詳細データ（試合結果等）
    └── {tournamentId}/
        └── {year}/
            └── {category}.json
```

## ファイル詳細

### 1. `index.json` - 大会マスタデータ

大会の基本情報を定義するマスタファイル。

#### データ構造

> **型定義**: [`TournamentIndexEntry`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L3-L9)

```typescript
export interface TournamentIndexEntry {
  tournamentId: string; // 大会ID（例: "highschool-japan-cup"）
  generationId: string; // 世代区分ID（例: "highschool", "university"）
  label: string; // 大会名（例: "ハイスクールジャパンカップ"）
  isMajorTitle: boolean; // 主要タイトルかどうか
  officialUrl: string; // 公式サイトURL
  federationId?: string; // 連盟ID（local_index.jsonで使用）
}
```

#### 使用例

```json
{
  "tournamentId": "highschool-japan-cup",
  "generationId": "highschool",
  "label": "ハイスクールジャパンカップ",
  "isMajorTitle": false,
  "officialUrl": "https://www.gosen-sp.jp/hjs/"
}
```

#### 使用箇所

- `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx`
  - `getStaticPaths`: tournamentId → generationId のマッピングに使用
  - `getStaticProps`: 大会名（label）の取得に使用

---

### 1-1. `local_index.json` - 地方大会マスタデータ

地域連盟主催などの大会情報を定義するマスタファイル。構造は `index.json` とほぼ同じですが、`federationId` が必須となる場合があります。

#### データ構造

```typescript
export interface LocalTournamentIndexEntry extends TournamentIndexEntry {
  federationId: string; // 連盟ID（data/prefectures.json のIDと一致）
}
```

#### 使用例

```json
{
  "tournamentId": "tokyo-highschool-spring",
  "generationId": "highschool",
  "federationId": "tokyo",
  "label": "東京都高等学校 ソフトテニス春季大会",
  "officialUrl": "http://www.soft-tennis.com/tokyo/h/index.html"
}
```

---

### 1-2. `federations.json` - 連盟情報マスタデータ

各地域の連盟情報を定義します。

#### データ構造

```typescript
interface FederationEntry {
  federationId: string; // 連盟ID（例: "tokyo"）
  region: string; // 地域区分（例: "関東"）
  label: string; // 連盟名（例: "東京都ソフトテニス連盟"）
  officialUrl: string; // 連盟公式サイトURL
}
```

#### 使用例

```json
{
  "federationId": "tokyo",
  "region": "関東",
  "label": "東京都ソフトテニス連盟",
  "officialUrl": "http://www.soft-tennis.com/tokyo/"
}
```

---

### 2. `genarations.json` - 世代区分マスタデータ

大会の世代区分を定義するマスタファイル。

#### データ構造

> **注**: 世代区分の型定義は `genarations.json` の構造に基づきますが、`src/types/tournament.ts` には定義されていません。

```typescript
interface GenerationEntry {
  generationId: string; // 世代区分ID
  label: string; // 世代区分名
}
```

#### 使用例

```json
{
  "generationId": "highschool",
  "label": "高校"
}
```

#### 世代区分一覧

- `international`: 国際大会
- `international-qualifier`: 国際予選
- `all`: 総合
- `corporate`: 実業団・社会人
- `university`: 大学
- `highschool`: 高校
- `junior`: ジュニア
- `masters`: シニア

---

### 3. `information/{tournamentId}.json` - 大会開催情報

各大会の年度別開催情報を格納。

#### データ構造

> **型定義**: [`TournamentInformationEntry`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L19-L27), [`TournamentCategoryInfo`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L11-L17)

```typescript
export interface TournamentInformationEntry {
  year: number; // 開催年
  location: string; // 開催地
  startDate: string; // 開始日（YYYY-MM-DD形式）
  endDate: string; // 終了日（YYYY-MM-DD形式）
  source: string; // 情報ソース名
  sourceUrl: string; // 情報ソースURL
  categories: TournamentCategoryInfo[]; // 実施種目情報
}

export interface TournamentCategoryInfo {
  categoryId: string; // カテゴリID（例: "doubles-none-boys"）
  label: string; // カテゴリ名（例: "男子ダブルス"）
  category: string; // 競技種別（"doubles", "singles", "team"）
  gender: string; // 性別（"boys", "girls"）
  age: string; // 年齢区分（"none", "u14", "u16"等）
}
```

> **注**: 実際のJSONファイルには `informationId` フィールドが含まれていますが、型定義には含まれていません。

#### 使用例

```json
{
  "informationId": "INF00021",
  "year": 2025,
  "location": "北海道",
  "startDate": "2025-06-20",
  "endDate": "2025-06-22",
  "source": "ハイスクールジャパンカップ | HJS | ゴーセン",
  "sourceUrl": "https://www.gosen-sp.jp/hjs/",
  "categories": [
    {
      "categoryId": "doubles-none-boys",
      "label": "男子ダブルス",
      "category": "doubles",
      "gender": "boys",
      "age": "none"
    }
  ]
}
```

#### 使用箇所

- `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx`
  - `getStaticProps`: 大会の開催情報（日程、場所等）の取得
  - カテゴリ間のリンク生成に使用

---

### 4. `details/{tournamentId}/{year}/{category}.json` - 大会詳細データ

試合結果、参加者情報、エントリー情報を格納。

#### ファイル命名規則

`{gameCategory}-{ageCategory}-{gender}.json`

例:

- `doubles-none-boys.json` - 男子ダブルス
- `singles-none-boys.json` - 男子シングルス
- `team-none-boys.json` - 男子団体

#### データ構造

##### 個人戦（ダブルス・シングルス）の場合

> **型定義**: [`TournamentDetailData`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L73-L78), [`TournamentParticipant`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L29-L36), [`TournamentEntry`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L38-L42), [`TournamentMatch`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L44-L56), [`TournamentResult`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L58-L71)

```typescript
export interface TournamentDetailData {
  participants: TournamentParticipant[]; // 参加者リスト
  entries: TournamentEntry[]; // エントリー情報
  matches: TournamentMatch[]; // 試合結果
  results: TournamentResult[]; // 最終結果
}

export interface TournamentParticipant {
  id: string; // 参加者ID（姓_名_チーム_都道府県）
  lastName: string; // 姓
  firstName: string; // 名
  team: string; // 所属チーム
  prefecture: string | null; // 都道府県
  playerId?: number; // プレイヤーマスタID（動的に付与）
}

export interface TournamentEntry {
  entryNo: number; // エントリー番号
  playerIds: string[]; // 参加者ID配列（ダブルスは2人、シングルスは1人）
  type?: string; // エントリータイプ（"seed", "packing", "extra"）
}

export interface TournamentMatch {
  entries: number[]; // 対戦エントリー番号配列
  scores: Record<string, number>; // スコア（エントリー番号 → 得点）
  round: string | null; // ラウンド名（"1回戦", "準決勝", "決勝"等）
  winnerEntryNo: number; // 勝者エントリー番号
  retired: boolean; // 棄権フラグ
  stage: string; // ステージ（"knockout", "roundrobin"）
  group: string | null; // グループ名（総当たり戦の場合）
  matchId: string; // 試合ID
  nextMatchId: string | null; // 次の試合ID
  prevMatchIds: string[]; // 前の試合ID配列
  prevMatchId: string | null; // 前の試合ID（単一）
}

export interface TournamentResult {
  entryNo: number; // エントリー番号
  tournament?: {
    // トーナメント結果
    label: string; // 結果ラベル（"優勝", "準優勝"等）
    rank: {
      // ランク情報
      kind: string; // ランク種別（"winner", "runnerup", "best", "round"）
      value: number; // ランク値（bestLevelやround番号）
    };
  };
  roundrobin?: {
    // 総当たり戦の結果
    group: string; // グループ名
    rank: number; // グループ内順位
  };
}
```

> **注**: 実際のJSONデータでは `rank` の構造が異なる場合があります（Union型として `{ kind: "winner" }` 等）。型定義は簡略化されています。

##### 団体戦の場合

```typescript
export interface TournamentParticipant {
  id: string; // チームID（チーム名_都道府県）
  lastName: string; // 空文字列またはnull（団体戦では使用しない）
  firstName: string; // 空文字列またはnull（団体戦では使用しない）
  team: string; // チーム名
  prefecture: string | null; // 都道府県
  playerId?: number; // 使用しない
}
```

その他のフィールドは個人戦と同様。

#### 使用例（ダブルス）

```json
{
  "participants": [
    {
      "id": "手塚_康介_木更津総合_千葉",
      "lastName": "手塚",
      "firstName": "康介",
      "team": "木更津総合",
      "prefecture": "千葉"
    }
  ],
  "entries": [
    {
      "entryNo": 1,
      "playerIds": ["手塚_康介_木更津総合_千葉", "竹之内_琉汰_木更津総合_千葉"],
      "type": null
    }
  ],
  "matches": [
    {
      "entries": [1, 2],
      "scores": { "1": 4, "2": 1 },
      "round": "1回戦",
      "winnerEntryNo": 1,
      "retired": false,
      "stage": "knockout",
      "group": null,
      "matchId": "match-1",
      "nextMatchId": "match-9",
      "prevMatchIds": [],
      "prevMatchId": null
    }
  ]
}
```

#### 使用箇所

- `src/pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx`
  - `getStaticProps`: 試合結果の表示に使用
  - プレイヤーマスタとの紐付け（playerId の付与）

---

## データフロー

### 1. ページ生成時（`getStaticPaths`）

1. `data/tournament/details/` ディレクトリをスキャン
2. `data/tournament/index.json` から tournamentId → generationId のマッピングを取得
3. 全ての大会・年度・カテゴリの組み合わせでパスを生成

### 2. ページデータ取得時（`getStaticProps`）

1. `data/tournament/index.json` から大会名を取得
2. `data/tournament/information/{tournamentId}.json` から開催情報を取得
3. `data/tournament/details/{tournamentId}/{year}/{category}.json` から試合結果を取得
4. `data/players/index.json` を使用してプレイヤーIDを解決

### 3. 大会一覧ページ（`/tournaments/list`）のデータ取得

1. `data/tournaments/index.json` および `data/tournaments/local_index.json` から全大会を読み込む
2. 各大会の `information/{tournamentId}.json` を読み込み、開催年ごとに `TournamentInstance` を生成
3. `data/tournaments/details/{tournamentId}/{year}/` フォルダの存在確認で `hasInternalResult` を判定
4. `data/prefectures.json` を使用して開催地名 → 都道府県ID の逆引きマップを生成
5. 開催日降順にソートして Props として渡す

---

## 注意事項

### カテゴリIDの命名規則

カテゴリIDは以下の形式で構成されます：

```
{gameCategory}-{ageCategory}-{gender}
```

- **gameCategory**: `doubles`, `singles`, `team`
- **ageCategory**: `none`, `u14`, `u16`, `u18` 等
- **gender**: `boys`, `girls`, `mixed`

例:

- `doubles-none-boys` - 男子ダブルス（年齢制限なし）
- `singles-u16-girls` - 女子シングルス（U16）
- `team-none-boys` - 男子団体（年齢制限なし）

### 参加者IDの命名規則

#### 個人戦の場合

```
{姓}_{名}_{チーム名}_{都道府県}
```

例: `手塚_康介_木更津総合_千葉`

#### 団体戦の場合

```
{チーム名}_{都道府県}
```

例: `木更津総合_千葉県`

### ステージの種類

- **knockout**: トーナメント形式
- **roundrobin**: 総当たり形式（リーグ戦）

### エントリータイプ

- **seed**: シード選手/チーム
- **packing**: 一般エントリー
- **null**: タイプ指定なし

---

## データ更新フロー

1. PDF等のソースから試合結果を抽出（`scripts/pdf/` 配下のスクリプト使用）
2. `data/tournament/details/{tournamentId}/{year}/{category}.json` を生成/更新
3. 必要に応じて `data/tournament/information/{tournamentId}.json` を更新

---

## 関連ファイル

- **型定義**: `src/types/tournament.ts`
- **データ生成スクリプト**: `scripts/pdf/`
- **プレイヤーマスタ**: `data/players/index.json`
- **大会一覧ページ（新・検索ハブ）**: `src/pages/tournaments/index.tsx`
- **大会一覧ページ（旧・カテゴリ別）**: `src/pages/tournaments/major/index.tsx`
- **大会検索テーブルコンポーネント**: `src/components/tournaments/TournamentSearchTable.tsx`

---

## TypeScript型定義

全ての型定義は [`src/types/tournament.ts`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts) に定義されています。

### 主要な型

- [`TournamentIndexEntry`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L3-L9) - 大会マスタデータ
- [`TournamentCategoryInfo`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L11-L17) - カテゴリ情報
- [`TournamentInformationEntry`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L19-L27) - 大会開催情報
- [`TournamentParticipant`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L29-L36) - 参加者情報
- [`TournamentEntry`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L38-L42) - エントリー情報
- [`TournamentMatch`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L44-L56) - 試合情報
- [`TournamentResult`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L58-L71) - 結果情報
- [`TournamentDetailData`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L73-L78) - 大会詳細データ
- [`MatchRow`](file:///Users/mkojima/Desktop/softeni-pick/src/types/tournament.ts#L80-L88) - 試合行データ（表示用）

### 型定義されていないデータ

以下のデータ構造は `src/types/tournament.ts` に型定義がありません：

- **GenerationEntry** (`genarations.json`)

---

## 大会一覧ページ（`/tournaments`）

### URL体系

| URL                  | ファイル                                | 説明                                           |
| -------------------- | --------------------------------------- | ---------------------------------------------- |
| `/tournaments`       | `src/pages/tournaments/index.tsx`       | 新ページ。全大会を検索・フィルターできるハブ   |
| `/tournaments/major` | `src/pages/tournaments/major/index.tsx` | 旧ページ。カテゴリ（世代）別に大会をカード表示 |

### `TournamentInstance` 型

`/tournaments/list` ページで使用するビュー用の型。`TournamentSearchTable` コンポーネントに渡される。

```typescript
type TournamentInstance = {
  tournamentId: string; // 大会ID
  generation: string; // 世代区分ID
  generationLabel: string; // 世代区分名（表示用）
  year: number; // 開催年
  label: string; // 大会名
  startDate: string; // 開始日（YYYY-MM-DD）
  endDate: string; // 終了日（YYYY-MM-DD）
  location: string; // 開催地
  prefectureId: string | null; // 都道府県ID（data/prefectures.json のID）
  level: TournamentLevel; // 大会規模
  categoryLabels: string[]; // 実施種目名一覧
  hasInternalResult: boolean; // 内部結果データの有無
  officialUrl: string; // 公式サイトURL
  firstCategoryPath: string | null; // 結果ページへの最初のリンクパス
};

type TournamentLevel = 'national' | 'block' | 'prefecture' | 'city' | 'open';
```

### `level`（大会規模）の推定ルール

`data/tournaments/index.json` / `local_index.json` のどちらに属するか、および `tournamentId` のプレフィックスで自動推定する。

| 条件                                                           | level                       |
| -------------------------------------------------------------- | --------------------------- |
| `local_index.json` に掲載されており、`areaId` が指定されている | `areaId` の値をそのまま使用 |
| `local_index.json` に掲載されており、`areaId` が未指定         | `prefecture`（都道府県）    |
| `tournamentId` が `east-` または `west-` で始まる              | `block`（ブロック）         |
| それ以外の `index.json` 掲載大会                               | `national`（全国）          |

`areaId` に設定可能な値は `TournamentLevel` 型と一致する。

| 値           | 説明                       |
| ------------ | -------------------------- |
| `national`   | 全国大会                   |
| `block`      | ブロック大会               |
| `prefecture` | 都道府県大会               |
| `city`       | 市区町村大会               |
| `open`       | オープン戦（参加資格不問） |

> `city`・`open` は自動推定されない。`local_index.json` の `areaId` フィールドに手動で指定する。

### フィルター項目とデータソース

| フィルター   | 選択肢のソース                                   | URL クエリパラメータ     |
| ------------ | ------------------------------------------------ | ------------------------ |
| カテゴリ     | `data/tournaments/genarations.json`              | `?generation=highschool` |
| 種類         | `TournamentLevel` 定数（ハードコード）           | `?level=national`        |
| 開催地       | `data/prefectures.json`                          | `?prefecture=tokyo`      |
| 年度         | `information/*.json` の `startDate` から自動生成 | `?year=2024`             |
| 結果ありのみ | —                                                | `?hasResult=1`           |

複数選択・URL同期・即時反映（Applyボタンなし）に対応。

### 結果列の表示ロジック

| 条件                                                  | 表示                             |
| ----------------------------------------------------- | -------------------------------- |
| `hasInternalResult === true`                          | 緑の「結果」バッジ（内部リンク） |
| `hasInternalResult === false` かつ `officialUrl` あり | 「公式」外部リンク               |
| 両方なし                                              | `—`                              |

---

## 今後の拡張性

このデータ構造は以下の拡張を想定しています：

1. 新しい大会の追加（`index.json` にエントリー追加）
2. 新しい世代区分の追加（`genarations.json` にエントリー追加）
3. 新しいカテゴリの追加（年齢区分、性別等）
4. 総当たり戦の詳細結果の追加（`results.roundrobin` フィールド）
5. 追加の統計情報（得失点、勝率等）
