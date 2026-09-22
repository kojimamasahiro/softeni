// lib/__tests__/playerResultsTitle.test.ts
// 実行: npm run player-title:test
//
// 全国優勝者の選手結果ページの title を完成形の幅で予算化する規則を固定する（docs/wiki/seo.md「title の字数予算」）。

import { assert, summary, test } from '../playerStats/__tests__/harness';
import { composePlayerResultsTitle, PLAYER_TITLE_MAX_WIDTH, type NationalTitleLike } from '../nationalTitles';

console.log('playerResultsTitle.test.ts');

const width = (s: string) => [...s].reduce((w, ch) => w + (/[ -~｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);
const t = (tournamentId: string, shortLabel: string, year: number): NationalTitleLike => ({
  tournamentId,
  tournamentName: shortLabel,
  shortLabel,
  discipline: '男子ダブルス',
  year,
});

test('全国優勝が無ければ null（呼び出し側の通常 title を使う）', () => {
  assert(composePlayerResultsTitle('山田太郎（A高）', '山田太郎', []) === null, 'null を返す');
});

test('短ければ従来どおりの形のまま', () => {
  const title = composePlayerResultsTitle('廣瀬礼衣（B高）', '廣瀬礼衣', [t('interhigh', 'インターハイ', 2025)]);
  assert(title === '廣瀬礼衣（B高） インターハイ優勝｜試合結果・戦績 | ソフトテニス', `got ${title}`);
});

test('船水颯人の実例（旧59全角）が上限内に収まり、選手名と直近の大会の通称と「ソフトテニス」を残す', () => {
  const titles = [
    ...[2025, 2024, 2023, 2022, 2021].map((y) => t('zennihon', '全日本選手権', y)),
    t('indoor', '全日本インドア', 2024),
    t('indoor', '全日本インドア', 2023),
    ...[2019, 2018, 2017, 2016, 2015].map((y) => t('other', '全日本シングルス', y)),
  ];
  const title = composePlayerResultsTitle('船水颯人（One）', '船水颯人', titles)!;
  assert(width(title) <= PLAYER_TITLE_MAX_WIDTH, `幅 ${width(title)}: ${title}`);
  assert(title.startsWith('船水颯人'), title);
  assert(title.includes('全日本選手権優勝5回'), title);
  assert(title.includes('ソフトテニス'), title);
});

test('所属名が長すぎて何も収まらないときは所属を落とした最短形', () => {
  const title = composePlayerResultsTitle('山田太郎（とても長い名前の実業団ソフトテニスクラブ）', '山田太郎', [t('interhigh', 'インターハイ', 2025)])!;
  assert(title === '山田太郎 インターハイ優勝｜ソフトテニス戦績', title);
});

summary();
