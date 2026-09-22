// lib/__tests__/championRecords.test.ts
// 実行: npm run records:test
//
// 大会の歴代ページの「記録」（最多優勝・最長連覇）の数え方を固定する（lib/championRecords.ts）。

import { assert, summary, test } from '../playerStats/__tests__/harness';
import { computeChampionRecords, describeCategoryRecord, toGenericRecordRows, toHighschoolRecordRows } from '../championRecords';
import type { ChampionSummaryRow } from '../highschoolNationalTournaments';

console.log('championRecords.test.ts');

const hsRow = (winners: Record<number, string[]>): ChampionSummaryRow => ({
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
const hs = (w: Record<number, string[]>) => computeChampionRecords(toHighschoolRecordRows([hsRow(w)]));

test('最多優勝と最長連覇を種目ごとに出す', () => {
  const [r] = hs({ 2021: ['A'], 2022: ['A'], 2023: ['A'], 2024: ['B'], 2025: ['A'] });
  assert(r.mostTitles.length === 1 && r.mostTitles[0].name === 'A' && r.mostTitles[0].count === 4, JSON.stringify(r.mostTitles));
  assert(r.longestStreaks.length === 1 && r.longestStreaks[0].length === 3 && r.longestStreaks[0].from === 2021, JSON.stringify(r.longestStreaks));
  assert(describeCategoryRecord(r) === '男子団体: 最多優勝はA（4回）、最長連覇はAの3連覇（2021〜2023年）。', describeCategoryRecord(r));
});

test('収録の無い年（中止を含む）をまたぐと連覇は途切れる', () => {
  const [r] = hs({ 2019: ['A'], 2021: ['A'] });
  assert(r.longestStreaks.length === 0, JSON.stringify(r.longestStreaks));
  assert(r.mostTitles[0].count === 2, '最多優勝には数える');
});

test('全員1回ずつなら記録を出さない', () => {
  assert(hs({ 2021: ['A'], 2022: ['B'] }).length === 0, '空');
});

test('高校: ペアの所属が2校なら両校に数え、同数は全校を出す', () => {
  const [r] = hs({ 2021: ['A', 'B'], 2022: ['A', 'B'] });
  assert(r.mostTitles.map((m) => m.name).join() === 'A,B', JSON.stringify(r.mostTitles));
  assert(r.longestStreaks.length === 2, JSON.stringify(r.longestStreaks));
});

test('汎用: 個人戦は選手単位（playerId で同一性）、団体戦はチーム名、打ち切り年は数えない。性別だけの種目名は補う', () => {
  const rows = toGenericRecordRows([
    { year: '2024', categoryLabel: '男子', category: 'singles', winner: '上松俊貴（NTT西日本）', winnerPlayers: [{ name: '上松俊貴', playerId: 19 }] },
    { year: '2025', categoryLabel: '男子', category: 'singles', winner: '上松俊貴（NTT西日本）', winnerPlayers: [{ name: '上松俊貴', playerId: 19 }] },
    { year: '2024', categoryLabel: '男子団体', winner: 'NTT西日本', winnerPlayers: null },
    { year: '2025', categoryLabel: '男子団体', winner: 'NTT西日本', winnerPlayers: [] },
    { year: '2026', categoryLabel: '男子団体', winner: null, winnerPlayers: null },
  ]);
  const recs = computeChampionRecords(rows);
  assert(
    describeCategoryRecord(recs[0]) === '男子シングルス: 最多優勝は上松俊貴（2回）、最長連覇は上松俊貴の2連覇（2024〜2025年）。',
    describeCategoryRecord(recs[0]),
  );
  assert(
    describeCategoryRecord(recs[1]) === '男子団体: 最多優勝はNTT西日本（2回）、最長連覇はNTT西日本の2連覇（2024〜2025年）。',
    describeCategoryRecord(recs[1]),
  );
});

test('汎用: 同姓同名でも playerId が違えば別人', () => {
  const rows = toGenericRecordRows([
    { year: 2024, categoryLabel: '男子シングルス', winner: 'X', winnerPlayers: [{ name: '山田太郎', playerId: 1 }] },
    { year: 2025, categoryLabel: '男子シングルス', winner: 'X', winnerPlayers: [{ name: '山田太郎', playerId: 2 }] },
  ]);
  assert(computeChampionRecords(rows).length === 0, '別人なので記録なし');
});

summary();
