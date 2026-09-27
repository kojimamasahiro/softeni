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
  rally9PlusWinRate: {
    title: '9本以上のラリーで無理に決めにいかない',
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

// 比較の文。数字は各行に出すので、ここでは指標の名前だけを挙げる（同じ数字を何度も出さない。2026-09-27）
export const buildComparisonMessages = (metrics: GrowthMetric[]) => {
  const improved = getImprovedMetrics(metrics).slice(0, 2);
  const declined = getDeclinedMetrics(metrics).slice(0, 2);
  const messages: string[] = [];
  if (improved.length > 0) messages.push(`伸びた指標: ${improved.map((metric) => metric.label).join('、')}`);
  if (declined.length > 0) messages.push(`次に見ておきたい指標: ${declined.map((metric) => metric.label).join('、')}`);
  if (messages.length === 0) messages.push('大きな変化はまだ見えにくい状態です。次の数試合も続けて確認してみましょう。');
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

// 「最近の成長」の比べ方（2026-09-27 にユーザー確認のうえ変更）
// - 2〜5試合: 最新の1試合と、それ以前の全試合をまとめた値を比べる。記録を全部使い、「今回はいつもと比べてどうか」を見る
//   （以前は直近1試合とその前の1試合だけで、3〜5試合あっても古い試合を使っていなかった）
// - 6試合以上: 直近の数試合と、その直前の同じ数の試合を比べる（6〜9試合は3試合ずつ、10試合以上は5試合ずつ）
export const RECENT_PERIOD_WINDOW_MIN_MATCHES = 6;

export const getRecentPeriodComparison = (stats: SingleMatchGrowthStats[]): GrowthComparison | null => {
  if (stats.length < 2) return null;

  if (stats.length < RECENT_PERIOD_WINDOW_MIN_MATCHES) {
    const currentStats = stats.slice(-1);
    const previousStats = stats.slice(0, -1);
    return buildComparison({
      kind: 'recent_period',
      title: '最近の成長',
      description: `最新の1試合と、それ以前の${previousStats.length}試合をまとめた値を比べています。`,
      currentLabel: '最新試合',
      previousLabel: 'それ以前',
      currentStats,
      previousStats,
    });
  }

  const windowSize = stats.length >= 10 ? 5 : 3;
  const currentStats = stats.slice(-windowSize);
  const previousStats = stats.slice(-(windowSize * 2), -windowSize);

  return buildComparison({
    kind: 'recent_period',
    title: '最近の成長',
    description: `直近の${currentStats.length}試合と、その前の${previousStats.length}試合を比べています。`,
    currentLabel: `直近${currentStats.length}試合`,
    previousLabel: `前${previousStats.length}試合`,
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

// 各指標は1回だけ出す。以前の「最近の成長」「改善トラッキング」は下の節と同じ指標を繰り返していたので「まとめ」に吸収した（2026-09-27）。
const SECTION_DEFS: Array<{ id: string; title: string; categories: GrowthMetric['category'][] }> = [
  { id: 'serve', title: 'サーブとレシーブ', categories: ['serve', 'receive'] },
  { id: 'key_moment', title: '重要局面', categories: ['key_moment'] },
  { id: 'momentum', title: '流れ（連続失点）', categories: ['momentum'] },
  { id: 'rally', title: 'ラリーの長さ別', categories: ['rally'] },
];

export const buildSections = (comparison: GrowthComparison | null): GrowthReportSection[] => {
  if (!comparison) return [];
  const summary: GrowthReportSection = { id: 'summary', title: 'まとめ', messages: buildComparisonMessages(comparison.metrics), metrics: [] };
  const sections = SECTION_DEFS.map(({ id, title, categories }) => ({
    id,
    title,
    messages: [],
    metrics: comparison.metrics.filter((metric) => categories.includes(metric.category) && metric.denominator > 0),
  })).filter((section) => section.metrics.length > 0);
  return [summary, ...sections];
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
