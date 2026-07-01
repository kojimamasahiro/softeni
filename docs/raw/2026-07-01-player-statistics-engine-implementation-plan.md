# Player Statistics Engine 実行計画（2026-07-01 ドラフト）

設計 2 本（[機能仕様](./2026-07-01-player-page-comprehensive-design.md) /
[エンジン](./2026-07-01-player-statistics-engine.md)）＋
[データ契約付録](./2026-07-01-player-statistics-engine-data-contract.md)（実データ確定・実装はこれを正とする）
を実装に落とすための段階計画。
方針は **非破壊**（既存データ・既存ページを壊さず、派生物を積み増す）と **薄い縦切り**
（各フェーズ単体で検証・マージ可能）。実装コードは本書に含めない。

## 0. 全体方針

- **後方互換**: 既存 `analysis.json` の外部形・既存ページの表示は最後まで維持。エンジンは並走で導入し、
  検証が済んだ箇所から切り替える。既存生成物の削除は最終フェーズ。
- **検証駆動**: 各フェーズの受け入れ基準に「既存の実値との突合（golden 比較）」を必ず入れる。
- **単一の調整点**: 閾値・係数は `data/ranking-config.json`（作成済み）に集約。コードに数値を埋めない。

## 0.1 モジュール配置・ファイル名・中間パス（確定 2026-07-01）

既存の `scripts/<領域>/` サブディレクトリ運用（`scripts/highschool/` 等）と `ts-node`（導入済み）に合わせて確定する。
**PR 時に決める余地は残さない**（配置・命名はここで固定）。

**型**
- `src/types/playerStatistics.ts` … 公開型 `PlayerStatistics` と下位型（ページ/コンポーネントが import。既存 `src/types/*` 準拠）。
- `lib/playerStats/types.ts` … 内部型 `PlayerMatchFact` / `PlayerEntryFact` / `Placement`（集計内部専用）。

**エンジン（`lib/playerStats/`。lib は現状フラットだが、多ファイルの本エンジンはサブディレクトリ化）**
```
lib/playerStats/
  playerStatistics.ts     # 唯一の公開ファサード: getPlayerStatistics / getAllPlayerIds / toPlayerMeta / toPlayerJsonLd
  config.ts               # data/ranking-config.json ローダ（型付き・プロセス内キャッシュ）
  sourceAdapter.ts        # L0: 読み込み・スキーマ変種判定・大会メタ join
  identity.ts             # pid→数値id 解決 / playerKey / homonyms（first-wins）
  placement.ts            # resolvePlacement / roundOrder 正規化 / categoryId パース（種目・性別）
  facts.ts                # L1: PlayerMatchFact/PlayerEntryFact 構築
  reverseIndex.ts         # 選手→出場カテゴリ 逆引き（生成/読取）
  aggregators/
    career.ts  byYear.ts  byTournament.ts  byPartner.ts  byTeam.ts  headToHead.ts
    titles.ts  milestones.ts  records.ts  highlights.ts  reachRates.ts  careerTimeline.ts  ranking.ts
```
既存 `lib/{careerRecord,majorTitles,milestones,tournamentRecords}.ts` は aggregators から内部利用し、P6 で薄いラッパへ。

**生成スクリプト（`scripts/playerStats/`。TS で書き `ts-node`(+`tsconfig-paths`) 実行 → ファサードを import し重複ロジックを作らない）**
- `scripts/playerStats/generate-facts.ts` … 逆引き構築＋ `_facts/{id}.json`（増分対応）
- `scripts/playerStats/generate-rankings.ts` … `rankings/{year}-{discipline}.json` ＋ `rankingTrend` 逆展開
- `scripts/playerStats/generate-public-json.ts` … `public/data/player-stats/{id}.json`（クライアント遅延取得用フル）
- `prebuild` 連鎖に上記 3 本を追加（既存 `generate-player-analysis.mjs` の後段）。

**中間・成果物パス**（`_` 接頭辞はビルド生成物＝`.gitignore` 追加候補）
| パス | 層 | 用途 |
| --- | --- | --- |
| `data/players/_facts/{id}.json` | L1 | Facts 中間（全機能の素） |
| `data/players/_agg/{id}.json` | L2 | 選手集計（fold 結果） |
| `data/players/_index/by-player.json` | 索引 | 選手→出場カテゴリ 逆引き |
| `data/players/_manifest.json` | 増分 | 大会ファイル contentHash 管理 |
| `data/rankings/{year}-{discipline}.json` | グローバル | 年度×種目 順位表 |
| `public/data/player-stats/{id}.json` | 公開 | クライアント遅延取得（既存 `players-lite/` とは別ディレクトリ） |
| `data/ranking-config.json` | 設定 | 調整値（作成済み） |

命名衝突チェック（確認済み）: 既存 `scripts/generate-players-json.mjs`/`generate-player-analysis.mjs` とはサブディレクトリで分離、
公開出力も既存 `public/data/players-lite/` `beta-matches/` と別ディレクトリのため衝突しない。

