import type { Game, Match, Point } from '../../src/types/database';
import type {
  AggregatedMetricSource,
  AverageStat,
  GrowthConfidence,
  GrowthMetric,
  GrowthMetricCategory,
  GrowthMetricUnit,
  GrowthTrend,
  RateStat,
  ReconstructedPoint,
  SingleMatchGrowthStats,
  TeamKey,
} from './types';
import { getGrowthTargetForSide, getMatchDate, getMatchWinner, getRequiredWins, isCompletedMatch } from './targets';

const NORMAL_GAME_WIN_POINTS = 4;
const FINAL_GAME_WIN_POINTS = 7;
const RATE_SAMPLE_SMALL = 5;
const RATE_SAMPLE_ENOUGH = 10;
const STABLE_DELTA = 2;

const metricDefinitions: Array<{
  key: string;
  label: string;
  category: GrowthMetricCategory;
  unit: GrowthMetricUnit;
  higherIsBetter: boolean;
  kind: 'rate' | 'average';
}> = [
  {
    key: 'servicePointWinRate',
    label: 'サーブ時得点率',
    category: 'serve',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'firstServeSuccessRate',
    label: '1stサービス成功率',
    category: 'serve',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'firstServePointWinRate',
    label: '1stサービス時得点率',
    category: 'serve',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'secondServePointWinRate',
    label: '2ndサービス時得点率',
    category: 'serve',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'doubleFaultRate',
    label: 'ダブルフォルト率',
    category: 'serve',
    unit: 'percent',
    higherIsBetter: false,
    kind: 'rate',
  },
  {
    key: 'receivePointWinRate',
    label: 'レシーブ時得点率',
    category: 'receive',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'afterTwoTwoPointWinRate',
    label: '2-2後の次ポイント取得率',
    category: 'key_moment',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'deucePointWinRate',
    label: 'デュースポイント取得率',
    category: 'key_moment',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'gamePointWinRate',
    label: 'ゲームポイント取得率',
    category: 'key_moment',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'opponentGamePointSaveRate',
    label: 'ゲームポイントを握られた後の粘り率',
    category: 'key_moment',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'finalGamePointWinRate',
    label: 'ファイナルゲーム得点率',
    category: 'key_moment',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'afterConsecutiveLostPointWinRate',
    label: '連続失点後の次ポイント取得率',
    category: 'momentum',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'twoPointLeadHoldRate',
    label: '2点差以上のリードを守れた率',
    category: 'momentum',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'shortRallyWinRate',
    label: '1-2本ラリー得点率',
    category: 'rally',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'middleRallyWinRate',
    label: '3-5本ラリー得点率',
    category: 'rally',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'longRallyWinRate',
    label: '6本以上ラリー得点率',
    category: 'rally',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'threePointLostStreakCount',
    label: '3連続失点以上',
    category: 'momentum',
    unit: 'average',
    higherIsBetter: false,
    kind: 'average',
  },
  {
    key: 'fourPointLostStreakCount',
    label: '4連続失点以上',
    category: 'momentum',
    unit: 'average',
    higherIsBetter: false,
    kind: 'average',
  },
  {
    key: 'maxLostStreak',
    label: '最大連続失点',
    category: 'momentum',
    unit: 'average',
    higherIsBetter: false,
    kind: 'average',
  },
];

const isTeamKey = (value: unknown): value is TeamKey => value === 'A' || value === 'B';

const getOppositeTeam = (team: TeamKey): TeamKey => (team === 'A' ? 'B' : 'A');

const isFinalGame = (bestOf: number, gamesWonA: number = 0, gamesWonB: number = 0) => {
  const requiredWins = getRequiredWins(bestOf);
  return gamesWonA === requiredWins - 1 && gamesWonB === requiredWins - 1;
};

const getPointsToWinForGame = (bestOf: number, gamesWonA: number = 0, gamesWonB: number = 0) =>
  isFinalGame(bestOf, gamesWonA, gamesWonB) ? FINAL_GAME_WIN_POINTS : NORMAL_GAME_WIN_POINTS;

const isWinningScore = (scoreFor: number, scoreAgainst: number, pointsToWin: number) => scoreFor >= pointsToWin && scoreFor - scoreAgainst >= 2;

const createRate = (points: ReconstructedPoint[], team: TeamKey): RateStat => ({
  numerator: points.filter((context) => context.point.winner_team === team).length,
  denominator: points.length,
});

