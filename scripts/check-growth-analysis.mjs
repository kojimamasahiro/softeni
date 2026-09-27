import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'node',
});
require('ts-node/register/transpile-only');

const { buildGrowthReport, buildGrowthTargets } = require('../lib/growthAnalysis/index.ts');
const { getRecentPeriodComparison } = require('../lib/growthAnalysis/comparisons.ts');
const { getStatsForTarget } = require('../lib/growthAnalysis/stats.ts');

const player = (lastName, firstName, teamName = '北高校', region = '東京') => ({
  last_name: lastName,
  first_name: firstName,
  team_name: teamName,
  region,
});

const point = (gameId, pointNumber, winnerTeam, servingTeam, rallyCount = 3) => ({
  id: `${gameId}-p${pointNumber}`,
  game_id: gameId,
  point_number: pointNumber,
  winner_team: winnerTeam,
  serving_team: servingTeam,
  serving_player: null,
  rally_count: rallyCount,
  first_serve_fault: pointNumber % 3 === 0,
  double_fault: false,
  result_type: winnerTeam === servingTeam ? 'winner' : 'unforced_error',
  winner_player: null,
  loser_player: null,
  created_at: '2026-01-01T00:00:00.000Z',
});

const game = (matchId, gameNumber, winners, servingTeam, winnerTeam) => {
  const id = `${matchId}-g${gameNumber}`;
  const pointsA = winners.filter((winner) => winner === 'A').length;
  const pointsB = winners.filter((winner) => winner === 'B').length;

  return {
    id,
    match_id: matchId,
    game_number: gameNumber,
    winner_team: winnerTeam,
    points_a: pointsA,
    points_b: pointsB,
    initial_serve_team: servingTeam,
    initial_serve_player_index: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    points: winners.map((winner, index) => point(id, index + 1, winner, servingTeam, index <= 1 ? 1 : index + 1)),
  };
};

const match = ({ id, createdAt, targetSide, opponentSide, targetWins }) => {
  const targetPlayers = [player('田中', '太郎')];
  const opponentPlayers = [player('佐藤', '次郎', '南高校', '神奈川')];
  const teamPlayers = {
    [targetSide]: targetPlayers,
    [opponentSide]: opponentPlayers,
  };
  const targetWinners = targetSide === 'A' ? ['A', 'A', 'B', 'B', 'A', 'A'] : ['B', 'B', 'A', 'A', 'B', 'B'];
  const opponentWinners = targetSide === 'A' ? ['A', 'A', 'B', 'B', 'B', 'B'] : ['B', 'B', 'A', 'A', 'A', 'A'];
  const gameWinners = targetWins ? [targetWinners, targetWinners] : [opponentWinners, opponentWinners];
  const winnerTeam = targetWins ? targetSide : opponentSide;

  return {
    id,
    tournament_name: 'fixture-cup',
    tournament_id: 'fixture-cup',
    tournament_generation: 'all',
    tournament_gender: 'boys',
    tournament_category: 'singles',
    tournament_year: 2026,
    round_name: 'fixture',
    best_of: 3,
    game_type: 'singles',
    created_at: createdAt,
    match_date: createdAt.slice(0, 10),
    court_name: 'fixture court',
    status: 'completed',
    completed_at: createdAt,
    opponent_level: 'same',
    source_site_match_id: null,
    source_site_tournament_id: null,
    teams: {
      A: {
        entry_number: 'A',
        players: teamPlayers.A,
      },
      B: {
        entry_number: 'B',
        players: teamPlayers.B,
      },
    },
    team_a: teamPlayers.A.map((entry) => `${entry.last_name} ${entry.first_name}`).join('・'),
    team_b: teamPlayers.B.map((entry) => `${entry.last_name} ${entry.first_name}`).join('・'),
    team_a_entry_number: 'A',
    team_a_player1_last_name: teamPlayers.A[0].last_name,
    team_a_player1_first_name: teamPlayers.A[0].first_name,
    team_a_player1_team_name: teamPlayers.A[0].team_name,
    team_a_player1_region: teamPlayers.A[0].region,
    team_b_entry_number: 'B',
    team_b_player1_last_name: teamPlayers.B[0].last_name,
    team_b_player1_first_name: teamPlayers.B[0].first_name,
    team_b_player1_team_name: teamPlayers.B[0].team_name,
    team_b_player1_region: teamPlayers.B[0].region,
    games: gameWinners.map((winners, index) => game(id, index + 1, winners, targetSide, winnerTeam)),
  };
};

