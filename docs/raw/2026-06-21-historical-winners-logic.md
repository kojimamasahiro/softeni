# Step1: historical-winners 生成ロジック 詳細設計

日付: 2026-06-21
状態: Draft（実装前の詳細設計。親仕様: `docs/raw/2026-06-21-news-auto-draft-design.md`）

## 位置づけ

文脈ブロックの優先度A・実装順序 Step1。最も安全（過去年度結果から機械的に算出・誤判定リスク最小）なため最初に作る。

**重要**: ゼロから作らない。既存の `lib/highschoolNationalTournaments.ts` が、高校全国大会に限定して「年度別・種目別の優勝〜ベスト4」と「歴代優勝サマリー（`championSummary`）」を既に実装している。本 Step は**この抽出ロジックを大会非依存に一般化**し、任意の `tournamentId` で `historical-winners` ブロックを生成できるようにする。

## 既存実装から再利用する確定知識

`lib/highschoolNationalTournaments.ts` で確認済み（実体準拠）。

- ディレクトリ: `data/tournaments/details/<tournamentId>/<year>/<categoryId>.json`
- `categoryId` 形式: `<category>-<age>-<gender>`（例: `doubles-none-boys`, `team-none-boys`, `singles-none-girls`）
- rank 語彙（`results[].tournament.rank`）:
  - `{kind:"winner"}` → 優勝（order 1）
  - `{kind:"runnerup"}` → 準優勝（order 2）
  - `{kind:"best", bestLevel:4}` → ベスト4（order 3）
  - `{kind:"round", round:N}` → N回戦敗退（historical-winners では非対象）
- エントリ解決: `results[].entryNo` → `entries[entryNo].playerIds[]` → `participants` を id で引き、`lastName/firstName/team/prefecture` を得る。
- 団体戦（`category==="team"`）は選手名を出さず校名（`team`）で表示。個人戦は「選手名（所属）」。
- `information/<tournamentId>.json` から `year/location/startDate/endDate` を取得。details が無く information にある年度は「開催予定（upcoming）」。
- 表示順: 種目 `team→doubles→singles`、性別 `boys→girls→mixed`。

## 一般化方針

### モジュール構成

- 抽出コア（大会非依存）を `lib/tournamentRecords.ts`（新規・仮称）へ切り出す。
  - 入力: `tournamentId`（＋任意で対象 `categoryId` / 対象年）
  - 出力: 後述の `HistoricalWinners` 構造
- `lib/highschoolNationalTournaments.ts` は、この汎用コア＋高校固有の付加情報（学校ページ link 解決 `getSchoolResolver` 等）を載せる薄いラッパへ寄せる（既存の高校歴代ページの出力は変えない＝リグレッション無し）。
  - 高校固有で**汎用側に持ち込まない**もの: `SchoolResolver`（`data/highschool/prefectures/**` 依存）、`GENERATION='highschool'` 固定。
- `fs` を使うため getStaticProps からのみ import（既存規約を踏襲）。

### 生成タイミング

完全手動入力前提に合わせ、`generate-news-drafts.mjs` 経由のビルド時生成、または大会/選手ページの getStaticProps で直接呼ぶ。Step1 単体では**既存ページ差し込み（Step4-5）が先の消費先**なので、まずページの getStaticProps から呼べる純関数として用意する。

## 出力スキーマ（`historical-winners` ブロック）

```ts
type ChampionEntry = {
  year: number;
  // 個人: 選手名一覧 / 団体: 空
  players: string[];
  // 所属校（個人=ペアの所属、団体=校名）
  teams: string[];
  prefectures: string[];
  // 表示用文字列（個人:「鈴木・佐藤（◯◯高校）」/ 団体:「◯◯高校」）。優勝者不明年は null
  display: string | null;
  // 既存の年度別結果ページ/対戦表へのリンク（任意）
  bracketHref?: string | null;
  // 選手ページ解決（解決できた playerId のみ。Step5 の選手リンク用）
  playerLinks?: Array<{ name: string; href: string | null }>;
};

type HistoricalWinnersBlock = {
  blockType: 'historical-winners';
  tournamentId: string;
  categoryId: string; // 例 doubles-none-boys
  categoryLabel: string; // 例 男子ダブルス
  // 新しい年が先頭
  champions: ChampionEntry[];
  // 当該年（速報/プレビュー対象年）の位置づけ用メタ
  edition: {
    targetYear: number | null;
    totalEditions: number; // 収録されている開催回数
    repeatChampion?: {
      // 連覇判定（下記ロジック）
      streak: number; // 連続優勝年数（2以上で連覇）
      since: number; // 連覇開始年
    } | null;
  };
  sourceYears: number[]; // 集計に使った年（鮮度・dateModified 用）
};
```

