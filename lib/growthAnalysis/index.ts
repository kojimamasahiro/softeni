// lib/growthAnalysis/index.ts
// 成長分析（/beta/matches-results/growth）のレポート生成エントリーポイント。
// 実装は責務ごとに分割済み（2026-08-01）:
//   types.ts        … 型定義
//   targets.ts       … 対象（選手/ペア）の識別・集計
//   stats.ts         … 1試合ぶんの指標算出・集計
//   comparisons.ts   … 期間・勝敗・相手別などの比較とレポートセクション組み立て
//   index.ts（本ファイル） … 上記を束ねてレポートを組み立てるエントリーポイント

import type { Match } from '../../src/types/database';
import type { GrowthBuildOptions, GrowthReport } from './types';
import { buildGrowthTargets } from './targets';
import { getStatsForTarget, formatMetricValue, formatDelta } from './stats';
import {
  getRecentPeriodComparison,
  getWinLossComparison,
  getSameOpponentComparison,
  getSameFieldComparison,
  getOpponentLevelComparison,
  buildSections,
  buildPracticeThemes,
} from './comparisons';
import type { GrowthComparison } from './types';

export * from './types';
export { getGrowthTargetForSide, getGrowthTargetsForMatch, buildGrowthTargets, isCompletedMatch } from './targets';

export const buildGrowthReport = (matches: Match[], targetKey: string, generatedAt: string = new Date().toISOString()): GrowthReport | null => {
  const target = buildGrowthTargets(matches).find((candidate) => candidate.key === targetKey);
  if (!target) return null;

  const stats = getStatsForTarget(matches, targetKey);
  const recentComparison = getRecentPeriodComparison(stats);
  const comparisons = [
    recentComparison,
    getWinLossComparison(stats),
    getSameOpponentComparison(stats),
    getSameFieldComparison(
      stats,
      'same_tournament',
      '同じ大会での比較',
      '同じ大会の試合だけで比べています。',
      (match) => match.tournament_id ?? match.tournament_name,
    ),
    getSameFieldComparison(stats, 'same_format', '同じ形式での比較', 'シングルス/ダブルスなど同じ形式の試合だけで比べています。', (match) => match.game_type),
    getSameFieldComparison(stats, 'same_pair', '同じペアでの比較', '同じペア構成の試合だけで比べています。', (match) =>
      match.game_type === 'doubles' ? targetKey : null,
    ),
    getOpponentLevelComparison(stats),
  ].filter((comparison): comparison is GrowthComparison => Boolean(comparison));

  return {
    target,
    generatedAt,
    matchCount: target.matchCount,
    completedMatchCount: stats.length,
    comparison: recentComparison,
    comparisons,
    sections: buildSections(recentComparison),
    practiceThemes: buildPracticeThemes(recentComparison),
    emptyMessage: stats.length < 2 ? 'もう少し記録すると、前回との変化や最近の傾向が見えます。' : null,
  };
};

export const buildGrowthReports = (matches: Match[], generatedAt: string = new Date().toISOString(), options: GrowthBuildOptions = {}) => {
  const targets = buildGrowthTargets(matches, options);
  const reports = targets.map((target) => buildGrowthReport(matches, target.key, generatedAt)).filter((report): report is GrowthReport => Boolean(report));

  return { targets, reports };
};

const getStableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const getGrowthReportFileName = (targetKey: string) => `${getStableHash(targetKey)}.json`;

export const formatGrowthMetricValue = formatMetricValue;
export const formatGrowthMetricDelta = formatDelta;
