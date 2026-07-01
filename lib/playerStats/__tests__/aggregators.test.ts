// lib/playerStats/__tests__/aggregators.test.ts
// 合成フィクスチャで境界条件を検証: 少標本閾値 / retired 除外 / 進出率分母(knockout×個人戦) /
// 同日 roundOrder による連勝順 / H2H 対個人。

import { aggregateByPartner } from '../aggregators/byPartner';
import { aggregateCareer } from '../aggregators/career';
import { aggregateHeadToHead } from '../aggregators/headToHead';
import { aggregateReachRates } from '../aggregators/reachRates';
import { aggregateRecords } from '../aggregators/records';
import { aggregateTitles } from '../aggregators/titles';
import { DEFAULT_CONFIG } from '../config';
import type {
  PersonRef,
  PlayerEntryFact,
  PlayerFacts,
  PlayerMatchFact,
} from '../types';
import { assert, summary, test } from './harness';

// eslint-disable-next-line no-console
console.log('aggregators.test.ts');

function ref(id: number | null, name: string, team: string | null = null): PersonRef {
  return { id, key: `${name}@${team ?? ''}`, name, team };
}

function match(over: Partial<PlayerMatchFact>): PlayerMatchFact {
  return {
    tournamentId: 't',
    tournamentName: 'T大会',
    year: 2024,
    categoryId: 'singles-none-boys',
    category: 'singles',
    gender: 'boys',
    ageRaw: 'none',
    date: '2024-05-01',
    roundOrder: 1,
    round: '1回戦',
    stage: 'knockout',
    result: 'win',
    gamesWon: 4,
    gamesLost: 1,
    countsForWinRate: true,
    opponents: [ref(2, '相手')],
    partner: null,
    selfTeam: 'A校',
    isNational: true,
    isMajorTitle: false,
    ...over,
  };
}

function entry(over: Partial<PlayerEntryFact>): PlayerEntryFact {
  return {
    tournamentId: 't',
    tournamentName: 'T大会',
    year: 2024,
    categoryId: 'singles-none-boys',
    category: 'singles',
    gender: 'boys',
    ageRaw: 'none',
    date: '2024-05-01',
    isNational: true,
    isMajorTitle: false,
    entryNo: 1,
    placement: { kind: 'roundLoss', round: 1 },
    reachedFinal: false,
    reachedSemifinal: false,
    isKnockoutSinglesDoublesMixed: true,
    partner: null,
    selfTeam: 'A校',
    ...over,
  };
}

function facts(matches: PlayerMatchFact[], entries: PlayerEntryFact[] = []): PlayerFacts {
  return {
    playerId: 1,
    displayName: '本人',
    currentTeam: 'A校',
    homonymRisk: false,
    matches,
    entries,
    sourceHash: 'x',
    engineVersion: '1.0.0',
  };
}

test('career: retired と draw を勝率・ゲーム率から除外', () => {
  const f = facts([
    match({ result: 'win', gamesWon: 4, gamesLost: 0 }),
    match({ result: 'lose', gamesWon: 2, gamesLost: 4 }),
    match({ result: 'win', countsForWinRate: false, gamesWon: 4, gamesLost: 3 }), // retired
    match({ result: 'draw', gamesWon: 4, gamesLost: 4 }),
  ]);
  const c = aggregateCareer(f);
  assert.strictEqual(c.overall.matches.total, 2); // retired/draw 除外
  assert.strictEqual(c.overall.matches.wins, 1);
  assert.strictEqual(c.overall.matches.losses, 1);
  assert.strictEqual(c.overall.games.won, 6); // 4+2 のみ
  assert.strictEqual(c.overall.games.lost, 4); // 0+4
});

