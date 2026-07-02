// lib/playerStats/aggregators/highlights.ts
// 便利フィールド（新セクションではない）: 最多対戦相手 / 最多ペア / 苦手・得意選手。
// headToHead / byPartner の派生。閾値 minMeetingsForH2H は config。

import type { Head2HeadRow, PartnerRow, PlayerStatistics } from '../../../src/types/playerStatistics';
import type { PlayerStatsConfig } from '../config';

export function aggregateHighlights(headToHead: Head2HeadRow[], byPartner: PartnerRow[], config: PlayerStatsConfig, topN = 5): PlayerStatistics['highlights'] {
  const min = config.stats.minMeetingsForH2H;
  const eligible = headToHead.filter((h) => h.meetings >= min);

  const tough = eligible
    .filter((h) => h.losses > h.wins)
    .sort((a, b) => b.losses - b.wins - (a.losses - a.wins))
    .slice(0, topN);

  const favorable = eligible
    .filter((h) => h.wins > h.losses)
    .sort((a, b) => b.wins - b.losses - (a.wins - a.losses))
    .slice(0, topN);

  return {
    mostFacedOpponent: headToHead[0] ?? null,
    mostFrequentPartner: byPartner[0] ?? null,
    toughOpponents: tough,
    favorableOpponents: favorable,
  };
}
