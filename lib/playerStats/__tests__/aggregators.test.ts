// lib/playerStats/__tests__/aggregators.test.ts
// 合成フィクスチャで境界条件を検証: 少標本閾値 / retired 除外 / 進出率分母(knockout×個人戦) /
// 同日 roundOrder による連勝順 / H2H 対個人。

import { aggregateByPartner } from '../aggregators/byPartner';
import { aggregateByTeam } from '../aggregators/byTeam';
import { aggregateCareer } from '../aggregators/career';
import { aggregateHeadToHead } from '../aggregators/headToHead';
import { aggregateMajorResults } from '../aggregators/majorResults';
import { aggregateReachRates } from '../aggregators/reachRates';
import { aggregateRecords } from '../aggregators/records';
import { aggregateTitles } from '../aggregators/titles';
import { DEFAULT_CONFIG } from '../config';
import type { PersonRef, PlayerEntryFact, PlayerFacts, PlayerMatchFact } from '../types';
import { assert, summary, test } from './harness';

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
  const many2024 = Array.from({ length: 10 }, (_, i) => match({ year: 2024, result: i < 6 ? 'win' : 'lose' }));
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
  const f = facts([match({ category: 'doubles', partner: ref(null, 'P', 'A校') }), match({ category: 'doubles', partner: ref(9, 'P', 'A校') })]);
  const bp = aggregateByPartner(f);
  assert.strictEqual(bp.length, 1);
  assert.strictEqual(bp[0].matches.total, 2);
  assert.strictEqual(bp[0].partnerId, 9); // id 付き参照を優先
});

test('titles: 連覇・n回目・全国初優勝', () => {
  // firstNationalTitle はホワイトリスト大会でのみ立つため、実在の全国大会 ID を使う
  const entries = [
    entry({ tournamentId: 'highschool-championship', year: 2021, placement: { kind: 'winner' }, isNational: true, date: '2021-05-01' }),
    entry({ tournamentId: 'highschool-championship', year: 2022, placement: { kind: 'winner' }, isNational: true, date: '2022-05-01' }),
    entry({ tournamentId: 'highschool-championship', year: 2024, placement: { kind: 'winner' }, isNational: true, date: '2024-05-01' }),
  ];
  const t = aggregateTitles(facts([], entries));
  assert.strictEqual(t.total, 3);
  assert.strictEqual(t.streaks.length, 1); // 2021-2022 連覇
  assert.strictEqual(t.streaks[0].streak, 2);
  assert.strictEqual(t.firsts.firstNationalTitle!.year, 2021);
});

test('titles.national: ホワイトリスト大会の優勝だけを拾い、年度降順で返す', () => {
  const entries = [
    // インターハイ優勝 2 回（同一大会）
    entry({ tournamentId: 'highschool-championship', categoryId: 'doubles-none-boys', year: 2023, placement: { kind: 'winner' }, date: '2023-08-01' }),
    entry({ tournamentId: 'highschool-championship', categoryId: 'doubles-none-boys', year: 2024, placement: { kind: 'winner' }, date: '2024-08-01' }),
    // 別の全国大会での優勝
    entry({ tournamentId: 'highschool-japan-cup', categoryId: 'singles-none-boys', year: 2024, placement: { kind: 'winner' }, date: '2024-07-01' }),
  ];
  const t = aggregateTitles(facts([], entries));
  assert.strictEqual(t.national.count, 3);
  assert.strictEqual(t.national.tournamentCount, 2);
  // 年度降順・同年度は日付降順（2024 インハイ → 2024 ハイジャパ → 2023 インハイ）
  assert.strictEqual(t.national.titles[0].year, 2024);
  assert.strictEqual(t.national.titles[0].shortLabel, 'インターハイ');
  assert.strictEqual(t.national.titles[1].shortLabel, 'ハイスクールジャパンカップ');
  assert.strictEqual(t.national.titles[2].year, 2023);
});

