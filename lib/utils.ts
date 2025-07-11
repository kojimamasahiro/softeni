// src/lib/utils.ts
import { TournamentYearData } from '@/types/tournament';

export function resultPriority(result: string): number {
  if (result.includes('優勝') && !result.includes('準')) return 1;
  if (result.includes('準優勝')) return 2;
  if (result.includes('ベスト4')) return 3;
  if (result.includes('ベスト8')) return 4;
  if (result.includes('6回戦敗退')) return 5;
  if (result.includes('5回戦敗退')) return 6;
  if (result.includes('4回戦敗退')) return 7;
  if (result.includes('3回戦敗退')) return 8;
  if (result.includes('2回戦敗退')) return 9;
  if (result.includes('1回戦敗退')) return 10;
  if (result.includes('予選敗退')) return 11;
  if (result.includes('未出場')) return 12;
  return 99;
}

export function sortMatchesByEntryNo(
  matches: NonNullable<TournamentYearData['matches']>,
): NonNullable<TournamentYearData['matches']> {
  return matches
    .slice()
    .sort(
      (a, b) =>
        (parseInt(a.entryNo) || Infinity) - (parseInt(b.entryNo) || Infinity),
    );
}

export function getTournamentLabel(id: string): string {
  switch (id) {
    case 'highschool-japan-cup':
      return 'ハイスクールジャパンカップ';
    case 'highschool-championship':
      return '全国高等学校総合体育大会';
    case 'highschool-senbatsu':
      return '選抜';
    case 'highschool-kokutai':
      return '国体';
    default:
      return id;
  }
}

export function getCategoryLabel(cat: string): string {
  return cat === 'singles'
    ? 'シングルス'
    : cat === 'doubles'
      ? 'ダブルス'
      : '団体戦';
}
