# 選手ページ「国内最強データベース」設計（2026-07-01 ドラフト）

目的は SEO ではなく、**選手データベースとして最も価値の高い設計**にすること。
以下 12 項目を **100% データから自動生成**する前提で、機能ごとに
「必要データ / 算出アルゴリズム / データモデル / キャッシュ方法 / 将来の拡張性」を設計する。

> 本書はドラフト仕様（`docs/raw`）。合意後に `docs/wiki/players-pages.md` へ反映する。
> 実装は含まない。既存資産（`lib/tournamentRecords.ts` `lib/milestones.ts`
> `lib/majorTitles.ts` `lib/careerRecord.ts` `scripts/generate-player-analysis.mjs`）を最大限再利用する前提。

---

## 0. 設計の核（全機能に共通する前提）

### 0.1 単一プリミティブ方式（最重要の設計判断）

12 項目のうち 11 項目は、**選手 1 人ぶんの「試合イベント列」と「大会エントリー列」**という
2 つの中間データを一度作れば、そこへの軽い畳み込み（fold）で導ける。個別機能ごとに
大会データを走査し直すのは避け、**中間表現を 1 回だけ前計算**する。

- `PlayerMatchFact[]` … その選手が出た**1 試合 = 1 レコード**（勝敗・スコア・ペア・相手・ラウンド）
- `PlayerEntryFact[]` … その選手が出た**1 大会カテゴリ = 1 レコード**（最終順位＝優勝/準優勝/ベスト4…）

この 2 つを `data`（→ ビルド時）で全選手ぶん生成し、各機能は fold するだけにする。
唯一の例外は **年度ランキング推移**で、これは全選手横断のグローバル計算になるため別パイプラインを持つ。

### 0.2 選手同定（identity）

既存規約を踏襲する（`docs/wiki/players-pages.md` / `team-player-identity.md`）。

- 公開 URL・リンクは**数値 id**（`data/players/index.json`。姓名一致・同姓同名は最初の id）。
- 集計内部の人物比較は **`playerKey =`「正規化名 @ 所属」**（`tournamentRecords` の `playerKey`）を使う。
  同姓同名の別人・改名は `data/players/homonyms.json` で分割/統合する。
- ダブルスは「ペア単位のキー」と「選手個人のキー」を分けて持つ（連覇・ペア別で使い分けるため）。

### 0.3 「全国大会」判定（決定済み 2026-07-01）

`data/tournaments/index.json`（29 大会、`generationId` 付き）＝**全国レベル**、
`data/tournaments/local_index.json`（23、都道府県連盟）＝**地方**、という既存の二分を利用する。

- **決定**: `isNational = tournamentId が index.json に存在し、かつ `generationId` が
  `international` / `international-qualifier` **以外**`。すなわち **国際大会・国際予選は全国大会に含めない**。
  対象 generation は `all`（総合）/ `corporate`（実業団）/ `university` / `highschool` / `junior` / `masters`。
- `isMajorTitle` は 4 大全日本（`zennihon-championship` / `-singles` / `-mixed` / `-indoor`）を指す既存フラグ。
- 実装は大会マスタ join 時に `isNational` を上記条件で立てるだけ。専用フィールド新設は不要（当面）。

### 0.4 集計スコープの明示（必須）

すべての集計は**当サイト掲載大会分**であり生涯記録ではない。既存の `careerRecord` と同様、
出力に必ず `scope: 'site-covered'` と `scopeNote`（「当サイト掲載大会分の集計に基づく」）を付け、
描画側で明示する。「初出場」「初優勝」「通算」は特に `confidence: 'scope-limited'` を付す。

### 0.45 年区切り（決定済み 2026-07-01）

**決定**: 年区切りは**年度（4月始まり）**とする。大会データの `year` はすでに**年度で指定**されているため、
`PlayerFact.year` をそのまま年度として扱えばよく、`date` からの再計算は不要。§3 年度別成績・§11 ランキングは
この `year`（＝年度）で group by する。`seasonModel` の分岐は設けない（常に年度）。

### 0.5 種目の分離

soft tennis は 個人シングルス / 個人ダブルス / 混合ダブルス / 団体 が混在する。
`category`（`singles` / `doubles` / `mixed` / `team`）を全 fact に持たせ、
成績は**原則「種目別」に出せる**設計にする（合算は誤解を招くため既定で種目別、総計は補助表示）。

### 0.6 勝率・ゲーム率の算入ルール（2026-07-01 データ実体に基づき改訂・確定）

