import { getPointsToWinForGame, isWinningScore } from '@/lib/matchRules';
import type { Match, Point } from '@/types/database';

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

export type AnalysisCardId =
  | 'service_to_points'
  | 'key_moments'
  | 'momentum'
  | 'rally_profile'
  | 'point_endings';

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

export type ImprovementHintCategory =
  | 'serve'
  | 'receive'
  | 'rally'
  | 'key_moment'
  | 'momentum'
  | 'error_trend';

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

const WINNER_RESULT_TYPES = new Set([
  'smash_winner',
  'volley_winner',
  'passing_winner',
  'drop_winner',
  'net_in_winner',
  'service_ace',
  'winner',
]);

const ERROR_RESULT_TYPES = new Set([
  'net',
  'out',
  'smash_error',
  'volley_error',
  'double_fault',
  'follow_error',
  'receive_error',
  'forced_error',
  'unforced_error',
]);

const RALLY_BUCKET_ORDER: RallyBucket[] = [
  '1-2',
  '3-4',
  '5-8',
  '9+',
  'unknown',
];

const getOppositeTeam = (team: TeamKey): TeamKey => (team === 'A' ? 'B' : 'A');

const createRate = (numerator: number, denominator: number): RateMetric => ({
  numerator,
  denominator,
  percentage: denominator > 0 ? (numerator / denominator) * 100 : null,
});

const combineRateMetrics = (...metrics: RateMetric[]): RateMetric =>
  createRate(
    metrics.reduce((sum, metric) => sum + metric.numerator, 0),
    metrics.reduce((sum, metric) => sum + metric.denominator, 0),
  );

const getRateReliability = (
  metric: RateMetric,
  minSample: number = ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE,
): AnalysisReliability => {
  if (metric.denominator === 0) return 'none';
  if (metric.denominator < minSample) return 'low';
  return 'ok';
};

const getPresenceReliability = (count: number): AnalysisReliability =>
  count > 0 ? 'ok' : 'none';

const isDeuceScore = (scoreA: number, scoreB: number, pointsToWin: number) =>
  scoreA === scoreB && scoreA >= pointsToWin - 1;

const getRallyBucket = (
  point: Pick<Point, 'rally_count' | 'double_fault'>,
): RallyBucket => {
  if (point.double_fault) return 'unknown';
  if (point.rally_count === null || point.rally_count === undefined) {
    return 'unknown';
  }
  if (point.rally_count <= 2) return '1-2';
  if (point.rally_count <= 4) return '3-4';
  if (point.rally_count <= 8) return '5-8';
  return '9+';
};

const formatPercentage = (value: number | null) => {
  if (value === null) return null;
  return `${value.toFixed(1)}%`;
};

const formatRateForMessage = (metric: RateMetric) => {
  const percentage = formatPercentage(metric.percentage);
  if (!percentage) return `${metric.numerator}/${metric.denominator}`;
  return `${percentage} (${metric.numerator}/${metric.denominator})`;
};

const formatPrimaryPercentage = (metric: RateMetric) => {
  if (metric.percentage === null) return '--';
  return `${metric.percentage.toFixed(0)}%`;
};

const formatCount = (value: number) => `${value}点`;

const getReliabilitySummary = (reliability: AnalysisReliability) => {
  if (reliability === 'low') {
    return '対象ポイントが少ないため、ここは参考値です。';
  }
  if (reliability === 'none') {
    return '対象ポイントがないため、ここはまだ確認できません。';
  }
  return null;
};

const buildMomentumSegments = (
  points: ReconstructedPointContext[],
): MomentumSegment[] => {
  if (points.length === 0) return [];

  const segments: MomentumSegment[] = [];
  let currentTeam = points[0].point.winner_team as TeamKey;
  let currentLength = 1;
  let startPoint = points[0];

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const winnerTeam = point.point.winner_team as TeamKey;

    if (winnerTeam === currentTeam) {
      currentLength += 1;
      continue;
    }

    const previousPoint = points[index - 1];
    segments.push({
      team: currentTeam,
      length: currentLength,
      startGameNumber: startPoint.gameNumber,
      endGameNumber: previousPoint.gameNumber,
      startPointNumber: startPoint.pointNumber,
      endPointNumber: previousPoint.pointNumber,
    });

    currentTeam = winnerTeam;
    currentLength = 1;
    startPoint = point;
  }

  const lastPoint = points[points.length - 1];
  segments.push({
    team: currentTeam,
    length: currentLength,
    startGameNumber: startPoint.gameNumber,
    endGameNumber: lastPoint.gameNumber,
    startPointNumber: startPoint.pointNumber,
    endPointNumber: lastPoint.pointNumber,
  });

  return segments;
};

const buildTeamInsights = (
  team: TeamKey,
  metrics: TeamAnalysisMetrics,
): TeamPerspectiveInsights => {
  const strongSignals: string[] = [];
  const improvementCandidates: string[] = [];
  const followUpPoints: string[] = [];

  if (
    metrics.service.firstServePointWinRate.denominator >=
      ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE &&
    (metrics.service.firstServePointWinRate.percentage ?? 0) >=
      ANALYSIS_THRESHOLDS.STRONG_FIRST_SERVE_POINT_WIN_RATE
  ) {
    strongSignals.push(
      `1stサーブ時得点率が ${formatRateForMessage(metrics.service.firstServePointWinRate)} でした。`,
    );
  }

  if (
    metrics.service.secondServePointWinRate.denominator >=
      ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE &&
    (metrics.service.secondServePointWinRate.percentage ?? 100) <
      ANALYSIS_THRESHOLDS.LOW_SECOND_SERVE_POINT_WIN_RATE
  ) {
    improvementCandidates.push(
      `2ndサーブ時得点率は ${formatRateForMessage(metrics.service.secondServePointWinRate)} でした。`,
    );
    followUpPoints.push(
      `2ndサーブ時得点率が ${formatRateForMessage(metrics.service.secondServePointWinRate)} で低めです。`,
    );
  }

  const longRallyMetric = metrics.rally.buckets['9+'];
  const overallMetric = metrics.overallPointWinRate;
  if (
    longRallyMetric.denominator >= ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE &&
    longRallyMetric.percentage !== null &&
    overallMetric.percentage !== null &&
    longRallyMetric.percentage <=
      overallMetric.percentage - ANALYSIS_THRESHOLDS.LONG_RALLY_DROP_GAP
  ) {
    improvementCandidates.push(
      `9本以上ラリー得点率は ${formatRateForMessage(longRallyMetric)} で、全体得点率との差が大きめです。`,
    );
    followUpPoints.push(
      `9本以上ラリー得点率が全体得点率より ${(
        overallMetric.percentage - longRallyMetric.percentage
      ).toFixed(1)}pt 低く出ています。`,
    );
  }

  if (
    metrics.keyMoments.gamePointWinRate.denominator >=
      ANALYSIS_THRESHOLDS.MIN_GAME_POINT_SAMPLE &&
    (metrics.keyMoments.gamePointWinRate.percentage ?? 100) <
      ANALYSIS_THRESHOLDS.LOW_GAME_POINT_CONVERSION
  ) {
    improvementCandidates.push(
      `ゲームポイント取得率は ${formatRateForMessage(metrics.keyMoments.gamePointWinRate)} でした。`,
    );
    followUpPoints.push(
      `ゲームポイント取得率が ${formatRateForMessage(metrics.keyMoments.gamePointWinRate)} で、取り切りの確認余地があります。`,
    );
  }

  if (
    metrics.momentum.maxStreakAgainst >= ANALYSIS_THRESHOLDS.LARGE_LOSS_STREAK
  ) {
    const segment = metrics.momentum.maxStreakAgainstSegment;
    const segmentLabel = segment
      ? ` (第${segment.startGameNumber}〜第${segment.endGameNumber}ゲーム)`
      : '';
    followUpPoints.push(
      `最大連続失点は ${metrics.momentum.maxStreakAgainst}点${segmentLabel} でした。`,
    );
  }

  metrics.endings.errorBreakdown.forEach((entry) => {
    if (
      entry.count >= ANALYSIS_THRESHOLDS.ERROR_SHARE_COUNT &&
      (entry.share ?? 0) >= ANALYSIS_THRESHOLDS.ERROR_SHARE_RATE
    ) {
      improvementCandidates.push(
        `${entry.resultType} が自チームエラーの ${formatPercentage(entry.share) ?? '0%'} を占めています。`,
      );
      followUpPoints.push(
        `${entry.resultType} が ${entry.count}件で、自チームエラー内の比率が高めです。`,
      );
    }
  });

  return {
    strongSignals,
    improvementCandidates,
    followUpPoints,
  };
};

const IMPROVEMENT_HINT_RULE_VERSION = 'single-match-v1';
const RESULT_TYPE_LABELS: Record<string, string> = {
  net: 'ネット',
  out: 'アウト',
  smash_error: 'スマッシュミス',
  volley_error: 'ボレーミス',
  double_fault: 'ダブルフォルト',
  follow_error: 'フォローミス',
  receive_error: 'レシーブミス',
  forced_error: 'ミス誘発',
  unforced_error: '凡ミス',
};

