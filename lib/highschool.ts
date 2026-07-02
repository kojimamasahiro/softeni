// lib/highschool.ts
// 高校カテゴリページ共通のロジック・定数

export type HighschoolGender = 'boys' | 'girls';
export type HighschoolEntryGender = HighschoolGender | 'mixed';

/** 高校主要大会の表示優先度（小さいほど優先） */
export const HIGHSCHOOL_TOURNAMENT_PRIORITY: Record<string, number> = {
  'highschool-kokutai': 1, // 国体
  'highschool-championship': 2, // インターハイ
  'highschool-japan-cup': 3, // ハイスクールジャパンカップ
  'highschool-senbatsu': 4, // 選抜
};

export const getTournamentSortPriority = (tournamentId: string): number => HIGHSCHOOL_TOURNAMENT_PRIORITY[tournamentId] ?? 99;

/** 種目の表示優先度（小さいほど優先） */
export const HIGHSCHOOL_CATEGORY_PRIORITY: Record<string, number> = {
  team: 1,
  doubles: 2,
  singles: 3,
};

/** ベスト8以上として扱う成績 */
export const HIGH_RESULT_SET = new Set(['優勝', '準優勝', 'ベスト4', 'ベスト8']);

export const isBest8Result = (result: string): boolean => HIGH_RESULT_SET.has(result);

/** mixed の成績は boys / girls の両ページに表示する */
export const isVisibleGender = (entryGender: string, pageGender: HighschoolGender): boolean => entryGender === pageGender || entryGender === 'mixed';

export const getGenderLabel = (gender: HighschoolGender): string => (gender === 'boys' ? '男子' : '女子');

export type PerformanceLabel = '好成績' | '健闘' | '敗退' | '予選敗退';

/** 成績文言から評価ラベルを返す（"未出場" などは null） */
export const getPerformanceLabel = (result: string): PerformanceLabel | null => {
  if (HIGH_RESULT_SET.has(result)) return '好成績';
  if (['6回戦敗退', '5回戦敗退', '4回戦敗退', '3回戦敗退'].includes(result)) return '健闘';
  if (['2回戦敗退', '1回戦敗退'].includes(result)) return '敗退';
  if (result === '予選敗退') return '予選敗退';
  return null;
};
