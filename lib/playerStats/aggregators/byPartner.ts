// lib/playerStats/aggregators/byPartner.ts
// ペア別勝敗（対個人で集約）。doubles/mixed の match のみ（partner を持つ）。

import type { PartnerRow } from '../../../src/types/playerStatistics';
import type { PersonRef, PlayerFacts, PlayerMatchFact } from '../types';
import { foldGames, foldWinLoss } from './util';

export function aggregateByPartner(facts: PlayerFacts): PartnerRow[] {
  const byKey = new Map<string, { ref: PersonRef; matches: PlayerMatchFact[] }>();
  for (const m of facts.matches) {
    if (!m.partner) continue;
    const key = m.partner.key;
    const cur = byKey.get(key) ?? { ref: m.partner, matches: [] };
    cur.matches.push(m);
    // 数値 id が付く参照を優先保持
    if (cur.ref.id == null && m.partner.id != null) cur.ref = m.partner;
    byKey.set(key, cur);
  }

  const rows: PartnerRow[] = [];
  for (const { ref, matches } of byKey.values()) {
    rows.push({
      partnerId: ref.id,
      partnerKey: ref.key,
      partnerName: ref.name,
      matches: foldWinLoss(matches),
      games: foldGames(matches),
    });
  }
  rows.sort((a, b) => b.matches.total - a.matches.total);
  return rows;
}
