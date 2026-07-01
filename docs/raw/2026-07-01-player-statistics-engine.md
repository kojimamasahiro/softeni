# Player Statistics Engine 設計（2026-07-01 ドラフト）

選手の全統計を **`playerStatistics.ts` の 1 呼び出しで `PlayerStatistics` として取得**できる集計エンジンの設計。
実装は含まない。既存のデータ構造は**一切変更せず**（読むだけ）、派生キャッシュのみ新設する。

姉妹ドキュメント: 機能ごとの仕様と算出ルールは
[2026-07-01-player-page-comprehensive-design.md](./2026-07-01-player-page-comprehensive-design.md)。
本書はそれを**単一エンジンとしてどう束ねるか**（層構造・API 契約・非機能要件）に絞る。
**実データで確定したスキーマ・変換規則・型の訂正は
[データ契約付録](./2026-07-01-player-statistics-engine-data-contract.md)を正とする**（本書の型定義と差異がある場合は付録が優先）。

---

## 1. 要件

### 機能要件
- 歴代戦績 / 年度別 / 大会別 / ペア別 / 全国初出場 / 全国初優勝 / 連覇・n回目 / 通算優勝数 / 主要大会優勝数 /
  年度ランキング推移 / 対戦相手 H2H を返す（学年別は対象外＝実装しない）。

### 非機能要件（本書の主眼）
1. **計算量**: 1 選手あたり **O(m log m)**（m = その選手の試合数）。全選手フルビルドは総試合数に線形 **O(M)**。
2. **増分更新**: 変更のあった大会に出場した選手だけ再計算できる。
3. **SSR で使える**: `getStaticProps` から `await` で呼べる純サーバー関数。
4. **JSON 生成に使える**: 同じ関数をビルドスクリプトから呼び、公開 JSON へ直列化できる。
5. **SEO ページ生成に使える**: title / description / JSON-LD を `PlayerStatistics` から決定的に導ける。
6. **記事生成に使える**: 自然文の素材となる**構造化イベント（label 付き）**を含む。
7. **単一ファサード**: 呼び出し口は `playerStatistics.ts` の 1 つ。内部構造を利用側に露出しない。
8. **非破壊**: `data/tournaments/**` `data/players/index.json` 等の既存構造・ファイルを変更しない。

---

## 2. アーキテクチャ（4 層）

```
[L0 Sources]        既存 JSON（読み取り専用・変更しない）
   index.json / information/*.json / details/**/*.json / players/index.json / homonyms.json / generations
        │  SourceAdapter（正規化・join のみ。副作用なし）
        ▼
[L1 Facts]          選手 1 人の中間表現（純粋・決定的）
   PlayerMatchFact[]（1試合1件） / PlayerEntryFact[]（1大会カテゴリ1件）
        │  各 Aggregator は Facts への単一パス fold（互いに独立・純関数）
        ▼
[L2 Aggregators]    career / byYear / byTournament / byPartner / headToHead / titles / milestones / rankingTrend
        │
        ▼
[L3 Facade]         playerStatistics.ts … getPlayerStatistics(id) → PlayerStatistics（唯一の公開 API）
        ▲
[L4 Cache/Incremental]  memo（プロセス内）＋ _facts/_agg/rankings（ビルド成果物）＋ contentHash 増分
```

- **L0 SourceAdapter**: 既存 JSON を読み、大会メタ（`generationId` / `isMajorTitle` / `isNational` / 種目 / 年度＝`year`）を
  join して**正規化レコード**を返すだけ。ここだけがファイル形式を知る。**L0 を差し替えれば入力元を変えられる**（Supabase 等）。
- **L1 Facts**: 選手横断で共有できる唯一の素データ。`PlayerMatchFact` / `PlayerEntryFact`（型は姉妹ドキュメント §1.1）。
- **L2 Aggregators**: 各統計は **Facts を 1 回なめる純関数** `(facts) => Section`。相互に依存しない（並列・部分実行可）。
- **L3 Facade**: オーケストレーションのみ。Facts をキャッシュ or 計算で用意 → 必要な Aggregator を回す → `PlayerStatistics` を組み立てる。
- **L4 Cache**: 後述 §6。

