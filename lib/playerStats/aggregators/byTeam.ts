// lib/playerStats/aggregators/byTeam.ts
// 所属別成績（当時の所属・正準化名で集約）。個人戦の selfTeam を集計。
// 団体戦の「チーム」とは無関係（データ契約 §I-4）。
// 国際大会（generationId==='international'）は selfTeam が国別代表コード（例: JPN-1）で
// 「所属」ではないため除外する（所属変更の誤検知を防ぐ。国際予選は実クラブなので対象）。

import type { TeamRow } from '../../../src/types/playerStatistics';
import type { PlayerFacts, PlayerMatchFact } from '../types';
import { canonicalizeTeam, foldGames, foldWinLoss, isInternationalTournament } from './util';

export function aggregateByTeam(facts: PlayerFacts, root?: string): TeamRow[] {
  const byTeam = new Map<string, { matches: PlayerMatchFact[]; dates: string[]; titles: number }>();

  for (const m of facts.matches) {
    if (isInternationalTournament(m.tournamentId, root)) continue;
    const team = canonicalizeTeam(m.selfTeam, root);
    if (!team) continue;
    const cur = byTeam.get(team) ?? { matches: [], dates: [], titles: 0 };
    cur.matches.push(m);
    if (m.date) cur.dates.push(m.date);
    byTeam.set(team, cur);
  }

  // titles: winner entry の selfTeam
  for (const e of facts.entries) {
    if (e.placement.kind !== 'winner') continue;
    if (isInternationalTournament(e.tournamentId, root)) continue;
    const team = canonicalizeTeam(e.selfTeam, root);
    if (!team) continue;
    const cur = byTeam.get(team) ?? { matches: [], dates: [], titles: 0 };
    cur.titles += 1;
    if (e.date) cur.dates.push(e.date);
    byTeam.set(team, cur);
  }

  const rows: TeamRow[] = [];
  for (const [team, v] of byTeam) {
    v.dates.sort();
    rows.push({
      team,
      span: { from: v.dates[0] ?? null, to: v.dates[v.dates.length - 1] ?? null },
      matches: foldWinLoss(v.matches),
      games: foldGames(v.matches),
      titles: v.titles,
    });
  }
  rows.sort((a, b) => {
    const af = a.span.from ?? '';
    const bf = b.span.from ?? '';
    return af < bf ? -1 : af > bf ? 1 : 0;
  });
  return rows;
}