## 1. フェーズ一覧（依存順）

| # | フェーズ | 主な成果物 | 依存 |
| --- | --- | --- | --- |
| P0 | 足場・型・フィクスチャ | `src/types/playerStatistics.ts`、検証用サンプル選手セット、config ローダ | ranking-config.json（済） |
| P1 | L0 SourceAdapter + L1 Facts | `lib/playerStats/{sourceAdapter,identity,placement,facts,reverseIndex}.ts`、`scripts/playerStats/generate-facts.ts` | P0 |
| P2 | L2 Aggregators（純関数） | `lib/playerStats/aggregators/*.ts`（career/byYear/…/careerTimeline） | P1 |
| P3 | ランキング（全選手横断・2段目） | `scripts/playerStats/generate-rankings.ts`、`data/rankings/*` | P1 |
| P4 | L3 Facade | `lib/playerStats/playerStatistics.ts`（`getPlayerStatistics` 他） | P2, P3 |
| P5 | 利用文脈の配線 | SSR / JSON生成 / SEO / 記事 の 4 経路を facade へ接続 | P4 |
| P6 | 移行・二重ロジック解消 | 既存 `analysis`/`careerRecord`/`milestones`/`majorTitles` を facade 由来に置換 | P5 |
| P7 | 増分・性能・最終検証 | contentHash 増分、性能予算、golden 全体突合、wiki/ADR 反映 | P6 |

## 2. 各フェーズの詳細（受け入れ基準つき）

### P0 足場・型・フィクスチャ
- `PlayerStatistics` と下位型（`PlayerMatchFact` `PlayerEntryFact` `CareerTotals` `YearRow` `TournamentRow`
  `PartnerRow` `TeamRow` `Head2HeadRow` `StreakSpan` `TitleStreak` `FirstEvent` `RankingPoint`
  `TimelineEvent` `MilestoneEvent`）を型定義。既存 `src/types/*` と衝突させず内包。
- `data/ranking-config.json` のローダ（型付き・既定値フォールバック・プロセス内キャッシュ）。
- 検証用の代表選手（curated 数名＋出場多い数名＋国際/高校/団体を含む）を固定リスト化。
- **受け入れ基準**: 型が `tsc` を通る。config ローダのユニットテストが緑。

### P1 SourceAdapter + Facts
- SourceAdapter: `index.json`/`information/*`/`details/**`/`generations` を読み、大会メタ
  （`generationId`/`isMajorTitle`/`isNational`（国際・国際予選除く）/`category`(種目)/`gender`/`age`/`year`＝年度）を join。
  `player→出場カテゴリ` 逆引き表を 1 回だけ構築（既存 `beta-matches/reverse` と同型）。
- Facts: 対象選手の match/entry を `PlayerMatchFact`/`PlayerEntryFact` に落とし時系列昇順。
  `retired:true` は勝率・ゲーム率の対象外フラグを持たせつつ、placement 側には反映（§0.6 準拠）。
- `scripts/generate-player-facts.mjs`: 全選手ぶん `_facts/{id}.json` を出力。
- **受け入れ基準**: 代表選手で、Facts から素朴集計した総試合数・勝敗（retired 除外）・ゲーム率が
  **既存 `analysis.json` と一致** or 差分が説明可能（retired 除外分など）。逆引きで全大会スキャンをしていない。

### P2 Aggregators（純関数）
- 1 ファイル 1 統計、`(facts, config) => Section`。相互依存なし。
  - career / byYear / byTournament / byPartner / byTeam / headToHead
  - titles・milestones・firsts（既存 `lib/milestones.ts` `lib/majorTitles.ts` `lib/tournamentRecords.ts` を内部利用）
  - records（最長連勝・最高勝率）/ highlights（最多対戦・最多ペア・苦手・得意）/ reachRates / careerTimeline
- **受け入れ基準**: 各 aggregator にフィクスチャ単体テスト（境界: 少標本閾値、ノックアウト/リーグ分母、
  同日内 roundOrder、同姓同名 `playerKey`）。既存 milestone 出力と回帰一致。

### P3 ランキング（2 段目）
- `scripts/generate-rankings.mjs`: 全選手 Facts → 年度×種目でシーズンポイント（tier×係数、上位3大会合算）→
  `rankings/{year}-{discipline}.json`（順位表）→ 各 `_agg` に `rankingTrend` を逆展開。
- Elo は config `enabled:false` のため今回は未実行（インターフェースのみ用意）。
- **受け入れ基準**: 1 年度の順位表を手計算サンプルと突合。config の係数変更が結果に反映される。
  変更年度だけ再計算できる（全再計算を強制しない）。

### P4 Facade
- `getPlayerStatistics(id, options)`: Facts をキャッシュ/計算で用意 → 必要 aggregator を実行 → `PlayerStatistics` 組み立て。
  `sections`/`discipline`/`freshness`/`includeFull` を実装。`getAllPlayerIds`/`toPlayerMeta`/`toPlayerJsonLd` も。