この分離により「SSR」「JSON 生成」「SEO」「記事生成」はすべて **L3 の同じ関数を呼ぶだけ**の利用者になる（§7）。

---

## 3. 公開 API（`playerStatistics.ts`）

```ts
// これだけが公開。fs を使うため getStaticProps / ビルドスクリプト専用（クライアント import 不可）。
export async function getPlayerStatistics(
  playerId: number,
  options?: PlayerStatisticsOptions,
): Promise<PlayerStatistics>;

export interface PlayerStatisticsOptions {
  /** 計算するセクション。既定は全部。SEO 等で一部だけ欲しい時に絞ると速い（遅延評価）。 */
  sections?: StatSection[];               // 'career'|'byYear'|'byTournament'|'byPartner'|'headToHead'|'titles'|'milestones'|'rankingTrend'
  /** 種目フィルタ。既定は全種目（種目別と総計の両方を含む）。 */
  discipline?: 'singles'|'doubles'|'mixed'|'team';
  /** 'cache'（既定）: 成果物があれば読む / 'recompute': 強制再計算（増分ジョブ用）。 */
  freshness?: 'cache' | 'recompute';
  /** H2H・ペア別の上限。既定は上位のみ。全件は includeFull で lite JSON 相当まで。 */
  includeFull?: boolean;
}
```

補助（任意・内部を薄く公開してよいが**主経路は上の 1 本**）:

```ts
export async function getAllPlayerIds(): Promise<number[]>;         // JSON 一括生成の反復用
export function toPlayerJsonLd(stats: PlayerStatistics): object;    // SEO: ProfilePage/Person
export function toPlayerMeta(stats: PlayerStatistics): PlayerMeta;  // SEO: title/description
```

---

## 4. 戻り値型 `PlayerStatistics`

```ts
export interface PlayerStatistics {
  playerId: number;
  identity: { displayName: string; currentTeam: string | null; slug?: string };

  // 集計範囲の明示（当サイト掲載分。描画側で必ず出す）
  scope: 'site-covered';
  scopeNote: string;
  coverage: { firstDate: string; lastDate: string; totalMatches: number; totalEntries: number };

  career: CareerTotals;            // 歴代戦績（種目別 + 総計 + 期間）
  byYear: YearRow[];               // 年度別（年度＝year。降順。最高順位付き）
  byTournament: TournamentRow[];   // 大会別（出場数/通算WL/最高成績/優勝数/各回）
  byPartner: PartnerRow[];         // ペア別勝敗（対個人で集約）
  byTeam: TeamRow[];               // 所属別成績（当時の所属・正準化名で集約）
  headToHead: Head2HeadRow[];      // 対戦相手 H2H（既定=対個人。対戦数降順）

  records: {
    longestWinStreak: StreakSpan;  // 最長連勝（時系列・同日内は roundOrder 順）
    longestLoseStreak: StreakSpan; // 参考: 最長連敗
    bestSeason: {                  // 最高勝率（年度別。minMatchesForSeasonWinRate 以上の年度のみ対象）
      year: number; discipline: string; winRate: number; wins: number; losses: number;
    } | null;
  };

  highlights: {                    // 既存セクションのトップ値（便利フィールド。新セクションではない）
    mostFacedOpponent: Head2HeadRow | null;   // 最多対戦相手
    mostFrequentPartner: PartnerRow | null;   // 最多ペア
    toughOpponents: Head2HeadRow[];           // 苦手選手（minMeetingsForH2H 以上・負け越し順）
    favorableOpponents: Head2HeadRow[];       // 得意選手（minMeetingsForH2H 以上・勝ち越し順）
  };

  reachRates: {                    // 進出率。分母 = ノックアウト個人戦（singles/doubles/mixed）の出場のみ
    denominator: number;
    finalReachRate: number;        // 決勝進出率（決勝の試合に到達 or 優勝 / 分母）
    semifinalReachRate: number;    // 準決勝進出率（準決勝の試合に到達以上 / 分母）
  };

  titles: {
    total: number;                 // 通算優勝数（種目別内訳あり）
    major: number;                 // 主要大会優勝数（4大全日本の内訳あり）
    byTournament: Record<string, number>;
    streaks: TitleStreak[];        // 連覇（since/streak）
    nth: Record<string, number>;   // 大会別 n回目
    firsts: {
      firstNational: FirstEvent | null;       // 全国初出場
      firstNationalTitle: FirstEvent | null;  // 全国初優勝
    };
  };

  milestones: MilestoneEvent[];    // 記事生成用の構造化イベント（label + shortLabel + detail + confidence）
  rankingTrend: RankingPoint[];    // 年度ランキング推移（year, discipline, rank, outOf, points, rating?）
  careerTimeline: TimelineEvent[]; // キャリア年表（デビュー/初優勝/連覇/所属変更/各年度の最高成績を時系列に整列）

  meta: {
    generatedAt: string;
    engineVersion: string;         // 集計ロジックのバージョン（キャッシュ無効化キー）
    sourceHash: string;            // この選手が依存する大会データの合成ハッシュ（増分判定）
  };
}
```