test('records.bestSeason: 少標本（<10試合）の年度は除外', () => {
  const many2024 = Array.from({ length: 10 }, (_, i) =>
    match({ year: 2024, result: i < 6 ? 'win' : 'lose' }),
  );
  const few2025 = [match({ year: 2025, result: 'win' })]; // 1勝0敗 100% だが少標本
  const r = aggregateRecords(facts([...many2024, ...few2025]), DEFAULT_CONFIG);
  assert.ok(r.bestSeason);
  assert.strictEqual(r.bestSeason!.year, 2024); // 少標本の2025は選ばれない
});

test('records.longestWinStreak: retired はスキップし連勝を切らない・数えない', () => {
  const f = facts([
    match({ date: '2024-01-01', roundOrder: 1, result: 'win' }),
    match({ date: '2024-01-02', roundOrder: 1, result: 'win', countsForWinRate: false }), // retired: skip
    match({ date: '2024-01-03', roundOrder: 1, result: 'win' }),
    match({ date: '2024-01-04', roundOrder: 1, result: 'lose' }),
  ]);
  const r = aggregateRecords(f, DEFAULT_CONFIG);
  assert.strictEqual(r.longestWinStreak.length, 2); // retired を挟んでも連続2勝
});

test('reachRates: 分母はノックアウト個人戦のみ（リーグ・団体は除外）', () => {
  const entries = [
    entry({ isKnockoutSinglesDoublesMixed: true, reachedFinal: true, reachedSemifinal: true }),
    entry({ isKnockoutSinglesDoublesMixed: true, reachedFinal: false, reachedSemifinal: true }),
    entry({ isKnockoutSinglesDoublesMixed: false }), // league only: 分母外
  ];
  const rr = aggregateReachRates(facts([], entries));
  assert.strictEqual(rr.denominator, 2);
  assert.strictEqual(rr.finalReachRate, 0.5);
  assert.strictEqual(rr.semifinalReachRate, 1);
});

test('headToHead: 対個人（doubles は相手2名それぞれに計上）', () => {
  const f = facts([
    match({
      category: 'doubles',
      categoryId: 'doubles-none-boys',
      result: 'win',
      opponents: [ref(2, 'X'), ref(3, 'Y')],
      partner: ref(9, 'P'),
    }),
    match({
      category: 'doubles',
      categoryId: 'doubles-none-boys',
      result: 'lose',
      opponents: [ref(2, 'X'), ref(4, 'Z')],
      partner: ref(9, 'P'),
    }),
  ]);
  const h = aggregateHeadToHead(f);
  const x = h.find((r) => r.opponentName === 'X');
  assert.ok(x);
  assert.strictEqual(x!.meetings, 2); // X とは2回
  assert.strictEqual(x!.wins, 1);
  assert.strictEqual(x!.losses, 1);
});

test('byPartner: partnerKey で集約（数値id付き参照を優先保持）', () => {
  const f = facts([
    match({ category: 'doubles', partner: ref(null, 'P', 'A校') }),
    match({ category: 'doubles', partner: ref(9, 'P', 'A校') }),
  ]);
  const bp = aggregateByPartner(f);
  assert.strictEqual(bp.length, 1);
  assert.strictEqual(bp[0].matches.total, 2);
  assert.strictEqual(bp[0].partnerId, 9); // id 付き参照を優先
});

test('titles: 連覇・n回目・全国初優勝', () => {
  const entries = [
    entry({ year: 2021, placement: { kind: 'winner' }, isNational: true, date: '2021-05-01' }),
    entry({ year: 2022, placement: { kind: 'winner' }, isNational: true, date: '2022-05-01' }),
    entry({ year: 2024, placement: { kind: 'winner' }, isNational: true, date: '2024-05-01' }),
  ];
  const t = aggregateTitles(facts([], entries));
  assert.strictEqual(t.total, 3);
  assert.strictEqual(t.streaks.length, 1); // 2021-2022 連覇
  assert.strictEqual(t.streaks[0].streak, 2);
  assert.strictEqual(t.firsts.firstNationalTitle!.year, 2021);
});

summary();
