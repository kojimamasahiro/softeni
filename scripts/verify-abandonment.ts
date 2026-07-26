// scripts/verify-abandonment.ts
// 打ち切り大会対応の検証。docs/raw/2026-07-26-abandoned-tournament-ui-design.md 「検証項目」に対応。
//   npx ts-node --project scripts/playerStats/tsconfig.json scripts/verify-abandonment.ts

import fs from 'fs';
import path from 'path';

import { SourceAdapter } from '../lib/playerStats/sourceAdapter';
import { resolvePlacement } from '../lib/playerStats/placement';
import { getAbandonment, applyAbandonment } from '../lib/tournamentAbandonment';
import { computeResultCoverage, formatResultCoverageBodyText, formatResultCoverageMetaSuffix } from '../lib/tournamentCoverage';
import { getHistoricalWinners } from '../lib/tournamentRecords';

const ROOT = process.cwd();
let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        expected=${JSON.stringify(expected)}\n        actual  =${JSON.stringify(actual)}`);
}

function readRaw(tid: string, year: number, cat: string) {
  const p = path.join(ROOT, 'data', 'tournaments', 'details', tid, String(year), `${cat}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function infoCategories(tid: string, year: number) {
  const p = path.join(ROOT, 'data', 'tournaments', 'information', `${tid}.json`);
  if (!fs.existsSync(p)) return null;
  const arr = JSON.parse(fs.readFileSync(p, 'utf-8')) as Array<{ year: number; categories?: unknown[] }>;
  return (arr.find((e) => Number(e.year) === year)?.categories ?? null) as never;
}

console.log('=== 1. 東海ブロック2026（打ち切り）===');
for (const cat of ['doubles-none-boys', 'doubles-none-girls']) {
  const tid = 'highschool-tokai-block';
  const abandonment = getAbandonment(infoCategories(tid, 2026), cat);
  check(`${cat}: information に打ち切り情報がある`, abandonment, { abandonedAfterRound: '3回戦' });

  const raw = readRaw(tid, 2026, cat);
  const resolved = applyAbandonment(raw, abandonment, `${tid}/2026/${cat}`);

  const kinds: Record<string, number> = {};
  for (const r of resolved.results) kinds[r.tournament.rank.kind] = (kinds[r.tournament.rank.kind] ?? 0) + 1;
  check(`${cat}: ongoing が 0 件になる`, kinds.ongoing ?? 0, 0);
  check(`${cat}: best が 8 件 / round が 56 件`, [kinds.best, kinds.round], [8, 56]);

  const best = resolved.results.find((r: { tournament: { rank: { kind: string } } }) => r.tournament.rank.kind === 'best');
  check(`${cat}: 解決後の形が完了大会と同一`, best.tournament, { label: 'ベスト8', rank: { kind: 'best', bestLevel: 8 } });

  const placements = resolved.results.filter((r: unknown) => JSON.stringify(resolvePlacement(r as never)) === JSON.stringify({ kind: 'best', bestLevel: 8 }));
  check(`${cat}: placement が ベスト8 に解決される（16選手ぶん8ペア）`, placements.length, 8);

  const coverage = computeResultCoverage(resolved, abandonment);
  check(`${cat}: coverage.status`, coverage.status, 'abandoned');
  console.log(`        本文: ${formatResultCoverageBodyText(coverage)}`);
  console.log(`        meta: ${formatResultCoverageMetaSuffix(coverage)}`);

  // playerStats 経路（SourceAdapter）でも同じ解決になること
  const adapter = new SourceAdapter(ROOT);
  const viaAdapter = adapter.readStandardDetail(tid, 2026, cat);
  const adapterBest = (viaAdapter?.results ?? []).filter((r) => (r as { tournament?: { rank?: { kind?: string } } }).tournament?.rank?.kind === 'best');
  check(`${cat}: SourceAdapter 経路でも best 8 件（経路間の一致）`, adapterBest.length, 8);
}

console.log('\n=== 2. 回帰: 打ち切りフラグの無い既存大会（2026-07-19 の検証表を再実行）===');
const regression: Array<[string, number, string, string]> = [
  ['highschool-championship', 2026, 'doubles-none-girls', 'not_recorded'],
  ['highschool-championship', 2025, 'doubles-none-girls', 'completed'],
  ['asian-games-qualifier', 2025, 'singles-tournament-boys', 'completed'],
];
for (const [tid, year, cat, expected] of regression) {
  const abandonment = getAbandonment(infoCategories(tid, year), cat);
  check(`${tid}/${year}/${cat}: 打ち切り情報なし`, abandonment, null);
  const raw = readRaw(tid, year, cat);
  const resolved = applyAbandonment(raw, abandonment);
  check(`${tid}/${year}/${cat}: applyAbandonment が素通し（同一参照）`, resolved === raw, true);
  const coverage = computeResultCoverage(resolved, abandonment);
  check(`${tid}/${year}/${cat}: coverage.status が従来どおり`, coverage.status, expected);
}

console.log('\n=== 3. 連覇: 打ち切り年は「開催年・優勝者なし」として並び、連覇を切る ===');
{
  const hw = getHistoricalWinners('highschool-tokai-block', 'doubles-none-boys', { targetYear: 2026 });
  const y2026 = hw?.champions?.find((c) => c.year === 2026);
  check('2026 が開催年として年表に存在する', Boolean(y2026), true);
  check('2026 の優勝者は null（捏造しない）', y2026?.display ?? null, null);
  check('2026 を対象年にした連覇は成立しない', hw?.edition?.repeatChampion ?? null, null);
}

console.log('\n=== 4. 4/8 以外は round フォールバック＋警告 ===');
const fake = {
  results: [
    { entryNo: 1, tournament: { label: 'ベスト16進出', rank: { kind: 'ongoing' } } },
    ...Array.from({ length: 15 }, (_, i) => ({ entryNo: i + 2, tournament: { label: 'ベスト16進出', rank: { kind: 'ongoing' } } })),
  ],
};
const fakeResolved = applyAbandonment(fake, { abandonedAfterRound: '4回戦' }, 'fake/9999/doubles-none-boys');
check('aliveEntries=16 は best でなく round へ落ちる', fakeResolved.results[0].tournament, {
  label: 'ベスト16',
  rank: { kind: 'round', round: 4 },
});

console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