## アルゴリズム

1. `tournamentId` 配下の全 `<year>` ディレクトリを走査。
2. 各年の対象 `categoryId` JSON を読む（指定が無ければ全 categoryId をそれぞれ独立に処理）。
3. 各 year×category で `results` を走査し `classifyRank` で優勝（`{kind:"winner"}`）のみ抽出。
4. 優勝 `entryNo` を `entries`→`participants` で解決し `ChampionEntry` を構築。
5. 年で降順ソートして `champions[]`。
6. `edition` を導出（`targetYear` 周辺の連覇判定など）。

### 連覇（repeatChampion）判定

`champions` を年昇順に並べ、`display`（または team 集合）が直前年と一致する連続区間を数える。`targetYear` が連続区間の末尾に当たる場合、`streak`（区間長）と `since`（区間先頭年）を返す。

- 比較キー: 個人は **playerId の集合**（表記揺れ回避。名寄せできた場合）。名寄せ未解決なら正規化済み表示文字列でフォールバック。団体は team 名（正規化）。
- `streak>=2` を「連覇」、`>=3` を「N連覇」として `milestone` ブロック（Step2）にも渡す。

## エッジケース（要対応）

- **優勝者欠落の年**: `results` に `winner` が無い／`entries` 解決失敗 → `display:null` の `ChampionEntry` を残す（年の存在は示し、空欄表示）。歴代の年抜けを捏造しない。
- **隔年・休止・名称変更**: information に無い年は単に欠落として扱う。tournamentId が変わる大会改称は別 tournamentId になる前提（横断結合はしない。必要なら別途エイリアス table を Open Question）。
- **団体戦に選手名を出さない**: `category==="team"` は `players:[]`、`display` は校名。
- **同名校・同姓同名**: 団体は prefecture で絞れないケースあり。個人 playerId 解決は既存「最初の id」規約に従い、解決不能はリンク無し（`href:null`）。誤リンクより未リンクを優先。
- **roundrobin 大会**: `results[].roundrobin` がある形式（リーグ戦）。優勝は `tournament.rank.kind==="winner"` で取れる前提だが、リーグのみで `tournament` が無い形式は要確認（`results[].tournament` が null のデータがあるか実装時に検証）。
- **カテゴリの age 軸**: シニア大会等は `age` が `none` 以外（`over55` 等）。`categoryId` をそのままキーにすれば破綻しない。

## テスト観点（Step1 完了の検証）

- 既存の高校歴代ページ（`/highschool/tournaments/championship` 等）の出力が**リファクタ前後で不変**（スナップショット比較）。
- `zennihon-championship`（2022-2025、doubles-none-boys/girls）で歴代優勝が正しく抽出され、連覇判定が手計算と一致。
- 優勝者欠落年・団体戦・roundrobin 形式それぞれで例外を出さず `display` が妥当。
- `sourceYears` が実在年と一致（ビルド日に依存しない鮮度シグナル）。

## 次への接続

- Step2 `milestone`: 本ブロックの `repeatChampion` と、選手の通算（Step3）から「初優勝/連覇/N連覇」を判定。`historical-winners` は milestone の主要入力。
- Step4 大会ページ差し込み: `historical-winners` をそのまま大会ハブ/年度別ページに描画（farm に無い情報密度を即獲得）。

## Open Questions（Step1 固有）

- 大会改称をまたぐ歴代結合（エイリアス table を持つか、tournamentId 単位で割り切るか）。
- roundrobin のみ形式で `results[].tournament` が欠落するデータの有無と、その場合の優勝抽出方法。
- 汎用化に伴う `lib/highschoolNationalTournaments.ts` のリファクタ範囲（コア抽出のみ差し替えるか、型も共通化するか）。