**データ実体（2026-07-01 調査）**: 不戦勝（相手不在）と途中棄権は**区別されず、いずれも `retired:true`** で
登録される（敗者側がリタイア＝負け、勝者に `winnerEntryNo`）。retired 試合 451 件中 約 84%（380 件）は
「勝者＝規定ゲーム到達（4 or 5）・敗者＝0」の既定スコアで、不戦勝の placeholder とみられる。残りは途中経過
スコアや無スコア（10 件）。**両者を確実に判別する手段はデータに無い**（規定勝ちゲーム数も形式で変動：`matchRules`）。

不戦勝だけを選り分けて除外することは判別不能でできない。一方、`retired:true` を**一律に全除外**することは
技術的に容易（`if (m.retired) continue`）。方針は「実際に戦った試合だけで集計する」を採り、以下で確定する:

- **勝敗（勝率）**: `retired:true` は**勝敗から全除外**（勝ち数にも負け数にも数えない）。不戦勝の水増しを避け、
  「実際に戦った試合の勝率」にする。本物の途中棄権（約 16%）も併せて落ちるが、判別できないため一律とする。
- **ゲーム率**: `retired:true` は**全除外**（スコアが既定値／途中値でプレー内容を反映しない。84% が満点-0 の既定値）。
- **draw（引き分け）**: リーグ戦等で稀。**勝率の分母から除外**（勝でも負でもない）。
- **順位・進出率・出場回数・優勝判定など「結果（placement）」側には反映する**。retired 試合の勝者は勝ち上がって
  いるため、`PlayerEntryFact.placement`（優勝/準優勝/ベスト4…）や大会別成績の出場・順位には通常どおり計上する。
  除外するのは勝率・ゲーム率の**分子分母だけ**である点に注意（勝敗カウントと順位カウントを分離）。
- 表示側に「勝率・ゲーム率は不戦勝・棄権を除いた、実際に戦った試合ベース」と注記する。

---

## 1. 共通データ基盤（PlayerFacts）

### 1.1 データモデル

```ts
// 中間表現。全選手ぶんビルド時に生成し data(build) → JSON 化する。
type PlayerMatchFact = {
  // 位置
  tournamentId: string; categoryId: string; year: number; matchId: string;
  // 大会メタ（index.json / information / generations から解決）
  generationId: string; isMajorTitle: boolean; isNational: boolean;
  category: 'singles'|'doubles'|'mixed'|'team'; gender: string; age: string;
  date: string;                 // information.startDate（鮮度・時系列に使う）
  // 試合
  round: string|null; roundOrder: number|null; stage: 'knockout'|'roundrobin'; group: string|null;
  result: 'win'|'lose'|'draw'; retired: boolean;
  gamesWon: number; gamesLost: number;
  // 人物
  selfEntryNo: number; selfTeam: string|null;
  partnerIds: number[]; partnerKeys: string[];      // ダブルスのみ
  opponentIds: number[]; opponentKeys: string[]; opponentDisplay: string; opponentTeam: string|null;
};

type PlayerEntryFact = {
  tournamentId: string; categoryId: string; year: number;
  generationId: string; isMajorTitle: boolean; isNational: boolean;
  category: 'singles'|'doubles'|'mixed'|'team'; gender: string; age: string; date: string;
  selfTeam: string|null; partnerKeys: string[];
  placement: { kind: 'winner'|'runnerup'|'best'|'round'; value: number|null }; // best4/best8 は value=4/8, round=敗退回戦
  gradeGuess: number|null;      // 学年推定（§5）。不確実なら null
};

type PlayerFacts = {
  playerId: number; displayName: string; currentTeam: string|null;
  scope: 'site-covered'; scopeNote: string;
  firstDate: string; lastDate: string;   // dateCreated/dateModified 用
  matches: PlayerMatchFact[];             // 時系列昇順
  entries: PlayerEntryFact[];
};
```

`round → roundOrder` は「1回戦=1 … 決勝=最大」に正規化し、H2H やラウンド別集計で比較可能にする。

### 1.2 算出アルゴリズム（生成）

1. 大会走査は**逆引き**で軽くする。既存 `public/data/beta-matches/reverse/by-player.json` と同型の
   `player → 出場大会カテゴリ` 逆引き表を `details/**` から 1 回だけ構築（`scripts/generate-player-facts.mjs`）。
2. 各 (tournamentId, year, categoryId) の `details` を読み、対象選手を含む `entries` を特定 →
   `matches` を走査して勝敗・スコア・ペア・相手を `PlayerMatchFact` に落とす。