const reconstructPoints = (match: Match): ReconstructedPoint[] => {
  const points: ReconstructedPoint[] = [];
  let gamesWonA = 0;
  let gamesWonB = 0;

  const games = [...(match.games ?? [])].sort((left, right) => left.game_number - right.game_number);

  games.forEach((game) => {
    const pointsToWin = getPointsToWinForGame(match.best_of, gamesWonA, gamesWonB);
    const sortedPoints = [...(game.points ?? [])].sort((left, right) => left.point_number - right.point_number);
    let scoreA = 0;
    let scoreB = 0;

    sortedPoints.forEach((point) => {
      const scoreBefore = { A: scoreA, B: scoreB };

      if (point.winner_team === 'A') scoreA += 1;
      if (point.winner_team === 'B') scoreB += 1;

      points.push({
        point,
        gameNumber: game.game_number,
        pointNumber: point.point_number,
        pointsToWin,
        scoreBefore,
        scoreAfter: { A: scoreA, B: scoreB },
        isFinalGame: pointsToWin === FINAL_GAME_WIN_POINTS,
      });
    });

    if (game.winner_team === 'A') gamesWonA += 1;
    if (game.winner_team === 'B') gamesWonB += 1;
  });

  return points;
};

const isGamePointOpportunity = (context: ReconstructedPoint, team: TeamKey) => {
  const opponent = getOppositeTeam(team);
  return isWinningScore(context.scoreBefore[team] + 1, context.scoreBefore[opponent], context.pointsToWin);
};

const getRallyBucket = (point: Point) => {
  if (point.double_fault) return 'unknown';
  const rallyCount = point.rally_count ?? 0;
  if (rallyCount <= 0) return 'unknown';
  if (rallyCount <= 2) return 'short';
  if (rallyCount <= 5) return 'middle';
  return 'long';
};

const getLostStreakStats = (reconstructedPoints: ReconstructedPoint[], team: TeamKey) => {
  let currentLostStreak = 0;
  let maxLostStreak = 0;
  let threePointLostStreakCount = 0;
  let fourPointLostStreakCount = 0;
  let afterLostStreakNumerator = 0;
  let afterLostStreakDenominator = 0;

  reconstructedPoints.forEach((context) => {
    if (currentLostStreak >= 2) {
      afterLostStreakDenominator += 1;
      if (context.point.winner_team === team) {
        afterLostStreakNumerator += 1;
      }
    }

    if (context.point.winner_team === team) {
      currentLostStreak = 0;
      return;
    }

    if (isTeamKey(context.point.winner_team)) {
      currentLostStreak += 1;
      maxLostStreak = Math.max(maxLostStreak, currentLostStreak);
      if (currentLostStreak === 3) threePointLostStreakCount += 1;
      if (currentLostStreak === 4) fourPointLostStreakCount += 1;
    }
  });

  return {
    maxLostStreak,
    threePointLostStreakCount,
    fourPointLostStreakCount,
    afterConsecutiveLostPointWinRate: {
      numerator: afterLostStreakNumerator,
      denominator: afterLostStreakDenominator,
    },
  };
};

const getTwoPointLeadHoldRate = (match: Match, team: TeamKey): RateStat => {
  let numerator = 0;
  let denominator = 0;

  (match.games ?? []).forEach((game: Game) => {
    let ledByTwo = false;
    let scoreA = 0;
    let scoreB = 0;

    [...(game.points ?? [])]
      .sort((left, right) => left.point_number - right.point_number)
      .forEach((point) => {
        if (point.winner_team === 'A') scoreA += 1;
        if (point.winner_team === 'B') scoreB += 1;
        const scoreFor = team === 'A' ? scoreA : scoreB;
        const scoreAgainst = team === 'A' ? scoreB : scoreA;
        if (scoreFor - scoreAgainst >= 2) ledByTwo = true;
      });

    if (ledByTwo) {
      denominator += 1;
      if (game.winner_team === team) numerator += 1;
    }
  });

  return { numerator, denominator };
};