型の下位定義（`CareerTotals` / `YearRow` / `TournamentRow` / `PartnerRow` / `Head2HeadRow` /
`TitleStreak` / `FirstEvent` / `MilestoneEvent` / `RankingPoint`）は姉妹ドキュメントの各節に対応。
既存 `MajorTitleData` / `MilestoneEvent`（`lib/milestones.ts`）と互換に保ち、置換ではなく**内包**する。

### 4.1 追加統計項目（2026-07-01 取り込み）

いずれも既存 Facts への単一パス fold で導け、データ構造もエンジンの計算量も変えない。閾値は `data/ranking-config.json`
（統計設定を統合）に外出しする: `minMatchesForSeasonWinRate=10` / `minMeetingsForH2H=3`。

- **最長連勝 `records.longestWinStreak`**: 時系列ソート済み match を 1 パスし連続 win の最大区間。
  同日内は `roundOrder` 昇順で確定的に並べる。連敗も参考に併算。O(m)。`StreakSpan{ length, from, to, fromTournament, toTournament }`。
- **最高勝率 `records.bestSeason`**（年度別で確定）: `byYear` のうち **試合数 ≥ `minMatchesForSeasonWinRate`(=10)** の年度に限り
  勝率最大の年度を選ぶ（1勝0敗=100% の少標本ノイズを除外）。該当年度が無ければ null。O(y)。
- **苦手選手 `highlights.toughOpponents` / 得意選手 `favorableOpponents`**: `headToHead` のうち
  **対戦数 ≥ `minMeetingsForH2H`(=3)** の相手を、負け越し順 / 勝ち越し順に上位数件。O(o)。
- **最多対戦相手 `highlights.mostFacedOpponent` / 最多ペア `highlights.mostFrequentPartner`**:
  `headToHead` / `byPartner` のトップ。派生の便利フィールド（新セクションではない）。O(1)。
- **所属別成績 `byTeam`**: `selfTeam`（当時の所属）で group by。学校名の表記揺れは既存 `team-name-aliases.json` の
  正準化を通してから集約。O(m)。`TeamRow{ team, span:{from,to}, matches:WL, games, titles }`。
- **決勝進出率 / 準決勝進出率 `reachRates`**: **分母 = ノックアウト個人戦（singles/doubles/mixed、団体除く）の出場エントリー数**。
  分子は当該エントリーで **決勝の試合に到達（or 優勝）/ 準決勝の試合に到達以上**。判定は大会データの
  ラウンド名リテラル（`決勝` / `準決勝`）を使うため大会規模に依存せず堅牢。リーグ戦・団体戦は分母から除外。O(e)。
