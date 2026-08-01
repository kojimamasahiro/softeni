import type { Match, Point } from '@/types/database';

import {
  ANALYSIS_THRESHOLDS,
  type AnalysisReliability,
  type ImprovementHint,
  type ImprovementHintConfidence,
  type ImprovementHintReviewGroup,
  type ImprovementHintReviewPoint,
  type ImprovementHintSourceMetric,
  type ImprovementHintSourceMetricKey,
  type MomentumSegment,
  type RallyBucket,
  type RateMetric,
  type ReconstructedPointContext,
  type TeamKey,
} from './types';

export const WINNER_RESULT_TYPES = new Set(['smash_winner', 'volley_winner', 'passing_winner', 'drop_winner', 'net_in_winner', 'service_ace', 'winner']);

export const ERROR_RESULT_TYPES = new Set([
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

export const RALLY_BUCKET_ORDER: RallyBucket[] = ['1-2', '3-4', '5-8', '9+', 'unknown'];

export const getOppositeTeam = (team: TeamKey): TeamKey => (team === 'A' ? 'B' : 'A');

export const createRate = (numerator: number, denominator: number): RateMetric => ({
  numerator,
  denominator,
  percentage: denominator > 0 ? (numerator / denominator) * 100 : null,
});

export const combineRateMetrics = (...metrics: RateMetric[]): RateMetric =>
  createRate(
    metrics.reduce((sum, metric) => sum + metric.numerator, 0),
    metrics.reduce((sum, metric) => sum + metric.denominator, 0),
  );

export const getRateReliability = (metric: RateMetric, minSample: number = ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE): AnalysisReliability => {
  if (metric.denominator === 0) return 'none';
  if (metric.denominator < minSample) return 'low';
  return 'ok';
};

export const getPresenceReliability = (count: number): AnalysisReliability => (count > 0 ? 'ok' : 'none');

export const isDeuceScore = (scoreA: number, scoreB: number, pointsToWin: number) => scoreA === scoreB && scoreA >= pointsToWin - 1;

export const getRallyBucket = (point: Pick<Point, 'rally_count' | 'double_fault'>): RallyBucket => {
  if (point.double_fault) return 'unknown';
  if (point.rally_count === null || point.rally_count === undefined) {
    return 'unknown';
  }
  if (point.rally_count <= 2) return '1-2';
  if (point.rally_count <= 4) return '3-4';
  if (point.rally_count <= 8) return '5-8';
  return '9+';
};

export const formatPercentage = (value: number | null) => {
  if (value === null) return null;
  return `${value.toFixed(1)}%`;
};

export const formatRateForMessage = (metric: RateMetric) => {
  const percentage = formatPercentage(metric.percentage);
  if (!percentage) return `${metric.numerator}/${metric.denominator}`;
  return `${percentage} (${metric.numerator}/${metric.denominator})`;
};

export const formatPrimaryPercentage = (metric: RateMetric) => {
  if (metric.percentage === null) return '--';
  return `${metric.percentage.toFixed(0)}%`;
};

export const formatCount = (value: number) => `${value}点`;

export const getReliabilitySummary = (reliability: AnalysisReliability) => {
  if (reliability === 'low') {
    return '対象ポイントが少ないため、ここは参考値です。';
  }
  if (reliability === 'none') {
    return '対象ポイントがないため、ここはまだ確認できません。';
  }
  return null;
};

export const buildMomentumSegments = (points: ReconstructedPointContext[]): MomentumSegment[] => {
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

export const buildTeamInsights = (team: TeamKey, metrics: import('./types').TeamAnalysisMetrics): import('./types').TeamPerspectiveInsights => {
  const strongSignals: string[] = [];
  const improvementCandidates: string[] = [];
  const followUpPoints: string[] = [];

  if (
    metrics.service.firstServePointWinRate.denominator >= ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE &&
    (metrics.service.firstServePointWinRate.percentage ?? 0) >= ANALYSIS_THRESHOLDS.STRONG_FIRST_SERVE_POINT_WIN_RATE
  ) {
    strongSignals.push(`1stサーブ時得点率が ${formatRateForMessage(metrics.service.firstServePointWinRate)} でした。`);
  }

  if (
    metrics.service.secondServePointWinRate.denominator >= ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE &&
    (metrics.service.secondServePointWinRate.percentage ?? 100) < ANALYSIS_THRESHOLDS.LOW_SECOND_SERVE_POINT_WIN_RATE
  ) {
    improvementCandidates.push(`2ndサーブ時得点率は ${formatRateForMessage(metrics.service.secondServePointWinRate)} でした。`);
    followUpPoints.push(`2ndサーブ時得点率が ${formatRateForMessage(metrics.service.secondServePointWinRate)} で低めです。`);
  }

  const longRallyMetric = metrics.rally.buckets['9+'];
  const overallMetric = metrics.overallPointWinRate;
  if (
    longRallyMetric.denominator >= ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE &&
    longRallyMetric.percentage !== null &&
    overallMetric.percentage !== null &&
    longRallyMetric.percentage <= overallMetric.percentage - ANALYSIS_THRESHOLDS.LONG_RALLY_DROP_GAP
  ) {
    improvementCandidates.push(`9本以上ラリー得点率は ${formatRateForMessage(longRallyMetric)} で、全体得点率との差が大きめです。`);
    followUpPoints.push(`9本以上ラリー得点率が全体得点率より ${(overallMetric.percentage - longRallyMetric.percentage).toFixed(1)}pt 低く出ています。`);
  }

  if (
    metrics.keyMoments.gamePointWinRate.denominator >= ANALYSIS_THRESHOLDS.MIN_GAME_POINT_SAMPLE &&
    (metrics.keyMoments.gamePointWinRate.percentage ?? 100) < ANALYSIS_THRESHOLDS.LOW_GAME_POINT_CONVERSION
  ) {
    improvementCandidates.push(`ゲームポイント取得率は ${formatRateForMessage(metrics.keyMoments.gamePointWinRate)} でした。`);
    followUpPoints.push(`ゲームポイント取得率が ${formatRateForMessage(metrics.keyMoments.gamePointWinRate)} で、取り切りの確認余地があります。`);
  }

  if (metrics.momentum.maxStreakAgainst >= ANALYSIS_THRESHOLDS.LARGE_LOSS_STREAK) {
    const segment = metrics.momentum.maxStreakAgainstSegment;
    const segmentLabel = segment ? ` (第${segment.startGameNumber}〜第${segment.endGameNumber}ゲーム)` : '';
    followUpPoints.push(`最大連続失点は ${metrics.momentum.maxStreakAgainst}点${segmentLabel} でした。`);
  }

  metrics.endings.errorBreakdown.forEach((entry) => {
    if (entry.count >= ANALYSIS_THRESHOLDS.ERROR_SHARE_COUNT && (entry.share ?? 0) >= ANALYSIS_THRESHOLDS.ERROR_SHARE_RATE) {
      improvementCandidates.push(`${entry.resultType} が自チームエラーの ${formatPercentage(entry.share) ?? '0%'} を占めています。`);
      followUpPoints.push(`${entry.resultType} が ${entry.count}件で、自チームエラー内の比率が高めです。`);
    }
  });

  return {
    strongSignals,
    improvementCandidates,
    followUpPoints,
  };
};

export const IMPROVEMENT_HINT_RULE_VERSION = 'single-match-v1';
export const RESULT_TYPE_LABELS: Record<string, string> = {
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

export const normalizeRecordedPlayerName = (name: string | null | undefined) => {
  if (!name) return null;

  const trimmed = name.trim();
  const uniqueIdMatch = trimmed.match(/^[AB]-\d-(.+)$/);
  return (uniqueIdMatch?.[1] ?? trimmed).replace(/\s+/g, ' ');
};

export const getTeamPlayersFromMatch = (match: Match, team: TeamKey) => {
  const structuredPlayers = match.teams?.[team]?.players
    ?.map((player) => normalizeRecordedPlayerName(`${player.last_name} ${player.first_name}`))
    .filter((player): player is string => Boolean(player));

  if (structuredPlayers && structuredPlayers.length > 0) {
    return structuredPlayers;
  }

  const prefix = `team_${team.toLowerCase()}`;
  const players = [1, 2]
    .map((playerIndex) => {
      const lastName = match[`${prefix}_player${playerIndex}_last_name` as keyof Match] as string | null | undefined;
      const firstName = match[`${prefix}_player${playerIndex}_first_name` as keyof Match] as string | null | undefined;

      if (!lastName || !firstName) return null;
      return normalizeRecordedPlayerName(`${lastName} ${firstName}`);
    })
    .filter((player): player is string => Boolean(player));

  return players;
};

export const getHintTarget = (match: Match, team: TeamKey, playerName?: string): ImprovementHint['target'] => {
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

export const getConfidence = (sampleSize: number, minSample: number, isStrongSignal: boolean): ImprovementHintConfidence => {
  if (sampleSize < minSample) return 'low';
  if (isStrongSignal && sampleSize >= minSample * 2) return 'high';
  return 'medium';
};

export const getConfidenceReason = (confidence: ImprovementHintConfidence, sampleSize: number, minSample: number) => {
  if (confidence === 'low') {
    return `対象ポイントが${sampleSize}件で目安の${minSample}件に届かないため、参考として確認してください。`;
  }
  if (confidence === 'high') {
    return `対象ポイントが${sampleSize}件あり、差も大きいため注目して確認しやすい項目です。`;
  }
  return `対象ポイントが${sampleSize}件あり、次の試合で確認しやすい項目です。`;
};

export const getMetricDropFromOverall = (metric: RateMetric, overallMetric: RateMetric) => {
  if (metric.percentage === null || overallMetric.percentage === null) return 0;
  return overallMetric.percentage - metric.percentage;
};

export const formatPointRange = (segment: MomentumSegment | null) => {
  if (!segment) return '該当区間なし';
  if (segment.startGameNumber === segment.endGameNumber) {
    return `第${segment.startGameNumber}ゲーム #${segment.startPointNumber}〜#${segment.endPointNumber}`;
  }
  return `第${segment.startGameNumber}ゲーム #${segment.startPointNumber}〜第${segment.endGameNumber}ゲーム #${segment.endPointNumber}`;
};

export const getOpponentGamePointSaveRate = (team: TeamKey, reconstructedPoints: ReconstructedPointContext[]) => {
  const opponent = getOppositeTeam(team);
  const opponentGamePointPoints = reconstructedPoints.filter((context) => context.isGamePointOpportunity[opponent]);

  return createRate(opponentGamePointPoints.filter((context) => context.point.winner_team === team).length, opponentGamePointPoints.length);
};

export const getDominantLoserPlayer = (match: Match, team: TeamKey, reconstructedPoints: ReconstructedPointContext[]) => {
  const teamPlayers = new Set(getTeamPlayersFromMatch(match, team));
  if (teamPlayers.size <= 1) return null;

  const counts = new Map<string, number>();
  let totalKnownErrors = 0;

  reconstructedPoints.forEach((context) => {
    const resultType = context.point.result_type || '';
    const loserPlayer = normalizeRecordedPlayerName(context.point.loser_player);
    if (context.point.winner_team === getOppositeTeam(team) && ERROR_RESULT_TYPES.has(resultType) && loserPlayer && teamPlayers.has(loserPlayer)) {
      totalKnownErrors += 1;
      counts.set(loserPlayer, (counts.get(loserPlayer) ?? 0) + 1);
    }
  });

  const [topPlayer, topCount] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];

  if (!topPlayer || !topCount || totalKnownErrors === 0) return null;

  const share = (topCount / totalKnownErrors) * 100;
  if (topCount < ANALYSIS_THRESHOLDS.INDIVIDUAL_ERROR_SHARE_COUNT || share < ANALYSIS_THRESHOLDS.INDIVIDUAL_ERROR_SHARE_RATE) {
    return null;
  }

  return {
    playerName: topPlayer,
    count: topCount,
    totalKnownErrors,
    share,
  };
};

export const buildMetric = (key: ImprovementHintSourceMetricKey, label: string, metric: RateMetric): ImprovementHintSourceMetric => ({
  key,
  label,
  value: metric.percentage !== null ? Number(metric.percentage.toFixed(1)) : '--',
  numerator: metric.numerator,
  denominator: metric.denominator,
  unit: '%',
});

export const getReviewPointPlayerName = (context: ReconstructedPointContext) => {
  const resultType = context.point.result_type || '';

  if (ERROR_RESULT_TYPES.has(resultType)) {
    return normalizeRecordedPlayerName(context.point.loser_player);
  }

  if (WINNER_RESULT_TYPES.has(resultType)) {
    return normalizeRecordedPlayerName(context.point.winner_player);
  }

  return normalizeRecordedPlayerName(context.point.winner_player) ?? normalizeRecordedPlayerName(context.point.loser_player);
};

export const toReviewPoint = (context: ReconstructedPointContext): ImprovementHintReviewPoint => ({
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

export const uniqueReviewContexts = (points: ReconstructedPointContext[]) => {
  const seenPointIds = new Set<string>();

  return points.filter((context) => {
    if (seenPointIds.has(context.point.id)) return false;
    seenPointIds.add(context.point.id);
    return true;
  });
};

export const buildReviewGroup = (
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

export const sortByRallyCountDesc = (points: ReconstructedPointContext[]) =>
  [...points].sort((left, right) => (right.point.rally_count ?? 0) - (left.point.rally_count ?? 0));

export const getPointAt = (reconstructedPoints: ReconstructedPointContext[], gameNumber: number, pointNumber: number) =>
  reconstructedPoints.find((context) => context.gameNumber === gameNumber && context.pointNumber === pointNumber) ?? null;

export const getPointAfterSegment = (reconstructedPoints: ReconstructedPointContext[], segment: MomentumSegment | null) => {
  if (!segment) return null;
  const endIndex = reconstructedPoints.findIndex((context) => context.gameNumber === segment.endGameNumber && context.pointNumber === segment.endPointNumber);
  return endIndex >= 0 ? (reconstructedPoints[endIndex + 1] ?? null) : null;
};

export const getPointsBeforeContexts = (reconstructedPoints: ReconstructedPointContext[], points: ReconstructedPointContext[]) =>
  points
    .map((point) => {
      const index = reconstructedPoints.findIndex((context) => context.point.id === point.point.id);
      return index > 0 ? reconstructedPoints[index - 1] : null;
    })
    .filter((context): context is ReconstructedPointContext => context !== null);

export const getPointsAfterContexts = (reconstructedPoints: ReconstructedPointContext[], points: ReconstructedPointContext[]) =>
  points
    .map((point) => {
      const index = reconstructedPoints.findIndex((context) => context.point.id === point.point.id);
      return index >= 0 ? (reconstructedPoints[index + 1] ?? null) : null;
    })
    .filter((context): context is ReconstructedPointContext => context !== null);
