// lib/__tests__/packedTeamMatches.test.ts
// 実行: npm run bracket:test（圧縮データの往復テストとまとめて流す）
//
// 団体戦の対戦ごとの記録（ADR-020）は、ページへ渡すときに lib/packedPageData.ts で詰め直す。
// ここが静かに落ちると、データはあるのに試合詳細に何も出ない（詰め方を足す前はまさにその状態だった）。

import { assert, summary, test } from '../playerStats/__tests__/harness';
import { packTournamentDetailData, unpackTournamentDetailData } from '../packedPageData';
import type { TournamentDetailData, TournamentMatch } from '../../src/types/tournament';

console.log('packedTeamMatches.test.ts');

const base: Omit<TournamentMatch, 'matchId' | 'matches'> = {
  entries: [1, 2],
  scores: { '1': 2, '2': 1 },
  round: '決勝',
  winnerEntryNo: 1,
  retired: false,
  stage: 'knockout',
  group: null,
  nextMatchId: null,
  prevMatchIds: [],
  prevMatchId: null,
};

const detail: TournamentDetailData = {
  participants: [],
  entries: [],
  results: [],
  matches: [
    {
      ...base,
      matchId: 'match-1',
      matches: [
        {
          type: 'D1',
          status: 'completed',
          winner: 'A',
          scoreA: 4,
          scoreB: 3,
          playersA: [
            { lastName: '大村', firstName: '怜央', playerId: 10 },
            { lastName: '伊藤', firstName: '康介' },
          ],
          playersB: [{ name: '川波 悠馬' }, { name: '百目木來杜' }],
        },
        {
          type: 'D2',
          status: 'unfinished',
          winner: null,
          scoreA: 3,
          scoreB: 3,
          playersA: [{ name: 'A' }, { name: 'B' }],
          playersB: [{ name: 'C' }, { name: 'D' }],
        },
        {
          type: 'D3',
          status: 'not_played',
          winner: null,
          scoreA: null,
          scoreB: null,
          playersA: [{ name: 'E' }, { name: 'F' }],
          playersB: [{ name: 'G' }, { name: 'H' }],
        },
      ],
    },
    { ...base, matchId: 'match-2' },
  ],
};

const packed = packTournamentDetailData(detail);
const [withTeam, withoutTeam] = unpackTournamentDetailData(packed).matches;

test('記録の無い試合は圧縮データに要素を足さない（団体戦以外のページを重くしない）', () => {
  assert.strictEqual(packed.matches[1].length, 8);
  assert.strictEqual(withoutTeam.matches, undefined);
});

test('状態・勝者・本数が往復で変わらない', () => {
  const subs = withTeam.matches ?? [];
  assert.deepStrictEqual(
    subs.map((s) => [s.type, s.status, s.winner, s.scoreA, s.scoreB]),
    [
      ['D1', 'completed', 'A', 4, 3],
      ['D2', 'unfinished', null, 3, 3],
      ['D3', 'not_played', null, null, null],
    ],
  );
});

test('選手は「姓 名」の表示名とリンク先だけになる。名前だけの選手はリンクしない', () => {
  const [d1] = withTeam.matches ?? [];
  assert.deepStrictEqual(d1.playersA, [{ name: '大村 怜央', playerId: 10 }, { name: '伊藤 康介' }]);
  assert.deepStrictEqual(d1.playersB, [{ name: '川波 悠馬' }, { name: '百目木來杜' }]);
});

summary();
