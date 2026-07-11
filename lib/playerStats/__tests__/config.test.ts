// lib/playerStats/__tests__/config.test.ts
import { loadRankingConfig, resolveTier, DEFAULT_CONFIG } from '../config';
import { assert, summary, test } from './harness';

console.log('config.test.ts');

test('loads ranking-config.json with expected values', () => {
  const cfg = loadRankingConfig();
  assert.strictEqual(cfg.ranking.topNTournamentsPerSeason, 3);
  assert.strictEqual(cfg.ranking.tier.major, 100);
  assert.strictEqual(cfg.stats.minMatchesForSeasonWinRate, 10);
  assert.strictEqual(cfg.stats.minMeetingsForH2H, 3);
});

test('defaults are internally consistent', () => {
  assert.strictEqual(DEFAULT_CONFIG.ranking.placementCoefficient.winner, 1.0);
  // シングルスは 2026-07-11 にランキングから撤退（doubles限定）。
  assert.deepStrictEqual(DEFAULT_CONFIG.ranking.disciplines, ['doubles']);
});

test('resolveTier classifies major/national/local', () => {
  assert.strictEqual(resolveTier({ isMajorTitle: true, isNational: true }), 'major');
  assert.strictEqual(resolveTier({ isMajorTitle: false, isNational: true }), 'national');
  assert.strictEqual(resolveTier({ isMajorTitle: false, isNational: false }), 'local');
});

summary();
