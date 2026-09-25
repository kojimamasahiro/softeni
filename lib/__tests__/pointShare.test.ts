// lib/__tests__/pointShare.test.ts
// 実行: npm run point-share:test
//
// ラリー共有リンク（docs/wiki/beta-matches-results.md）の URL・文面・クエリ解決を固定する。
// 特に point_number はゲームごとの番号なので、`?point=N` が別のゲームへ飛ばないことを見る。

import { buildPointShareText, buildPointShareUrl, describeSharedPoint, locateSharedPoint, scoreBeforePoint } from '../pointShare';
import { assert, summary, test } from '../playerStats/__tests__/harness';

console.log('pointShare.test.ts');

const games = [
  {
    game_number: 1,
    points: [
      { id: 'g1p1', point_number: 1, winner_team: 'A', rally_count: 3 },
      { id: 'g1p2', point_number: 2, winner_team: 'B', rally_count: 5 },
    ],
  },
  {
    game_number: 2,
    points: [
      { id: 'g2p1', point_number: 1, winner_team: 'B', rally_count: 4 },
      { id: 'g2p2', point_number: 2, winner_team: 'B', rally_count: 2 },
      { id: 'g2p3', point_number: 3, winner_team: 'A', rally_count: 9 },
    ],
  },
];

test('pointId で該当ゲームのポイントを見つける', () => {
  const located = locateSharedPoint(games, { pointId: 'g2p3' });
  assert.strictEqual(located?.gameNumber, 2);
  assert.strictEqual(located?.point.id, 'g2p3');
});

test('存在しない pointId は null', () => {
  assert.strictEqual(locateSharedPoint(games, { pointId: 'nope' }), null);
});

test('game と point でゲームを区別する', () => {
  assert.strictEqual(locateSharedPoint(games, { game: '2', point: '1' })?.point.id, 'g2p1');
  assert.strictEqual(locateSharedPoint(games, { game: '1', point: '1' })?.point.id, 'g1p1');
});

test('複数ゲームの試合で game なしの point は曖昧なので null', () => {
  assert.strictEqual(locateSharedPoint(games, { point: '1' }), null);
});

test('1ゲームだけの試合なら game なしの point でも解決する', () => {
  assert.strictEqual(locateSharedPoint([games[0]], { point: '2' })?.point.id, 'g1p2');
});

test('数字でない・0 以下のクエリは null', () => {
  assert.strictEqual(locateSharedPoint(games, { game: '2', point: 'x' }), null);
  assert.strictEqual(locateSharedPoint(games, { game: '2', point: '0' }), null);
  assert.strictEqual(locateSharedPoint(games, { game: ['2'], point: '1' }), null);
});

test('ポイント開始前のスコアを数える', () => {
  assert.deepStrictEqual(scoreBeforePoint(games[1], games[1].points[2]), { A: 0, B: 2 });
  assert.deepStrictEqual(scoreBeforePoint(games[1], games[1].points[0]), { A: 0, B: 0 });
});

test('共有 URL は canonical に pointId だけを付ける', () => {
  assert.strictEqual(buildPointShareUrl('https://score.softeni-pick.com/matches/abc/', 'g2p3'), 'https://score.softeni-pick.com/matches/abc/?pointId=g2p3');
  assert.strictEqual(buildPointShareUrl('https://example.com/matches/abc/?focusTeam=B#x', 'p'), 'https://example.com/matches/abc/?pointId=p');
});

test('共有の文面', () => {
  const text = buildPointShareText({
    tournamentLabel: '全日本選手権 2025',
    roundName: '準決勝',
    teamA: '山田・佐藤',
    teamB: '鈴木・田中',
    gameNumber: 2,
    scoreBefore: { A: 0, B: 2 },
    rallyCount: 9,
    winnerName: '山田・佐藤',
  });
  assert.strictEqual(text, '全日本選手権 2025 準決勝\n山田・佐藤 vs 鈴木・田中\n第2ゲーム 0-2 から（ラリー9本、山田・佐藤のポイント）');
});

test('ラリー本数・得点者が無ければ括弧を省く', () => {
  assert.strictEqual(describeSharedPoint({ gameNumber: 1, scoreBefore: { A: 3, B: 3 }, rallyCount: null, winnerName: null }), '第1ゲーム 3-3 から');
  assert.strictEqual(describeSharedPoint({ gameNumber: 1, scoreBefore: { A: 3, B: 3 }, rallyCount: 0, winnerName: 'A' }), '第1ゲーム 3-3 から（Aのポイント）');
});

summary();
