import type { Point } from '@/types/database';

export type TeamKey = 'A' | 'B';

export type RallyBucket = '1-2' | '3-4' | '5-8' | '9+' | 'unknown';

export type RateMetric = {
  numerator: number;
  denominator: number;
  percentage: number | null;
};

export type ReconstructedPointContext = {
  point: Point;
  gameNumber: number;
  pointNumber: number;
  pointsToWin: number;
  scoreBefore: {
    A: number;
    B: number;
  };
  scoreAfter: {
    A: number;
    B: number;
  };
  isFirstPointOfGame: boolean;
  isTwoTwoPoint: boolean;
  isDeucePoint: boolean;
  isGamePointOpportunity: Record<TeamKey, boolean>;
  isGameWinningPoint: boolean;
  rallyBucket: RallyBucket;
};

export type MomentumSegment = {
  team: TeamKey;
  length: number;
  startGameNumber: number;
  endGameNumber: number;
  startPointNumber: number;
  endPointNumber: number;
};

export type ErrorBreakdownEntry = {
  resultType: string;
  count: number;
  share: number | null;
};

export type TeamAnalysisMetrics = {
  overallPointWinRate: RateMetric;
  service: {
    firstServeSuccessRate: RateMetric;
    firstServePointWinRate: RateMetric;
    secondServePointWinRate: RateMetric;
    doubleFaultCount: number;
  };
  receive: {
    pointWinRate: RateMetric;
  };
  keyMoments: {
    firstPointWinRate: RateMetric;
    twoTwoPointWinRate: RateMetric;
    deucePointWinRate: RateMetric;
    gamePointWinRate: RateMetric;
  };
  rally: {
    buckets: Record<RallyBucket, RateMetric>;
  };
  momentum: {
    maxStreakFor: number;
    maxStreakAgainst: number;
    maxStreakForSegment: MomentumSegment | null;
    maxStreakAgainstSegment: MomentumSegment | null;
  };
  endings: {
    winners: number;
    errors: number;
    errorBreakdown: ErrorBreakdownEntry[];
  };
};

export type NeutralComparisonMetrics = Record<TeamKey, TeamAnalysisMetrics>;

export type TeamPerspectiveInsights = {
  strongSignals: string[];
  improvementCandidates: string[];
  followUpPoints: string[];
};

export type AnalysisCardId = 'service_to_points' | 'key_moments' | 'momentum' | 'rally_profile' | 'point_endings';

export type AnalysisReliability = 'ok' | 'low' | 'none';

export type AnalysisGuideDetailItem = {
  label: string;
  value: string;
};

export type AnalysisGuideCard = {
  id: AnalysisCardId;
  title: string;
  primaryValue: string;
  secondaryValue?: string;
  reliability: AnalysisReliability;
  summary: string;
  description: string;
  howToRead: string;
  nextCheck: string;
  whyItMatters: string;
  details: AnalysisGuideDetailItem[];
};

export type TeamGuideSummary = {
  cards: AnalysisGuideCard[];
};

export type ImprovementHintCategory = 'serve' | 'receive' | 'rally' | 'key_moment' | 'momentum' | 'error_trend';

export type ImprovementHintConfidence = 'high' | 'medium' | 'low';

export type ImprovementHintSourceMetricKey =
  | 'service.firstServeInRate'
  | 'service.firstServePointWinRate'
  | 'service.secondServeWinRate'
  | 'service.doubleFaults'
  | 'receive.pointWinRate'
  | 'receive.opponentSecondServeWinRate'
  | 'rally.short1To4WinRate'
  | 'rally.medium5To8WinRate'
  | 'rally.long9PlusWinRate'
  | 'keyMoment.firstPointWinRate'
  | 'keyMoment.gamePointWinRate'
  | 'keyMoment.opponentGamePointSaveRate'
  | 'keyMoment.deucePointWinRate'
  | 'momentum.maxLostStreak'
  | 'error.resultTypeShare'
  | 'error.loserPlayerShare'
  | 'overall.pointWinRate';

export type ImprovementHintSourceMetric = {
  key: ImprovementHintSourceMetricKey;
  label?: string;
  value: number | string;
  numerator?: number;
  denominator?: number;
  unit?: '%' | 'points' | 'count' | 'rate';
};

export type ImprovementHintReviewPoint = {
  pointId: string;
  gameNumber: number;
  pointNumber: number;
  scoreBefore: Record<TeamKey, number>;
  scoreAfter: Record<TeamKey, number>;
  servingTeam: string | null;
  servingPlayer: string | null;
  winnerTeam: string | null;
  resultType: string | null;
  rallyCount: number | null;
  playerName: string | null;
  point_note?: string | null;
  point_detail?: string | null;
  shot_type?: string | null;
  shot_course?: string | null;
};

export type ImprovementHintReviewGroup = {
  id: string;
  label: string;
  points: ImprovementHintReviewPoint[];
  emptyMessage: string;
};

export type ImprovementHint = {
  id: string;
  ruleId: string;
  ruleVersion: string;
  matchId: string;
  target: {
    team: TeamKey;
    scope: 'player' | 'pair' | 'team';
    playerName?: string;
    playerId?: string | null;
    pairKey?: string | null;
  };
  category: ImprovementHintCategory;
  title: string;
  evidence: string;
  evidenceItems?: string[];
  interpretation: string;
  nextCheck: string;
  nextCheckItems?: string[];
  confidence: ImprovementHintConfidence;
  confidenceReason: string;
  priorityScore: number;
  priorityReasons?: string[];
  sourceMetrics: ImprovementHintSourceMetric[];
  reviewGroups?: ImprovementHintReviewGroup[];
};

export type MatchAnalysisSummary = {
  reconstructedPoints: ReconstructedPointContext[];
  neutralComparison: NeutralComparisonMetrics;
  teamInsights: Record<TeamKey, TeamPerspectiveInsights>;
  teamGuideCards: Record<TeamKey, TeamGuideSummary>;
  improvementHints: Record<TeamKey, ImprovementHint[]>;
  scoreIntegrity: {
    ok: boolean;
    mismatches: Array<{
      gameNumber: number;
      expected: { pointsA: number; pointsB: number; winner: TeamKey | null };
      actual: { pointsA: number; pointsB: number; winner: TeamKey | null };
    }>;
  };
};

export const ANALYSIS_THRESHOLDS = {
  MIN_RATE_SAMPLE: 5,
  MIN_GAME_POINT_SAMPLE: 3,
  STRONG_FIRST_SERVE_POINT_WIN_RATE: 60,
  LOW_SECOND_SERVE_POINT_WIN_RATE: 40,
  LONG_RALLY_DROP_GAP: 15,
  LOW_GAME_POINT_CONVERSION: 40,
  LARGE_LOSS_STREAK: 5,
  ERROR_SHARE_RATE: 40,
  ERROR_SHARE_COUNT: 3,
  LOW_FIRST_SERVE_IN_RATE: 55,
  LOW_FIRST_SERVE_POINT_WIN_RATE: 45,
  LOW_RECEIVE_POINT_WIN_RATE: 40,
  LOW_RALLY_WIN_RATE: 40,
  LOW_OPPONENT_GAME_POINT_SAVE_RATE: 35,
  HIGH_DOUBLE_FAULT_COUNT: 2,
  INDIVIDUAL_ERROR_SHARE_RATE: 60,
  INDIVIDUAL_ERROR_SHARE_COUNT: 3,
  LARGE_RELATIVE_DROP: 12,
} as const;
