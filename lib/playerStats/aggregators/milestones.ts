// lib/playerStats/aggregators/milestones.ts
// 記事生成用の構造化イベント（label + shortLabel + detail + confidence）。
// 選手自身の winner entry から first-title / repeat-title / nth-title を導く。
// shortLabel の書式は既存 lib/milestones.ts と互換（男子ダブルス初優勝 / 3連覇（2021年〜）等）。

import type { MilestoneEvent } from '../../../src/types/playerStatistics';
import type { PlayerFacts } from '../types';
import { disciplineGenderLabel } from './util';

const SCOPE_NOTE = '当サイト掲載大会分の集計に基づく';

const genreGenderLabel = disciplineGenderLabel;

export function aggregateMilestones(facts: PlayerFacts): MilestoneEvent[] {
  const name = facts.displayName;
  const winners = facts.entries.filter((e) => e.placement.kind === 'winner');

  // (tid, categoryId) → 優勝年ソート
  const yearsByCat = new Map<string, number[]>();
  for (const w of winners) {
    const key = `${w.tournamentId}/${w.categoryId}`;
    const arr = yearsByCat.get(key) ?? [];
    arr.push(w.year);
    yearsByCat.set(key, arr);
  }
  for (const [k, arr] of yearsByCat) {
    yearsByCat.set(k, Array.from(new Set(arr)).sort((a, b) => a - b));
  }

  const events: MilestoneEvent[] = [];
  for (const w of winners) {
    const catKey = `${w.tournamentId}/${w.categoryId}`;
    const years = yearsByCat.get(catKey)!;
    const idx = years.indexOf(w.year);
    const cat = genreGenderLabel(w.categoryId);
    const subject = { players: [name], teams: w.selfTeam ? [w.selfTeam] : [], display: name };

    // 連続年の後尾長を数える
    let runLen = 1;
    let since = w.year;
    for (let i = idx - 1; i >= 0; i--) {
      if (years[i + 1] - years[i] === 1) {
        runLen += 1;
        since = years[i];
      } else break;
    }

    if (runLen >= 2) {
      const streakLabel = runLen >= 3 ? `${runLen}連覇` : '連覇（2連覇）';
      const shortLabel = `${cat}${streakLabel}（${since}年〜）`;
      events.push({
        kind: 'repeat-title',
        subject,
        tournamentId: w.tournamentId,
        categoryId: w.categoryId,
        year: w.year,
        detail: { streak: runLen, since },
        confidence: 'confirmed',
        label: `${name} ${shortLabel}`,
        shortLabel,
      });
    } else if (idx === 0) {
      const shortLabel = `${cat}初優勝`;
      events.push({
        kind: 'first-title',
        subject,
        tournamentId: w.tournamentId,
        categoryId: w.categoryId,
        year: w.year,
        detail: { coveredSince: years[0] },
        confidence: 'scope-limited',
        label: `${name} ${shortLabel}`,
        shortLabel,
        scopeNote: SCOPE_NOTE,
      });
    } else {
      const n = idx + 1;
      const shortLabel = `${cat}${n}回目の優勝`;
      events.push({
        kind: 'nth-title',
        subject,
        tournamentId: w.tournamentId,
        categoryId: w.categoryId,
        year: w.year,
        detail: { n, coveredSince: years[0] },
        confidence: 'scope-limited',
        label: `${name} ${shortLabel}`,
        shortLabel,
        scopeNote: SCOPE_NOTE,
      });
    }
  }

  // 年度昇順 → 種目で安定ソート
  events.sort((a, b) => a.year - b.year || a.categoryId.localeCompare(b.categoryId));
  return events;
}
