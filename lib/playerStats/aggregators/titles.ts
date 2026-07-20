// lib/playerStats/aggregators/titles.ts
// 通算優勝数 / 主要大会優勝数 / 大会別優勝 / 連覇 / n回目 / 全国初出場・初優勝。
// winner entry（placement.kind==='winner'）を素に集計。scope=当サイト掲載分。

import type { FirstEvent, NationalTitle, PlayerStatistics, TitleStreak } from '../../../src/types/playerStatistics';
import { getNationalTitleMeta, isNationalTitleTournament } from '../../nationalTitles';
import type { PlayerEntryFact, PlayerFacts } from '../types';
import { disciplineGenderLabel } from './util';

const disciplineLabel = disciplineGenderLabel;

export function aggregateTitles(facts: PlayerFacts): PlayerStatistics['titles'] {
  const winners = facts.entries.filter((e) => e.placement.kind === 'winner');

  let total = 0;
  let major = 0;
  const byTournament: Record<string, number> = {};
  const nth: Record<string, number> = {};
  // (tid, categoryId) → 優勝年一覧
  const yearsByCat = new Map<string, number[]>();

  for (const w of winners) {
    total += 1;
    if (w.isMajorTitle) major += 1;
    byTournament[w.tournamentId] = (byTournament[w.tournamentId] ?? 0) + 1;
    const catKey = `${w.tournamentId}/${w.categoryId}`;
    nth[catKey] = (nth[catKey] ?? 0) + 1;
    const arr = yearsByCat.get(catKey) ?? [];
    arr.push(w.year);
    yearsByCat.set(catKey, arr);
  }

  // 連覇: 同一 (tid, categoryId) の連続年
  const streaks: TitleStreak[] = [];
  for (const [catKey, yearsRaw] of yearsByCat) {
    const years = Array.from(new Set(yearsRaw)).sort((a, b) => a - b);
    let runStart = years[0];
    let runLen = 1;
    const flush = () => {
      if (runLen >= 2) {
        const [tournamentId, categoryId] = catKey.split('/');
        streaks.push({
          tournamentId,
          categoryId,
          discipline: disciplineLabel(categoryId),
          streak: runLen,
          since: runStart,
        });
      }
    };
    for (let i = 1; i < years.length; i++) {
      if (years[i] - years[i - 1] === 1) {
        runLen += 1;
      } else {
        flush();
        runStart = years[i];
        runLen = 1;
      }
    }
    flush();
  }
  streaks.sort((a, b) => b.streak - a.streak);

  // 全国初出場 / 全国初優勝（date 昇順の最初）
  const byDate = (a: PlayerEntryFact, b: PlayerEntryFact) => ((a.date || '') < (b.date || '') ? -1 : (a.date || '') > (b.date || '') ? 1 : 0);

  const toFirstEvent = (e: PlayerEntryFact | undefined): FirstEvent | null =>
    e
      ? {
          tournamentId: e.tournamentId,
          tournamentName: e.tournamentName,
          categoryId: e.categoryId,
          year: e.year,
          date: e.date || null,
        }
      : null;

  // 「全国」の判定は entry の広義 isNational（＝国際大会以外すべて。東日本/西日本選手権のような
  // 地域大会も true）ではなく、lib/nationalTitles.ts の明示ホワイトリストを使う（2026-07-20 統一）。
  // 以前は isNational を使っていたため、東日本選手権への出場・優勝が「全国初出場」「全国初優勝」
  // としてキャリア年表に出ていた。バッジ（titles.national）と基準を揃えて解消する。
  // なお isNational 自体はランキング tier 等で引き続き使うため、定義は変更していない。
  const nationalEntries = facts.entries
    .filter((e) => isNationalTitleTournament(e.tournamentId))
    .slice()
    .sort(byDate);
  const firstNational = toFirstEvent(nationalEntries[0]);

  const nationalTitles = winners
    .filter((e) => isNationalTitleTournament(e.tournamentId))
    .slice()
    .sort(byDate);
  const firstNationalTitle = toFirstEvent(nationalTitles[0]);

  // 全国大会優勝（実績表示用）。判定は lib/nationalTitles.ts のホワイトリストで、
  // 上の firstNational* が使う広義の isNational（東日本/西日本選手権も true）とは別基準。
  const nationalTitleList: NationalTitle[] = [];
  for (const w of winners) {
    const meta = getNationalTitleMeta(w.tournamentId);
    if (!meta) continue;
    nationalTitleList.push({
      tournamentId: w.tournamentId,
      tournamentName: meta.label,
      shortLabel: meta.shortLabel,
      categoryId: w.categoryId,
      discipline: disciplineLabel(w.categoryId),
      year: w.year,
      date: w.date || null,
    });
  }
  // 年度降順（同年度は日付降順）。直近優先であって格付けではない。
  nationalTitleList.sort((a, b) => b.year - a.year || (b.date ?? '').localeCompare(a.date ?? ''));

  return {
    total,
    major,
    byTournament,
    streaks,
    nth,
    national: {
      count: nationalTitleList.length,
      tournamentCount: new Set(nationalTitleList.map((t) => t.tournamentId)).size,
      titles: nationalTitleList,
    },
    firsts: { firstNational, firstNationalTitle },
  };
}