- **キャリア年表 `careerTimeline`**: デビュー / 全国初出場・初優勝 / 連覇 / 所属変更（`byTeam` の期間境界）/
  各年度の最高成績 を時系列に整列した `TimelineEvent[]`。既存 `milestones`＋`byYear`＋`byTeam` の組み立てビューで、
  記事生成の骨子に使う。O(m)。
- **ランキング推移 `rankingTrend`**: 既にコア機能として設計済み（§5-4・§6.3）。ここでは再掲のみ。

### 4.2 調整可能パラメータ `data/ranking-config.json`（推奨初期値・後から変更可）

閾値・係数はコードに埋めず**単一の外部 JSON**に集約する。値を変えて再ビルドすれば集計へ反映される
（集計ロジック自体を変えた時のみ `engineVersion` を上げて全再計算）。初期値は推奨のプレースホルダーで、
運用開始後に実データを見て微調整する前提。実ファイルは作成済み（`data/ranking-config.json`）。

| キー | 初期値 | 意味 |
| --- | --- | --- |
| `ranking.topNTournamentsPerSeason` | 3 | 年度ランキングで合算する上位大会数（掲載偏り補正） |
| `ranking.tier.{major,national,local}` | 100 / 60 / 20 | 大会格の重み（分類は大会マスタから導出） |
| `ranking.placementCoefficient` | 優勝1.0 / 準優勝0.7 / ベスト4 0.5 / ベスト8 0.3 / 出場0.1 | 最終順位の係数 |
| `ranking.disciplines` | `["singles","doubles"]` | ランキングを出す種目 |
| `ranking.rating.enabled` | false | Elo 系副指標（将来）。初期値付きで無効 |
| `stats.minMatchesForSeasonWinRate` | 10 | 最高勝率（年度別）の最小試合数 |
| `stats.minMeetingsForH2H` | 3 | 苦手・得意選手の最小対戦数 |
| `stats.headToHeadDefaultAxis` | `"individual"` | H2H 既定軸（対個人） |
| `stats.reachRate.denominatorStage` | `"knockout"` | 進出率の分母ステージ |
| `stats.reachRate.denominatorCategories` | `["singles","doubles","mixed"]` | 進出率の分母種目（団体除く） |

ファサードは起動時にこの JSON を 1 回読み、`getPlayerStatistics` 全体で共有する（プロセス内キャッシュ）。
tier 分類ロジック（major/national/local の判定）はコード側に置き、閾値・重みだけを config に置く。

---

## 5. アルゴリズムと計算量

記号: m=選手の試合数, e=出場大会カテゴリ数, p=相方数, o=相手数, y=年度数, t=大会数（いずれも m 以下）。

1. **Facts 構築 O(m)**: `player→出場カテゴリ` 逆引き表（`details/**` から 1 回だけ生成する `by-player` 索引。
   既存 `public/data/beta-matches/reverse/by-player.json` と同型）で対象大会だけを開く。各カテゴリの `matches` を
   走査し `PlayerMatchFact` / `PlayerEntryFact` に落とす。逆引きにより**全大会スキャンを避ける**のが線形性の鍵。
2. **時系列ソート O(m log m)**: Facts を `date`（＝年度内の開催日）昇順に 1 回ソート。H2H の「初/直近」、
   連覇、ランキング Elo の時系列処理に使う。**エンジン内で最も重いのはここ**。
3. **各 Aggregator O(m)**: すべて単一パスの group-by fold。
   - career: 全 match を畳み込み（WLG）。O(m)。
   - byYear: `year` で group。O(m)。ソート O(y log y)。
   - byTournament: `tournamentId(+種目)` で group。O(m)。ソート O(t log t)。
   - byPartner: doubles match を `partnerKey` で group。O(m)。
   - headToHead: `opponentKey`（既定=対個人）で group。O(m)。ソート O(o log o)。
   - titles/milestones: winner entry 抽出＋優勝年の連続判定。O(e)。既存 `milestones.ts` の決定的ロジックを流用。
   - firstNational / firstNationalTitle: `isNational` entry の最小 date。O(e)。
