// lib/__tests__/upcomingInternational.test.ts
// 実行: npm run upcoming:test
//
// 選手ページの「これから開催される国際大会」ブロックの判定を固定する。
// ここは 1) 予選会↔本大会を命名規約で結ぶ 2) 会期が終われば自動的に消える
// 3) 1大会が複数カテゴリに分割されていても1件にまとめる、の3点が要。
// どれかが静かに壊れると、出るべき選手に出ない／終わった大会が出続ける。

import { assert, summary, test } from '../playerStats/__tests__/harness';
import { buildUpcomingInternationalLinks, placementStrength, type PlayerTournamentLike } from '../upcomingInternational';
import type { TournamentInformationEntry } from '../../src/types/tournament';

console.log('upcomingInternational.test.ts');

const INDEX = [
  { tournamentId: 'asian-games', label: 'アジア競技大会', generationId: 'international' },
  { tournamentId: 'asian-games-qualifier', label: 'アジア競技大会日本代表予選会', generationId: 'international-qualifier' },
];

function info(over: Partial<TournamentInformationEntry> = {}): TournamentInformationEntry {
  return {
    year: 2026,
    location: '愛知県',
    startDate: '2026-09-18',
    endDate: '2026-09-23',
    source: 'JOC',
    sourceUrl: 'https://example.invalid/',
    label: '第20回 アジア競技大会',
    categories: [],
    venues: [{ prefecture: '愛知県', city: '名古屋市天白区', name: '名古屋市東山公園テニスセンター' }],
    ...over,
  } as TournamentInformationEntry;
}

// 予選会は2回ぶん入っている: 2022年度=前回(杭州)向け / 2025年度=今回(愛知・名古屋)向け
const INFO = new Map<string, TournamentInformationEntry[]>([
  ['asian-games', [info()]],
  [
    'asian-games-qualifier',
    [
      info({ year: 2022, startDate: '2022-04-16', endDate: '2022-04-17', label: '第19回 アジア競技大会日本代表予選会', venues: [] }),
      info({ year: 2025, startDate: '2026-03-20', endDate: '2026-03-22', label: '第20回 アジア競技大会日本代表予選会', venues: [] }),
    ],
  ],
]);

function build(playerTournaments: PlayerTournamentLike[], today = '2026-08-26') {
  return buildUpcomingInternationalLinks({ playerTournaments, tournamentIndex: INDEX, informationMap: INFO, today });
}

test('予選会に出場していれば本大会へのリンクが出る', () => {
  const links = build([{ tournamentId: 'asian-games-qualifier', year: 2025, finalResult: '優勝', link: '/x/' }]);
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].mainLabel, '第20回 アジア競技大会');
  assert.strictEqual(links[0].mainHref, '/tournaments/international/asian-games/');
  assert.strictEqual(links[0].placementLabel, '優勝');
  assert.strictEqual(links[0].venueName, '名古屋市東山公園テニスセンター');
  assert.strictEqual(links[0].hasStarted, false);
});

test('予選会に出ていない選手には何も出ない', () => {
  assert.strictEqual(build([{ tournamentId: 'zennihon-championship', year: 2025, finalResult: '優勝' }]).length, 0);
});

test('本大会が index.json に未登録なら出ない（命名規約で相手が居ないケース）', () => {
  const links = buildUpcomingInternationalLinks({
    playerTournaments: [{ tournamentId: 'world-championship-qualifier', year: 2024, finalResult: '優勝' }],
    tournamentIndex: INDEX,
    informationMap: INFO,
    today: '2026-08-26',
  });
  assert.strictEqual(links.length, 0);
});

test('会期が過ぎたら自動的に消える', () => {
  assert.strictEqual(build([{ tournamentId: 'asian-games-qualifier', year: 2025, finalResult: '優勝' }], '2026-09-24').length, 0);
});

test('会期中は hasStarted が true になる', () => {
  const links = build([{ tournamentId: 'asian-games-qualifier', year: 2025, finalResult: '優勝' }], '2026-09-20');
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].hasStarted, true);
});

test('段階分割された大会は1件にまとまり、決着した成績が選ばれる', () => {
  // 2025年の予選会は 決勝トーナメント / 準決勝リーグ / 決勝リーグ の3カテゴリに分かれている。
  // 最終成績を持つのは決着したカテゴリだけ（docs/wiki/data-model.md）なので、そちらが選ばれる。
  const links = build([
    { tournamentId: 'asian-games-qualifier', year: 2025, finalResult: '不明' },
    { tournamentId: 'asian-games-qualifier', year: 2025, finalResult: '予選1位' },
    { tournamentId: 'asian-games-qualifier', year: 2025, finalResult: '優勝' },
  ]);
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].placementLabel, '優勝');
});

test('成績が判定できない場合は placementLabel が null（「出場」とだけ書く）', () => {
  const links = build([{ tournamentId: 'asian-games-qualifier', year: 2025, finalResult: '不明' }]);
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].placementLabel, null);
});

test('複数年度に出ている場合は今回の本大会に対応する回を採る', () => {
  const links = build([
    { tournamentId: 'asian-games-qualifier', year: 2022, finalResult: '優勝' },
    { tournamentId: 'asian-games-qualifier', year: 2025, finalResult: '3回戦敗退' },
  ]);
  assert.strictEqual(links.length, 1);
  assert.strictEqual(links[0].qualifierYear, 2025);
  // 2022年の優勝ではなく2025年の成績。前回大会の実績を今回に紐づけない
  assert.strictEqual(links[0].placementLabel, '3回戦敗退');
});

test('前回大会向けの予選会にしか出ていない選手には出さない', () => {
  // アジア競技大会は4年周期。2022年度の予選会は前回(杭州)向けなので、
  // そこにしか出ていない選手を今回の大会に結びつけてはいけない。
  assert.strictEqual(build([{ tournamentId: 'asian-games-qualifier', year: 2022, finalResult: '優勝' }]).length, 0);
});

test('予選会側の開催情報が無ければ年度で絞らない', () => {
  const links = buildUpcomingInternationalLinks({
    playerTournaments: [{ tournamentId: 'asian-games-qualifier', year: 2022, finalResult: '優勝' }],
    tournamentIndex: INDEX,
    informationMap: new Map([['asian-games', [info()]]]),
    today: '2026-08-26',
  });
  assert.strictEqual(links.length, 1);
});

test('placementStrength: 優勝 > 準優勝 > ベスト4 > ベスト8 > 回戦敗退 > 予選順位 > 不明', () => {
  const order = ['優勝', '準優勝', 'ベスト4', 'ベスト8', '5回戦敗退', '1回戦敗退', '予選2位', '予選4位', '不明'];
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(placementStrength(order[i - 1]) > placementStrength(order[i]), `${order[i - 1]} > ${order[i]}`);
  }
});

summary();
