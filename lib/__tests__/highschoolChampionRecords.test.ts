// lib/__tests__/highschoolChampionRecords.test.ts
// 実行: npm run records:test
//
// 高校全国大会の歴代ページの「記録」（最多優勝・最長連覇）の数え方を固定する（lib/highschoolChampionRecords.ts）。

import { assert, summary, test } from '../playerStats/__tests__/harness';
import { computeChampionRecords, describeCategoryRecord } from '../highschoolChampionRecords';
import type { ChampionSummaryRow } from '../highschoolNationalTournaments';

console.log('highschoolChampionRecords.test.ts');

const row = (winners: Record<number, string[]>): ChampionSummaryRow => ({
  categoryId: 'team-none-boys',
  label: '男子団体',
  category: 'team',
  gender: 'boys',
  byYear: Object.entries(winners).map(([year, teams]) => ({
    year: Number(year),
    winner: teams.join('・'),
    players: [],
    playerLinks: [],
    teams,
    teamLinks: [],
    prefectures: [],
  })),
});

test('最多優勝と最長連覇を種目ごとに出す', () => {
  const [r] = computeChampionRecords([row({ 2021: ['A'], 2022: ['A'], 2023: ['A'], 2024: ['B'], 2025: ['A'] })]);
  assert(r.mostTitles.length === 1 && r.mostTitles[0].school === 'A' && r.mostTitles[0].count === 4, JSON.stringify(r.mostTitles));
  assert(r.longestStreaks.length === 1 && r.longestStreaks[0].length === 3 && r.longestStreaks[0].from === 2021, JSON.stringify(r.longestStreaks));
  assert(describeCategoryRecord(r) === '男子団体: 最多優勝はA（4回）、最長連覇はAの3連覇（2021〜2023年）。', describeCategoryRecord(r));
});

test('収録の無い年（中止を含む）をまたぐと連覇は途切れる', () => {
  const [r] = computeChampionRecords([row({ 2019: ['A'], 2021: ['A'] })]);
  assert(r.longestStreaks.length === 0, JSON.stringify(r.longestStreaks));
  assert(r.mostTitles[0].count === 2, '最多優勝には数える');
});

test('全校1回ずつなら記録を出さない', () => {
  assert(computeChampionRecords([row({ 2021: ['A'], 2022: ['B'] })]).length === 0, '空');
});

test('ペアの所属が2校なら両校に数え、同数は全校を出す', () => {
  const [r] = computeChampionRecords([row({ 2021: ['A', 'B'], 2022: ['A', 'B'] })]);
  assert(r.mostTitles.map((m) => m.school).join() === 'A,B', JSON.stringify(r.mostTitles));
  assert(r.longestStreaks.length === 2, JSON.stringify(r.longestStreaks));
});

summary();