const getSingleMatchGrowthStats = (match: Match, side: TeamKey): SingleMatchGrowthStats | null => {
  const targetKey = getGrowthTargetForSide(match, side).key;
  if (!targetKey) return null;

  const opponent = getOppositeTeam(side);
  const reconstructedPoints = reconstructPoints(match);
  const servedPoints = reconstructedPoints.filter((context) => context.point.serving_team === side);
  const firstServePoints = servedPoints.filter((context) => !context.point.first_serve_fault);
  const secondServePoints = servedPoints.filter((context) => context.point.first_serve_fault);
  const receivePoints = reconstructedPoints.filter((context) => context.point.serving_team === opponent);
  const twoTwoPoints = reconstructedPoints.filter((context) => context.scoreBefore.A === 2 && context.scoreBefore.B === 2);
  const deucePoints = reconstructedPoints.filter(
    (context) => context.scoreBefore.A === context.scoreBefore.B && context.scoreBefore.A >= context.pointsToWin - 1,
  );
  const gamePointPoints = reconstructedPoints.filter((context) => isGamePointOpportunity(context, side));
  const opponentGamePointPoints = reconstructedPoints.filter((context) => isGamePointOpportunity(context, opponent));
  const finalGamePoints = reconstructedPoints.filter((context) => context.isFinalGame);
  const rallyPoints = reconstructedPoints.filter((context) => getRallyBucket(context.point) !== 'unknown');
  const shortRallyPoints = rallyPoints.filter((context) => getRallyBucket(context.point) === 'short');
  const middleRallyPoints = rallyPoints.filter((context) => getRallyBucket(context.point) === 'middle');
  const longRallyPoints = rallyPoints.filter((context) => getRallyBucket(context.point) === 'long');
  const lostStreakStats = getLostStreakStats(reconstructedPoints, side);
  const matchWinner = getMatchWinner(match);
  const opponentTarget = getGrowthTargetForSide(match, opponent);

  return {
    match,
    side,
    targetWon: matchWinner === side,
    opponentKey: opponentTarget.key,
    opponentName: opponentTarget.displayName,
    matchDate: getMatchDate(match) ?? '',
    rates: {
      servicePointWinRate: createRate(servedPoints, side),
      firstServeSuccessRate: {
        numerator: firstServePoints.length,
        denominator: servedPoints.length,
      },
      firstServePointWinRate: createRate(firstServePoints, side),
      secondServePointWinRate: createRate(secondServePoints, side),
      doubleFaultRate: {
        numerator: servedPoints.filter((context) => context.point.double_fault).length,
        denominator: servedPoints.length,
      },
      receivePointWinRate: createRate(receivePoints, side),
      afterTwoTwoPointWinRate: createRate(twoTwoPoints, side),
      deucePointWinRate: createRate(deucePoints, side),
      gamePointWinRate: createRate(gamePointPoints, side),
      opponentGamePointSaveRate: createRate(opponentGamePointPoints, side),
      finalGamePointWinRate: createRate(finalGamePoints, side),
      afterConsecutiveLostPointWinRate: lostStreakStats.afterConsecutiveLostPointWinRate,
      twoPointLeadHoldRate: getTwoPointLeadHoldRate(match, side),
      shortRallyWinRate: createRate(shortRallyPoints, side),
      middleRallyWinRate: createRate(middleRallyPoints, side),
      longRallyWinRate: createRate(longRallyPoints, side),
    },
    averages: {
      threePointLostStreakCount: lostStreakStats.threePointLostStreakCount,
      fourPointLostStreakCount: lostStreakStats.fourPointLostStreakCount,
      maxLostStreak: lostStreakStats.maxLostStreak,
    },
  };
};

export const getStatsForTarget = (matches: Match[], targetKey: string) =>
  matches
    .filter(isCompletedMatch)
    .flatMap((match) =>
      (['A', 'B'] as TeamKey[])
        .filter((side) => getGrowthTargetForSide(match, side).key === targetKey)
        .map((side) => getSingleMatchGrowthStats(match, side))
        .filter((stats): stats is SingleMatchGrowthStats => Boolean(stats)),
    )
    .sort((left, right) => left.matchDate.localeCompare(right.matchDate));

export const aggregateStats = (statsList: SingleMatchGrowthStats[]): AggregatedMetricSource => {
  const aggregated: AggregatedMetricSource = {
    rates: {},
    averages: {},
    matchCount: statsList.length,
  };

  statsList.forEach((stats) => {
    Object.entries(stats.rates).forEach(([key, value]) => {
      const current = aggregated.rates[key] ?? { numerator: 0, denominator: 0 };
      aggregated.rates[key] = {
        numerator: current.numerator + value.numerator,
        denominator: current.denominator + value.denominator,
      };
    });

    Object.entries(stats.averages).forEach(([key, value]) => {
      const current = aggregated.averages[key] ?? { total: 0, matches: 0 };
      aggregated.averages[key] = {
        total: current.total + value,
        matches: current.matches + 1,
      };
    });
  });

  return aggregated;
};

const getRateValue = (rate: RateStat | undefined) => {
  if (!rate || rate.denominator === 0) return null;
  return (rate.numerator / rate.denominator) * 100;
};