const normalizeRecordedPlayerName = (name: string | null | undefined) => {
  if (!name) return null;

  const trimmed = name.trim();
  const uniqueIdMatch = trimmed.match(/^[AB]-\d-(.+)$/);
  return (uniqueIdMatch?.[1] ?? trimmed).replace(/\s+/g, ' ');
};

const getTeamPlayersFromMatch = (match: Match, team: TeamKey) => {
  const structuredPlayers = match.teams?.[team]?.players
    ?.map((player) =>
      normalizeRecordedPlayerName(`${player.last_name} ${player.first_name}`),
    )
    .filter((player): player is string => Boolean(player));

  if (structuredPlayers && structuredPlayers.length > 0) {
    return structuredPlayers;
  }

  const prefix = `team_${team.toLowerCase()}`;
  const players = [1, 2]
    .map((playerIndex) => {
      const lastName = match[
        `${prefix}_player${playerIndex}_last_name` as keyof Match
      ] as string | null | undefined;
      const firstName = match[
        `${prefix}_player${playerIndex}_first_name` as keyof Match
      ] as string | null | undefined;

      if (!lastName || !firstName) return null;
      return normalizeRecordedPlayerName(`${lastName} ${firstName}`);
    })
    .filter((player): player is string => Boolean(player));

  return players;
};

const getHintTarget = (
  match: Match,
  team: TeamKey,
  playerName?: string,
): ImprovementHint['target'] => {
  const players = getTeamPlayersFromMatch(match, team);

  if (playerName) {
    return {
      team,
      scope: 'player',
      playerName,
      playerId: null,
      pairKey: players.length > 1 ? players.join('|') : null,
    };
  }

  if (players.length === 1) {
    return {
      team,
      scope: 'player',
      playerName: players[0],
      playerId: null,
      pairKey: null,
    };
  }

  if (players.length > 1) {
    return {
      team,
      scope: 'pair',
      pairKey: players.join('|'),
    };
  }

  return {
    team,
    scope: 'team',
    pairKey: null,
  };
};

const getConfidence = (
  sampleSize: number,
  minSample: number,
  isStrongSignal: boolean,
): ImprovementHintConfidence => {
  if (sampleSize < minSample) return 'low';
  if (isStrongSignal && sampleSize >= minSample * 2) return 'high';
  return 'medium';
};

const getConfidenceReason = (
  confidence: ImprovementHintConfidence,
  sampleSize: number,
  minSample: number,
) => {
  if (confidence === 'low') {
    return `対象ポイントが${sampleSize}件で目安の${minSample}件に届かないため、参考として確認してください。`;
  }
  if (confidence === 'high') {
    return `対象ポイントが${sampleSize}件あり、差も大きいため注目して確認しやすい項目です。`;
  }
  return `対象ポイントが${sampleSize}件あり、次の試合で確認しやすい項目です。`;
};

const getMetricDropFromOverall = (
  metric: RateMetric,
  overallMetric: RateMetric,
) => {
  if (metric.percentage === null || overallMetric.percentage === null) return 0;
  return overallMetric.percentage - metric.percentage;
};

const formatPointRange = (segment: MomentumSegment | null) => {
  if (!segment) return '該当区間なし';
  if (segment.startGameNumber === segment.endGameNumber) {
    return `第${segment.startGameNumber}ゲーム #${segment.startPointNumber}〜#${segment.endPointNumber}`;
  }
  return `第${segment.startGameNumber}ゲーム #${segment.startPointNumber}〜第${segment.endGameNumber}ゲーム #${segment.endPointNumber}`;
};

const getOpponentGamePointSaveRate = (
  team: TeamKey,
  reconstructedPoints: ReconstructedPointContext[],
) => {
  const opponent = getOppositeTeam(team);
  const opponentGamePointPoints = reconstructedPoints.filter(
    (context) => context.isGamePointOpportunity[opponent],
  );

  return createRate(
    opponentGamePointPoints.filter(
      (context) => context.point.winner_team === team,
    ).length,
    opponentGamePointPoints.length,
  );
};

const getDominantLoserPlayer = (
  match: Match,
  team: TeamKey,
  reconstructedPoints: ReconstructedPointContext[],
) => {
  const teamPlayers = new Set(getTeamPlayersFromMatch(match, team));
  if (teamPlayers.size <= 1) return null;

  const counts = new Map<string, number>();
  let totalKnownErrors = 0;

  reconstructedPoints.forEach((context) => {
    const resultType = context.point.result_type || '';
    const loserPlayer = normalizeRecordedPlayerName(context.point.loser_player);
    if (
      context.point.winner_team === getOppositeTeam(team) &&
      ERROR_RESULT_TYPES.has(resultType) &&
      loserPlayer &&
      teamPlayers.has(loserPlayer)
    ) {
      totalKnownErrors += 1;
      counts.set(loserPlayer, (counts.get(loserPlayer) ?? 0) + 1);
    }
  });

  const [topPlayer, topCount] =
    [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];

  if (!topPlayer || !topCount || totalKnownErrors === 0) return null;

  const share = (topCount / totalKnownErrors) * 100;
  if (
    topCount < ANALYSIS_THRESHOLDS.INDIVIDUAL_ERROR_SHARE_COUNT ||
    share < ANALYSIS_THRESHOLDS.INDIVIDUAL_ERROR_SHARE_RATE
  ) {
    return null;
  }

  return {
    playerName: topPlayer,
    count: topCount,
    totalKnownErrors,
    share,
  };
};

const buildMetric = (
  key: ImprovementHintSourceMetricKey,
  label: string,
  metric: RateMetric,
): ImprovementHintSourceMetric => ({
  key,
  label,
  value:
    metric.percentage !== null ? Number(metric.percentage.toFixed(1)) : '--',
  numerator: metric.numerator,
  denominator: metric.denominator,
  unit: '%',
});

const getReviewPointPlayerName = (context: ReconstructedPointContext) => {
  const resultType = context.point.result_type || '';

  if (ERROR_RESULT_TYPES.has(resultType)) {
    return normalizeRecordedPlayerName(context.point.loser_player);
  }

  if (WINNER_RESULT_TYPES.has(resultType)) {
    return normalizeRecordedPlayerName(context.point.winner_player);
  }

  return (
    normalizeRecordedPlayerName(context.point.winner_player) ??
    normalizeRecordedPlayerName(context.point.loser_player)
  );
};

const toReviewPoint = (
  context: ReconstructedPointContext,
): ImprovementHintReviewPoint => ({
  pointId: context.point.id,
  gameNumber: context.gameNumber,
  pointNumber: context.pointNumber,
  scoreBefore: context.scoreBefore,
  scoreAfter: context.scoreAfter,
  servingTeam: context.point.serving_team,
  servingPlayer: context.point.serving_player,
  winnerTeam: context.point.winner_team,
  resultType: context.point.result_type,
  rallyCount: context.point.rally_count,
  playerName: getReviewPointPlayerName(context),
  point_note: context.point.point_note,
  point_detail: context.point.point_detail,
  shot_type: context.point.shot_type,
  shot_course: context.point.shot_course,
});

const uniqueReviewContexts = (points: ReconstructedPointContext[]) => {
  const seenPointIds = new Set<string>();

  return points.filter((context) => {
    if (seenPointIds.has(context.point.id)) return false;
    seenPointIds.add(context.point.id);
    return true;
  });
};

const buildReviewGroup = (
  id: string,
  label: string,
  points: ReconstructedPointContext[],
  emptyMessage = '該当ポイントを絞り込めませんでした。',
): ImprovementHintReviewGroup => ({
  id,
  label,
  points: uniqueReviewContexts(points).map(toReviewPoint),
  emptyMessage,
});

const sortByRallyCountDesc = (points: ReconstructedPointContext[]) =>
  [...points].sort(
    (left, right) =>
      (right.point.rally_count ?? 0) - (left.point.rally_count ?? 0),
  );

const getPointAt = (
  reconstructedPoints: ReconstructedPointContext[],
  gameNumber: number,
  pointNumber: number,
) =>
  reconstructedPoints.find(
    (context) =>
      context.gameNumber === gameNumber && context.pointNumber === pointNumber,
  ) ?? null;

const getPointAfterSegment = (
  reconstructedPoints: ReconstructedPointContext[],
  segment: MomentumSegment | null,
) => {
  if (!segment) return null;
  const endIndex = reconstructedPoints.findIndex(
    (context) =>
      context.gameNumber === segment.endGameNumber &&
      context.pointNumber === segment.endPointNumber,
  );
  return endIndex >= 0 ? (reconstructedPoints[endIndex + 1] ?? null) : null;
};

const getPointsBeforeContexts = (
  reconstructedPoints: ReconstructedPointContext[],
  points: ReconstructedPointContext[],
) =>
  points
    .map((point) => {
      const index = reconstructedPoints.findIndex(
        (context) => context.point.id === point.point.id,
      );
      return index > 0 ? reconstructedPoints[index - 1] : null;
    })
    .filter(
      (context): context is ReconstructedPointContext => context !== null,
    );

