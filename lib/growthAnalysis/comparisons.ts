import type { Match } from '../../src/types/database';
import type { GrowthComparison, GrowthComparisonKind, GrowthMetric, GrowthReportSection, PracticeTheme, SingleMatchGrowthStats } from './types';
import { aggregateStats, buildGrowthMetrics } from './stats';

const practiceThemeMap: Record<string, Omit<PracticeTheme, 'id' | 'sourceMetricKey' | 'priority'>> = {
  secondServePointWinRate: {
    title: '2ndサービス後の1本目を安定させる',
    description: '2ndサービス時のポイントを、次の試合でも続けて確認してみましょう。',
  },
  doubleFaultRate: {
    title: '2ndサービスを入れにいく形を確認する',
    description: 'ダブルフォルトが続く場面を減らせるかを見てみましょう。',
  },
  receivePointWinRate: {
    title: 'レシーブから先にミスしない',
    description: 'レシーブ後の1本目まで含めて、落ち着いて入ることを確認します。',
  },
  longRallyWinRate: {
    title: '6本以上のラリーで無理に決めにいかない',
    description: '長いラリーで失点しにくい形を作れるかを見てみましょう。',
  },
  threePointLostStreakCount: {
    title: '連続失点後の1点を丁寧に取る',
    description: '流れが傾いた後の次のポイントを、練習テーマとして確認します。',
  },
  maxLostStreak: {
    title: '失点が続いた場面の入り方を整える',
    description: '最大連続失点を小さくできるかを次の試合で見てみましょう。',
  },
  afterTwoTwoPointWinRate: {
    title: '競った場面での配球・入り方を確認する',
    description: '2-2から先にリードできる場面を増やせるかを確認します。',
  },
  gamePointWinRate: {
    title: 'ゲームポイントの取り切り方を確認する',
    description: 'ゲームポイントで急がず、取り切る形を見直してみましょう。',
  },
};

export const getComparableMetrics = (metrics: GrowthMetric[]) =>
  metrics.filter((metric) => metric.currentValue !== null && metric.previousValue !== null && metric.confidence !== 'insufficient_sample');

export const getImprovedMetrics = (metrics: GrowthMetric[]) =>
  getComparableMetrics(metrics)
    .filter((metric) => metric.trend === 'improved')
    .sort((left, right) => Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0));

export const getDeclinedMetrics = (metrics: GrowthMetric[]) =>
  getComparableMetrics(metrics)
    .filter((metric) => metric.trend === 'declined')
    .sort((left, right) => Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0));

export const buildComparisonMessages = (metrics: GrowthMetric[]) => {
  const improved = getImprovedMetrics(metrics)[0];
  const declined = getDeclinedMetrics(metrics)[0];
  const messages: string[] = [];

  if (improved) {
    messages.push(improved.summary);
  }
  if (declined) {
    messages.push(declined.summary);
  }
  if (messages.length === 0) {
    messages.push('大きな変化はまだ見えにくい状態です。次の数試合も続けて確認してみましょう。');
  }

  return messages;
};

const buildComparison = ({
  kind,
  title,
  description,
  currentLabel,
  previousLabel,
  currentStats,
  previousStats,
}: {
  kind: GrowthComparisonKind;
  title: string;
  description: string;
  currentLabel: string;
  previousLabel: string;
  currentStats: SingleMatchGrowthStats[];
  previousStats: SingleMatchGrowthStats[];
}): GrowthComparison | null => {
  if (currentStats.length === 0 || previousStats.length === 0) return null;

  const metrics = buildGrowthMetrics(aggregateStats(currentStats), aggregateStats(previousStats));

  return {
    kind,
    title,
    description,
    currentLabel,
    previousLabel,
    currentMatchCount: currentStats.length,
    previousMatchCount: previousStats.length,
    metrics,
    messages: buildComparisonMessages(metrics),
  };
};

export const getRecentPeriodComparison = (stats: SingleMatchGrowthStats[]): GrowthComparison | null => {
  if (stats.length < 2) return null;
  const windowSize = stats.length >= 10 ? 5 : stats.length >= 6 ? 3 : 1;
  const currentStats = stats.slice(-windowSize);
  const previousStats = stats.slice(-(windowSize * 2), -windowSize);

  return buildComparison({
    kind: 'recent_period',
    title: '最近の成長',
    description: `${currentStats.length}試合と、その前の${previousStats.length}試合を比べています。`,
    currentLabel: windowSize === 1 ? '今回' : `直近${currentStats.length}試合`,
    previousLabel: windowSize === 1 ? '前回' : `前${previousStats.length}試合`,
    currentStats,
    previousStats,
  });
};

export const getWinLossComparison = (stats: SingleMatchGrowthStats[]): GrowthComparison | null => {
  const wonStats = stats.filter((entry) => entry.targetWon);
  const lostStats = stats.filter((entry) => !entry.targetWon);

  return buildComparison({
    kind: 'win_loss',
    title: '勝ち試合と負け試合の差',
    description: '勝敗だけでなく、どの場面で差が出ているかを比べています。',
    currentLabel: '勝ち試合',
    previousLabel: '負け試合',
    currentStats: wonStats,
    previousStats: lostStats,
  });
};