const getAverageValue = (average: AverageStat | undefined) => {
  if (!average || average.matches === 0) return null;
  return average.total / average.matches;
};

const getConfidence = (currentSample: number, previousSample: number, currentMatches: number, previousMatches: number): GrowthConfidence => {
  if (currentMatches === 0 || previousMatches === 0) {
    return 'insufficient_sample';
  }
  if (currentSample === 0 || previousSample === 0) {
    return 'insufficient_sample';
  }
  if (currentSample < RATE_SAMPLE_SMALL || previousSample < RATE_SAMPLE_SMALL || currentMatches < 2 || previousMatches < 2) {
    return 'small_sample';
  }
  if (currentSample < RATE_SAMPLE_ENOUGH || previousSample < RATE_SAMPLE_ENOUGH) {
    return 'small_sample';
  }
  return 'enough_sample';
};

const getTrend = (delta: number | null, higherIsBetter: boolean): GrowthTrend => {
  if (delta === null || Math.abs(delta) < STABLE_DELTA) return 'stable';
  const movedUp = delta > 0;
  return movedUp === higherIsBetter ? 'improved' : 'declined';
};

export const formatMetricValue = (metric: GrowthMetric, value: number | null) => {
  if (value === null) return 'データなし';
  if (metric.unit === 'average') return `${value.toFixed(1)}回`;
  return `${Math.round(value)}%`;
};

export const formatDelta = (metric: GrowthMetric) => {
  if (metric.delta === null) return '';
  const sign = metric.delta > 0 ? '+' : '';
  if (metric.unit === 'average') return `${sign}${metric.delta.toFixed(1)}回`;
  return `${sign}${Math.round(metric.delta)}pt`;
};

const buildMetricSummary = (metric: GrowthMetric) => {
  if (metric.currentValue === null || metric.previousValue === null) {
    return `${metric.label}は、まだ比較できる記録が足りません。`;
  }

  const current = formatMetricValue(metric, metric.currentValue);
  const previous = formatMetricValue(metric, metric.previousValue);
  const delta = formatDelta(metric);

  if (metric.trend === 'improved') {
    return `${metric.label}は ${previous} から ${current} に改善傾向です（${delta}）。`;
  }
  if (metric.trend === 'declined') {
    return `${metric.label}は ${previous} から ${current} です。次はここを見てみましょう（${delta}）。`;
  }
  return `${metric.label}は ${previous} から ${current} で、大きな変化はありません。`;
};

export const buildGrowthMetrics = (current: AggregatedMetricSource, previous: AggregatedMetricSource) =>
  metricDefinitions.map((definition): GrowthMetric => {
    const currentRate = current.rates[definition.key];
    const previousRate = previous.rates[definition.key];
    const currentAverage = current.averages[definition.key];
    const previousAverage = previous.averages[definition.key];
    const currentValue = definition.kind === 'rate' ? getRateValue(currentRate) : getAverageValue(currentAverage);
    const previousValue = definition.kind === 'rate' ? getRateValue(previousRate) : getAverageValue(previousAverage);
    const currentSample = definition.kind === 'rate' ? (currentRate?.denominator ?? 0) : (currentAverage?.matches ?? 0);
    const previousSample = definition.kind === 'rate' ? (previousRate?.denominator ?? 0) : (previousAverage?.matches ?? 0);
    const delta = currentValue !== null && previousValue !== null ? currentValue - previousValue : null;
    const metric: GrowthMetric = {
      key: definition.key,
      label: definition.label,
      category: definition.category,
      unit: definition.unit,
      higherIsBetter: definition.higherIsBetter,
      currentValue,
      previousValue,
      delta,
      trend: getTrend(delta, definition.higherIsBetter),
      confidence: getConfidence(currentSample, previousSample, current.matchCount, previous.matchCount),
      numerator: definition.kind === 'rate' ? (currentRate?.numerator ?? 0) : (currentAverage?.total ?? 0),
      denominator: definition.kind === 'rate' ? (currentRate?.denominator ?? 0) : (currentAverage?.matches ?? 0),
      previousNumerator: definition.kind === 'rate' ? (previousRate?.numerator ?? 0) : (previousAverage?.total ?? 0),
      previousDenominator: definition.kind === 'rate' ? (previousRate?.denominator ?? 0) : (previousAverage?.matches ?? 0),
      matchCount: current.matchCount,
      previousMatchCount: previous.matchCount,
      summary: '',
    };

    return {
      ...metric,
      summary: buildMetricSummary(metric),
    };
  });
