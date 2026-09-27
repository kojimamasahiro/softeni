// lib/__tests__/matchFindings.test.ts
// 実行: npm run match-findings:test
//
// 試合詳細の「この試合で分かったこと」（docs/wiki/score-analysis.md）の条件と優先を固定する。

import { getPointsToWinForGame, isWinningScore } from '../matchRules';
import { isDeuceScore, getRallyBucket } from '../matchAnalysis/helpers';
import { buildPointSources, buildRallyLengthSplit } from '../matchAnalysis/matchCharts';
import { buildMatchFindings } from '../matchAnalysis/matchFindings';
import type { ReconstructedPointContext } from '../matchAnalysis/types';
import type { Point } from '../../src/types/database';
import { assert, summary, test } from '../playerStats/__tests__/harness';

console.log('matchFindings.test.ts');

const NAMES = { A: '甲', B: '乙' };

// games: 1ゲーム1文字列。各文字がそのポイントの勝者。result / rally は全ポイント共通の既定値を上書きできる
type PointSpec = { w: 'A' | 'B'; result?: string; rally?: number };
const build = (bestOf: number, games: Array<string | PointSpec[]>): ReconstructedPointContext[] => {
  const contexts: ReconstructedPointContext[] = [];
  let wonA = 0;
  let wonB = 0;
  games.forEach((game, gi) => {
    const specs: PointSpec[] = typeof game === 'string' ? [...game].map((w) => ({ w: w as 'A' | 'B' })) : game;
    const pointsToWin = getPointsToWinForGame(bestOf, wonA, wonB);
    let a = 0;
    let b = 0;
    specs.forEach((spec, pi) => {
      const point = {
        id: `g${gi + 1}p${pi + 1}`,
        point_number: pi + 1,
        winner_team: spec.w,
        result_type: spec.result ?? 'volley_winner',
        rally_count: spec.rally ?? 3,
        double_fault: false,
      } as unknown as Point;
      const before = { A: a, B: b };
      if (spec.w === 'A') a += 1;
      else b += 1;
      contexts.push({
        point,
        gameNumber: gi + 1,
        pointNumber: pi + 1,
        pointsToWin,
        scoreBefore: before,
        scoreAfter: { A: a, B: b },
        isFirstPointOfGame: pi === 0,
        isTwoTwoPoint: before.A === 2 && before.B === 2,
        isDeucePoint: isDeuceScore(before.A, before.B, pointsToWin),
        isGamePointOpportunity: { A: isWinningScore(before.A + 1, before.B, pointsToWin), B: isWinningScore(before.B + 1, before.A, pointsToWin) },
        isGameWinningPoint: isWinningScore(a, b, pointsToWin) || isWinningScore(b, a, pointsToWin),
        rallyBucket: getRallyBucket(point),
      });
    });
    if (a > b) wonA += 1;
    else wonB += 1;
  });
  return contexts;
};

const kinds = (contexts: ReconstructedPointContext[]) => buildMatchFindings(contexts, NAMES).map((finding) => finding.kind);

test('0-2 から逆転すると comeback。移動先は差が最大になった直後のゲームの1本目', () => {
  const findings = buildMatchFindings(build(5, ['BBBB', 'BBBB', 'ABAAA', 'ABAAA', 'ABAAA']), NAMES);
  assert.strictEqual(findings[0].kind, 'comeback');
  assert.strictEqual(findings[0].text, '甲がゲームカウントで2ゲーム差をつけられてから逆転した');
  assert.deepStrictEqual(findings[0].target, { gameNumber: 3, pointId: 'g3p1' });
});

test('1ゲーム差の逆転は comeback にならず、ファイナルまで行けば final_game', () => {
  // 0-1, 1-1, 1-2, 2-2, 2-3, 3-3, ファイナル
  const games = ['BABBB', 'AABAA', 'BABBB', 'AABAA', 'BABBB', 'AABAA', 'AAAABAAA'];
  const findings = buildMatchFindings(build(7, games), NAMES);
  assert.strictEqual(findings[0].kind, 'final_game');
  assert.deepStrictEqual(findings[0].target, { gameNumber: 7, pointId: 'g7p1' });
});

test('デュースのゲームを片方が全部取ると deuce_sweep。一方でも落とせば出ない', () => {
  const deuce = 'AAABBBAA';
  assert.ok(kinds(build(5, [deuce, deuce, 'AAAA'])).includes('deuce_sweep'));
  assert.ok(!kinds(build(5, [deuce, 'BBBAAABB', 'AAAA', 'AAAA'])).includes('deuce_sweep'));
  assert.ok(!kinds(build(5, [deuce, 'AAAA', 'AAAA'])).includes('deuce_sweep'), 'デュース1ゲームだけでは出ない');
});

