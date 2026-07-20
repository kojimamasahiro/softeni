// src/types/playerStatistics.ts
// Player Statistics Engine の公開型。ページ/コンポーネント/生成スクリプトが import する。
// 内部型（PlayerMatchFact 等）は lib/playerStats/types.ts。
//
// 設計: docs/raw/2026-07-01-player-statistics-engine.md §4
// データ契約: docs/raw/2026-07-01-player-statistics-engine-data-contract.md

/** 計算するセクション（getPlayerStatistics options.sections）。 */
export type StatSection =
  | 'career'
  | 'byYear'
  | 'byTournament'
  | 'byPartner'
  | 'byTeam'
  | 'headToHead'
  | 'records'
  | 'highlights'
  | 'reachRates'
  | 'titles'
  | 'majorResults'
  | 'milestones'
  | 'rankingTrend'
  | 'careerTimeline';

export interface WinLoss {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface GameTotals {
  total: number;
  won: number;
  lost: number;
  gameRate: number;
}

/** 種目別 + 総計の戦績（歴代）。 */
export interface CareerTotals {
  overall: { matches: WinLoss; games: GameTotals };
  byDiscipline: Record<string, { matches: WinLoss; games: GameTotals }>;
  span: { from: string | null; to: string | null };
}

export interface YearRow {
  year: number;
  discipline: string; // 'all' 総計 or 種目別
  matches: WinLoss;
  games: GameTotals;
  bestResult: string | null; // 最高成績（表示ラベル）
}

export interface TournamentRow {
  tournamentId: string;
  tournamentName: string;
  appearances: number;
  matches: WinLoss;
  titles: number;
  bestResult: string | null;
  years: number[];
}

export interface PartnerRow {
  partnerId: number | null;
  partnerKey: string;
  partnerName: string;
  matches: WinLoss;
  games: GameTotals;
}

export interface TeamRow {
  team: string;
  span: { from: string | null; to: string | null };
  matches: WinLoss;
  games: GameTotals;
  titles: number;
}

export interface Head2HeadRow {
  opponentId: number | null;
  opponentKey: string;
  opponentName: string;
  meetings: number;
  wins: number;
  losses: number;
  winRate: number;
  firstDate: string | null;
  lastDate: string | null;
}

export interface StreakSpan {
  length: number;
  from: string | null;
  to: string | null;
  fromTournament: string | null;
  toTournament: string | null;
}

export interface TitleStreak {
  tournamentId: string;
  categoryId: string;
  discipline: string;
  streak: number;
  since: number;
}

/**
 * 全国大会優勝 1 件（表示・SEO 用）。
 *
 * 対象大会は `lib/nationalTitles.ts` の明示ホワイトリストで判定する。
 * `titles.firsts.firstNational*` が使う広い `isNational`（国際大会以外すべて＝東日本/
 * 西日本選手権のような地域大会も含む）とは別基準なので混同しないこと。
 */
export interface NationalTitle {
  tournamentId: string;
  /** 正式名称（例: 全国高等学校総合体育大会） */
  tournamentName: string;
  /** 通称（例: インターハイ）。バッジ・title に出す主表記 */
  shortLabel: string;
  categoryId: string;
  /** 種目ラベル（例: 男子ダブルス） */
  discipline: string;
  year: number;
  date: string | null;
}

/** 勲章カードのカテゴリ（`lib/nationalTitles.ts` の `MajorCategoryId` と同値）。 */
export type MajorCategoryId = 'junior' | 'highschool' | 'university' | 'general' | 'international' | 'senior';

/**
 * 主要大会でのベスト8以上の成績 1 件（勲章カード用）。
 *
 * 対象大会は `lib/nationalTitles.ts` で `majorCategory !== null` のもの
 * （社会人・東日本/西日本選手権・国際予選は含まない）。
 */
export interface MajorResultEntry {
  tournamentId: string;
  /** 正式名称（例: 全国高等学校総合体育大会） */
  tournamentName: string;
  /** 通称（例: インターハイ） */
  shortLabel: string;
  categoryId: string;
  /** 種目ラベル（例: 男子ダブルス） */
  discipline: string;
  year: number;
  date: string | null;
  /** 表示ラベル: 優勝 / 準優勝 / ベスト4 / ベスト8 */
  placementLabel: string;
  /** 並び替え用の順位（1=優勝, 2=準優勝, 4=ベスト4, 8=ベスト8）。小さいほど上位 */
  placementRank: 1 | 2 | 4 | 8;
}

/** カテゴリ 1 つぶんの主要大会実績（勲章カード 1 枚に対応）。 */
export interface MajorCategoryResult {
  category: MajorCategoryId;
  /** 表示ラベル（ジュニア / 高校 / 大学 / 総合 / 国際大会 / シニア） */
  categoryLabel: string;
  /** このカテゴリの最高成績（同順位なら年度が新しい方）。カード表面に出す */
  best: MajorResultEntry;
  /** ベスト8以上の全件（成績上位順 → 年度降順）。2 件以上なら展開表示する */
  entries: MajorResultEntry[];
}

export interface FirstEvent {
  tournamentId: string;
  tournamentName: string;
  categoryId: string;
  year: number;
  date: string | null;
}

/** 記事生成用の構造化イベント（lib/milestones.ts の MilestoneEvent と互換に保つ）。 */
export interface MilestoneEvent {
  kind: string;
  subject: { players: string[]; teams: string[]; display: string };
  tournamentId: string;
  categoryId: string;
  year: number;
  detail: Record<string, string | number>;
  confidence: 'confirmed' | 'scope-limited';
  label: string;
  shortLabel: string;
  scopeNote?: string;
}

export interface RankingPoint {
  year: number;
  discipline: string;
  /** 男女別順位表（boys / girls）。 */
  gender: string;
  rank: number;
  outOf: number;
  points: number;
  rating?: number;
}

export interface TimelineEvent {
  date: string | null;
  year: number;
  kind: string; // 'debut' | 'firstNational' | 'firstTitle' | 'repeat-title' | 'team-change' | 'season-best'
  label: string;
  detail?: Record<string, string | number>;
}

export interface PlayerMeta {
  title: string;
  description: string;
}

export interface PlayerStatistics {
  playerId: number;
  identity: {
    displayName: string;
    currentTeam: string | null;
    slug?: string | null;
    /** 同姓同名融合の可能性（homonyms.json 登録名）。UI で注記する用。 */
    homonymRisk?: boolean;
  };

