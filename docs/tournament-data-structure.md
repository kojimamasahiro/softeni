# Tournament Data Structure Documentation

このドキュメントは、`data/tournament/` ディレクトリ配下のJSONファイルの構造と使用方法を説明します。

## ディレクトリ構造

```
data/tournament/
├── index.json                    # 大会マスタデータ
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
  tournamentId: string;        // 大会ID（例: "highschool-japan-cup"）
  generationId: string;        // 世代区分ID（例: "highschool", "university"）
  label: string;               // 大会名（例: "ハイスクールジャパンカップ"）
  isMajorTitle: boolean;       // 主要タイトルかどうか
  officialUrl: string;         // 公式サイトURL
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

### 2. `genarations.json` - 世代区分マスタデータ

大会の世代区分を定義するマスタファイル。

#### データ構造

> **注**: 世代区分の型定義は `genarations.json` の構造に基づきますが、`src/types/tournament.ts` には定義されていません。

```typescript
interface GenerationEntry {
  generationId: string;        // 世代区分ID
  label: string;               // 世代区分名
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
  year: number;                // 開催年
  location: string;            // 開催地
  startDate: string;           // 開始日（YYYY-MM-DD形式）
  endDate: string;             // 終了日（YYYY-MM-DD形式）
  source: string;              // 情報ソース名
  sourceUrl: string;           // 情報ソースURL
  categories: TournamentCategoryInfo[];  // 実施種目情報
}

export interface TournamentCategoryInfo {
  categoryId: string;          // カテゴリID（例: "doubles-none-boys"）
  label: string;               // カテゴリ名（例: "男子ダブルス"）
  category: string;            // 競技種別（"doubles", "singles", "team"）
  gender: string;              // 性別（"boys", "girls"）
  age: string;                 // 年齢区分（"none", "u14", "u16"等）
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
  participants: TournamentParticipant[];  // 参加者リスト
  entries: TournamentEntry[];             // エントリー情報
  matches: TournamentMatch[];             // 試合結果
  results: TournamentResult[];            // 最終結果
}

export interface TournamentParticipant {
  id: string;                   // 参加者ID（姓_名_チーム_都道府県）
  lastName: string;             // 姓
  firstName: string;            // 名
  team: string;                 // 所属チーム
  prefecture: string | null;    // 都道府県
  playerId?: number;            // プレイヤーマスタID（動的に付与）
}

export interface TournamentEntry {
  entryNo: number;              // エントリー番号
  playerIds: string[];          // 参加者ID配列（ダブルスは2人、シングルスは1人）
  type?: string;                // エントリータイプ（"seed", "packing", "extra"）
}

export interface TournamentMatch {
  entries: number[];            // 対戦エントリー番号配列
  scores: Record<string, number>; // スコア（エントリー番号 → 得点）
  round: string | null;         // ラウンド名（"1回戦", "準決勝", "決勝"等）
  winnerEntryNo: number;        // 勝者エントリー番号
  retired: boolean;             // 棄権フラグ
  stage: string;                // ステージ（"knockout", "roundrobin"）
  group: string | null;         // グループ名（総当たり戦の場合）
  matchId: string;              // 試合ID
  nextMatchId: string | null;   // 次の試合ID
  prevMatchIds: string[];       // 前の試合ID配列
  prevMatchId: string | null;   // 前の試合ID（単一）
}

export interface TournamentResult {
  entryNo: number;              // エントリー番号
  tournament?: {                // トーナメント結果
    label: string;              // 結果ラベル（"優勝", "準優勝"等）
    rank: {                     // ランク情報
      kind: string;             // ランク種別（"winner", "runnerup", "best", "round"）
      value: number;            // ランク値（bestLevelやround番号）
    };
  };
  roundrobin?: {                // 総当たり戦の結果
    group: string;              // グループ名
    rank: number;               // グループ内順位
  };
}
```

> **注**: 実際のJSONデータでは `rank` の構造が異なる場合があります（Union型として `{ kind: "winner" }` 等）。型定義は簡略化されています。

##### 団体戦の場合

```typescript
export interface TournamentParticipant {
  id: string;                   // チームID（チーム名_都道府県）
  lastName: string;             // 空文字列またはnull（団体戦では使用しない）
  firstName: string;            // 空文字列またはnull（団体戦では使用しない）
  team: string;                 // チーム名
  prefecture: string | null;    // 都道府県
  playerId?: number;            // 使用しない
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
      "scores": {"1": 4, "2": 1},
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

## 今後の拡張性

このデータ構造は以下の拡張を想定しています：

1. 新しい大会の追加（`index.json` にエントリー追加）
2. 新しい世代区分の追加（`genarations.json` にエントリー追加）
3. 新しいカテゴリの追加（年齢区分、性別等）
4. 総当たり戦の詳細結果の追加（`results.roundrobin` フィールド）
5. 追加の統計情報（得失点、勝率等）