const getPointsAfterContexts = (
  reconstructedPoints: ReconstructedPointContext[],
  points: ReconstructedPointContext[],
) =>
  points
    .map((point) => {
      const index = reconstructedPoints.findIndex(
        (context) => context.point.id === point.point.id,
      );
      return index >= 0 ? (reconstructedPoints[index + 1] ?? null) : null;
    })
    .filter(
      (context): context is ReconstructedPointContext => context !== null,
    );

const buildImprovementHints = (
  match: Match,
  team: TeamKey,
  metrics: TeamAnalysisMetrics,
  reconstructedPoints: ReconstructedPointContext[],
): ImprovementHint[] => {
  const hints: ImprovementHint[] = [];
  const overallMetric = metrics.overallPointWinRate;
  const isOneSidedLoss = (overallMetric.percentage ?? 50) < 38;
  const opponent = getOppositeTeam(team);
  const lostPoints = reconstructedPoints.filter(
    (context) => context.point.winner_team === opponent,
  );
  const servedPoints = reconstructedPoints.filter(
    (context) => context.point.serving_team === team,
  );
  const receivedPoints = reconstructedPoints.filter(
    (context) => context.point.serving_team === opponent,
  );
  const shortRallyLosses = lostPoints.filter(
    (context) => context.rallyBucket === '1-2' || context.rallyBucket === '3-4',
  );
  const addHint = (
    hint: Omit<ImprovementHint, 'id' | 'matchId' | 'target' | 'ruleVersion'> & {
      playerName?: string;
    },
  ) => {
    const { playerName, ...hintWithoutPlayerName } = hint;
    const playerSuffix = playerName ? `:${encodeURIComponent(playerName)}` : '';
    hints.push({
      id: `${match.id}:${team}:${hintWithoutPlayerName.ruleId}${playerSuffix}`,
      ruleVersion: IMPROVEMENT_HINT_RULE_VERSION,
      matchId: match.id,
      target: getHintTarget(match, team, playerName),
      ...hintWithoutPlayerName,
    });
  };

  const firstServeInRate = metrics.service.firstServeSuccessRate;
  if (
    firstServeInRate.denominator > 0 &&
    (firstServeInRate.percentage ?? 100) <
      ANALYSIS_THRESHOLDS.LOW_FIRST_SERVE_IN_RATE
  ) {
    const confidence = getConfidence(
      firstServeInRate.denominator,
      ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE,
      (firstServeInRate.percentage ?? 100) < 45,
    );
    const drop = Math.max(
      0,
      ANALYSIS_THRESHOLDS.LOW_FIRST_SERVE_IN_RATE -
        (firstServeInRate.percentage ?? 0),
    );

    addHint({
      ruleId: 'serve.firstServeInRate.low',
      category: 'serve',
      title: '1stサーブの入りを確認',
      evidence: `1stサーブ成功率が ${formatRateForMessage(firstServeInRate)} でした。`,
      evidenceItems: [
        `1stサーブ成功率: ${formatRateForMessage(firstServeInRate)}`,
        `ダブルフォルト: ${metrics.service.doubleFaultCount}本`,
      ],
      interpretation:
        'この試合では、サーブの入りが次に見返す確認ポイントになる可能性があります。',
      nextCheck:
        '次の試合では、1stサーブが入らなかった場面の入り方を確認しましょう。',
      nextCheckItems: [
        '1stサーブが入らなかったポイント',
        '2ndサーブ後の失点パターン',
      ],
      confidence,
      confidenceReason: getConfidenceReason(
        confidence,
        firstServeInRate.denominator,
        ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE,
      ),
      priorityScore: 48 + drop + Math.min(firstServeInRate.denominator, 12),
      priorityReasons: [
        'サーブの入りは次の試合で確認しやすい',
        '1stサーブ成功率が低め',
      ],
      reviewGroups: [
        buildReviewGroup(
          'first-serve-faults',
          '1stサーブが入らなかったポイント',
          servedPoints.filter((context) => context.point.first_serve_fault),
          '1stサーブフォルトのポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'second-serve-lost-points',
          '2ndサーブ後の失点パターン',
          servedPoints.filter(
            (context) =>
              context.point.first_serve_fault &&
              context.point.winner_team === opponent,
          ),
          '2ndサーブ後の失点ポイントを絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        buildMetric(
          'service.firstServeInRate',
          '1stサーブ成功率',
          firstServeInRate,
        ),
        {
          key: 'service.doubleFaults',
          label: 'ダブルフォルト',
          value: metrics.service.doubleFaultCount,
          unit: 'count',
        },
      ],
    });
  }

  const firstServePointWinRate = metrics.service.firstServePointWinRate;
  const firstServePointDrop = getMetricDropFromOverall(
    firstServePointWinRate,
    overallMetric,
  );
  if (
    firstServePointWinRate.denominator > 0 &&
    (firstServeInRate.percentage ?? 0) >=
      ANALYSIS_THRESHOLDS.LOW_FIRST_SERVE_IN_RATE &&
    ((firstServePointWinRate.percentage ?? 100) <
      ANALYSIS_THRESHOLDS.LOW_FIRST_SERVE_POINT_WIN_RATE ||
      firstServePointDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP)
  ) {
    const confidence = getConfidence(
      firstServePointWinRate.denominator,
      ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE,
      firstServePointDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP,
    );

    addHint({
      ruleId: 'serve.firstServePointWinRate.low',
      category: 'serve',
      title: '1stサーブ後の展開を確認',
      evidence: `1stサーブ時得点率が ${formatRateForMessage(firstServePointWinRate)} でした。`,
      evidenceItems: [
        `1stサーブ時得点率: ${formatRateForMessage(firstServePointWinRate)}`,
        `総ポイント取得率との差: ${firstServePointDrop.toFixed(1)}pt`,
      ],
      interpretation:
        '1stサーブは入っていても、その後の1本で押し返された可能性があります。',
      nextCheck:
        '1stサーブが入ったポイントで、どこから主導権が変わったか確認しましょう。',
      nextCheckItems: [
        '1stサーブでの失点',
        '短いラリーでの失点',
        '相手の決定打で終わった場面',
      ],
      confidence,
      confidenceReason: getConfidenceReason(
        confidence,
        firstServePointWinRate.denominator,
        ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE,
      ),
      priorityScore:
        52 +
        Math.max(firstServePointDrop, 0) +
        Math.min(firstServePointWinRate.denominator, 12),
      priorityReasons: [
        '1stサーブ成功後の得点率が低め',
        '総ポイント取得率との差を確認',
      ],
      reviewGroups: [
        buildReviewGroup(
          'first-serve-next-ball',
          '1stサーブでの失点',
          servedPoints.filter(
            (context) =>
              !context.point.first_serve_fault &&
              context.point.winner_team === opponent,
          ),
          '1stサーブ後の失点ポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'short-rally-lost-points',
          '短いラリーでの失点',
          shortRallyLosses,
          '短いラリーでの失点ポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'opponent-attack-first',
          '相手の決定打で終わった場面',
          lostPoints.filter((context) =>
            WINNER_RESULT_TYPES.has(context.point.result_type || ''),
          ),
          '相手の決定打になったポイントを絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        buildMetric(
          'service.firstServePointWinRate',
          '1stサーブ時得点率',
          firstServePointWinRate,
        ),
        buildMetric('overall.pointWinRate', '総ポイント取得率', overallMetric),
      ],
    });
  }

  const secondServePointWinRate = metrics.service.secondServePointWinRate;
  if (
    secondServePointWinRate.denominator > 0 &&
    ((secondServePointWinRate.percentage ?? 100) <
      ANALYSIS_THRESHOLDS.LOW_SECOND_SERVE_POINT_WIN_RATE ||
      metrics.service.doubleFaultCount >=
        ANALYSIS_THRESHOLDS.HIGH_DOUBLE_FAULT_COUNT)
  ) {
    const confidence = getConfidence(
      secondServePointWinRate.denominator + metrics.service.doubleFaultCount,
      Math.max(3, ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE - 2),
      (secondServePointWinRate.percentage ?? 100) < 30 ||
        metrics.service.doubleFaultCount >= 3,
    );

    addHint({
      ruleId: 'serve.secondServe.low',
      category: 'serve',
      title: '2ndサーブ後の展開を確認',
      evidence: `2ndサーブ時得点率が ${formatRateForMessage(secondServePointWinRate)} で、ダブルフォルトは ${metrics.service.doubleFaultCount}本でした。`,
      evidenceItems: [
        `2ndサーブ時得点率: ${formatRateForMessage(secondServePointWinRate)}`,
        `ダブルフォルト: ${metrics.service.doubleFaultCount}本`,
      ],
      interpretation:
        '2ndサーブの後に相手へ流れが渡った場面があった可能性があります。',
      nextCheck:
        '2ndサーブ後の短いラリーで、どの形の失点が多かったか確認しましょう。',
      nextCheckItems: [
        '2ndサーブでの失点',
        'ダブルフォルトが出たポイント',
        '2nd後の1-4本ラリー失点',
      ],
      confidence,
      confidenceReason: getConfidenceReason(
        confidence,
        secondServePointWinRate.denominator,
        Math.max(3, ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE - 2),
      ),
      priorityScore:
        56 +
        Math.max(
          0,
          ANALYSIS_THRESHOLDS.LOW_SECOND_SERVE_POINT_WIN_RATE -
            (secondServePointWinRate.percentage ?? 0),
        ) +
        metrics.service.doubleFaultCount * 4,
      priorityReasons: [
        '2ndサーブ時得点率が低め',
        'ダブルフォルト数も確認対象',
      ],
      reviewGroups: [
        buildReviewGroup(
          'second-serve-return',
          '2ndサーブでの失点',
          servedPoints.filter(
            (context) =>
              context.point.first_serve_fault &&
              context.point.winner_team === opponent,
          ),
          '2ndサーブ後の失点ポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'double-fault-games',
          'ダブルフォルトが出たポイント',
          servedPoints.filter((context) => context.point.double_fault),
          'ダブルフォルトのポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'second-serve-short-rally-lost-points',
          '2nd後の1-4本ラリー失点',
          servedPoints.filter(
            (context) =>
              context.point.first_serve_fault &&
              context.point.winner_team === opponent &&
              (context.rallyBucket === '1-2' || context.rallyBucket === '3-4'),
          ),
          '2ndサーブ後の短いラリー失点を絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        buildMetric(
          'service.secondServeWinRate',
          '2ndサーブ時得点率',
          secondServePointWinRate,
        ),
        {
          key: 'service.doubleFaults',
          label: 'ダブルフォルト',
          value: metrics.service.doubleFaultCount,
          unit: 'count',
        },
      ],
    });
  }

  const receivePointWinRate = metrics.receive.pointWinRate;
  const receiveDrop = getMetricDropFromOverall(
    receivePointWinRate,
    overallMetric,
  );
  if (
    receivePointWinRate.denominator > 0 &&
    ((receivePointWinRate.percentage ?? 100) <
      ANALYSIS_THRESHOLDS.LOW_RECEIVE_POINT_WIN_RATE ||
      receiveDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP)
  ) {
    const confidence = getConfidence(
      receivePointWinRate.denominator,
      ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE,
      receiveDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP,
    );

    addHint({
      ruleId: 'receive.pointWinRate.low',
      category: 'receive',
      title: 'レシーブ後の展開を確認',
      evidence: `レシーブ時得点率が ${formatRateForMessage(receivePointWinRate)} でした。`,
      evidenceItems: [
        `レシーブ時得点率: ${formatRateForMessage(receivePointWinRate)}`,
        `総ポイント取得率との差: ${receiveDrop.toFixed(1)}pt`,
      ],
      interpretation:
        '相手サーブからの入りで、主導権を作りにくかった可能性があります。',
      nextCheck:
        '相手サーブ後の1本目から3本目で、どこから苦しくなったか確認しましょう。',
      nextCheckItems: [
        'レシーブ直後の失点',
        '相手2ndサーブからの失点',
        'レシーブ後の短いラリー',
      ],
      confidence,
      confidenceReason: getConfidenceReason(
        confidence,
        receivePointWinRate.denominator,
        ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE,
      ),
      priorityScore:
        44 +
        Math.max(receiveDrop, 0) +
        Math.min(receivePointWinRate.denominator, 12),
      priorityReasons: [
        'レシーブは次の試合で確認しやすい',
        '総ポイント取得率との差を確認',
      ],
      reviewGroups: [
        buildReviewGroup(
          'receive-lost-points',
          'レシーブ直後の失点',
          receivedPoints.filter(
            (context) =>
              context.point.winner_team === opponent &&
              context.point.rally_count === 3,
          ),
          'レシーブ時の失点ポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'opponent-second-serve-points',
          '相手2ndサーブからの失点',
          receivedPoints.filter(
            (context) =>
              context.point.first_serve_fault &&
              context.point.winner_team === opponent,
          ),
          '相手2ndサーブ時の失点ポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'receive-short-rally-lost-points',
          'レシーブ後の短いラリー',
          receivedPoints.filter(
            (context) =>
              context.point.winner_team === opponent &&
              (context.rallyBucket === '1-2' || context.rallyBucket === '3-4'),
          ),
          'レシーブ後の短いラリーを絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        buildMetric(
          'receive.pointWinRate',
          'レシーブ時得点率',
          receivePointWinRate,
        ),
        buildMetric('overall.pointWinRate', '総ポイント取得率', overallMetric),
      ],
    });
  }

  const shortRallyMetric = combineRateMetrics(
    metrics.rally.buckets['1-2'],
    metrics.rally.buckets['3-4'],
  );
  const mediumRallyMetric = metrics.rally.buckets['5-8'];
  const longRallyMetric = metrics.rally.buckets['9+'];
  const rallyCandidates: Array<{
    ruleId: string;
    title: string;
    metric: RateMetric;
    metricKey: ImprovementHintSourceMetricKey;
    label: string;
    nextCheckItems: string[];
  }> = [
    {
      ruleId: 'rally.short1To4.low',
      title: '短いラリーの終わり方を確認',
      metric: shortRallyMetric,
      metricKey: 'rally.short1To4WinRate',
      label: '1-4本ラリー得点率',
      nextCheckItems: ['1-4本ラリーでの失点', '短いラリーの終わり方'],
    },
    {
      ruleId: 'rally.medium5To8.low',
      title: '中盤ラリーの組み立てを確認',
      metric: mediumRallyMetric,
      metricKey: 'rally.medium5To8WinRate',
      label: '5-8本ラリー得点率',
      nextCheckItems: ['5-8本ラリーでの失点', '5-8本ラリーの終わり方'],
    },
    {
      ruleId: 'rally.long9Plus.low',
      title: '長いラリーの終わり方を確認',
      metric: longRallyMetric,
      metricKey: 'rally.long9PlusWinRate',
      label: '9本以上ラリー得点率',
      nextCheckItems: ['9本以上ラリーでの失点', '長いラリーの終わり方'],
    },
  ];

  rallyCandidates.forEach((candidate) => {
    const rallyDrop = getMetricDropFromOverall(candidate.metric, overallMetric);
    if (
      candidate.metric.denominator > 0 &&
      ((candidate.metric.percentage ?? 100) <
        ANALYSIS_THRESHOLDS.LOW_RALLY_WIN_RATE ||
        rallyDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP)
    ) {
      const confidence = getConfidence(
        candidate.metric.denominator,
        ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE,
        rallyDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP,
      );
      const rallyLosses =
        candidate.ruleId === 'rally.short1To4.low'
          ? shortRallyLosses
          : candidate.ruleId === 'rally.medium5To8.low'
            ? lostPoints.filter((context) => context.rallyBucket === '5-8')
            : sortByRallyCountDesc(
                lostPoints.filter((context) => context.rallyBucket === '9+'),
              );

      addHint({
        ruleId: candidate.ruleId,
        category: 'rally',
        title: candidate.title,
        evidence: `${candidate.label}が ${formatRateForMessage(candidate.metric)} でした。`,
        evidenceItems: [
          `${candidate.label}: ${formatRateForMessage(candidate.metric)}`,
          `総ポイント取得率との差: ${rallyDrop.toFixed(1)}pt`,
        ],
        interpretation:
          'このラリー帯で点が動いた場面を見返すと、次の確認ポイントが見つかる可能性があります。',
        nextCheck: `${candidate.label}に含まれる失点場面を確認しましょう。`,
        nextCheckItems: candidate.nextCheckItems,
        confidence,
        confidenceReason: getConfidenceReason(
          confidence,
          candidate.metric.denominator,
          ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE,
        ),
        priorityScore:
          42 +
          Math.max(rallyDrop, 0) +
          Math.min(candidate.metric.denominator, 10),
        priorityReasons: [
          '総ポイント取得率との差を確認',
          isOneSidedLoss
            ? '全体的に苦しい試合の中でも落ち込みが大きい'
            : 'ラリー帯ごとの差が見やすい',
        ],
        reviewGroups: [
          buildReviewGroup(
            `${candidate.ruleId}.primary`,
            candidate.nextCheckItems[0],
            rallyLosses,
            `${candidate.label}の失点ポイントを絞り込めませんでした。`,
          ),
          buildReviewGroup(
            `${candidate.ruleId}.secondary`,
            candidate.nextCheckItems[1],
            candidate.ruleId === 'rally.long9Plus.low'
              ? sortByRallyCountDesc(rallyLosses)
              : rallyLosses.filter((context) =>
                  ERROR_RESULT_TYPES.has(context.point.result_type || ''),
                ),
            `${candidate.label}の終わり方を絞り込めませんでした。`,
          ),
        ],
        sourceMetrics: [
          buildMetric(candidate.metricKey, candidate.label, candidate.metric),
          buildMetric(
            'overall.pointWinRate',
            '総ポイント取得率',
            overallMetric,
          ),
        ],
      });
    }
  });

  const gamePointWinRate = metrics.keyMoments.gamePointWinRate;
  const gamePointDrop = getMetricDropFromOverall(
    gamePointWinRate,
    overallMetric,
  );
  if (
    gamePointWinRate.denominator > 0 &&
    ((gamePointWinRate.percentage ?? 100) <
      ANALYSIS_THRESHOLDS.LOW_GAME_POINT_CONVERSION ||
      gamePointDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP)
  ) {
    const confidence = getConfidence(
      gamePointWinRate.denominator,
      ANALYSIS_THRESHOLDS.MIN_GAME_POINT_SAMPLE,
      gamePointDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP,
    );

    addHint({
      ruleId: 'keyMoment.gamePointWinRate.low',
      category: 'key_moment',
      title: 'ゲームポイントの取り切りを確認',
      evidence: `自チームのゲームポイント取得率が ${formatRateForMessage(gamePointWinRate)} でした。`,
      evidenceItems: [
        `ゲームポイント取得率: ${formatRateForMessage(gamePointWinRate)}`,
        `デュースポイント取得率: ${formatRateForMessage(metrics.keyMoments.deucePointWinRate)}`,
      ],
      interpretation:
        'ゲームを取り切れる場面で、もう一度見る価値のあるポイントがあった可能性があります。',
      nextCheck:
        'ゲームポイントの前後で、先に攻めたか、相手に攻められたかを確認しましょう。',
      nextCheckItems: [
        '自チームのゲームポイント',
        'ゲームポイント直前のポイント',
        'デュースになった後の1本',
      ],
      confidence,
      confidenceReason: getConfidenceReason(
        confidence,
        gamePointWinRate.denominator,
        ANALYSIS_THRESHOLDS.MIN_GAME_POINT_SAMPLE,
      ),
      priorityScore:
        50 +
        Math.max(gamePointDrop, 0) +
        Math.min(gamePointWinRate.denominator, 8),
      priorityReasons: ['重要局面の確認価値が高い', '取り切りの場面を絞れる'],
      reviewGroups: [
        buildReviewGroup(
          'own-game-point-points',
          '自チームのゲームポイント',
          reconstructedPoints.filter(
            (context) => context.isGamePointOpportunity[team],
          ),
          '自チームのゲームポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'before-own-game-point',
          'ゲームポイント直前のポイント',
          getPointsBeforeContexts(
            reconstructedPoints,
            reconstructedPoints.filter(
              (context) => context.isGamePointOpportunity[team],
            ),
          ),
          'ゲームポイント直前のポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'after-own-game-point-loss',
          'デュースになった後の1本',
          getPointsAfterContexts(
            reconstructedPoints,
            reconstructedPoints.filter(
              (context) =>
                context.isGamePointOpportunity[team] &&
                context.point.winner_team === opponent,
            ),
          ),
          'ゲームポイントを落とした後のポイントを絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        buildMetric(
          'keyMoment.gamePointWinRate',
          'ゲームポイント取得率',
          gamePointWinRate,
        ),
        buildMetric(
          'keyMoment.deucePointWinRate',
          'デュースポイント取得率',
          metrics.keyMoments.deucePointWinRate,
        ),
      ],
    });
  }

  const opponentGamePointSaveRate = getOpponentGamePointSaveRate(
    team,
    reconstructedPoints,
  );
  if (
    opponentGamePointSaveRate.denominator > 0 &&
    (opponentGamePointSaveRate.percentage ?? 100) <
      ANALYSIS_THRESHOLDS.LOW_OPPONENT_GAME_POINT_SAVE_RATE
  ) {
    const confidence = getConfidence(
      opponentGamePointSaveRate.denominator,
      ANALYSIS_THRESHOLDS.MIN_GAME_POINT_SAMPLE,
      (opponentGamePointSaveRate.percentage ?? 100) < 25,
    );

    addHint({
      ruleId: 'keyMoment.opponentGamePointSaveRate.low',
      category: 'key_moment',
      title: '相手ゲームポイントでの粘りを確認',
      evidence: `相手ゲームポイントでの得点率が ${formatRateForMessage(opponentGamePointSaveRate)} でした。`,
      evidenceItems: [
        `相手ゲームポイント得点率: ${formatRateForMessage(opponentGamePointSaveRate)}`,
      ],
      interpretation:
        '相手にゲームポイントを握られた場面で、粘り切れなかった可能性があります。',
      nextCheck:
        '相手ゲームポイントで、守るだけになったか、先に仕掛けられたか確認しましょう。',
      nextCheckItems: [
        '相手ゲームポイントの入り',
        'レシーブ側かサーブ側か',
        '最後の失点の終わり方',
      ],
      confidence,
      confidenceReason: getConfidenceReason(
        confidence,
        opponentGamePointSaveRate.denominator,
        ANALYSIS_THRESHOLDS.MIN_GAME_POINT_SAMPLE,
      ),
      priorityScore:
        45 +
        Math.max(
          0,
          ANALYSIS_THRESHOLDS.LOW_OPPONENT_GAME_POINT_SAVE_RATE -
            (opponentGamePointSaveRate.percentage ?? 0),
        ) +
        Math.min(opponentGamePointSaveRate.denominator, 8),
      priorityReasons: [
        '相手ゲームポイントを分けて確認',
        '重要局面の見返しに向いている',
      ],
      reviewGroups: [
        buildReviewGroup(
          'opponent-game-point-points',
          '相手ゲームポイントの入り',
          reconstructedPoints.filter(
            (context) => context.isGamePointOpportunity[opponent],
          ),
          '相手ゲームポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'opponent-game-point-serve-receive',
          'レシーブ側かサーブ側か',
          reconstructedPoints.filter(
            (context) => context.isGamePointOpportunity[opponent],
          ),
          '相手ゲームポイントのサーブ/レシーブ情報を絞り込めませんでした。',
        ),
        buildReviewGroup(
          'opponent-game-point-lost-endings',
          '最後の失点の終わり方',
          reconstructedPoints.filter(
            (context) =>
              context.isGamePointOpportunity[opponent] &&
              context.point.winner_team === opponent,
          ),
          '相手ゲームポイントでの失点を絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        buildMetric(
          'keyMoment.opponentGamePointSaveRate',
          '相手ゲームポイント得点率',
          opponentGamePointSaveRate,
        ),
      ],
    });
  }

  if (
    metrics.momentum.maxStreakAgainst >= ANALYSIS_THRESHOLDS.LARGE_LOSS_STREAK
  ) {
    const segment = metrics.momentum.maxStreakAgainstSegment;
    const confidence = getConfidence(
      metrics.momentum.maxStreakAgainst,
      ANALYSIS_THRESHOLDS.LARGE_LOSS_STREAK,
      metrics.momentum.maxStreakAgainst >= 7,
    );
    const segmentStartPoint = segment
      ? getPointAt(
          reconstructedPoints,
          segment.startGameNumber,
          segment.startPointNumber,
        )
      : null;
    const segmentPoints = segment
      ? reconstructedPoints.filter(
          (context) =>
            (context.gameNumber > segment.startGameNumber ||
              (context.gameNumber === segment.startGameNumber &&
                context.pointNumber >= segment.startPointNumber)) &&
            (context.gameNumber < segment.endGameNumber ||
              (context.gameNumber === segment.endGameNumber &&
                context.pointNumber <= segment.endPointNumber)),
        )
      : [];
    const segmentAfterPoint = getPointAfterSegment(
      reconstructedPoints,
      segment,
    );

    addHint({
      ruleId: 'momentum.maxLostStreak.large',
      category: 'momentum',
      title: '連続失点の始まりを確認',
      evidence: `最大連続失点は ${metrics.momentum.maxStreakAgainst}点でした。`,
      evidenceItems: [
        `最大連続失点: ${metrics.momentum.maxStreakAgainst}点`,
        `該当区間: ${formatPointRange(segment)}`,
      ],
      interpretation:
        '流れが相手に傾いた区間があり、始まり方を見返す価値があります。',
      nextCheck:
        '連続失点が始まる直前と終わる直後のポイント内容を確認しましょう。',
      nextCheckItems: [
        '連続失点が始まる直前のポイント',
        '連続失点中のサーブ/レシーブ',
        '連続失点が止まったポイント',
      ],
      confidence,
      confidenceReason: getConfidenceReason(
        confidence,
        metrics.momentum.maxStreakAgainst,
        ANALYSIS_THRESHOLDS.LARGE_LOSS_STREAK,
      ),
      priorityScore: 54 + metrics.momentum.maxStreakAgainst * 3,
      priorityReasons: [
        '該当区間を特定できる',
        '次に確認するポイントを絞りやすい',
      ],
      reviewGroups: [
        buildReviewGroup(
          'before-lost-streak',
          '連続失点が始まる直前のポイント',
          segmentStartPoint
            ? getPointsBeforeContexts(reconstructedPoints, [segmentStartPoint])
            : [],
          '連続失点が始まる直前のポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'lost-streak-points',
          '連続失点中のサーブ/レシーブ',
          segmentPoints,
          '連続失点中のポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'after-lost-streak',
          '連続失点が止まったポイント',
          segmentAfterPoint ? [segmentAfterPoint] : [],
          '連続失点が止まったポイントを絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        {
          key: 'momentum.maxLostStreak',
          label: '最大連続失点',
          value: metrics.momentum.maxStreakAgainst,
          unit: 'points',
        },
      ],
    });
  }

  metrics.endings.errorBreakdown.slice(0, 2).forEach((entry) => {
    if (
      entry.count >= ANALYSIS_THRESHOLDS.ERROR_SHARE_COUNT &&
      (entry.share ?? 0) >= ANALYSIS_THRESHOLDS.ERROR_SHARE_RATE
    ) {
      const confidence = getConfidence(
        entry.count,
        ANALYSIS_THRESHOLDS.ERROR_SHARE_COUNT,
        (entry.share ?? 0) >= 55,
      );
      const label = RESULT_TYPE_LABELS[entry.resultType] ?? entry.resultType;
      const errorPoints = lostPoints.filter(
        (context) => context.point.result_type === entry.resultType,
      );
      const lostStreakSegment = metrics.momentum.maxStreakAgainstSegment;
      const errorPointsInLostStreak = lostStreakSegment
        ? errorPoints.filter(
            (context) =>
              (context.gameNumber > lostStreakSegment.startGameNumber ||
                (context.gameNumber === lostStreakSegment.startGameNumber &&
                  context.pointNumber >= lostStreakSegment.startPointNumber)) &&
              (context.gameNumber < lostStreakSegment.endGameNumber ||
                (context.gameNumber === lostStreakSegment.endGameNumber &&
                  context.pointNumber <= lostStreakSegment.endPointNumber)),
          )
        : [];

      addHint({
        ruleId: `error.resultTypeShare.${entry.resultType}`,
        category: 'error_trend',
        title: `${label}の終わり方を確認`,
        evidence: `${label}が自チームエラーの ${formatPercentage(entry.share) ?? '0%'} を占めていました。`,
        evidenceItems: [
          `${label}: ${entry.count}件`,
          `自チームエラー内の比率: ${formatPercentage(entry.share) ?? '0%'}`,
        ],
        interpretation:
          'この試合では、同じ終わり方の失点がややまとまっていた可能性があります。',
        nextCheck:
          '同じミスが出た場面で、直前のボールや立ち位置を確認しましょう。',
        nextCheckItems: [
          `${label}が出た直前の1本`,
          'サーブ側で出たミス',
          'レシーブ側で出たミス',
          '連続失点の中で出たミス',
        ],
        confidence,
        confidenceReason: getConfidenceReason(
          confidence,
          entry.count,
          ANALYSIS_THRESHOLDS.ERROR_SHARE_COUNT,
        ),
        priorityScore: 40 + (entry.share ?? 0) / 2 + entry.count * 3,
        priorityReasons: [
          '失点の終わり方に偏りがある',
          '次の試合で記録確認しやすい',
        ],
        reviewGroups: [
          buildReviewGroup(
            `${entry.resultType}-actual-points`,
            `${label}が出た直前の1本`,
            getPointsBeforeContexts(reconstructedPoints, errorPoints),
            `${label}が出たポイントを絞り込めませんでした。`,
          ),
          buildReviewGroup(
            `${entry.resultType}-serving-side`,
            'サーブ側で出たミス',
            errorPoints.filter(
              (context) => context.point.serving_team === team,
            ),
            `${label}がサーブ側で出たポイントを絞り込めませんでした。`,
          ),
          buildReviewGroup(
            `${entry.resultType}-receiving-side`,
            'レシーブ側で出たミス',
            errorPoints.filter(
              (context) => context.point.serving_team === opponent,
            ),
            `${label}がレシーブ側で出たポイントを絞り込めませんでした。`,
          ),
          buildReviewGroup(
            `${entry.resultType}-lost-streak`,
            '連続失点の中で出たミス',
            errorPointsInLostStreak,
            `${label}が最大連続失点の区間で出たポイントを絞り込めませんでした。`,
          ),
        ],
        sourceMetrics: [
          {
            key: 'error.resultTypeShare',
            label: `${label}比率`,
            value: entry.share !== null ? Number(entry.share.toFixed(1)) : '--',
            numerator: entry.count,
            denominator: metrics.endings.errors,
            unit: '%',
          },
        ],
      });
    }
  });

  const dominantLoser = getDominantLoserPlayer(
    match,
    team,
    reconstructedPoints,
  );
  if (dominantLoser) {
    const confidence = getConfidence(
      dominantLoser.count,
      ANALYSIS_THRESHOLDS.INDIVIDUAL_ERROR_SHARE_COUNT,
      dominantLoser.share >= 70,
    );
    const dominantLoserPoints = lostPoints.filter(
      (context) =>
        ERROR_RESULT_TYPES.has(context.point.result_type || '') &&
        normalizeRecordedPlayerName(context.point.loser_player) ===
          dominantLoser.playerName,
    );

    addHint({
      ruleId: 'error.loserPlayerShare.high',
      category: 'error_trend',
      playerName: dominantLoser.playerName,
      title: '失点の終点になった場面を確認',
      evidence: `${dominantLoser.playerName} が失点の終点として ${dominantLoser.count}件記録されていました。`,
      evidenceItems: [
        `記録された失点終点: ${dominantLoser.count}件`,
        `既知の自チームエラー内比率: ${dominantLoser.share.toFixed(1)}%`,
      ],
      interpretation:
        '個人の責任ではなく、ペアとしてその選手に最後のボールが集まった可能性があります。',
      nextCheck:
        'その選手の前の1本と、ペアの配置・役割を一緒に確認しましょう。',
      nextCheckItems: [
        '失点直前にどちらが触ったか',
        'ペアの立ち位置',
        '同じ形で狙われていないか',
      ],
      confidence,
      confidenceReason: getConfidenceReason(
        confidence,
        dominantLoser.count,
        ANALYSIS_THRESHOLDS.INDIVIDUAL_ERROR_SHARE_COUNT,
      ),
      priorityScore: 38 + dominantLoser.share / 2 + dominantLoser.count * 3,
      priorityReasons: [
        'ダブルスでは個人責任ではなく配置確認として扱う',
        '失点終点の偏りがある',
      ],
      reviewGroups: [
        buildReviewGroup(
          'dominant-loser-touches',
          '失点直前にどちらが触ったか',
          getPointsBeforeContexts(reconstructedPoints, dominantLoserPoints),
          '該当選手が失点終点になったポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'dominant-loser-position',
          'ペアの立ち位置',
          dominantLoserPoints,
          'ペアの立ち位置を確認するポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'dominant-loser-pattern',
          '同じ形で狙われていないか',
          dominantLoserPoints,
          '同じ形を確認するポイントを絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        {
          key: 'error.loserPlayerShare',
          label: '失点終点の比率',
          value: Number(dominantLoser.share.toFixed(1)),
          numerator: dominantLoser.count,
          denominator: dominantLoser.totalKnownErrors,
          unit: '%',
        },
      ],
    });
  }

  return hints
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .slice(0, 3);
};