3. 同ファイルの `results[entryNo].tournament.rank` を `placement` に写して `PlayerEntryFact` を作る。
4. `information.json` から `date` / `category`(種目) / `gender` / `age`、`index.json` から
   `generationId` / `isMajorTitle` / `isNational` を join。
5. 時系列昇順にソートして `PlayerFacts` を確定。

### 1.3 キャッシュ方法

- **ビルド時前計算（prebuild）**。`scripts/generate-player-facts.mjs` が
  `data/players/_facts/{id}.json`（内部中間）を出力。既存 `generate-player-analysis.mjs` は
  この facts を入力に置き換え、`analysis.json` を facts の fold として再定義する（ロジック二重化解消）。
- **増分生成**: 大会データ（`details/**` `information/**`）の内容ハッシュを持ち、
  変更のあった大会に出場した選手だけ facts を再生成（`--changed-only`）。全 8,000 組フルビルドは CI 夜間のみ。
- 静的 `output:'export'` のためランタイム計算はしない。ページは facts 由来の集計 JSON を読むだけ。

### 1.4 将来の拡張性

- score 機能（Supabase の `points`）を facts の `matchId` で join すれば、得失点・サーブ/レシーブ別まで
  同じ器で拡張できる（`PlayerMatchFact.detail?` を追加するだけ）。
- 国際大会のローマ字選手も同じ器に載る（identity だけ別ルール）。

---

## 2. 歴代戦績（通算成績）

1. **必要データ**: `PlayerMatchFact[]`（全件）。
2. **アルゴリズム**: 全 match を fold。`total/wins/losses`、`winRate=wins/(wins+losses)`（算入ルールは §0.6）、
   `games{total,won,lost,gameRate}`。種目別（singles/doubles/mixed/team）と総計の両方を出す。初出場〜直近の期間も付す。
3. **データモデル**: `CareerTotals { byDiscipline: Record<category, WLG>, overall: WLG, span:{from,to} }`。
   既存 `analysis.json`（totalMatches/wins/losses/games）を種目分割に拡張。
4. **キャッシュ**: `player-aggregates/{id}.json` にビルド時格納（facts の純関数）。
5. **拡張**: 「掲載範囲」注記付きのまま、将来 score 連携で得点効率・タイブレーク勝率を追加可能。

## 3. 年度別成績

1. **必要データ**: `PlayerMatchFact[]` + `PlayerEntryFact[]`。
2. **アルゴリズム**: `year`（＝**年度**、§0.45）で group by → 各年 WLG を fold。加えて各年の**最高順位**
   （entries の placement 最良値）と主な出場大会を付す。既存 `byYear` を土台に placement を追加。
3. **データモデル**: `YearRow { year, matches:WL, games, bestPlacement, tournaments:[{id,label,placement}] }[]`（降順）。
4. **キャッシュ**: `player-aggregates/{id}.json` 内 `byYear`。
5. **拡張**: `year` は既に年度なので追加の日付処理は不要。§11 ランキングと同じ年区切りを共有する。

## 4. 大会別成績

1. **必要データ**: `PlayerEntryFact[]`（出場回数・順位）＋ `PlayerMatchFact[]`（大会内 WL）。
2. **アルゴリズム**: `tournamentId`（必要なら `categoryId` 種目まで）で group by →
   出場回数、通算 WL、**最高成績**、優勝回数、各回の結果一覧。全日本など複数種目のある大会は種目別に割る。
3. **データモデル**: `TournamentRow { tournamentId, label, isMajorTitle, appearances, wl, titles, best, editions:[{year, placement, partner}] }[]`。
   格の高い順（isMajorTitle → generation 重み → 出場数）でソート。
4. **キャッシュ**: `player-aggregates/{id}.json` 内 `byTournament`。大会マスタ（label 等）は共有ロード。
5. **拡張**: 大会に「格 tier」フィールドを足せばソート・重み付けを一元化（§11 と共有）。

## 5. 学年別成績 — 【除外・実装しない】（決定済み 2026-07-01）

**決定**: 学年を確実に決定できるデータ（生年月日・入学年）がサイト全体では存在せず、
推定は誤表示による信頼毀損リスクが高い。よって**学年別成績は本設計から除外し、実装しない**。