4. **rankingTrend O(y)**: **エンジン内では再計算しない**。事前計算済み `rankings/{year}-{discipline}.json` から
   当該選手の行を引くだけ（§6.3）。全選手横断のグローバル計算は別パスに隔離し、ファサードの計算量を選手ローカルに保つ。

→ **1 選手 = O(m log m)**、支配項はソート。全選手フルビルドは Σm = 総試合数 M に線形で **O(M log m_max)**。
§4.1 の追加項目（最長連勝 O(m) / 所属別 O(m) / 進出率 O(e) / 最高勝率 O(y) / 苦手・得意・最多 O(o)・O(p)）は
いずれも既存パスに相乗りする定数本数の fold で、**この計算量を変えない**。

---

## 6. キャッシュ / 増分更新（L4）

### 6.1 3 段のキャッシュ
- **プロセス内 memo**: SSR/ビルドの 1 プロセス中、同じ `playerId` の Facts と Section を Map で使い回す
  （既存 `lib/majorTitles.ts` の `Promise` キャッシュと同方式）。同一ビルドで大会データを何度も読まない。
- **成果物キャッシュ（ビルド時）**: `data/players/_facts/{id}.json`（L1）と `data/players/_agg/{id}.json`（L2 結果）。
  `freshness:'cache'` はこれを読む。無ければ計算して書く。
- **公開 JSON**: 大量データ（全 H2H・全ペア）は `public/data/players-*/{id}.json` に出し、クライアント遅延取得
  （既存 `players-lite` 方式を踏襲）。

### 6.2 増分判定（contentHash）
- SourceAdapter が各大会ファイル（`details/**` `information/*`）の**内容ハッシュ**を持つ manifest を管理。
- `PlayerStatistics.meta.sourceHash` = その選手が依存する大会ファイル群のハッシュ合成。
- ビルド時、`by-player` 逆引きで **変更のあった大会 → 影響選手集合**を求め、その選手だけ `_facts`/`_agg` を再生成。
  無関係な約 8,000 組は再計算しない。`engineVersion` を上げた時のみ全再計算。

### 6.3 ランキングの増分（時系列の特例）
- ランキングは全選手横断のグローバル計算。`scripts/generate-rankings.mjs`（2 段目）が
  年度×種目で `rankings/{year}-{discipline}.json` を出力し、各選手 `_agg` に該当行を逆展開する。
- シーズンポイント（主指標）は年度独立なので**変更年度だけ**再計算。
- Elo（副指標・将来）は時系列依存のため、**年度末レーティングのスナップショット**を保存し、
  変更年度以降のみ再計算できるようにする。

---

## 7. 4 つの利用文脈（すべて L3 を呼ぶだけ）

### 7.1 SSR（選手ページ）
```ts
// src/pages/players/[id]/results.tsx など
export const getStaticProps = async ({ params }) => {
  const stats = await getPlayerStatistics(Number(params.id));
  return { props: { stats } };
};
```
`output:'export'` のためビルド時に確定。ランタイム集計なし。

### 7.2 JSON 生成（公開データ）
```ts
// scripts/generate-player-json.mjs
for (const id of await getAllPlayerIds()) {
  const stats = await getPlayerStatistics(id, { includeFull: true });
  writeJson(`public/data/players/${id}.json`, stats);
}
```
同じファサードを反復するだけ。SSR と生成物が**必ず一致**（ロジック単一）。

### 7.3 SEO ページ生成
```ts
const stats = await getPlayerStatistics(id, { sections: ['career','titles','byYear'] });
const meta = toPlayerMeta(stats);      // title/description（所属・直近・通算を埋め込む）
const jsonLd = toPlayerJsonLd(stats);  // ProfilePage + Person（dateCreated=firstDate, dateModified=lastDate）
```
`sections` を絞れば SEO に必要な最小計算で済む。日付は `coverage` 由来でビルド日を使わない（既存方針と一致）。