  scope: 'site-covered';
  scopeNote: string;
  coverage: {
    firstDate: string | null;
    lastDate: string | null;
    totalMatches: number;
    totalEntries: number;
  };

  career: CareerTotals;
  byYear: YearRow[];
  byTournament: TournamentRow[];
  byPartner: PartnerRow[];
  byTeam: TeamRow[];
  headToHead: Head2HeadRow[];

  records: {
    longestWinStreak: StreakSpan;
    longestLoseStreak: StreakSpan;
    bestSeason: {
      year: number;
      discipline: string;
      winRate: number;
      wins: number;
      losses: number;
    } | null;
  };

  highlights: {
    mostFacedOpponent: Head2HeadRow | null;
    mostFrequentPartner: PartnerRow | null;
    toughOpponents: Head2HeadRow[];
    favorableOpponents: Head2HeadRow[];
  };

  reachRates: {
    denominator: number;
    finalReachRate: number;
    semifinalReachRate: number;
  };

  titles: {
    total: number;
    major: number;
    byTournament: Record<string, number>;
    streaks: TitleStreak[];
    nth: Record<string, number>;
    /**
     * 全国大会優勝（`lib/nationalTitles.ts` のホワイトリスト × placement=winner）。
     * `titles` は年度降順（直近優先）。順序は格付けではない。
     */
    national: {
      count: number;
      /** 優勝した大会の種類数（同一大会の複数回優勝は 1 と数える） */
      tournamentCount: number;
      titles: NationalTitle[];
    };
    firsts: {
      firstNational: FirstEvent | null;
      firstNationalTitle: FirstEvent | null;
    };
  };

  /**
   * 主要大会のカテゴリ別ベスト8以上（勲章カード）。
   * `MAJOR_CATEGORY_ORDER`（ジュニア→高校→大学→総合→国際大会→シニア）順。
   * 該当のないカテゴリは要素ごと存在しない（記録が無いカテゴリを出さないのは仕様）。
   */
  majorResults: MajorCategoryResult[];

  milestones: MilestoneEvent[];
  rankingTrend: RankingPoint[];
  careerTimeline: TimelineEvent[];

  meta: {
    generatedAt: string;
    engineVersion: string;
    sourceHash: string;
  };
}

export interface PlayerStatisticsOptions {
  sections?: StatSection[];
  discipline?: 'singles' | 'doubles' | 'mixed' | 'team';
  freshness?: 'cache' | 'recompute';
  includeFull?: boolean;
}
