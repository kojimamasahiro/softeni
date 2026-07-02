// lib/playerStats/aggregators/reachRates.ts
// 決勝 / 準決勝 進出率。分母 = ノックアウト個人戦（singles/doubles/mixed）の出場エントリー数。
// リーグのみ・placement=unknown・team は分母から除外（データ契約 §G）。

import type { PlayerStatistics } from '../../../src/types/playerStatistics';
import type { PlayerFacts } from '../types';
import { calculateRate } from './util';

export function aggregateReachRates(facts: PlayerFacts): PlayerStatistics['reachRates'] {
  let denominator = 0;
  let finals = 0;
  let semis = 0;
  for (const e of facts.entries) {
    if (!e.isKnockoutSinglesDoublesMixed) continue;
    denominator += 1;
    if (e.reachedFinal) finals += 1;
    if (e.reachedSemifinal) semis += 1;
  }
  return {
    denominator,
    finalReachRate: calculateRate(finals, denominator),
    semifinalReachRate: calculateRate(semis, denominator),
  };
}