test('連続得点はゲームをまたいで数え、6連続から出す', () => {
  // 第1ゲーム末の4連続＋第2ゲーム頭の1本で5連続まで
  const five = buildMatchFindings(build(5, ['BAAAA', 'ABAAA', 'BAAAA']), NAMES);
  assert.ok(!five.some((finding) => finding.kind === 'streak'));
  const long = buildMatchFindings(build(5, ['BAAAA', 'AAAA', 'AAAA']), NAMES);
  const streak = long.find((finding) => finding.kind === 'streak');
  assert.ok(streak);
  assert.strictEqual(streak.text, '甲が第1〜3ゲームにかけて12連続得点');
  assert.deepStrictEqual(streak.target, { gameNumber: 1, pointId: 'g1p2' });
});

test('決め球の差・ミスの差は5点以上で出し、移動先を持たない', () => {
  const miss = (w: 'A' | 'B'): PointSpec => ({ w, result: 'out' });
  const win = (w: 'A' | 'B'): PointSpec => ({ w, result: 'smash_winner' });
  // 甲: 決め球12点 / 乙: 決め球0点、乙の得点は全部甲のミス（甲のミス4点）
  const games: PointSpec[][] = [
    [win('A'), win('A'), miss('B'), win('A'), win('A')],
    [win('A'), miss('B'), win('A'), miss('B'), win('A'), win('A')],
    [win('A'), win('A'), miss('B'), win('A'), win('A')],
  ];
  const findings = buildMatchFindings(build(5, games), NAMES);
  const winnerGap = findings.find((finding) => finding.kind === 'winner_gap');
  assert.strictEqual(winnerGap?.text, '自分で決めた点は 甲 12点、乙 0点');
  assert.strictEqual(winnerGap?.target, null);
  assert.ok(!findings.some((finding) => finding.kind === 'error_gap'), 'ミスの差は 4-0 で5点未満');
});

test('ラリーは8本以上ある区切りで75%以上の偏りがあれば、最も偏った1つだけ出す', () => {
  const long = (w: 'A' | 'B'): PointSpec => ({ w, rally: 10 });
  const games: PointSpec[][] = [
    [long('A'), long('A'), long('B'), long('A'), long('A')],
    [long('A'), long('A'), long('A'), long('A')],
    [
      { w: 'B', rally: 1 },
      { w: 'A', rally: 1 },
      { w: 'A', rally: 1 },
      { w: 'A', rally: 1 },
      { w: 'A', rally: 1 },
    ],
  ];
  const findings = buildMatchFindings(build(5, games), NAMES);
  const rally = findings.filter((finding) => finding.kind === 'rally_bias');
  assert.strictEqual(rally.length <= 1, true);
  assert.strictEqual(rally[0]?.text, '9本以上のラリーで取った点は 甲 8点、乙 1点');
});

test('最大3行で、優先の高い順', () => {
  const findings = buildMatchFindings(build(5, ['BBBB', 'BBBB', 'AAAA', 'AAAA', 'AAAA']), NAMES);
  assert.ok(findings.length <= 3);
  assert.strictEqual(findings[0].kind, 'comeback');
  assert.strictEqual(findings[1].kind, 'streak');
});

test('ゲームカウントが同数（途中の記録）なら何も出さない', () => {
  assert.deepStrictEqual(buildMatchFindings(build(5, ['AAAA', 'BBBB']), NAMES), []);
});

test('決め球とミス: 決め球は決めた側、ミスはミスをした側（失点した側）に数える', () => {
  const games: PointSpec[][] = [
    [
      { w: 'A', result: 'smash_winner' },
      { w: 'A', result: 'out' }, // 乙のアウト
      { w: 'B', result: 'net' }, // 甲のネット
      { w: 'A', result: 'smash_winner' },
      { w: 'A', result: 'double_fault' }, // 乙のダブルフォルト
    ],
  ];
  const sources = buildPointSources(build(3, games));
  assert.deepStrictEqual(sources.winners, [{ resultType: 'smash_winner', counts: { A: 2, B: 0 } }]);
  // 並びは固定順（net → out → … → double_fault）
  assert.deepStrictEqual(
    sources.ownErrors.map((row) => [row.resultType, row.counts.A, row.counts.B]),
    [
      ['net', 1, 0],
      ['out', 0, 1],
      ['double_fault', 0, 1],
    ],
  );
  assert.deepStrictEqual(sources.other, { A: 0, B: 0 });
});

test('ラリーの長さ別: ダブルフォルトは本数に入れず unknown に数える', () => {
  const games: PointSpec[][] = [
    [
      { w: 'A', rally: 1 },
      { w: 'B', rally: 4 },
      { w: 'A', rally: 12 },
      { w: 'A', rally: 12 },
      { w: 'A', result: 'double_fault' },
    ],
  ];
  const contexts = build(3, games);
  contexts[4].point.double_fault = true;
  contexts[4].rallyBucket = 'unknown';
  const split = buildRallyLengthSplit(contexts);
  assert.deepStrictEqual(
    split.rows.map((row) => [row.bucket, row.counts.A, row.counts.B]),
    [
      ['1-2', 1, 0],
      ['3-4', 0, 1],
      ['5-8', 0, 0],
      ['9+', 2, 0],
    ],
  );
  assert.strictEqual(split.unknown, 1);
});

summary();
