import type { Match } from '@/types/database';

import {
  ERROR_RESULT_TYPES,
  IMPROVEMENT_HINT_RULE_VERSION,
  RESULT_TYPE_LABELS,
  WINNER_RESULT_TYPES,
  buildMetric,
  buildReviewGroup,
  combineRateMetrics,
  formatPercentage,
  formatPointRange,
  formatRateForMessage,
  getConfidence,
  getConfidenceReason,
  getDominantLoserPlayer,
  getHintTarget,
  getMetricDropFromOverall,
  getOpponentGamePointSaveRate,
  getOppositeTeam,
  getPointAfterSegment,
  getPointAt,
  getPointsAfterContexts,
  getPointsBeforeContexts,
  normalizeRecordedPlayerName,
  sortByRallyCountDesc,
} from './helpers';
import {
  ANALYSIS_THRESHOLDS,
  type ImprovementHint,
  type ImprovementHintSourceMetricKey,
  type RateMetric,
  type ReconstructedPointContext,
  type TeamAnalysisMetrics,
  type TeamKey,
} from './types';

export const buildImprovementHints = (
  match: Match,
  team: TeamKey,
  metrics: TeamAnalysisMetrics,
  reconstructedPoints: ReconstructedPointContext[],
): ImprovementHint[] => {
  const hints: ImprovementHint[] = [];
  const overallMetric = metrics.overallPointWinRate;
  const isOneSidedLoss = (overallMetric.percentage ?? 50) < 38;
  const opponent = getOppositeTeam(team);
  const lostPoints = reconstructedPoints.filter((context) => context.point.winner_team === opponent);
  const servedPoints = reconstructedPoints.filter((context) => context.point.serving_team === team);
  const receivedPoints = reconstructedPoints.filter((context) => context.point.serving_team === opponent);
  const shortRallyLosses = lostPoints.filter((context) => context.rallyBucket === '1-2' || context.rallyBucket === '3-4');
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
  if (firstServeInRate.denominator > 0 && (firstServeInRate.percentage ?? 100) < ANALYSIS_THRESHOLDS.LOW_FIRST_SERVE_IN_RATE) {
    const confidence = getConfidence(firstServeInRate.denominator, ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE, (firstServeInRate.percentage ?? 100) < 45);
    const drop = Math.max(0, ANALYSIS_THRESHOLDS.LOW_FIRST_SERVE_IN_RATE - (firstServeInRate.percentage ?? 0));

    addHint({
      ruleId: 'serve.firstServeInRate.low',
      category: 'serve',
      title: '1stサーブの入りを確認',
      evidence: `1stサーブ成功率が ${formatRateForMessage(firstServeInRate)} でした。`,
      evidenceItems: [`1stサーブ成功率: ${formatRateForMessage(firstServeInRate)}`, `ダブルフォルト: ${metrics.service.doubleFaultCount}本`],
      interpretation: 'この試合では、サーブの入りが次に見返す確認ポイントになる可能性があります。',
      nextCheck: '次の試合では、1stサーブが入らなかった場面の入り方を確認しましょう。',
      nextCheckItems: ['1stサーブが入らなかったポイント', '2ndサーブ後の失点パターン'],
      confidence,
      confidenceReason: getConfidenceReason(confidence, firstServeInRate.denominator, ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE),
      priorityScore: 48 + drop + Math.min(firstServeInRate.denominator, 12),
      priorityReasons: ['サーブの入りは次の試合で確認しやすい', '1stサーブ成功率が低め'],
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
          servedPoints.filter((context) => context.point.first_serve_fault && context.point.winner_team === opponent),
          '2ndサーブ後の失点ポイントを絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        buildMetric('service.firstServeInRate', '1stサーブ成功率', firstServeInRate),
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
  const firstServePointDrop = getMetricDropFromOverall(firstServePointWinRate, overallMetric);
  if (
    firstServePointWinRate.denominator > 0 &&
    (firstServeInRate.percentage ?? 0) >= ANALYSIS_THRESHOLDS.LOW_FIRST_SERVE_IN_RATE &&
    ((firstServePointWinRate.percentage ?? 100) < ANALYSIS_THRESHOLDS.LOW_FIRST_SERVE_POINT_WIN_RATE ||
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
      evidenceItems: [`1stサーブ時得点率: ${formatRateForMessage(firstServePointWinRate)}`, `総ポイント取得率との差: ${firstServePointDrop.toFixed(1)}pt`],
      interpretation: '1stサーブは入っていても、その後の1本で押し返された可能性があります。',
      nextCheck: '1stサーブが入ったポイントで、どこから主導権が変わったか確認しましょう。',
      nextCheckItems: ['1stサーブでの失点', '短いラリーでの失点', '相手の決定打で終わった場面'],
      confidence,
      confidenceReason: getConfidenceReason(confidence, firstServePointWinRate.denominator, ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE),
      priorityScore: 52 + Math.max(firstServePointDrop, 0) + Math.min(firstServePointWinRate.denominator, 12),
      priorityReasons: ['1stサーブ成功後の得点率が低め', '総ポイント取得率との差を確認'],
      reviewGroups: [
        buildReviewGroup(
          'first-serve-next-ball',
          '1stサーブでの失点',
          servedPoints.filter((context) => !context.point.first_serve_fault && context.point.winner_team === opponent),
          '1stサーブ後の失点ポイントを絞り込めませんでした。',
        ),
        buildReviewGroup('short-rally-lost-points', '短いラリーでの失点', shortRallyLosses, '短いラリーでの失点ポイントを絞り込めませんでした。'),
        buildReviewGroup(
          'opponent-attack-first',
          '相手の決定打で終わった場面',
          lostPoints.filter((context) => WINNER_RESULT_TYPES.has(context.point.result_type || '')),
          '相手の決定打になったポイントを絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        buildMetric('service.firstServePointWinRate', '1stサーブ時得点率', firstServePointWinRate),
        buildMetric('overall.pointWinRate', '総ポイント取得率', overallMetric),
      ],
    });
  }

  const secondServePointWinRate = metrics.service.secondServePointWinRate;
  if (
    secondServePointWinRate.denominator > 0 &&
    ((secondServePointWinRate.percentage ?? 100) < ANALYSIS_THRESHOLDS.LOW_SECOND_SERVE_POINT_WIN_RATE ||
      metrics.service.doubleFaultCount >= ANALYSIS_THRESHOLDS.HIGH_DOUBLE_FAULT_COUNT)
  ) {
    const confidence = getConfidence(
      secondServePointWinRate.denominator + metrics.service.doubleFaultCount,
      Math.max(3, ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE - 2),
      (secondServePointWinRate.percentage ?? 100) < 30 || metrics.service.doubleFaultCount >= 3,
    );

    addHint({
      ruleId: 'serve.secondServe.low',
      category: 'serve',
      title: '2ndサーブ後の展開を確認',
      evidence: `2ndサーブ時得点率が ${formatRateForMessage(secondServePointWinRate)} で、ダブルフォルトは ${metrics.service.doubleFaultCount}本でした。`,
      evidenceItems: [`2ndサーブ時得点率: ${formatRateForMessage(secondServePointWinRate)}`, `ダブルフォルト: ${metrics.service.doubleFaultCount}本`],
      interpretation: '2ndサーブの後に相手へ流れが渡った場面があった可能性があります。',
      nextCheck: '2ndサーブ後の短いラリーで、どの形の失点が多かったか確認しましょう。',
      nextCheckItems: ['2ndサーブでの失点', 'ダブルフォルトが出たポイント', '2nd後の1-4本ラリー失点'],
      confidence,
      confidenceReason: getConfidenceReason(confidence, secondServePointWinRate.denominator, Math.max(3, ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE - 2)),
      priorityScore:
        56 +
        Math.max(0, ANALYSIS_THRESHOLDS.LOW_SECOND_SERVE_POINT_WIN_RATE - (secondServePointWinRate.percentage ?? 0)) +
        metrics.service.doubleFaultCount * 4,
      priorityReasons: ['2ndサーブ時得点率が低め', 'ダブルフォルト数も確認対象'],
      reviewGroups: [
        buildReviewGroup(
          'second-serve-return',
          '2ndサーブでの失点',
          servedPoints.filter((context) => context.point.first_serve_fault && context.point.winner_team === opponent),
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
              context.point.first_serve_fault && context.point.winner_team === opponent && (context.rallyBucket === '1-2' || context.rallyBucket === '3-4'),
          ),
          '2ndサーブ後の短いラリー失点を絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        buildMetric('service.secondServeWinRate', '2ndサーブ時得点率', secondServePointWinRate),
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
  const receiveDrop = getMetricDropFromOverall(receivePointWinRate, overallMetric);
  if (
    receivePointWinRate.denominator > 0 &&
    ((receivePointWinRate.percentage ?? 100) < ANALYSIS_THRESHOLDS.LOW_RECEIVE_POINT_WIN_RATE || receiveDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP)
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
      evidenceItems: [`レシーブ時得点率: ${formatRateForMessage(receivePointWinRate)}`, `総ポイント取得率との差: ${receiveDrop.toFixed(1)}pt`],
      interpretation: '相手サーブからの入りで、主導権を作りにくかった可能性があります。',
      nextCheck: '相手サーブ後の1本目から3本目で、どこから苦しくなったか確認しましょう。',
      nextCheckItems: ['レシーブ直後の失点', '相手2ndサーブからの失点', 'レシーブ後の短いラリー'],
      confidence,
      confidenceReason: getConfidenceReason(confidence, receivePointWinRate.denominator, ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE),
      priorityScore: 44 + Math.max(receiveDrop, 0) + Math.min(receivePointWinRate.denominator, 12),
      priorityReasons: ['レシーブは次の試合で確認しやすい', '総ポイント取得率との差を確認'],
      reviewGroups: [
        buildReviewGroup(
          'receive-lost-points',
          'レシーブ直後の失点',
          receivedPoints.filter((context) => context.point.winner_team === opponent && context.point.rally_count === 3),
          'レシーブ時の失点ポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'opponent-second-serve-points',
          '相手2ndサーブからの失点',
          receivedPoints.filter((context) => context.point.first_serve_fault && context.point.winner_team === opponent),
          '相手2ndサーブ時の失点ポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'receive-short-rally-lost-points',
          'レシーブ後の短いラリー',
          receivedPoints.filter((context) => context.point.winner_team === opponent && (context.rallyBucket === '1-2' || context.rallyBucket === '3-4')),
          'レシーブ後の短いラリーを絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        buildMetric('receive.pointWinRate', 'レシーブ時得点率', receivePointWinRate),
        buildMetric('overall.pointWinRate', '総ポイント取得率', overallMetric),
      ],
    });
  }

  const shortRallyMetric = combineRateMetrics(metrics.rally.buckets['1-2'], metrics.rally.buckets['3-4']);
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
      ((candidate.metric.percentage ?? 100) < ANALYSIS_THRESHOLDS.LOW_RALLY_WIN_RATE || rallyDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP)
    ) {
      const confidence = getConfidence(candidate.metric.denominator, ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE, rallyDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP);
      const rallyLosses =
        candidate.ruleId === 'rally.short1To4.low'
          ? shortRallyLosses
          : candidate.ruleId === 'rally.medium5To8.low'
            ? lostPoints.filter((context) => context.rallyBucket === '5-8')
            : sortByRallyCountDesc(lostPoints.filter((context) => context.rallyBucket === '9+'));

      addHint({
        ruleId: candidate.ruleId,
        category: 'rally',
        title: candidate.title,
        evidence: `${candidate.label}が ${formatRateForMessage(candidate.metric)} でした。`,
        evidenceItems: [`${candidate.label}: ${formatRateForMessage(candidate.metric)}`, `総ポイント取得率との差: ${rallyDrop.toFixed(1)}pt`],
        interpretation: 'このラリー帯で点が動いた場面を見返すと、次の確認ポイントが見つかる可能性があります。',
        nextCheck: `${candidate.label}に含まれる失点場面を確認しましょう。`,
        nextCheckItems: candidate.nextCheckItems,
        confidence,
        confidenceReason: getConfidenceReason(confidence, candidate.metric.denominator, ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE),
        priorityScore: 42 + Math.max(rallyDrop, 0) + Math.min(candidate.metric.denominator, 10),
        priorityReasons: ['総ポイント取得率との差を確認', isOneSidedLoss ? '全体的に苦しい試合の中でも落ち込みが大きい' : 'ラリー帯ごとの差が見やすい'],
        reviewGroups: [
          buildReviewGroup(`${candidate.ruleId}.primary`, candidate.nextCheckItems[0], rallyLosses, `${candidate.label}の失点ポイントを絞り込めませんでした。`),
          buildReviewGroup(
            `${candidate.ruleId}.secondary`,
            candidate.nextCheckItems[1],
            candidate.ruleId === 'rally.long9Plus.low'
              ? sortByRallyCountDesc(rallyLosses)
              : rallyLosses.filter((context) => ERROR_RESULT_TYPES.has(context.point.result_type || '')),
            `${candidate.label}の終わり方を絞り込めませんでした。`,
          ),
        ],
        sourceMetrics: [
          buildMetric(candidate.metricKey, candidate.label, candidate.metric),
          buildMetric('overall.pointWinRate', '総ポイント取得率', overallMetric),
        ],
      });
    }
  });

  const gamePointWinRate = metrics.keyMoments.gamePointWinRate;
  const gamePointDrop = getMetricDropFromOverall(gamePointWinRate, overallMetric);
  if (
    gamePointWinRate.denominator > 0 &&
    ((gamePointWinRate.percentage ?? 100) < ANALYSIS_THRESHOLDS.LOW_GAME_POINT_CONVERSION || gamePointDrop >= ANALYSIS_THRESHOLDS.LARGE_RELATIVE_DROP)
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
      interpretation: 'ゲームを取り切れる場面で、もう一度見る価値のあるポイントがあった可能性があります。',
      nextCheck: 'ゲームポイントの前後で、先に攻めたか、相手に攻められたかを確認しましょう。',
      nextCheckItems: ['自チームのゲームポイント', 'ゲームポイント直前のポイント', 'デュースになった後の1本'],
      confidence,
      confidenceReason: getConfidenceReason(confidence, gamePointWinRate.denominator, ANALYSIS_THRESHOLDS.MIN_GAME_POINT_SAMPLE),
      priorityScore: 50 + Math.max(gamePointDrop, 0) + Math.min(gamePointWinRate.denominator, 8),
      priorityReasons: ['重要局面の確認価値が高い', '取り切りの場面を絞れる'],
      reviewGroups: [
        buildReviewGroup(
          'own-game-point-points',
          '自チームのゲームポイント',
          reconstructedPoints.filter((context) => context.isGamePointOpportunity[team]),
          '自チームのゲームポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'before-own-game-point',
          'ゲームポイント直前のポイント',
          getPointsBeforeContexts(
            reconstructedPoints,
            reconstructedPoints.filter((context) => context.isGamePointOpportunity[team]),
          ),
          'ゲームポイント直前のポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'after-own-game-point-loss',
          'デュースになった後の1本',
          getPointsAfterContexts(
            reconstructedPoints,
            reconstructedPoints.filter((context) => context.isGamePointOpportunity[team] && context.point.winner_team === opponent),
          ),
          'ゲームポイントを落とした後のポイントを絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [
        buildMetric('keyMoment.gamePointWinRate', 'ゲームポイント取得率', gamePointWinRate),
        buildMetric('keyMoment.deucePointWinRate', 'デュースポイント取得率', metrics.keyMoments.deucePointWinRate),
      ],
    });
  }

  const opponentGamePointSaveRate = getOpponentGamePointSaveRate(team, reconstructedPoints);
  if (opponentGamePointSaveRate.denominator > 0 && (opponentGamePointSaveRate.percentage ?? 100) < ANALYSIS_THRESHOLDS.LOW_OPPONENT_GAME_POINT_SAVE_RATE) {
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
      evidenceItems: [`相手ゲームポイント得点率: ${formatRateForMessage(opponentGamePointSaveRate)}`],
      interpretation: '相手にゲームポイントを握られた場面で、粘り切れなかった可能性があります。',
      nextCheck: '相手ゲームポイントで、守るだけになったか、先に仕掛けられたか確認しましょう。',
      nextCheckItems: ['相手ゲームポイントの入り', 'レシーブ側かサーブ側か', '最後の失点の終わり方'],
      confidence,
      confidenceReason: getConfidenceReason(confidence, opponentGamePointSaveRate.denominator, ANALYSIS_THRESHOLDS.MIN_GAME_POINT_SAMPLE),
      priorityScore:
        45 +
        Math.max(0, ANALYSIS_THRESHOLDS.LOW_OPPONENT_GAME_POINT_SAVE_RATE - (opponentGamePointSaveRate.percentage ?? 0)) +
        Math.min(opponentGamePointSaveRate.denominator, 8),
      priorityReasons: ['相手ゲームポイントを分けて確認', '重要局面の見返しに向いている'],
      reviewGroups: [
        buildReviewGroup(
          'opponent-game-point-points',
          '相手ゲームポイントの入り',
          reconstructedPoints.filter((context) => context.isGamePointOpportunity[opponent]),
          '相手ゲームポイントを絞り込めませんでした。',
        ),
        buildReviewGroup(
          'opponent-game-point-serve-receive',
          'レシーブ側かサーブ側か',
          reconstructedPoints.filter((context) => context.isGamePointOpportunity[opponent]),
          '相手ゲームポイントのサーブ/レシーブ情報を絞り込めませんでした。',
        ),
        buildReviewGroup(
          'opponent-game-point-lost-endings',
          '最後の失点の終わり方',
          reconstructedPoints.filter((context) => context.isGamePointOpportunity[opponent] && context.point.winner_team === opponent),
          '相手ゲームポイントでの失点を絞り込めませんでした。',
        ),
      ],
      sourceMetrics: [buildMetric('keyMoment.opponentGamePointSaveRate', '相手ゲームポイント得点率', opponentGamePointSaveRate)],
    });
  }

  if (metrics.momentum.maxStreakAgainst >= ANALYSIS_THRESHOLDS.LARGE_LOSS_STREAK) {
    const segment = metrics.momentum.maxStreakAgainstSegment;
    const confidence = getConfidence(metrics.momentum.maxStreakAgainst, ANALYSIS_THRESHOLDS.LARGE_LOSS_STREAK, metrics.momentum.maxStreakAgainst >= 7);
    const segmentStartPoint = segment ? getPointAt(reconstructedPoints, segment.startGameNumber, segment.startPointNumber) : null;
    const segmentPoints = segment
      ? reconstructedPoints.filter(
          (context) =>
            (context.gameNumber > segment.startGameNumber ||
              (context.gameNumber === segment.startGameNumber && context.pointNumber >= segment.startPointNumber)) &&
            (context.gameNumber < segment.endGameNumber || (context.gameNumber === segment.endGameNumber && context.pointNumber <= segment.endPointNumber)),
        )
      : [];
    const segmentAfterPoint = getPointAfterSegment(reconstructedPoints, segment);

    addHint({
      ruleId: 'momentum.maxLostStreak.large',
      category: 'momentum',
      title: '連続失点の始まりを確認',
      evidence: `最大連続失点は ${metrics.momentum.maxStreakAgainst}点でした。`,
      evidenceItems: [`最大連続失点: ${metrics.momentum.maxStreakAgainst}点`, `該当区間: ${formatPointRange(segment)}`],
      interpretation: '流れが相手に傾いた区間があり、始まり方を見返す価値があります。',
      nextCheck: '連続失点が始まる直前と終わる直後のポイント内容を確認しましょう。',
      nextCheckItems: ['連続失点が始まる直前のポイント', '連続失点中のサーブ/レシーブ', '連続失点が止まったポイント'],
      confidence,
      confidenceReason: getConfidenceReason(confidence, metrics.momentum.maxStreakAgainst, ANALYSIS_THRESHOLDS.LARGE_LOSS_STREAK),
      priorityScore: 54 + metrics.momentum.maxStreakAgainst * 3,
      priorityReasons: ['該当区間を特定できる', '次に確認するポイントを絞りやすい'],
      reviewGroups: [
        buildReviewGroup(
          'before-lost-streak',
          '連続失点が始まる直前のポイント',
          segmentStartPoint ? getPointsBeforeContexts(reconstructedPoints, [segmentStartPoint]) : [],
          '連続失点が始まる直前のポイントを絞り込めませんでした。',
        ),
        buildReviewGroup('lost-streak-points', '連続失点中のサーブ/レシーブ', segmentPoints, '連続失点中のポイントを絞り込めませんでした。'),
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
    if (entry.count >= ANALYSIS_THRESHOLDS.ERROR_SHARE_COUNT && (entry.share ?? 0) >= ANALYSIS_THRESHOLDS.ERROR_SHARE_RATE) {
      const confidence = getConfidence(entry.count, ANALYSIS_THRESHOLDS.ERROR_SHARE_COUNT, (entry.share ?? 0) >= 55);
      const label = RESULT_TYPE_LABELS[entry.resultType] ?? entry.resultType;
      const errorPoints = lostPoints.filter((context) => context.point.result_type === entry.resultType);
      const lostStreakSegment = metrics.momentum.maxStreakAgainstSegment;
      const errorPointsInLostStreak = lostStreakSegment
        ? errorPoints.filter(
            (context) =>
              (context.gameNumber > lostStreakSegment.startGameNumber ||
                (context.gameNumber === lostStreakSegment.startGameNumber && context.pointNumber >= lostStreakSegment.startPointNumber)) &&
              (context.gameNumber < lostStreakSegment.endGameNumber ||
                (context.gameNumber === lostStreakSegment.endGameNumber && context.pointNumber <= lostStreakSegment.endPointNumber)),
          )
        : [];

      addHint({
        ruleId: `error.resultTypeShare.${entry.resultType}`,
        category: 'error_trend',
        title: `${label}の終わり方を確認`,
        evidence: `${label}が自チームエラーの ${formatPercentage(entry.share) ?? '0%'} を占めていました。`,
        evidenceItems: [`${label}: ${entry.count}件`, `自チームエラー内の比率: ${formatPercentage(entry.share) ?? '0%'}`],
        interpretation: 'この試合では、同じ終わり方の失点がややまとまっていた可能性があります。',
        nextCheck: '同じミスが出た場面で、直前のボールや立ち位置を確認しましょう。',
        nextCheckItems: [`${label}が出た直前の1本`, 'サーブ側で出たミス', 'レシーブ側で出たミス', '連続失点の中で出たミス'],
        confidence,
        confidenceReason: getConfidenceReason(confidence, entry.count, ANALYSIS_THRESHOLDS.ERROR_SHARE_COUNT),
        priorityScore: 40 + (entry.share ?? 0) / 2 + entry.count * 3,
        priorityReasons: ['失点の終わり方に偏りがある', '次の試合で記録確認しやすい'],
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
            errorPoints.filter((context) => context.point.serving_team === team),
            `${label}がサーブ側で出たポイントを絞り込めませんでした。`,
          ),
          buildReviewGroup(
            `${entry.resultType}-receiving-side`,
            'レシーブ側で出たミス',
            errorPoints.filter((context) => context.point.serving_team === opponent),
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

  const dominantLoser = getDominantLoserPlayer(match, team, reconstructedPoints);
  if (dominantLoser) {
    const confidence = getConfidence(dominantLoser.count, ANALYSIS_THRESHOLDS.INDIVIDUAL_ERROR_SHARE_COUNT, dominantLoser.share >= 70);
    const dominantLoserPoints = lostPoints.filter(
      (context) =>
        ERROR_RESULT_TYPES.has(context.point.result_type || '') && normalizeRecordedPlayerName(context.point.loser_player) === dominantLoser.playerName,
    );

    addHint({
      ruleId: 'error.loserPlayerShare.high',
      category: 'error_trend',
      playerName: dominantLoser.playerName,
      title: '失点の終点になった場面を確認',
      evidence: `${dominantLoser.playerName} が失点の終点として ${dominantLoser.count}件記録されていました。`,
      evidenceItems: [`記録された失点終点: ${dominantLoser.count}件`, `既知の自チームエラー内比率: ${dominantLoser.share.toFixed(1)}%`],
      interpretation: '個人の責任ではなく、ペアとしてその選手に最後のボールが集まった可能性があります。',
      nextCheck: 'その選手の前の1本と、ペアの配置・役割を一緒に確認しましょう。',
      nextCheckItems: ['失点直前にどちらが触ったか', 'ペアの立ち位置', '同じ形で狙われていないか'],
      confidence,
      confidenceReason: getConfidenceReason(confidence, dominantLoser.count, ANALYSIS_THRESHOLDS.INDIVIDUAL_ERROR_SHARE_COUNT),
      priorityScore: 38 + dominantLoser.share / 2 + dominantLoser.count * 3,
      priorityReasons: ['ダブルスでは個人責任ではなく配置確認として扱う', '失点終点の偏りがある'],
      reviewGroups: [
        buildReviewGroup(
          'dominant-loser-touches',
          '失点直前にどちらが触ったか',
          getPointsBeforeContexts(reconstructedPoints, dominantLoserPoints),
          '該当選手が失点終点になったポイントを絞り込めませんでした。',
        ),
        buildReviewGroup('dominant-loser-position', 'ペアの立ち位置', dominantLoserPoints, 'ペアの立ち位置を確認するポイントを絞り込めませんでした。'),
        buildReviewGroup('dominant-loser-pattern', '同じ形で狙われていないか', dominantLoserPoints, '同じ形を確認するポイントを絞り込めませんでした。'),
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

  return hints.sort((left, right) => right.priorityScore - left.priorityScore).slice(0, 3);
};
