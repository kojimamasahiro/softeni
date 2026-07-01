// lib/playerStats/__tests__/placement.test.ts
import {
  normalizeRoundOrder,
  parseCategoryId,
  resolvePlacement,
} from '../placement';
import { playerKey } from '../identity';
import { assert, summary, test } from './harness';

// eslint-disable-next-line no-console
console.log('placement.test.ts');

test('resolvePlacement maps rank kinds (bestLevel, roundLoss, groupOnly, unknown)', () => {
  assert.deepStrictEqual(
    resolvePlacement({ tournament: { rank: { kind: 'winner' } } }),
    { kind: 'winner' },
  );
  assert.deepStrictEqual(
    resolvePlacement({ tournament: { rank: { kind: 'best', bestLevel: 4 } } }),
    { kind: 'best', bestLevel: 4 },
  );
  assert.deepStrictEqual(
    resolvePlacement({ tournament: { rank: { kind: 'round', round: 3 } } }),
    { kind: 'roundLoss', round: 3 },
  );
  assert.deepStrictEqual(
    resolvePlacement({ tournament: null, roundrobin: { group: 'A', rank: 2 } }),
    { kind: 'groupOnly', groupRank: 2 },
  );
  assert.deepStrictEqual(resolvePlacement({ tournament: null }), {
    kind: 'unknown',
  });
});

test('normalizeRoundOrder is monotonic (回戦 < 準々 < 準決 < 決勝)', () => {
  assert.ok(normalizeRoundOrder('1回戦') < normalizeRoundOrder('3回戦'));
  assert.ok(normalizeRoundOrder('5回戦') < normalizeRoundOrder('準々決勝'));
  assert.ok(normalizeRoundOrder('準々決勝') < normalizeRoundOrder('準決勝'));
  assert.ok(normalizeRoundOrder('準決勝') < normalizeRoundOrder('決勝'));
  assert.strictEqual(normalizeRoundOrder(null), 0);
});

test('parseCategoryId: mixed は gender 由来 / team 判定 / age 保持', () => {
  const doublesMixed = parseCategoryId('doubles-none-mixed');
  assert.strictEqual(doublesMixed?.category, 'mixed');
  assert.strictEqual(doublesMixed?.gender, 'mixed');

  const singles = parseCategoryId('singles-none-boys');
  assert.strictEqual(singles?.category, 'singles');
  assert.strictEqual(singles?.gender, 'boys');

  const team = parseCategoryId('team-none-girls');
  assert.strictEqual(team?.category, 'team');

  const aged = parseCategoryId('doubles-u14-girls');
  assert.strictEqual(aged?.ageRaw, 'u14');
  assert.strictEqual(aged?.category, 'doubles');
});

test('playerKey は名前@所属を正規化（空白除去・NFKC）', () => {
  assert.strictEqual(playerKey('船水 颯人', 'One'), '船水颯人@One');
  assert.strictEqual(playerKey('佐藤　駿丞'), '佐藤駿丞');
});

summary();
