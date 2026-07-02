// lib/playerStats/aggregators/careerTimeline.ts
// キャリア年表: デビュー / 全国初出場・初優勝 / 連覇 / 所属変更 / 各年度の最高成績 を時系列整列。
// 既存 milestones + byYear + byTeam の組み立てビュー（記事生成の骨子）。

import type { MilestoneEvent, PlayerStatistics, TeamRow, TimelineEvent, YearRow } from '../../../src/types/playerStatistics';
import type { PlayerFacts } from '../types';

export function aggregateCareerTimeline(
  facts: PlayerFacts,
  parts: {
    byYear: YearRow[];
    byTeam: TeamRow[];
    milestones: MilestoneEvent[];
    titles: PlayerStatistics['titles'];
  },
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // デビュー（最初の date）
  const dates: Array<{ date: string; year: number; name: string }> = [];
  for (const m of facts.matches) if (m.date) dates.push({ date: m.date, year: m.year, name: m.tournamentName });
  for (const e of facts.entries) if (e.date) dates.push({ date: e.date, year: e.year, name: e.tournamentName });
  dates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (dates[0]) {
    events.push({
      date: dates[0].date,
      year: dates[0].year,
      kind: 'debut',
      label: `デビュー（${dates[0].name}）`,
    });
  }

  // 全国初出場 / 初優勝
  const fn = parts.titles.firsts.firstNational;
  if (fn) {
    events.push({
      date: fn.date,
      year: fn.year,
      kind: 'firstNational',
      label: `全国初出場（${fn.tournamentName}）`,
      detail: { tournamentId: fn.tournamentId },
    });
  }
  const fnt = parts.titles.firsts.firstNationalTitle;
  if (fnt) {
    events.push({
      date: fnt.date,
      year: fnt.year,
      kind: 'firstTitle',
      label: `全国初優勝（${fnt.tournamentName}）`,
      detail: { tournamentId: fnt.tournamentId },
    });
  }

  // 連覇（milestones の repeat-title）
  for (const ms of parts.milestones) {
    if (ms.kind !== 'repeat-title') continue;
    events.push({
      date: null,
      year: ms.year,
      kind: 'repeat-title',
      label: ms.label,
      detail: ms.detail,
    });
  }

  // 所属変更（byTeam の期間境界。2 校目以降の from を変更点とする）
  const teamsByFrom = parts.byTeam
    .filter((t) => t.span.from)
    .slice()
    .sort((a, b) => ((a.span.from ?? '') < (b.span.from ?? '') ? -1 : 1));
  teamsByFrom.forEach((t, i) => {
    if (i === 0) return;
    const y = Number((t.span.from ?? '').slice(0, 4)) || 0;
    events.push({
      date: t.span.from,
      year: y,
      kind: 'team-change',
      label: `所属変更（${t.team}）`,
      detail: { team: t.team },
    });
  });

  // 各年度の最高成績（bestResult のある年度）
  for (const y of parts.byYear) {
    if (!y.bestResult) continue;
    events.push({
      date: null,
      year: y.year,
      kind: 'season-best',
      label: `${y.year}年 最高成績: ${y.bestResult}`,
      detail: { bestResult: y.bestResult },
    });
  }

  events.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    const ad = a.date ?? '';
    const bd = b.date ?? '';
    return ad < bd ? -1 : ad > bd ? 1 : 0;
  });
  return events;
}