const matches = [
  match({
    id: 'older',
    createdAt: '2026-01-01T00:00:00.000Z',
    targetSide: 'A',
    opponentSide: 'B',
    targetWins: false,
  }),
  match({
    id: 'newer',
    createdAt: '2026-01-08T00:00:00.000Z',
    targetSide: 'B',
    opponentSide: 'A',
    targetWins: true,
  }),
];

const target = buildGrowthTargets(matches).find((candidate) => candidate.displayName === '田中 太郎');

assert.ok(target, 'target should be extracted');
assert.equal(target.matchCount, 2, 'target should include A/B side swaps');

const report = buildGrowthReport(matches, target.key, '2026-01-09T00:00:00.000Z');
assert.ok(report, 'report should be generated');
assert.equal(report.comparison?.currentMatchCount, 1);
assert.equal(report.comparison?.previousMatchCount, 1);
assert.ok(
  report.comparisons.some((comparison) => comparison.kind === 'win_loss'),
  'win/loss comparison should be available',
);
assert.ok(
  report.comparisons.some((comparison) => comparison.kind === 'same_opponent'),
  'same opponent comparison should be available',
);

const serviceMetric = report.comparison?.metrics.find((metric) => metric.key === 'servicePointWinRate');
assert.ok(serviceMetric, 'service metric should exist');
assert.equal(serviceMetric.trend, 'improved');

const lostStreakMetric = report.comparison?.metrics.find((metric) => metric.key === 'threePointLostStreakCount');
assert.ok(lostStreakMetric, 'lost streak metric should exist');
assert.equal(lostStreakMetric.trend, 'improved');

// 節の構成（2026-09-27）: 先頭は数字を持たない「まとめ」、以降は各指標を1回だけ出す
assert.equal(report.sections[0].id, 'summary');
assert.equal(report.sections[0].metrics.length, 0, 'summary should not repeat metric rows');
const sectionMetricKeys = report.sections.flatMap((section) => section.metrics.map((metric) => metric.key));
assert.equal(new Set(sectionMetricKeys).size, sectionMetricKeys.length, 'each metric should appear in only one section');
const receiveMetric = report.comparison.metrics.find((metric) => metric.key === 'receivePointWinRate');
assert.equal(sectionMetricKeys.includes('receivePointWinRate'), receiveMetric.denominator > 0, 'receive metric should be shown with serve when it has data');

// ラリーの区切りは試合詳細と同じ 1〜2 / 3〜4 / 5〜8 / 9本以上
const rallyKeys = report.comparison.metrics.filter((metric) => metric.category === 'rally').map((metric) => metric.key);
assert.deepEqual(rallyKeys, ['rally1to2WinRate', 'rally3to4WinRate', 'rally5to8WinRate', 'rally9PlusWinRate']);
assert.ok(report.comparison.metrics.find((metric) => metric.key === 'rally3to4WinRate').denominator > 0);

// 「最近の成長」の比べ方（2026-09-27）: 5試合までは最新1試合 vs それ以前の全試合、6試合以上は同じ数の試合どうし
const baseStats = getStatsForTarget(matches, target.key);
const repeatStats = (count) => Array.from({ length: count }, (_, index) => baseStats[index % baseStats.length]);
const five = getRecentPeriodComparison(repeatStats(5));
assert.equal(five.currentMatchCount, 1);
assert.equal(five.previousMatchCount, 4, 'with 2-5 matches, every earlier match should be used');
assert.equal(five.currentLabel, '最新試合');
const six = getRecentPeriodComparison(repeatStats(6));
assert.equal(six.currentMatchCount, 3);
assert.equal(six.previousMatchCount, 3);
const ten = getRecentPeriodComparison(repeatStats(10));
assert.equal(ten.currentMatchCount, 5);
assert.equal(ten.previousMatchCount, 5);

console.log('✓ growth analysis fixture checks passed');
