// lib/playerStats/aggregators/titles.ts
// 通算優勝数 / 主要大会優勝数 / 大会別優勝 / 連覇 / n回目 / 全国初出場・初優勝。
// winner entry（placement.kind==='winner'）を素に集計。scope=当サイト掲載分。

import type {
  FirstEvent,
  PlayerStatistics,
  TitleStreak,
} from '../../../src/types/playerStatistics';
import type { PlayerEntryFact, PlayerFacts } from '../types';
import { disciplineGenderLabel } from './util';

const disciplineLabel = disciplineGenderLabel;

export function aggregateTitles(facts: PlayerFacts): PlayerStatistics['titles'] {
  const winners = facts.entries.filter((e) => e.placement.kind === 'winner');

  let total = 0;
  let major = 0;
  const byTournament: Record<string, number> = {};
  const nth: Record<string, number> = {};
  // (tid, categoryId) → 優勝年一覧
  const yearsByCat = new Map<string, number[]>();

  for (const w of winners) {
    total += 1;
    if (w.isMajorTitle) major += 1;
    byTournament[w.tournamentId] = (byTournament[w.tournamentId] ?? 0) + 1;
    const catKey = `${w.tournamentId}/${w.categoryId}`;
    nth[catKey] = (nth[catKey] ?? 0) + 1;
    const arr = yearsByCat.get(catKey) ?? [];
    arr.push(w.year);
    yearsByCat.set(catKey, arr);
  }

  // 連覇: 同一 (tid, categoryId) の連続年
  const streaks: TitleStreak[] = [];
  for (const [catKey, yearsRaw] of yearsByCat) {
    const years = Array.from(new Set(yearsRaw)).sort((a, b) => a - b);
    let runStart = years[0];
    let runLen = 1;
    const flush = (endIdx: number) => {
      if (runLen >= 2) {
        const [tournamentId, categoryId] = catKey.split('/');
        streaks.push({
          tournamentId,
          categoryId,
          discipline: disciplineLabel(categoryId),
          streak: runLen,
          since: runStart,
        });
      }
    };
    for (let i = 1; i < years.length; i++) {
      if (years[i] - years[i - 1] === 1) {
        runLen += 1;
      } else {
        flush(i - 1);
        runStart = years[i];
        runLen = 1;
      }
    }
    flush(years.length - 1);
  }
  streaks.sort((a, b) => b.streak - a.streak);

  // 全国初出場 / 全国初優勝（date 昇順の最初）
  const byDate = (a: PlayerEntryFact, b: PlayerEntryFact) =>
    (a.date || '') < (b.date || '') ? -1 : (a.date || '') > (b.date || '') ? 1 : 0;

  const toFirstEvent = (e: PlayerEntryFact | undefined): FirstEvent | null =>
    e
      ? {
          tournamentId: e.tournamentId,
          tournamentName: e.tournamentName,
          categoryId: e.categoryId,
          year: e.year,
          date: e.date || null,
        }
      : null;

  const nationalEntries = facts.entries
    .filter((e) => e.isNational)
    .slice()
    .sort(byDate);
  const firstNational = toFirstEvent(nationalEntries[0]);

  const nationalTitles = winners
    .filter((e) => e.isNational)
    .slice()
    .sort(byDate);
  const firstNationalTitle = toFirstEvent(nationalTitles[0]);

  return {
    total,
    major,
    byTournament,
    streaks,
    nth,
    firsts: { firstNational, firstNationalTitle },
  };
}
