// lib/playerStats/aggregators/records.ts
// 最長連勝 / 最長連敗（retired はスキップ・連鎖を切らない・数えない。データ契約 §G）/
// 最高勝率（年度別・最小試合数以上）。

import type { PlayerStatistics, StreakSpan } from '../../../src/types/playerStatistics';
import type { PlayerStatsConfig } from '../config';
import type { PlayerFacts, PlayerMatchFact } from '../types';
import { calculateRate } from './util';

function emptySpan(): StreakSpan {
  return { length: 0, from: null, to: null, fromTournament: null, toTournament: null };
}

/** facts.matches は時系列昇順（date→roundOrder）を前提。 */
function longestStreak(matches: PlayerMatchFact[], target: 'win' | 'lose'): StreakSpan {
  let best = emptySpan();
  let curLen = 0;
  let curFrom: PlayerMatchFact | null = null;
  let curTo: PlayerMatchFact | null = null;

  for (const m of matches) {
    if (!m.countsForWinRate) continue; // retired はスキップ（連鎖を切らない）
    if (m.result !== 'win' && m.result !== 'lose') {
      // draw は連鎖を切る
      curLen = 0;
      curFrom = null;
      curTo = null;
      continue;
    }
    if (m.result === target) {
      if (curLen === 0) curFrom = m;
      curLen += 1;
      curTo = m;
      if (curLen > best.length) {
        best = {
          length: curLen,
          from: curFrom?.date ?? null,
          to: curTo?.date ?? null,
          fromTournament: curFrom?.tournamentName ?? null,
          toTournament: curTo?.tournamentName ?? null,
        };
      }
    } else {
      curLen = 0;
      curFrom = null;
      curTo = null;
    }
  }
  return best;
}

export function aggregateRecords(facts: PlayerFacts, config: PlayerStatsConfig): PlayerStatistics['records'] {
  const longestWinStreak = longestStreak(facts.matches, 'win');
  const longestLoseStreak = longestStreak(facts.matches, 'lose');

  // 最高勝率: (year, discipline) 群で min 試合数以上のうち勝率最大
  const min = config.stats.minMatchesForSeasonWinRate;
  const groups = new Map<string, { wins: number; losses: number }>();
  for (const m of facts.matches) {
    if (!m.countsForWinRate) continue;
    if (m.result !== 'win' && m.result !== 'lose') continue;
    const key = `${m.year}\t${m.category}`;
    const cur = groups.get(key) ?? { wins: 0, losses: 0 };
    if (m.result === 'win') cur.wins += 1;
    else cur.losses += 1;
    groups.set(key, cur);
  }

  let bestSeason: PlayerStatistics['records']['bestSeason'] = null;
  for (const [key, v] of groups) {
    const total = v.wins + v.losses;
    if (total < min) continue;
    const winRate = calculateRate(v.wins, total);
    if (!bestSeason || winRate > bestSeason.winRate) {
      const [yearStr, discipline] = key.split('\t');
      bestSeason = {
        year: Number(yearStr),
        discipline,
        winRate,
        wins: v.wins,
        losses: v.losses,
      };
    }
  }

  return { longestWinStreak, longestLoseStreak, bestSeason };
}