- `PlayerEntryFact` / `PlayerMatchFact` に `gradeGuess` フィールドは持たせない（設計を単純化）。
- 将来、生年月日マスタ（`data/players/birthdates.json` 等）が十分な網羅率で整備できた場合にのみ再検討する（§13）。
- なお「学校系 generation の在籍N年目」という**年数ベース**の表現（学年ではなく）は誤りが無く導けるため、
  必要になれば §3 年度別成績の派生として別途検討可能（本設計では出さない）。

## 6. 全国大会初出場

1. **必要データ**: `PlayerEntryFact[]`（`isNational` フラグ・`date`）。
2. **アルゴリズム**: `isNational===true` の entry を `date` 昇順で並べ**先頭**を採用。
   種目別に分けても良い（「全国初出場（ダブルス）」）。`confidence:'scope-limited'`（掲載開始以前は不可視）。
3. **データモデル**: `FirstNational { tournamentId, label, year, category, team, partner }|null`。
4. **キャッシュ**: `player-aggregates/{id}.json` 内 `milestones.firstNational`。既存 `milestones.ts` の
   `first-appearance`（現在 pending）をここに実装統合。
5. **拡張**: `nationalScope` フィールド導入で「全国」の定義変更に 1 箇所で追随。

## 7. 全国大会初優勝

1. **必要データ**: `PlayerEntryFact[]`（`isNational` かつ `placement.kind==='winner'`）。
2. **アルゴリズム**: 条件一致 entry を `date` 昇順で先頭採用。連覇・n回目（§8）と同じ優勝抽出ロジックを共有し、
   人物一致は `playerKey`（名前@所属）で判定（既存 `milestones` の `first-title` と同方式で誤判定を抑制）。
3. **データモデル**: `FirstNationalTitle { tournamentId, label, year, category, team, partner }|null`。
4. **キャッシュ**: `player-aggregates/{id}.json` 内 `milestones.firstTitle`（既存 `first-title` を national 条件付きで再利用）。
5. **拡張**: 「主要大会初優勝」「種目別初優勝」への一般化は条件式の差し替えのみ。

## 8. 連覇・○回目優勝

1. **必要データ**: 対象選手が優勝した `PlayerEntryFact`（tournamentId+categoryId+year+`playerKey`）。
2. **アルゴリズム**: 既存 `lib/milestones.ts` の実装済みロジックをそのまま採用。
   種目×大会ごとに優勝年を昇順に並べ、**連続年区間 → `repeat-title`（streak/since）**、
   非連続の複数回 → **`nth-title`（n回目）**、初回 → `first-title`。人物一致は `championKey`（所属＋名前）。
3. **データモデル**: `TitleStreaks { byTournament: Record<tid, { wins:number[], streaks:[{since,streak}], nth:number }> }`。
4. **キャッシュ**: `player-aggregates/{id}.json` 内 `milestones.titles`。`tournamentRecords` の歴代優勝者ブロックを共有。
5. **拡張**: `best4-first`（ベスト4初進出）など placement 拡張は `MilestoneEvent` が汎用なので追加容易。

## 9. 通算優勝数

1. **必要データ**: `PlayerEntryFact[]`（`placement.kind==='winner'`）。
2. **アルゴリズム**: winner entry を数える。**種目別・大会別内訳つき総数**。重複計上防止として
   1 (tournamentId, year, categoryId) = 1 タイトルで一意化。
3. **データモデル**: `TitleCount { total, byDiscipline, byTournament }`。
4. **キャッシュ**: `player-aggregates/{id}.json` 内 `titleCount`。§8 と同じ winner 抽出を共有。
5. **拡張**: 「全国のみ」「地方含む」をトグルできるよう winner entry に `isNational` を保持済み。

## 10. 主要大会優勝数

1. **必要データ**: §9 の winner entry のうち `isMajorTitle===true`。
2. **アルゴリズム**: `isMajorTitle && winner` を数える。4 大全日本の内訳（大会別回数）を必ず添える。
   既存 `lib/majorTitles.ts`（選手別 major title 抽出）を facts 経由に置換して共有。
3. **データモデル**: `MajorTitleCount { total, byTournament: {zennihon-championship:n, ...} }`。
4. **キャッシュ**: `player-aggregates/{id}.json` 内 `majorTitleCount`。
5. **拡張**: 「主要大会」の集合を大会マスタの `tier`/`isMajorTitle` で管理し、定義変更に一元対応。

## 11. 年度ごとのランキング推移（新規・設計比重大）

既存にランキング概念は無い。**全選手横断のグローバル計算**なので専用パイプラインを設計する。
説明可能性を最優先し、**主指標＝シーズンポイント制（決定的）**、**副指標＝レーティング（Elo系）**の二段構えとする。

