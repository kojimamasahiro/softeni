import type { Match, Point } from '../../src/types/database';

export type TeamKey = 'A' | 'B';
export type GrowthTargetKind = 'player' | 'pair';
export type GrowthComparisonKind = 'recent_period' | 'win_loss' | 'same_opponent' | 'same_tournament' | 'same_format' | 'same_pair' | 'opponent_level';
export type GrowthConfidence = 'enough_sample' | 'small_sample' | 'insufficient_sample';
export type GrowthTrend = 'improved' | 'declined' | 'stable';
// 公開レベル（ADR-004）。当面の採用範囲は 'none'（撤回・非生成）と 'link'（グループ限定）のみ。
// 'public' / 'ranked'（実名の全体公開・ランキング）は保留で、現時点では割り当てない。
export type GrowthVisibility = 'none' | 'link' | 'public' | 'ranked';
export type GrowthMetricUnit = 'percent' | 'percentage_point' | 'count' | 'average';
export type GrowthMetricCategory = 'serve' | 'receive' | 'key_moment' | 'momentum' | 'rally';

export type GrowthTarget = {
  key: string;
  kind: GrowthTargetKind;
  displayName: string;
  playerNames: string[];
  teamNames: string[];
  regions: string[];
  matchCount: number;
  completedMatchCount: number;
  latestMatchDate: string | null;
  // 公開レベル（ADR-004）。当面は 'link'（グループ限定公開）を既定とする。
  visibility: GrowthVisibility;
};

// 当面の既定公開レベル。グループ限定（パスワード/限定リンク前提）。
export const DEFAULT_GROWTH_VISIBILITY: GrowthVisibility = 'link';

// buildGrowthTargets / buildGrowthReports の生成オプション。
// excludedKeys: 撤回（オプトアウト）された subject_key。生成段で完全に除外する（ADR-004 Decision 5）。
// featuredKeys: ショーケース対象の subject_key。visibility を 'public' に引き上げる（ADR-004）。
export type GrowthBuildOptions = {
  excludedKeys?: ReadonlySet<string> | string[];
  featuredKeys?: ReadonlySet<string> | string[];
};

export type GrowthMetric = {
  key: string;
  label: string;
  category: GrowthMetricCategory;
  unit: GrowthMetricUnit;
  higherIsBetter: boolean;
  currentValue: number | null;
  previousValue: number | null;
  delta: number | null;
  trend: GrowthTrend;
  confidence: GrowthConfidence;
  numerator: number;
  denominator: number;
  previousNumerator: number;
  previousDenominator: number;
  matchCount: number;
  previousMatchCount: number;
  summary: string;
};

export type GrowthComparison = {
  kind: GrowthComparisonKind;
  title: string;
  description: string;
  currentLabel: string;
  previousLabel: string;
  currentMatchCount: number;
  previousMatchCount: number;
  metrics: GrowthMetric[];
  messages: string[];
};

export type PracticeTheme = {
  id: string;
  title: string;
  description: string;
  sourceMetricKey: string;
  priority: number;
};

export type GrowthReportSection = {
  id: string;
  title: string;
  messages: string[];
  metrics: GrowthMetric[];
};

export type GrowthReport = {
  target: GrowthTarget;
  generatedAt: string;
  matchCount: number;
  completedMatchCount: number;
  comparison: GrowthComparison | null;
  comparisons: GrowthComparison[];
  sections: GrowthReportSection[];
  practiceThemes: PracticeTheme[];
  emptyMessage: string | null;
};

export type PlayerIdentity = {
  name: string;
  teamName: string;
  region: string;
};

export type ReconstructedPoint = {
  point: Point;
  gameNumber: number;
  pointNumber: number;
  pointsToWin: number;
  scoreBefore: Record<TeamKey, number>;
  scoreAfter: Record<TeamKey, number>;
  isFinalGame: boolean;
};

export type RateStat = {
  numerator: number;
  denominator: number;
};

export type AverageStat = {
  total: number;
  matches: number;
};

export type SingleMatchGrowthStats = {
  match: Match;
  side: TeamKey;
  targetWon: boolean;
  opponentKey: string;
  opponentName: string;
  matchDate: string;
  rates: Record<string, RateStat>;
  averages: Record<string, number>;
};

export type AggregatedMetricSource = {
  rates: Record<string, RateStat>;
  averages: Record<string, AverageStat>;
  matchCount: number;
};
