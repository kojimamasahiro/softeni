// lib/playerStats/aggregators/byYear.ts
// 年度別（年度=year。降順）。最高成績付き。

import type { YearRow } from '../../../src/types/playerStatistics';
import type { PlayerFacts } from '../types';
import { foldGames, foldWinLoss, placementLabel, placementRank } from './util';

export function aggregateByYear(facts: PlayerFacts): YearRow[] {
  const byYear = new Map<number, typeof facts.matches>();
  for (const m of facts.matches) {
    const arr = byYear.get(m.year) ?? [];
    arr.push(m);
    byYear.set(m.year, arr);
  }

  // 年度ごとの最高成績（entries の placement）
  const bestByYear = new Map<number, { rank: number; label: string }>();
  for (const e of facts.entries) {
    const rank = placementRank(e.placement);
    const cur = bestByYear.get(e.year);
    if (!cur || rank > cur.rank) {
      bestByYear.set(e.year, { rank, label: placementLabel(e.placement) });
    }
  }

  const rows: YearRow[] = [];
  for (const [year, arr] of byYear) {
    const best = bestByYear.get(year);
    rows.push({
      year,
      discipline: 'all',
      matches: foldWinLoss(arr),
      games: foldGames(arr),
      bestResult: best && best.label ? best.label : null,
    });
  }
  // entries はあるが match が無い年度（team のみ等）も拾う
  for (const [year, best] of bestByYear) {
    if (byYear.has(year)) continue;
    rows.push({
      year,
      discipline: 'all',
      matches: { total: 0, wins: 0, losses: 0, winRate: 0 },
      games: { total: 0, won: 0, lost: 0, gameRate: 0 },
      bestResult: best.label || null,
    });
  }

  rows.sort((a, b) => b.year - a.year);
  return rows;
}
