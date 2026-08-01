import { getPointsToWinForGame, isWinningScore } from '@/lib/matchRules';
import type { Match } from '@/types/database';

import { buildGuideCards } from './guideCards';
import {
  ERROR_RESULT_TYPES,
  RALLY_BUCKET_ORDER,
  WINNER_RESULT_TYPES,
  buildMomentumSegments,
  buildTeamInsights,
  createRate,
  getOppositeTeam,
  getRallyBucket,
  isDeuceScore,
} from './helpers';
import { buildImprovementHints } from './improvementHints';
import type { MatchAnalysisSummary, NeutralComparisonMetrics, RateMetric, ReconstructedPointContext, TeamKey } from './types';

export * from './types';

export const analyzeMatch = (match: Match): MatchAnalysisSummary => {
  const sortedGames = [...(match.games ?? [])].sort((left, right) => left.game_number - right.game_number);

  const reconstructedPoints: ReconstructedPointContext[] = [];
  const mismatches: MatchAnalysisSummary['scoreIntegrity']['mismatches'] = [];
  let gamesWonA = 0;
  let gamesWonB = 0;

  sortedGames.forEach((game) => {
    const pointsToWin = getPointsToWinForGame(match.best_of, gamesWonA, gamesWonB);
    const sortedPoints = [...(game.points ?? [])].sort((left, right) => left.point_number - right.point_number);

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
        isGameWinningPoint: isWinningScore(scoreA, scoreB, pointsToWin) || isWinningScore(scoreB, scoreA, pointsToWin),
        rallyBucket: getRallyBucket(point),
      });
    });

    const actualWinner = scoreA > scoreB ? ('A' as TeamKey) : scoreB > scoreA ? ('B' as TeamKey) : null;
    const expectedWinner = (game.winner_team as TeamKey | null) ?? null;

    if (scoreA !== (game.points_a ?? 0) || scoreB !== (game.points_b ?? 0) || actualWinner !== expectedWinner) {
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
    const servedPoints = reconstructedPoints.filter((context) => context.point.serving_team === team);
    const firstServePoints = servedPoints.filter((context) => !context.point.first_serve_fault);
    const secondServePoints = servedPoints.filter((context) => context.point.first_serve_fault);
    const receivePoints = reconstructedPoints.filter((context) => context.point.serving_team === opponent);
    const firstPointPoints = reconstructedPoints.filter((context) => context.isFirstPointOfGame);
    const twoTwoPoints = reconstructedPoints.filter((context) => context.isTwoTwoPoint);
    const deucePoints = reconstructedPoints.filter((context) => context.isDeucePoint);
    const gamePointPoints = reconstructedPoints.filter((context) => context.isGamePointOpportunity[team]);
    const rallyPoints = reconstructedPoints.filter((context) => !context.point.double_fault);

    const rallyBuckets = RALLY_BUCKET_ORDER.reduce(
      (bucketAcc, bucket) => {
        const bucketPoints = rallyPoints.filter((context) => context.rallyBucket === bucket);
        bucketAcc[bucket] = createRate(bucketPoints.filter((context) => context.point.winner_team === team).length, bucketPoints.length);
        return bucketAcc;
      },
      {} as Record<(typeof RALLY_BUCKET_ORDER)[number], RateMetric>,
    );

    const errorCounts = new Map<string, number>();
    let winners = 0;
    let errors = 0;

    reconstructedPoints.forEach((context) => {
      const resultType = context.point.result_type || '';
      if (WINNER_RESULT_TYPES.has(resultType) && context.point.winner_team === team) {
        winners += 1;
      }

      if (ERROR_RESULT_TYPES.has(resultType) && context.point.winner_team === opponent) {
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

    const maxStreakForSegment = segments.filter((segment) => segment.team === team).sort((left, right) => right.length - left.length)[0] ?? null;
    const maxStreakAgainstSegment = segments.filter((segment) => segment.team === opponent).sort((left, right) => right.length - left.length)[0] ?? null;

    acc[team] = {
      overallPointWinRate: createRate(reconstructedPoints.filter((context) => context.point.winner_team === team).length, totalPoints),
      service: {
        firstServeSuccessRate: createRate(firstServePoints.length, servedPoints.length),
        firstServePointWinRate: createRate(firstServePoints.filter((context) => context.point.winner_team === team).length, firstServePoints.length),
        secondServePointWinRate: createRate(secondServePoints.filter((context) => context.point.winner_team === team).length, secondServePoints.length),
        doubleFaultCount: servedPoints.filter((context) => context.point.double_fault).length,
      },
      receive: {
        pointWinRate: createRate(receivePoints.filter((context) => context.point.winner_team === team).length, receivePoints.length),
      },
      keyMoments: {
        firstPointWinRate: createRate(firstPointPoints.filter((context) => context.point.winner_team === team).length, firstPointPoints.length),
        twoTwoPointWinRate: createRate(twoTwoPoints.filter((context) => context.point.winner_team === team).length, twoTwoPoints.length),
        deucePointWinRate: createRate(deucePoints.filter((context) => context.point.winner_team === team).length, deucePoints.length),
        gamePointWinRate: createRate(gamePointPoints.filter((context) => context.point.winner_team === team).length, gamePointPoints.length),
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
      A: buildGuideCards(neutralComparison.A, neutralComparison.B, reconstructedPoints),
      B: buildGuideCards(neutralComparison.B, neutralComparison.A, reconstructedPoints),
    },
    improvementHints: {
      A: buildImprovementHints(match, 'A', neutralComparison.A, reconstructedPoints),
      B: buildImprovementHints(match, 'B', neutralComparison.B, reconstructedPoints),
    },
    scoreIntegrity: {
      ok: mismatches.length === 0,
      mismatches,
    },
  };
};