### 7.4 記事生成
```ts
const stats = await getPlayerStatistics(id, { sections: ['milestones','titles','headToHead'] });
// stats.milestones は自然文ではなく構造化イベント（label/shortLabel/detail/confidence）。
// テンプレート or LLM に渡して速報・プレビュー記事の素材にする（既存 news-context-blocks と同思想）。
```
エンジンは**文章を作らない**。「初優勝」「3連覇（2021年〜）」等の素文と構造化 detail を返し、生成は上位に委ねる。
`scope-limited` / `confidence` を持つので、記事側で「当サイト掲載分」「推定」を明示できる。

---

## 8. 既存資産との統合（非破壊のまま一本化）

- `analysis.json`（totalMatches/wins/byPartner/byYear）→ エンジンの `career`/`byPartner`/`byYear` に相当。
  既存生成物は**エンジン出力から導出**する形に置換し、ロジック二重化を解消（`analysis.json` の外部形は互換維持可）。
- `lib/milestones.ts`（first-title/repeat-title/nth-title 等）→ L2 `titles`/`milestones` として**内包**（再利用、破棄しない）。
- `lib/majorTitles.ts` → `titles.major` の算出に流用。
- `lib/careerRecord.ts`（scope 注記付き通算）→ `career` + `scope`/`scopeNote` に統合。
- `lib/tournamentRecords.ts`（歴代優勝者・`championKey`）→ 優勝抽出・連覇判定の共有コアとして L2 が呼ぶ。
- **既存の生データ（`data/tournaments/**`・`data/players/index.json`・`homonyms.json`）は読み取り専用**。
  エンジンが書くのは `_facts`/`_agg`/`rankings`/`public/data` の**派生物のみ**。データ構造は崩さない。

---

## 9. 将来の拡張性

- **入力差し替え**: L0 SourceAdapter を実装差し替えすれば、Supabase 由来の score データ（`points`）を
  `PlayerMatchFact.detail?` として合流でき、得失点・サーブ/レシーブ別統計まで同じ器で拡張できる。
- **セクション追加**: 新統計は「Facts への純関数 1 つ＋`PlayerStatistics` にフィールド追加」で足せる（他に影響しない）。
- **ランキング指標**: シーズンポイント → Glicko-2 や対戦強度重み付けへ、L2 の rankingTrend 実装差し替えで対応。
- **エンジンバージョニング**: `engineVersion` でロジック更新時の全再計算を制御。出力互換を壊す変更はメジャーを上げる。
- **チーム/学校統計への横展開**: 同じ Facts 設計をチーム軸に一般化すれば `teamStatistics.ts` を対称に作れる。

---

## 10. 決定事項（姉妹ドキュメント §14 準拠・再掲）

年区切り=年度 / 全国大会=index.json かつ国際・国際予選以外 /
勝率=`retired:true`（不戦勝・途中棄権は判別不能。データ実体に基づき改訂）は勝率・ゲーム率から全除外（実際に戦った試合ベース）・draw は分母除外・ただし順位/進出率/優勝判定など placement 側には反映 /
ランキング偏り補正=年度の上位3大会合算＋注記 / H2H 既定=対個人 / 学年別=対象外。

追加統計項目（§4.1、2026-07-01 確定）: 最長連勝 / 最高勝率=**年度別（最小10試合）** / 苦手・得意選手=**H2H 3対戦以上** /
最多対戦相手 / 最多ペア / 所属別成績 / 決勝・準決勝進出率=**ノックアウト個人戦を分母** / ランキング推移（既設計）/ キャリア年表。
閾値 `minMatchesForSeasonWinRate=10` / `minMeetingsForH2H=3` は `ranking-config.json` に外出し。

データ実体確認済み（2026-07-01）: 不戦勝 / bye は独立表現を持たず `retired:true` で登録され途中棄権と判別不能。
実装フェーズの確認: `ranking-config.json` の係数・閾値調整。
