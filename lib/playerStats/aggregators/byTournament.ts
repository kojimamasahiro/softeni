// lib/playerStats/aggregators/byTournament.ts
// 大会別（出場数 / 通算WL / 最高成績 / 優勝数 / 各回年度）。

import type { TournamentRow } from '../../../src/types/playerStatistics';
import type { PlayerFacts } from '../types';
import { foldWinLoss, placementLabel, placementRank } from './util';

export function aggregateByTournament(facts: PlayerFacts): TournamentRow[] {
  const matchesByTid = new Map<string, typeof facts.matches>();
  for (const m of facts.matches) {
    const arr = matchesByTid.get(m.tournamentId) ?? [];
    arr.push(m);
    matchesByTid.set(m.tournamentId, arr);
  }

  const meta = new Map<
    string,
    {
      name: string;
      appearances: Set<string>;
      years: Set<number>;
      titles: number;
      best: { rank: number; label: string };
    }
  >();
  for (const e of facts.entries) {
    const cur = meta.get(e.tournamentId) ?? {
      name: e.tournamentName,
      appearances: new Set<string>(),
      years: new Set<number>(),
      titles: 0,
      best: { rank: -1, label: '' },
    };
    cur.appearances.add(`${e.year}/${e.categoryId}`);
    cur.years.add(e.year);
    if (e.placement.kind === 'winner') cur.titles += 1;
    const rank = placementRank(e.placement);
    if (rank > cur.best.rank) {
      cur.best = { rank, label: placementLabel(e.placement) };
    }
    meta.set(e.tournamentId, cur);
  }

  const rows: TournamentRow[] = [];
  const tids = new Set<string>([...meta.keys(), ...matchesByTid.keys()]);
  for (const tid of tids) {
    const m = meta.get(tid);
    const matchArr = matchesByTid.get(tid) ?? [];
    rows.push({
      tournamentId: tid,
      tournamentName: m?.name ?? matchArr[0]?.tournamentName ?? tid,
      appearances: m ? m.appearances.size : 0,
      matches: foldWinLoss(matchArr),
      titles: m?.titles ?? 0,
      bestResult: m && m.best.label ? m.best.label : null,
      years: m ? Array.from(m.years).sort((a, b) => b - a) : [],
    });
  }

  rows.sort((a, b) => {
    if (b.titles !== a.titles) return b.titles - a.titles;
    if (b.appearances !== a.appearances) return b.appearances - a.appearances;
    return b.matches.total - a.matches.total;
  });
  return rows;
}