export const getRecentPeriodComparisonForKind = (stats: SingleMatchGrowthStats[], kind: GrowthComparisonKind, title: string, description: string) => {
  if (stats.length < 2) return null;
  const currentStats = stats.slice(-1);
  const previousStats = stats.slice(0, -1);
  return buildComparison({
    kind,
    title,
    description,
    currentLabel: '最新試合',
    previousLabel: '過去平均',
    currentStats,
    previousStats,
  });
};

export const getSameOpponentComparison = (stats: SingleMatchGrowthStats[]): GrowthComparison | null => {
  const latest = stats[stats.length - 1];
  if (!latest) return null;
  const sameOpponentStats = stats.filter((entry) => entry.opponentKey === latest.opponentKey);
  return getRecentPeriodComparisonForKind(sameOpponentStats, 'same_opponent', `同じ相手との比較`, `${latest.opponentName} との試合だけで比べています。`);
};

export const getSameFieldComparison = (
  stats: SingleMatchGrowthStats[],
  kind: GrowthComparisonKind,
  title: string,
  description: string,
  getField: (match: Match) => string | null | undefined,
) => {
  const latest = stats[stats.length - 1];
  const fieldValue = latest ? getField(latest.match) : null;
  if (!fieldValue) return null;
  return getRecentPeriodComparisonForKind(
    stats.filter((entry) => getField(entry.match) === fieldValue),
    kind,
    title,
    description,
  );
};

const getOpponentLevelLabel = (level: string) => {
  if (level === 'stronger') return '格上';
  if (level === 'same') return '同格';
  if (level === 'weaker') return '格下';
  return '不明';
};

export const getOpponentLevelComparison = (stats: SingleMatchGrowthStats[]): GrowthComparison | null => {
  const latest = stats[stats.length - 1];
  const level = latest?.match.opponent_level ?? 'unknown';
  if (!latest || level === 'unknown') return null;
  return getRecentPeriodComparisonForKind(
    stats.filter((entry) => (entry.match.opponent_level ?? 'unknown') === level),
    'opponent_level',
    '相手レベル別比較',
    `相手レベル「${getOpponentLevelLabel(level)}」の試合だけで比べています。`,
  );
};

const buildTrackingMessages = (metrics: GrowthMetric[]) => {
  const improved = getImprovedMetrics(metrics)[0];
  const declined = getDeclinedMetrics(metrics)[0];
  const messages: string[] = [];

  if (improved) {
    messages.push(`前回まで確認していた「${improved.label}」は改善傾向です。`);
  }
  if (declined) {
    messages.push(`一方で「${declined.label}」は次の試合で確認してみましょう。`);
  }
  if (messages.length === 0) {
    messages.push('改善トラッキングは、あと数試合記録すると見えやすくなります。');
  }
  return messages;
};

export const buildSections = (comparison: GrowthComparison | null): GrowthReportSection[] => {
  if (!comparison) return [];
  const byCategory = (category: GrowthMetric['category']) => comparison.metrics.filter((metric) => metric.category === category);

  const sections: GrowthReportSection[] = [
    {
      id: 'summary',
      title: '最近の成長',
      messages: comparison.messages,
      metrics: getComparableMetrics(comparison.metrics).slice(0, 4),
    },
    {
      id: 'tracking',
      title: '改善トラッキング',
      messages: buildTrackingMessages(comparison.metrics),
      metrics: [...getImprovedMetrics(comparison.metrics), ...getDeclinedMetrics(comparison.metrics)].slice(0, 3),
    },
    {
      id: 'serve',
      title: 'サーブ成長',
      messages: buildComparisonMessages(byCategory('serve')),
      metrics: byCategory('serve'),
    },
    {
      id: 'key_moment',
      title: '重要局面',
      messages: buildComparisonMessages(byCategory('key_moment')),
      metrics: byCategory('key_moment'),
    },
    {
      id: 'momentum',
      title: '連続失点の変化',
      messages: buildComparisonMessages(byCategory('momentum')),
      metrics: byCategory('momentum'),
    },
    {
      id: 'rally',
      title: 'ラリー傾向',
      messages: buildComparisonMessages(byCategory('rally')),
      metrics: byCategory('rally'),
    },
  ];

  return sections.map((section) => ({
    ...section,
    metrics: section.metrics.filter((metric) => metric.denominator > 0),
  }));
};

export const buildPracticeThemes = (comparison: GrowthComparison | null): PracticeTheme[] => {
  if (!comparison) return [];

  return getDeclinedMetrics(comparison.metrics)
    .filter((metric) => practiceThemeMap[metric.key])
    .slice(0, 3)
    .map((metric, index) => ({
      id: `practice-${metric.key}`,
      sourceMetricKey: metric.key,
      priority: index + 1,
      ...practiceThemeMap[metric.key],
    }));
};
