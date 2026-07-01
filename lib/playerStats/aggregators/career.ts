// lib/playerStats/aggregators/career.ts
// 歴代戦績（種目別 + 総計 + 期間）。retired・draw は勝率/ゲーム率から除外（実戦ベース）。

import type { CareerTotals } from '../../../src/types/playerStatistics';
import type { PlayerFacts } from '../types';
import { foldGames, foldWinLoss } from './util';

export function aggregateCareer(facts: PlayerFacts): CareerTotals {
  const byDiscipline: CareerTotals['byDiscipline'] = {};
  const groups = new Map<string, typeof facts.matches>();
  for (const m of facts.matches) {
    const arr = groups.get(m.category) ?? [];
    arr.push(m);
    groups.set(m.category, arr);
  }
  for (const [disc, arr] of groups) {
    byDiscipline[disc] = { matches: foldWinLoss(arr), games: foldGames(arr) };
  }

  // 期間: match/entry の date（空文字除外）の min/max
  const dates: string[] = [];
  for (const m of facts.matches) if (m.date) dates.push(m.date);
  for (const e of facts.entries) if (e.date) dates.push(e.date);
  dates.sort();

  return {
    overall: {
      matches: foldWinLoss(facts.matches),
      games: foldGames(facts.matches),
    },
    byDiscipline,
    span: {
      from: dates[0] ?? null,
      to: dates[dates.length - 1] ?? null,
    },
  };
}
