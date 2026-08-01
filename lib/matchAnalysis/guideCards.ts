import { ANALYSIS_THRESHOLDS, type AnalysisReliability, type ReconstructedPointContext, type TeamAnalysisMetrics, type TeamGuideSummary } from './types';
import {
  combineRateMetrics,
  formatCount,
  formatPrimaryPercentage,
  formatRateForMessage,
  getPresenceReliability,
  getRateReliability,
  getReliabilitySummary,
} from './helpers';

export const buildGuideCards = (
  metrics: TeamAnalysisMetrics,
  opponentMetrics: TeamAnalysisMetrics,
  reconstructedPoints: ReconstructedPointContext[],
): TeamGuideSummary => {
  const reliabilityMessage = (reliability: AnalysisReliability) => getReliabilitySummary(reliability);

  const serviceReliability = getRateReliability(metrics.service.firstServePointWinRate);
  const serviceSummary =
    reliabilityMessage(serviceReliability) ??
    ((metrics.service.firstServePointWinRate.percentage ?? 0) >= ANALYSIS_THRESHOLDS.STRONG_FIRST_SERVE_POINT_WIN_RATE
      ? 'サーブから点につながる場面が目立ちました。'
      : (metrics.service.firstServePointWinRate.percentage ?? 0) < 45
        ? '1stサーブ後の展開を見返す手がかりになります。'
        : 'サーブからの入り方を確認する手がかりになります。');

  const keyMomentReliability = getRateReliability(metrics.keyMoments.gamePointWinRate, ANALYSIS_THRESHOLDS.MIN_GAME_POINT_SAMPLE);
  const keyMomentSummary =
    reliabilityMessage(keyMomentReliability) ??
    ((metrics.keyMoments.gamePointWinRate.percentage ?? 0) >= 50
      ? '大事な場面で取り切る場面が見られました。'
      : '大事な場面の取り切りを見返す手がかりになります。');

  const momentumReliability = getPresenceReliability(reconstructedPoints.length);
  const momentumSegment = metrics.momentum.maxStreakAgainstSegment;
  const momentumRange = momentumSegment ? `第${momentumSegment.startGameNumber}〜第${momentumSegment.endGameNumber}ゲーム` : '該当区間なし';
  const momentumSummary =
    reliabilityMessage(momentumReliability) ??
    (metrics.momentum.maxStreakAgainst >= ANALYSIS_THRESHOLDS.LARGE_LOSS_STREAK
      ? '連続失点が流れの確認ポイントになりそうです。'
      : '流れが止まった場面を見返す手がかりになります。');

  const shortRallyMetric = combineRateMetrics(metrics.rally.buckets['1-2'], metrics.rally.buckets['3-4']);
  const veryShortRallyMetric = metrics.rally.buckets['1-2'];
  const midShortRallyMetric = metrics.rally.buckets['3-4'];
  const midLongRallyMetric = metrics.rally.buckets['5-8'];
  const longRallyMetric = metrics.rally.buckets['9+'];
  const rallyReliability =
    shortRallyMetric.denominator === 0 && longRallyMetric.denominator === 0
      ? 'none'
      : shortRallyMetric.denominator >= ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE && longRallyMetric.denominator >= ANALYSIS_THRESHOLDS.MIN_RATE_SAMPLE
        ? 'ok'
        : 'low';
  const rallyGap =
    shortRallyMetric.percentage !== null && longRallyMetric.percentage !== null ? shortRallyMetric.percentage - longRallyMetric.percentage : null;
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
        primaryValue: serviceReliability === 'none' ? '--' : formatPrimaryPercentage(metrics.service.firstServePointWinRate),
        secondaryValue:
          serviceReliability === 'none'
            ? undefined
            : `1stサーブ時得点率 (${metrics.service.firstServePointWinRate.numerator}/${metrics.service.firstServePointWinRate.denominator})`,
        reliability: serviceReliability,
        summary: serviceSummary,
        description: '1stサーブが入った場面で、どれだけ点につながったかを見る数字です。',
        howToRead: '高いほど、サーブから主導権を取りやすかった可能性があります。低いときは、1stサーブでの失点も一緒に見返します。',
        nextCheck: '1stサーブが入った後に、どこで相手に押し返されたかを確認します。',
        whyItMatters: 'サーブは毎ポイントの入り口なので、試合全体の流れを見返す出発点になります。',
        details: [
          {
            label: '1stサーブ成功率',
            value: formatRateForMessage(metrics.service.firstServeSuccessRate),
          },
          {
            label: '2ndサーブ時得点率',
            value: formatRateForMessage(metrics.service.secondServePointWinRate),
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
        primaryValue: keyMomentReliability === 'none' ? '--' : formatPrimaryPercentage(metrics.keyMoments.gamePointWinRate),
        secondaryValue:
          keyMomentReliability === 'none'
            ? undefined
            : `ゲームポイント取得率 (${metrics.keyMoments.gamePointWinRate.numerator}/${metrics.keyMoments.gamePointWinRate.denominator})`,
        reliability: keyMomentReliability,
        summary: keyMomentSummary,
        description: 'ゲームを取り切れる場面で、実際に点を取れたかを見る数字です。',
        howToRead: 'ここが高いと、終盤の1本を取り切れた場面が多かったと見られます。',
        nextCheck: 'ゲームポイントの前後で、どの配球やミスが続いたかを確認します。',
        whyItMatters: '同じ得点数でも、終盤の1本はゲームの流れを大きく動かします。',
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
        primaryValue: momentumReliability === 'none' ? '--' : formatCount(metrics.momentum.maxStreakAgainst),
        secondaryValue: momentumReliability === 'none' ? undefined : `最大連続失点 (${momentumRange})`,
        reliability: momentumReliability,
        summary: momentumSummary,
        description: '続けて失点した一番長い区間を見て、流れが止まった場面を探します。',
        howToRead: '連続失点が長いほど、その前後の入り方や判断を見返す手がかりになります。',
        nextCheck: '連続失点が始まる直前と終わる直後のポイント内容を確認します。',
        whyItMatters: '流れが変わる場面をつかむと、次回の振り返りで見る順番がはっきりします。',
        details: [
          {
            label: '最大連続失点',
            value: momentumReliability === 'none' ? 'データ不足' : `${metrics.momentum.maxStreakAgainst}点`,
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
        primaryValue: rallyReliability === 'none' ? '--' : `${formatPrimaryPercentage(shortRallyMetric)} / ${formatPrimaryPercentage(longRallyMetric)}`,
        secondaryValue: rallyReliability === 'none' ? undefined : '1-4本ラリー / 長いラリー',
        reliability: rallyReliability,
        summary: rallySummary,
        description: '短いラリーと長いラリーで、どちらが点につながりやすかったかを見るカードです。',
        howToRead: '短いラリーは入りや決め切り、長いラリーは粘りや組み立ての傾向を見るのに役立ちます。',
        nextCheck: '短いラリーで終わった点と長いラリーで終わった点を1本ずつ見比べます。',
        whyItMatters: 'どの長さのラリーで点が動いたかが分かると、試合の型を振り返りやすくなります。',
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
        primaryValue: endingReliability === 'none' ? '--' : `${winnerPoints}件 / ${opponentErrorPoints}件`,
        secondaryValue: endingReliability === 'none' ? undefined : 'ウィナー / 相手ミス',
        reliability: endingReliability,
        summary: endingSummary,
        description: '取った点が、決めた形だったか相手のミスだったかを見分けるためのカードです。',
        howToRead: '両方の比率を見ると、どの形で点が終わりやすかったかをざっくり確認できます。',
        nextCheck: '自分たちのミス内訳もあわせて見て、どこを見返すかを絞ります。',
        whyItMatters: 'ポイントの終わり方は、試合の傾向を短時間で振り返る入口になります。',
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
