// lib/highschoolChampionRecords.ts
// 高校全国大会の歴代ページに出す「記録」（種目別の最多優勝校・最長連覇）。
//
// 「インターハイ 最多優勝」「連覇」のような記録系の検索語の受け皿（docs/raw/2026-09-22-idea-seo-expansion.md #3）。
// 数え方（2026-09-22 ユーザー判断）:
// - **種目別に数える**（男子団体・女子ダブルス等を合算しない）。
// - 数えるのは**収録範囲の中だけ**。画面・FAQ でも「{収録範囲}の記録」と明記する。
// - 連覇は**収録のある連続した年**だけで数える。収録の無い年・中止の年をまたぐと途切れる
//   （中止の年をまたいだ優勝を連覇と呼ぶかは数え方が割れるため、数えない側に倒す）。
// - 個人戦は所属校で数える。ペアの所属が2校なら両校に1回ずつ数える。

import type { ChampionSummaryRow } from './highschoolNationalTournaments';

export type SchoolCount = { school: string; count: number; years: number[] };
export type SchoolStreak = { school: string; length: number; from: number; to: number };

export type CategoryRecord = {
  categoryId: string;
  label: string;
  /** 優勝回数が最多の学校（同数は全校）。最多が1回なら空（記録として意味が無い） */
  mostTitles: SchoolCount[];
  /** 最長の連覇（同数は全件）。2連覇未満なら空 */
  longestStreaks: SchoolStreak[];
};

export function computeChampionRecords(rows: ChampionSummaryRow[]): CategoryRecord[] {
  const records: CategoryRecord[] = [];
  for (const row of rows) {
    const winnersByYear = new Map<number, Set<string>>();
    for (const cell of row.byYear) {
      if (!cell.winner) continue;
      const schools = new Set(cell.teams.filter((t) => !!t));
      if (schools.size > 0) winnersByYear.set(cell.year, schools);
    }

    const counts = new Map<string, number[]>();
    for (const [year, schools] of winnersByYear) for (const s of schools) counts.set(s, [...(counts.get(s) ?? []), year]);
    const max = Math.max(0, ...[...counts.values()].map((y) => y.length));
    const mostTitles =
      max >= 2
        ? [...counts.entries()]
            .filter(([, y]) => y.length === max)
            .map(([school, y]) => ({ school, count: y.length, years: [...y].sort((a, b) => a - b) }))
            .sort((a, b) => a.school.localeCompare(b.school, 'ja'))
        : [];

    // 連覇: 前年も同じ学校が優勝している（前年に収録があり、かつ優勝校に含まれる）ときだけ伸ばす。
    const streaks: SchoolStreak[] = [];
    const years = [...winnersByYear.keys()].sort((a, b) => a - b);
    const running = new Map<string, { from: number; length: number }>();
    for (const year of years) {
      const schools = winnersByYear.get(year)!;
      const prev = winnersByYear.get(year - 1);
      for (const s of schools) {
        const cur = prev?.has(s) && running.has(s) ? running.get(s)! : { from: year, length: 0 };
        cur.length += 1;
        running.set(s, cur);
        streaks.push({ school: s, length: cur.length, from: cur.from, to: year });
      }
      for (const s of [...running.keys()]) if (!schools.has(s)) running.delete(s);
    }
    const best = Math.max(0, ...streaks.map((s) => s.length));
    const longestStreaks = best >= 2 ? streaks.filter((s) => s.length === best).sort((a, b) => a.from - b.from || a.school.localeCompare(b.school, 'ja')) : [];

    records.push({ categoryId: row.categoryId, label: row.label, mostTitles, longestStreaks });
  }
  return records.filter((r) => r.mostTitles.length > 0 || r.longestStreaks.length > 0);
}

/** 1種目ぶんの記録を1文にする（画面と FAQ で同じ文面を使う）。 */
export function describeCategoryRecord(r: CategoryRecord): string {
  const parts: string[] = [];
  if (r.mostTitles.length > 0) {
    parts.push(`最多優勝は${r.mostTitles.map((m) => `${m.school}（${m.count}回）`).join('・')}`);
  }
  if (r.longestStreaks.length > 0) {
    parts.push(`最長連覇は${r.longestStreaks.map((s) => `${s.school}の${s.length}連覇（${s.from}〜${s.to}年）`).join('・')}`);
  }
  return `${r.label}: ${parts.join('、')}。`;
}