const buildGuideCards = (
  metrics: TeamAnalysisMetrics,
  opponentMetrics: TeamAnalysisMetrics,
  reconstructedPoints: ReconstructedPointContext[],
): TeamGuideSummary => {
  const reliabilityMessage = (reliability: AnalysisReliability) =>
    getReliabilitySummary(reliability);

  const serviceReliability = getRateReliability(
    metrics.service.firstServePointWinRate,
  );
  const serviceSummary =
    reliabilityMessage(serviceReliability) ??
    ((metrics.service.firstServePointWinRate.percentage ?? 0) >=
    ANALYSIS_THRESHOLDS.STRONG_FIRST_SERVE_POINT_WIN_RATE
      ? 'サーブから点につながる場面が目立ちました。'
      : (metrics.service.firstServePointWinRate.percentage ?? 0) < 45
        ? '1stサーブ後の展開を見返す手がかりになります。'
        : 'サーブからの入り方を確認する手がかりになります。');

  const keyMomentReliability = getRateReliability(
    metrics.keyMoments.gamePointWinRate,
    ANALYSIS_THRESHOLDS.MIN_GAME_POINT_SAMPLE,
  );
  const keyMomentSummary =
    reliabilityMessage(keyMomentReliability) ??
    ((metrics.keyMoments.gamePointWinRate.percentage ?? 0) >= 50
      ? '大事な場面で取り切る場面が見られました。'
      : '大事な場面の取り切りを見返す手がかりになります。');

  const momentumReliability = getPresenceReliability(
    reconstructedPoints.length,
  );
  const momentumSegment = metrics.momentum.maxStreakAgainstSegment;
  const momentumRange = momentumSegment
    ? `第${momentumSegment.startGameNumber}〜第${momentumSegment.endGameNumber}ゲーム`
    : '該当区間なし';
  const momentumSummary =
    reliabilityMessage(momentumReliability) ??
    (metrics.momentum.maxStreakAgainst >= ANALYSIS_THRESHOLDS.LARGE_LOSS_STREAK
      ? '連続失点が流れの確認ポイントになりそうです。'
      : '流れが止まった場面を見返す手がかりになります。');

  const shortRallyMetric = combineRateMetrics(
    metrics.rally.buckets['1-2'],
    metrics.rally.buckets['3-4'],
  );
  const veryShortRallyMetric = metrics.rally.buckets['1-2'];
  const midShortRallyMetric = metrics.rally.buckets['3-4'];
  const midLongRallyMetric = metrics.rally.buckets['5-8'];
  const longRallyMetric = metrics.rally.buckets['9+'];
  const rallyReliability =
    shortRallyMetric.denominator === 0 && longRallyMetric.denominator === 0
      ? 'none'
      : shortRallyMetric.denominator >= ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE &&
          longRallyMetric.denominator >= ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE
        ? 'ok'
        : 'low';
  const rallyGap =
    shortRallyMetric.percentage !== null && longRallyMetric.percentage !== null
      ? shortRallyMetric.percentage - longRallyMetric.percentage
      : null;
  const rallySummary =
    reliabilityMessage(rallyReliability) ??
    (rallyGap !== null && rallyGap >= 10
      ? '短いラリーで点につながる場面が目立ちました。'
      : rallyGap !== null && rallyGap <= -10
        ? '長いラリーで点につながる場面が目立ちました。'
        : 'ラリーの長さごとの差を見返す手がかりになります。');

  const winnerPoints = metrics.endings.winners;
  const opponentErrorPoints = opponentMetrics.endings.errors;
  const endingReliability = getPresenceReliability(reconstructedPoints.length);
  const endingSummary =
    reliabilityMessage(endingReliability) ??
    (winnerPoints >= opponentErrorPoints + 3
      ? '自分たちから決める形が目立ちました。'
      : opponentErrorPoints >= winnerPoints + 3
        ? '相手のミスで取る場面が目立ちました。'
        : '決めた点と相手ミスの点が近い内容でした。');

  return {
    cards: [
      {
        id: 'service_to_points',
        title: 'サービスから点につながったか',
        primaryValue:
          serviceReliability === 'none'
            ? '--'
            : formatPrimaryPercentage(metrics.service.firstServePointWinRate),
        secondaryValue:
          serviceReliability === 'none'
            ? undefined
            : `1stサーブ時得点率 (${metrics.service.firstServePointWinRate.numerator}/${
                metrics.service.firstServePointWinRate.denominator
              })`,
        reliability: serviceReliability,
        summary: serviceSummary,
        description:
          '1stサーブが入った場面で、どれだけ点につながったかを見る数字です。',
        howToRead:
          '高いほど、サーブから主導権を取りやすかった可能性があります。低いときは、1stサーブでの失点も一緒に見返します。',
        nextCheck:
          '1stサーブが入った後に、どこで相手に押し返されたかを確認します。',
        whyItMatters:
          'サーブは毎ポイントの入り口なので、試合全体の流れを見返す出発点になります。',
        details: [
          {
            label: '1stサーブ成功率',
            value: formatRateForMessage(metrics.service.firstServeSuccessRate),
          },
          {
            label: '2ndサーブ時得点率',
            value: formatRateForMessage(
              metrics.service.secondServePointWinRate,
            ),
          },
          {
            label: 'ダブルフォルト数',
            value: `${metrics.service.doubleFaultCount}件`,
          },
        ],
      },
      {
        id: 'key_moments',
        title: '大事な場面で点を取れたか',
        primaryValue:
          keyMomentReliability === 'none'
            ? '--'
            : formatPrimaryPercentage(metrics.keyMoments.gamePointWinRate),
        secondaryValue:
          keyMomentReliability === 'none'
            ? undefined
            : `ゲームポイント取得率 (${metrics.keyMoments.gamePointWinRate.numerator}/${metrics.keyMoments.gamePointWinRate.denominator})`,
        reliability: keyMomentReliability,
        summary: keyMomentSummary,
        description:
          'ゲームを取り切れる場面で、実際に点を取れたかを見る数字です。',
        howToRead:
          'ここが高いと、終盤の1本を取り切れた場面が多かったと見られます。',
        nextCheck:
          'ゲームポイントの前後で、どの配球やミスが続いたかを確認します。',
        whyItMatters:
          '同じ得点数でも、終盤の1本はゲームの流れを大きく動かします。',
        details: [
          {
            label: '各ゲーム1ポイント目取得率',
            value: formatRateForMessage(metrics.keyMoments.firstPointWinRate),
          },
          {
            label: '2-2局面取得率',
            value: formatRateForMessage(metrics.keyMoments.twoTwoPointWinRate),
          },
          {
            label: 'デュースポイント取得率',
            value: formatRateForMessage(metrics.keyMoments.deucePointWinRate),
          },
          {
            label: 'ゲームポイント取得率',
            value: formatRateForMessage(metrics.keyMoments.gamePointWinRate),
          },
        ],
      },
      {
        id: 'momentum',
        title: 'どこで流れが悪くなったか',
        primaryValue:
          momentumReliability === 'none'
            ? '--'
            : formatCount(metrics.momentum.maxStreakAgainst),
        secondaryValue:
          momentumReliability === 'none'
            ? undefined
            : `最大連続失点 (${momentumRange})`,
        reliability: momentumReliability,
        summary: momentumSummary,
        description:
          '続けて失点した一番長い区間を見て、流れが止まった場面を探します。',
        howToRead:
          '連続失点が長いほど、その前後の入り方や判断を見返す手がかりになります。',
        nextCheck:
          '連続失点が始まる直前と終わる直後のポイント内容を確認します。',
        whyItMatters:
          '流れが変わる場面をつかむと、次回の振り返りで見る順番がはっきりします。',
        details: [
          {
            label: '最大連続失点',
            value:
              momentumReliability === 'none'
                ? 'データ不足'
                : `${metrics.momentum.maxStreakAgainst}点`,
          },
          {
            label: '該当区間',
            value: momentumRange,
          },
          {
            label: '最大連続得点',
            value: `${metrics.momentum.maxStreakFor}点`,
          },
        ],
      },
      {
        id: 'rally_profile',
        title: '短いラリー・長いラリーのどちらが得意だったか',
        primaryValue:
          rallyReliability === 'none'
            ? '--'
            : `${formatPrimaryPercentage(shortRallyMetric)} / ${formatPrimaryPercentage(longRallyMetric)}`,
        secondaryValue:
          rallyReliability === 'none' ? undefined : '1-4本ラリー / 長いラリー',
        reliability: rallyReliability,
        summary: rallySummary,
        description:
          '短いラリーと長いラリーで、どちらが点につながりやすかったかを見るカードです。',
        howToRead:
          '短いラリーは入りや決め切り、長いラリーは粘りや組み立ての傾向を見るのに役立ちます。',
        nextCheck:
          '短いラリーで終わった点と長いラリーで終わった点を1本ずつ見比べます。',
        whyItMatters:
          'どの長さのラリーで点が動いたかが分かると、試合の型を振り返りやすくなります。',
        details: [
          {
            label: '1-2本ラリー得点率',
            value: formatRateForMessage(veryShortRallyMetric),
          },
          {
            label: '短いラリー合算得点率 (1-4本)',
            value: formatRateForMessage(shortRallyMetric),
          },
          {
            label: '3-4本ラリー得点率',
            value: formatRateForMessage(midShortRallyMetric),
          },
          {
            label: '5-8本ラリー得点率',
            value: formatRateForMessage(midLongRallyMetric),
          },
          {
            label: '9本以上ラリー得点率',
            value: formatRateForMessage(longRallyMetric),
          },
        ],
      },
      {
        id: 'point_endings',
        title: 'ポイントがどう終わったか',
        primaryValue:
          endingReliability === 'none'
            ? '--'
            : `${winnerPoints}件 / ${opponentErrorPoints}件`,
        secondaryValue:
          endingReliability === 'none' ? undefined : 'ウィナー / 相手ミス',
        reliability: endingReliability,
        summary: endingSummary,
        description:
          '取った点が、決めた形だったか相手のミスだったかを見分けるためのカードです。',
        howToRead:
          '両方の比率を見ると、どの形で点が終わりやすかったかをざっくり確認できます。',
        nextCheck:
          '自分たちのミス内訳もあわせて見て、どこを見返すかを絞ります。',
        whyItMatters:
          'ポイントの終わり方は、試合の傾向を短時間で振り返る入口になります。',
        details: [
          {
            label: 'ウィナー数',
            value: `${winnerPoints}件`,
          },
          {
            label: '相手ミスで取った点数',
            value: `${opponentErrorPoints}件`,
          },
          ...(metrics.endings.errorBreakdown.length > 0
            ? metrics.endings.errorBreakdown.slice(0, 3).map((entry) => ({
                label: `自チームの確認ポイント: ${entry.resultType}`,
                value: `${entry.count}件`,
              }))
            : [
                {
                  label: '自チームの確認ポイント',
                  value: '大きく偏った項目はありません。',
                },
              ]),
        ],
      },
    ],
  };
};