test('titles.national: isNational=true でも東日本/西日本選手権は全国大会優勝に数えない', () => {
  // 東日本・西日本選手権は地域大会だが、エンジンの isNational は
  // 「国際大会以外＝true」の広い定義なので true になる。実績表示では除外されるべき。
  const entries = [
    entry({ tournamentId: 'east-japan', year: 2026, placement: { kind: 'winner' }, isNational: true, date: '2026-05-01' }),
    entry({ tournamentId: 'west-japan', year: 2025, placement: { kind: 'winner' }, isNational: true, date: '2025-05-01' }),
  ];
  const t = aggregateTitles(facts([], entries));
  assert.strictEqual(t.total, 2); // 通算優勝には数える
  assert.strictEqual(t.national.count, 0); // 全国大会優勝には数えない
  // キャリア年表の「全国初出場 / 全国初優勝」も同じホワイトリスト基準に統一済み（2026-07-20）。
  // 以前は広義 isNational を使っていたため東日本選手権が「全国初優勝」として出ていた。
  assert.strictEqual(t.firsts.firstNationalTitle, null);
  assert.strictEqual(t.firsts.firstNational, null);
});

test('majorResults: ベスト8以上をカテゴリ別に集約し、最高成績を best にする', () => {
  const entries = [
    // 高校: ベスト4 と 優勝 → best は優勝
    entry({ tournamentId: 'highschool-championship', year: 2023, placement: { kind: 'best', bestLevel: 4 }, date: '2023-08-01' }),
    entry({ tournamentId: 'highschool-japan-cup', year: 2024, placement: { kind: 'winner' }, date: '2024-07-01' }),
    // 大学: ベスト8 のみ
    entry({ tournamentId: 'zennihon-university', year: 2026, placement: { kind: 'best', bestLevel: 8 }, date: '2026-09-01' }),
    // ベスト8 未満は対象外
    entry({ tournamentId: 'zennihon-championship', year: 2026, placement: { kind: 'roundLoss', round: 2 }, date: '2026-10-01' }),
  ];
  const r = aggregateMajorResults(facts([], entries));
  // カテゴリ順は senior→international→general→university→highschool→junior 固定
  // （キャリアの新しい側から。2026-07-20 に進行順から反転）
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].category, 'university');
  assert.strictEqual(r[0].best.placementLabel, 'ベスト8');
  assert.strictEqual(r[1].category, 'highschool');
  assert.strictEqual(r[1].categoryLabel, '高校');
  assert.strictEqual(r[1].best.placementLabel, '優勝');
  assert.strictEqual(r[1].entries.length, 2); // 優勝 → ベスト4 の順
  assert.strictEqual(r[1].entries[1].placementLabel, 'ベスト4');
});

test('majorResults: 社会人・東西日本・国際予選はカードを出さない / 国際大会は出す', () => {
  const entries = [
    entry({ tournamentId: 'zennihon-workers', year: 2025, placement: { kind: 'winner' }, date: '2025-05-01' }), // 社会人
    entry({ tournamentId: 'east-japan', year: 2025, placement: { kind: 'winner' }, date: '2025-06-01' }), // 地域大会
    entry({ tournamentId: 'asian-games-qualifier', year: 2025, placement: { kind: 'winner' }, date: '2025-07-01' }), // 国際予選
    entry({ tournamentId: 'international-korea-cup', year: 2025, placement: { kind: 'best', bestLevel: 4 }, date: '2025-08-01' }), // 国際大会
  ];
  const r = aggregateMajorResults(facts([], entries));
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].category, 'international');

  // 一方 SEO 側（titles.national）は社会人を含み、国際大会を含まない（意図的な非対称）
  const t = aggregateTitles(facts([], entries));
  assert.strictEqual(t.national.count, 1);
  assert.strictEqual(t.national.titles[0].tournamentId, 'zennihon-workers');
});

test('byTeam: 国際大会（generationId=international）の国別代表コードは所属に数えない', () => {
  // 国内クラブ NTT西日本 の実績 + 国際大会（コリアカップ）で JPN-1 として出場。
  // JPN-1 は所属ではないため、所属は 1 つ（＝所属変更なし）になるべき。
  const f = facts([
    match({ tournamentId: 'zennihon-singles', selfTeam: 'NTT西日本', date: '2026-04-01' }),
    match({ tournamentId: 'international-korea-cup', selfTeam: 'JPN-1', date: '2026-06-15' }),
  ]);
  const rows = aggregateByTeam(f, process.cwd());
  assert.strictEqual(rows.length, 1); // JPN-1 は除外
  assert.strictEqual(rows[0].team, 'NTT西日本');
});

summary();
