// src/lib/utils.ts
import { TournamentYearData } from '@/types/tournament';

export function resultPriority(result: string): number {
  if (result.includes('優勝') && !result.includes('準')) return 1;
  if (result.includes('準優勝')) return 2;
  if (result.includes('ベスト4')) return 3;
  if (result.includes('ベスト8')) return 4;
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