export const analyzeMatch = (match: Match): MatchAnalysisSummary => {
  const sortedGames = [...(match.games ?? [])].sort(
    (left, right) => left.game_number - right.game_number,
  );

  const reconstructedPoints: ReconstructedPointContext[] = [];
  const mismatches: MatchAnalysisSummary['scoreIntegrity']['mismatches'] = [];
  let gamesWonA = 0;
  let gamesWonB = 0;

  sortedGames.forEach((game) => {
    const pointsToWin = getPointsToWinForGame(
      match.best_of,
      gamesWonA,
      gamesWonB,
    );
    const sortedPoints = [...(game.points ?? [])].sort(
      (left, right) => left.point_number - right.point_number,
    );

    let scoreA = 0;
    let scoreB = 0;

    sortedPoints.forEach((point, index) => {
      const scoreBefore = { A: scoreA, B: scoreB };
      const isGamePointOpportunity = {
        A: isWinningScore(scoreA + 1, scoreB, pointsToWin),
        B: isWinningScore(scoreB + 1, scoreA, pointsToWin),
      };

      if (point.winner_team === 'A') {
        scoreA += 1;
      } else if (point.winner_team === 'B') {
        scoreB += 1;
      }

      reconstructedPoints.push({
        point,
        gameNumber: game.game_number,
        pointNumber: point.point_number,
        pointsToWin,
        scoreBefore,
        scoreAfter: { A: scoreA, B: scoreB },
        isFirstPointOfGame: index === 0,
        isTwoTwoPoint: scoreBefore.A === 2 && scoreBefore.B === 2,
        isDeucePoint: isDeuceScore(scoreBefore.A, scoreBefore.B, pointsToWin),
        isGamePointOpportunity,
        isGameWinningPoint:
          isWinningScore(scoreA, scoreB, pointsToWin) ||
          isWinningScore(scoreB, scoreA, pointsToWin),
        rallyBucket: getRallyBucket(point),
      });
    });

    const actualWinner =
      scoreA > scoreB
        ? ('A' as TeamKey)
        : scoreB > scoreA
          ? ('B' as TeamKey)
          : null;
    const expectedWinner = (game.winner_team as TeamKey | null) ?? null;

    if (
      scoreA !== (game.points_a ?? 0) ||
      scoreB !== (game.points_b ?? 0) ||
      actualWinner !== expectedWinner
    ) {
      mismatches.push({
        gameNumber: game.game_number,
        expected: {
          pointsA: game.points_a ?? 0,
          pointsB: game.points_b ?? 0,
          winner: expectedWinner,
        },
        actual: {
          pointsA: scoreA,
          pointsB: scoreB,
          winner: actualWinner,
        },
      });
    }

    if (actualWinner === 'A') gamesWonA += 1;
    if (actualWinner === 'B') gamesWonB += 1;
  });

  const segments = buildMomentumSegments(reconstructedPoints);
  const totalPoints = reconstructedPoints.length;

  const neutralComparison = (['A', 'B'] as TeamKey[]).reduce((acc, team) => {
    const opponent = getOppositeTeam(team);
    const servedPoints = reconstructedPoints.filter(
      (context) => context.point.serving_team === team,
    );
    const firstServePoints = servedPoints.filter(
      (context) => !context.point.first_serve_fault,
    );
    const secondServePoints = servedPoints.filter(
      (context) => context.point.first_serve_fault,
    );
    const receivePoints = reconstructedPoints.filter(
      (context) => context.point.serving_team === opponent,
    );
    const firstPointPoints = reconstructedPoints.filter(
      (context) => context.isFirstPointOfGame,
    );
    const twoTwoPoints = reconstructedPoints.filter(
      (context) => context.isTwoTwoPoint,
    );
    const deucePoints = reconstructedPoints.filter(
      (context) => context.isDeucePoint,
    );
    const gamePointPoints = reconstructedPoints.filter(
      (context) => context.isGamePointOpportunity[team],
    );
    const rallyPoints = reconstructedPoints.filter(
      (context) => !context.point.double_fault,
    );

    const rallyBuckets = RALLY_BUCKET_ORDER.reduce(
      (bucketAcc, bucket) => {
        const bucketPoints = rallyPoints.filter(
          (context) => context.rallyBucket === bucket,
        );
        bucketAcc[bucket] = createRate(
          bucketPoints.filter((context) => context.point.winner_team === team)
            .length,
          bucketPoints.length,
        );
        return bucketAcc;
      },
      {} as Record<RallyBucket, RateMetric>,
    );

    const errorCounts = new Map<string, number>();
    let winners = 0;
    let errors = 0;

    reconstructedPoints.forEach((context) => {
      const resultType = context.point.result_type || '';
      if (
        WINNER_RESULT_TYPES.has(resultType) &&
        context.point.winner_team === team
      ) {
        winners += 1;
      }

      if (
        ERROR_RESULT_TYPES.has(resultType) &&
        context.point.winner_team === opponent
      ) {
        errors += 1;
        errorCounts.set(resultType, (errorCounts.get(resultType) ?? 0) + 1);
      }
    });

    const errorBreakdown = [...errorCounts.entries()]
      .map(([resultType, count]) => ({
        resultType,
        count,
        share: errors > 0 ? (count / errors) * 100 : null,
      }))
      .sort((left, right) => right.count - left.count);

    const maxStreakForSegment =
      segments
        .filter((segment) => segment.team === team)
        .sort((left, right) => right.length - left.length)[0] ?? null;
    const maxStreakAgainstSegment =
      segments
        .filter((segment) => segment.team === opponent)
        .sort((left, right) => right.length - left.length)[0] ?? null;

    acc[team] = {
      overallPointWinRate: createRate(
        reconstructedPoints.filter(
          (context) => context.point.winner_team === team,
        ).length,
        totalPoints,
      ),
      service: {
        firstServeSuccessRate: createRate(
          firstServePoints.length,
          servedPoints.length,
        ),
        firstServePointWinRate: createRate(
          firstServePoints.filter(
            (context) => context.point.winner_team === team,
          ).length,
          firstServePoints.length,
        ),
        secondServePointWinRate: createRate(
          secondServePoints.filter(
            (context) => context.point.winner_team === team,
          ).length,
          secondServePoints.length,
        ),
        doubleFaultCount: servedPoints.filter(
          (context) => context.point.double_fault,
        ).length,
      },
      receive: {
        pointWinRate: createRate(
          receivePoints.filter((context) => context.point.winner_team === team)
            .length,
          receivePoints.length,
        ),
      },
      keyMoments: {
        firstPointWinRate: createRate(
          firstPointPoints.filter(
            (context) => context.point.winner_team === team,
          ).length,
          firstPointPoints.length,
        ),
        twoTwoPointWinRate: createRate(
          twoTwoPoints.filter((context) => context.point.winner_team === team)
            .length,
          twoTwoPoints.length,
        ),
        deucePointWinRate: createRate(
          deucePoints.filter((context) => context.point.winner_team === team)
            .length,
          deucePoints.length,
        ),
        gamePointWinRate: createRate(
          gamePointPoints.filter(
            (context) => context.point.winner_team === team,
          ).length,
          gamePointPoints.length,
        ),
      },
      rally: {
        buckets: rallyBuckets,
      },
      momentum: {
        maxStreakFor: maxStreakForSegment?.length ?? 0,
        maxStreakAgainst: maxStreakAgainstSegment?.length ?? 0,
        maxStreakForSegment,
        maxStreakAgainstSegment,
      },
      endings: {
        winners,
        errors,
        errorBreakdown,
      },
    };

    return acc;
  }, {} as NeutralComparisonMetrics);

  return {
    reconstructedPoints,
    neutralComparison,
    teamInsights: {
      A: buildTeamInsights('A', neutralComparison.A),
      B: buildTeamInsights('B', neutralComparison.B),
    },
    teamGuideCards: {
      A: buildGuideCards(
        neutralComparison.A,
        neutralComparison.B,
        reconstructedPoints,
      ),
      B: buildGuideCards(
        neutralComparison.B,
        neutralComparison.A,
        reconstructedPoints,
      ),
    },
    improvementHints: {
      A: buildImprovementHints(
        match,
        'A',
        neutralComparison.A,
        reconstructedPoints,
      ),
      B: buildImprovementHints(
        match,
        'B',
        neutralComparison.B,
        reconstructedPoints,
      ),
    },
    scoreIntegrity: {
      ok: mismatches.length === 0,
      mismatches,
    },
  };
};