1. **必要データ**: 全選手の `PlayerEntryFact`（順位・大会格・年）＋（副指標用に）全 `PlayerMatchFact`（時系列の勝敗）。
2. **アルゴリズム**:
   - **(A) シーズンポイント（主）**: 大会格 `tier`（例 全日本=100 / その他全国=60 / 地方=20）×
     最終順位係数（優勝=1.0 / 準優勝=0.7 / ベスト4=0.5 / ベスト8=0.3 / 出場=0.1）を年内で合算 → 高い順に順位付け。
     種目別ランキング（シングルス/ダブルス）を別々に出す。係数は `data/ranking-config.json` に外出しして調整可能に。
     **偏り補正（決定済み 2026-07-01）**: 掲載データは年により厚薄があり、単純合計だと「収録が厚い年・地域・多出場」の
     選手が有利になる。→ **その年度の上位 3 大会のみ合算（賞金ランキング型）＋ `scope-limited` 注記**で確定。
     （検討した代替: 補正せず合計 / 出場大会数で割る平均〔少数精鋭が過大〕は不採用。）
     tier・順位係数の初期値（全日本=100 / その他全国=60 / 地方=20、優勝1.0〜出場0.1）は
     `data/ranking-config.json` に外出しし、運用しながら調整する。
   - **(B) レーティング（副）**: 試合を `date` 昇順に処理する **Elo**（初期 1500、K は大会格で可変、
     ダブルスはペア平均で更新し各人へ配分）。年末値の推移を折れ線化。少試合選手は暫定（provisional）扱い。
   - 各年の順位は「その年に 1 試合以上」の選手集合内で相対化。年跨ぎの推移は id で連結。
3. **データモデル**:
   - グローバル: `rankings/{year}-{discipline}.json`（`[{rank, playerId, points, rating}]`）。
   - 選手別: `player-aggregates/{id}.json` 内 `rankingTrend: [{year, discipline, rank, outOf, points, rating}]`。
4. **キャッシュ方法**:
   - **2 段ビルド**。段1で全 facts → 段2で `scripts/generate-rankings.mjs` が年×種目の全選手集計 →
     グローバル表 `rankings/*.json` を生成 → 各選手へ該当行を逆展開して `player-aggregates` に注入。
   - グローバル計算のため増分は効きにくい：ある年の大会が変わったら**その年（Elo は以降全年）**を再計算。
     Elo は時系列依存なので「変更年以降のみ再計算」できるようスナップショットを年末で保存しておく。
5. **将来の拡張性**:
   - 係数・tier を `ranking-config.json` に集約済み → 定義変更で全再計算のみ。
   - Glicko-2（不確実性つき）や、対戦相手の強さで重み付けした「質」指標へ差し替え可能（インターフェース固定）。
   - **Open Question**: 掲載範囲が地方大会に偏る年はポイントが歪む。tier 正規化・出場大会数での補正方針は要検討（`scope-limited` 明示必須）。

## 12. 対戦相手との通算成績（H2H）

1. **必要データ**: `PlayerMatchFact[]`（`opponentKeys` / `opponentIds` / 勝敗 / games / date / tournament）。
2. **アルゴリズム**: `opponentKey` で group by → H2H の WL・gameRate・初/直近対戦・大会別内訳。
   ダブルスは 2 つの見方があるため両方を保持し、**既定は「対個人」**とする（決定済み 2026-07-01）:
   - **対個人（既定・推奨）**: 相手選手を相方問わず名寄せ。例「A が相方甲でBと3回・相方乙でBと2回」→「Bと通算5回」。
     相手との相性を見るデータベース用途に直感的でカウントもまとまる。
   - **ペア対ペア（絞り込みオプション）**: 「A・X ペア」対「B・Y ペア」。厳密だが相方が変わると別カウントで細切れになる。
3. **データモデル**: `Head2Head { opponentId, opponentName, wl:WL, games, first, last, meetings:[{year, tournament, round, result, score}] }[]`
   （対戦数降順）。相手が結果ページを持つ（`count>=5`）場合のみ `/players/{id}/results` へリンク。
4. **キャッシュ**: `player-aggregates/{id}.json` 内 `headToHead`。上位 N 件をページ埋め込み、全件は lite JSON（`players-lite` 方式）で遅延取得。
5. **拡張**: `roundOrder` を持つので「決勝での対戦成績」「大会格別 H2H」に絞り込み可能。将来 score 連携でゲーム内容まで。

---

