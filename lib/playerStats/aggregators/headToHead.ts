// lib/playerStats/aggregators/headToHead.ts
// 対戦相手 H2H（既定=対個人）。1 試合の各対戦相手それぞれに対して勝敗を計上する。
// retired は除外（実戦のみ）。対戦数降順。

import type { Head2HeadRow } from '../../../src/types/playerStatistics';
import type { PersonRef, PlayerFacts } from '../types';
import { calculateRate } from './util';

export function aggregateHeadToHead(facts: PlayerFacts): Head2HeadRow[] {
  const byKey = new Map<
    string,
    {
      ref: PersonRef;
      wins: number;
      losses: number;
      first: string;
      last: string;
    }
  >();

  for (const m of facts.matches) {
    if (!m.countsForWinRate) continue;
    if (m.result !== 'win' && m.result !== 'lose') continue;
    for (const opp of m.opponents) {
      if (!opp.key) continue;
      const cur =
        byKey.get(opp.key) ??
        ({ ref: opp, wins: 0, losses: 0, first: '', last: '' } as {
          ref: PersonRef;
          wins: number;
          losses: number;
          first: string;
          last: string;
        });
      if (m.result === 'win') cur.wins += 1;
      else cur.losses += 1;
      if (cur.ref.id == null && opp.id != null) cur.ref = opp;
      const d = m.date || '';
      if (d) {
        if (!cur.first || d < cur.first) cur.first = d;
        if (!cur.last || d > cur.last) cur.last = d;
      }
      byKey.set(opp.key, cur);
    }
  }

  const rows: Head2HeadRow[] = [];
  for (const v of byKey.values()) {
    const meetings = v.wins + v.losses;
    rows.push({
      opponentId: v.ref.id,
      opponentKey: v.ref.key,
      opponentName: v.ref.name,
      meetings,
      wins: v.wins,
      losses: v.losses,
      winRate: calculateRate(v.wins, meetings),
      firstDate: v.first || null,
      lastDate: v.last || null,
    });
  }
  rows.sort((a, b) => {
    if (b.meetings !== a.meetings) return b.meetings - a.meetings;
    return b.wins - a.wins;
  });
  return rows;
}
