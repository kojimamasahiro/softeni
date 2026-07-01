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
  identity: { displayName: string; currentTeam: string | null; slug?: string };

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
    firsts: {
      firstNational: FirstEvent | null;
      firstNationalTitle: FirstEvent | null;
    };
  };

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
