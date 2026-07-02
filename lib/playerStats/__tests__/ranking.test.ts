// lib/playerStats/__tests__/ranking.test.ts
// シーズンポイント: 上位N大会合算 / tier×係数 / config 変更が結果に反映されること。

import { computeSeasonPoints, entryScore, placementCoefficient } from '../aggregators/rankingCompute';
import { DEFAULT_CONFIG, PlayerStatsConfig } from '../config';
import type { PlayerEntryFact } from '../types';
import { assert, summary, test } from './harness';

console.log('ranking.test.ts');

function entry(over: Partial<PlayerEntryFact>): PlayerEntryFact {
  return {
    tournamentId: 't',
    tournamentName: 'T',
    year: 2024,
    categoryId: 'doubles-none-boys',
    category: 'doubles',
    gender: 'boys',
    ageRaw: 'none',
    date: '2024-05-01',
    isNational: true,
    isMajorTitle: false,
    entryNo: 1,
    placement: { kind: 'winner' },
    reachedFinal: true,
    reachedSemifinal: true,
    isKnockoutSinglesDoublesMixed: true,
    partner: null,
    selfTeam: 'A',
    ...over,
  };
}

test('entryScore = tier重み × 順位係数', () => {
  // major winner = 100 * 1.0
  assert.strictEqual(entryScore(entry({ isMajorTitle: true, placement: { kind: 'winner' } }), DEFAULT_CONFIG), 100);
  // national best4 = 60 * 0.5
  assert.strictEqual(entryScore(entry({ isMajorTitle: false, isNational: true, placement: { kind: 'best', bestLevel: 4 } }), DEFAULT_CONFIG), 30);
});

test('上位N大会（=3）のみ合算する', () => {
  const entries = [
    entry({ tournamentId: 'a', isMajorTitle: true, placement: { kind: 'winner' } }), // 100
    entry({ tournamentId: 'b', isMajorTitle: true, placement: { kind: 'winner' } }), // 100
    entry({ tournamentId: 'c', isNational: true, placement: { kind: 'winner' } }), // 60
    entry({ tournamentId: 'd', isNational: false, placement: { kind: 'roundLoss', round: 1 } }), // 20*0.1=2（合算外）
  ];
  const sp = computeSeasonPoints(entries, DEFAULT_CONFIG);
  assert.strictEqual(sp.length, 1);
  assert.strictEqual(sp[0].points, 260); // 100+100+60（4件目は上位3外）
  assert.strictEqual(sp[0].counted, 3);
});

test('config の係数変更が結果に反映される', () => {
  const custom: PlayerStatsConfig = {
    ...DEFAULT_CONFIG,
    ranking: {
      ...DEFAULT_CONFIG.ranking,
      placementCoefficient: {
        ...DEFAULT_CONFIG.ranking.placementCoefficient,
        winner: 2.0, // 1.0 → 2.0
      },
    },
  };
  const e = entry({ isMajorTitle: true, placement: { kind: 'winner' } });
  assert.strictEqual(entryScore(e, DEFAULT_CONFIG), 100);
  assert.strictEqual(entryScore(e, custom), 200); // 係数変更が反映
});

test('discipline は config.disciplines のみ対象（mixed は既定で除外）', () => {
  const entries = [
    entry({ category: 'doubles', placement: { kind: 'winner' }, isMajorTitle: true }),
    entry({ category: 'mixed', categoryId: 'doubles-none-mixed', placement: { kind: 'winner' }, isMajorTitle: true }),
  ];
  const sp = computeSeasonPoints(entries, DEFAULT_CONFIG);
  assert.strictEqual(sp.length, 1); // doubles のみ
  assert.strictEqual(sp[0].discipline, 'doubles');
});

test('標準競技順位(1224): 同点は同順位、次は件数分飛ばす', () => {
  // ポイント降順に並んだ行から順位を割り当てるロジック（generate-rankings と同一）。
  const rows = [
    { playerId: 1, points: 100 },
    { playerId: 2, points: 100 },
    { playerId: 3, points: 80 },
    { playerId: 4, points: 80 },
    { playerId: 5, points: 50 },
  ];
  let prevPoints: number | null = null;
  let prevRank = 0;
  const ranks = rows.map((r, i) => {
    const rank = prevPoints !== null && r.points === prevPoints ? prevRank : i + 1;
    prevPoints = r.points;
    prevRank = rank;
    return rank;
  });
  assert.deepStrictEqual(ranks, [1, 1, 3, 3, 5]); // 1224 方式
});

test('placementCoefficient は kind を係数へ写像', () => {
  assert.strictEqual(placementCoefficient({ kind: 'runnerup' }, DEFAULT_CONFIG), 0.7);
  assert.strictEqual(placementCoefficient({ kind: 'best', bestLevel: 8 }, DEFAULT_CONFIG), 0.3);
  assert.strictEqual(placementCoefficient({ kind: 'unknown' }, DEFAULT_CONFIG), 0.1);
});

summary();