- プロセス内 memo（既存 `majorTitles.ts` の Promise キャッシュ方式）。
- **受け入れ基準**: 1 呼び出しで全セクションが返る。`sections` 指定で計算が減る。同一プロセス反復でファイル再読しない。

### P5 利用文脈の配線（4 経路）
- **SSR**: `src/pages/players/[id]/results.tsx` の `getStaticProps` を facade 併用に（表示は既存維持のまま新データを追加提供）。
- **JSON 生成**: `scripts/generate-player-json.mjs` で全 ID を facade に通し `public/data/players/{id}.json` を出力。
- **SEO**: `toPlayerMeta`/`toPlayerJsonLd` を既存メタ生成へ差し込み（`dateCreated/Modified` は `coverage` 由来、ビルド日不使用）。
- **記事**: `milestones`/`careerTimeline` を `news-context-blocks` 系へ供給（自然文はエンジン外）。
- **受け入れ基準**: SSR とビルド JSON が同値（ロジック単一）。SEO 日付が実データ由来。既存表示に回帰なし。

### P6 移行・二重ロジック解消
- `analysis.json`/`careerRecord`/`milestones`/`majorTitles` の算出を facade 由来へ置換。外部 JSON 形は互換維持（描画無改修）。
- 旧生成スクリプトはエンジン呼び出しの薄いラッパへ。重複ロジックを削除。
- **受け入れ基準**: 置換前後で公開 HTML/JSON の差分が「意図した変化のみ」。既存テスト緑。

### P7 増分・性能・最終検証
- 増分: 大会ファイルの contentHash manifest ＋ 逆引きで「変更大会→影響選手」だけ `_facts`/`_agg` 再生成。
  `engineVersion` 上げ時のみ全再計算。ランキングは変更年度のみ。
- 性能: フルビルドが総試合数に線形（目標時間予算を定義）。1 選手 O(m log m) を実測で確認。
- 最終検証: 代表選手＋ランダム抽出で既存実値との golden 突合。`docs/wiki` 反映、必要なら ADR 追加。
- **受け入れ基準**: 無変更ビルドで再計算が発生しない。性能予算内。golden 差分ゼロ（説明可能な差のみ）。

## 3. 依存グラフ（クリティカルパス）

```
P0 → P1 → P2 ┐
          └→ P3 ┘→ P4 → P5 → P6 → P7
```
P2 と P3 は P1 完了後に並行可。P4 は P2・P3 両方に依存。P5 以降は直列。

## 4. テスト戦略

- **単体**: 各 aggregator を小さな合成フィクスチャで（境界値・retired・同日順・同姓同名）。
- **回帰(golden)**: 代表選手の `PlayerStatistics` をスナップショット化し、リファクタで固定。
- **突合**: 既存 `analysis.json`・現行ページ表示値との一致（差分は理由を明記）。
- **性能**: フルビルド時間と 1 選手時間の計測をCIログに残す。
- **高負荷検証（任意）**: 大規模データで facade 反復の総時間が線形に収まるか確認。

## 5. リスクと対策

| リスク | 対策 |
| --- | --- |
| retired 除外で既存勝率と乖離し「数字が変わった」と見える | 差分を golden で可視化し、注記（実戦のみ）を UI に添える。移行 PR に差分説明を必須化 |
| 同姓同名・改名の名寄せ誤り | `playerKey`（名前@所属）＋ `homonyms.json`。H2H・連覇は既存 championKey 方式を踏襲 |
| ランキングの掲載偏り | 上位3大会合算＋ `scope-limited` 注記。係数は config で調整 |
| 全選手フルビルドの時間増 | 逆引きで全大会スキャン回避、増分（contentHash）、成果物キャッシュ |
| 二重ロジックの一時併存 | P6 で必ず単一化。併存期間は「エンジンが真、旧は薄いラッパ」を明文化 |
| 不戦勝データの表現揺れ | 実体は `retired:true` 一律（確認済み）。将来別表現が出たら SourceAdapter 1 箇所で吸収 |

## 6. マイルストーン（提案）

- M1: P0–P1（Facts が既存 analysis と突合できる）
- M2: P2–P3（全セクション＋ランキングが計算できる）
- M3: P4–P5（facade 1 本で SSR/JSON/SEO/記事が動く）
- M4: P6–P7（二重ロジック解消・増分・性能・golden 完了、wiki/ADR 反映）

## 7. 実装前に確認しておくこと

- 実装フェーズの残タスク（設計は確定）: `ranking-config.json` の初期値は運用後に微調整（本計画では推奨値で開始）。
- モジュール配置・ファイル名・中間パスは **§0.1 で確定済み**。
- P6 の外部 JSON 互換をどこまで厳密に保つか（描画無改修が条件）。← 実装で唯一残る判断。