## 12.5 追加統計項目（2026-07-01 取り込み）

いずれも既存 Facts（§1）への単一パス fold で導け、データ構造・計算量を変えない。エンジン設計 §4.1 と対応。
閾値は `data/ranking-config.json` に外出し（`minMatchesForSeasonWinRate=10` / `minMeetingsForH2H=3`）。

| 項目 | 必要データ | アルゴリズム / 定義 | 計算量 |
| --- | --- | --- | --- |
| 最長連勝 | 時系列 match | 連続 win の最大区間。同日内は `roundOrder` 順 | O(m) |
| 最高勝率 | `byYear` | **年度別**で試合数 ≥ 10 の年度に限り勝率最大を選ぶ（少標本除外） | O(y) |
| 苦手選手 / 得意選手 | `headToHead` | **対戦数 ≥ 3** の相手を負け越し順 / 勝ち越し順 | O(o) |
| 最多対戦相手 / 最多ペア | `headToHead` / `byPartner` | 各トップ（派生の便利値） | O(1) |
| 所属別成績 | `selfTeam` | 当時の所属で group by（`team-name-aliases` 正準化後） | O(m) |
| 決勝進出率 / 準決勝進出率 | entries + round名 | **分母 = ノックアウト個人戦の出場**。分子 = `決勝`/`準決勝` の試合に到達（or 優勝）。団体・リーグは分母除外 | O(e) |
| ランキング推移 | `rankings/*` | §11 で設計済み（再掲） | O(y) |
| キャリア年表 | milestones + byYear + byTeam | 主要イベントを時系列整列（記事生成の骨子） | O(m) |

※「学年別」は §5 のとおり対象外。上表は生年月日等の欠損データに依存せず 100% 自動生成できる。

## 13. まとめ：出力物とキャッシュ層（全体像）

| 層 | ファイル | 生成 | 単位 | 用途 |
| --- | --- | --- | --- | --- |
| 中間 | `data/players/_facts/{id}.json` | `generate-player-facts.mjs`（prebuild, 増分可） | 選手 | 全機能の素データ（§1） |
| 選手集計 | `data/players/_agg/{id}.json` | facts の純関数 fold | 選手 | §2–§4,§6–§10,§12（歴代/年度/大会/ペア/初出場/初優勝/連覇/優勝数/H2H。学年別は除外） |
| グローバル | `data/rankings/{year}-{discipline}.json` | `generate-rankings.mjs`（2段目） | 年×種目 | §11 ランキング |
| 公開軽量 | `public/data/players-*/{id}.json` | 既存 lite 方式に準拠 | 選手 | クライアント遅延取得（全 H2H・全ペア等） |

方針:
- **すべてビルド時前計算**（本番は `output:'export'`）。ページは JSON を読むだけでランタイム集計しない。
- **増分**は大会データの内容ハッシュ基準。§2–§10・§12 は該当選手のみ、§11 は該当年（Elo は以降年）を再計算。
- 既存の `analysis.json` / `careerRecord` / `milestones` / `majorTitles` は facts 入力に**統合し二重ロジックを解消**。

## 14. 決定事項（2026-07-01 すべて確定）

1. **学年別成績は除外・実装しない**（§5）。確実な生年/入学年データが無いため。
2. **全国大会 = index.json の大会のうち国際大会・国際予選を除く**（§0.3）。
3. **年区切りは年度**。大会データの `year` が既に年度指定のため `year` をそのまま使う（§0.45）。
4. **ランキングの偏り補正 = その年度の上位3大会のみ合算 + scope-limited 注記**（§11）。
   tier・順位係数の初期値は `data/ranking-config.json` に外出しして運用調整。
5. **勝率・ゲーム率の算入ルール（データ実体に基づき改訂）= `retired:true`（不戦勝・途中棄権は判別不能）は
   勝率・ゲーム率から全除外（実際に戦った試合ベース）。draw は分母除外。ただし順位・進出率・優勝判定など
   placement 側には反映する**（§0.6）。
6. **ダブルス H2H の既定軸 = 対個人（相方問わず名寄せ）。ペア対ペアはオプション**（§12）。

### データ実体の確認結果（2026-07-01 解決）
- 不戦勝 / bye は**独立表現を持たず `retired:true` で登録**され、途中棄権と判別不能。ルールは §0.6 に確定反映済み。

### 実装フェーズに持ち越す確認
- `ranking-config.json` の tier・係数・追加統計の閾値の初期値は運用開始後に実データを見て微調整する（§11・§12.5）。
