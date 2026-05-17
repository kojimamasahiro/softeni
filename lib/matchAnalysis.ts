import type { Match, Point } from '@/types/database';
import { getPointsToWinForGame, isWinningScore } from '@/lib/matchRules';

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

export type MatchAnalysisSummary = {
  reconstructedPoints: ReconstructedPointContext[];
  neutralComparison: NeutralComparisonMetrics;
  teamInsights: Record<TeamKey, TeamPerspectiveInsights>;
  teamGuideCards: Record<TeamKey, TeamGuideSummary>;
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

  const shortRallyMetric = metrics.rally.buckets['1-2'];
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
          '高いほど、サーブから主導権を取りやすかった可能性があります。低いときは、サーブ後の次の1本も一緒に見返します。',
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
          rallyReliability === 'none' ? undefined : '短いラリー / 長いラリー',
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
    scoreIntegrity: {
      ok: mismatches.length === 0,
      mismatches,
    },
  };
};
