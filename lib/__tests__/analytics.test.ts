// lib/__tests__/analytics.test.ts
// 実行: npm run analytics:test
//
// ページ種別の判定を固定する。ここがずれると GA4 の from_type / to_type が静かに壊れ、
// 回遊検証ランブック（docs/wiki/circulation-verification.md）の実測表と突き合わせられなくなる。
// 判定順（具体的なものが先）に依存しているので、規則を足すときは必ずここに1件足すこと。

import { getPageType, isTrackableInternalHref, normalizePath } from '../analytics';
import { assert, summary, test } from '../playerStats/__tests__/harness';

console.log('analytics.test.ts');

test('主要なページ種別を判定できる', () => {
  const cases: Array<[string, string]> = [
    ['/', 'top'],
    ['/players/1234/results/', 'player_results'],
    ['/players/', 'players_index'],
    ['/players/uematsu-toshiki/', 'player_profile'],
    ['/tournaments/', 'tour_index'],
    ['/tournaments/highschool/highschool-championship/', 'tour_hub'],
    ['/tournaments/highschool/highschool-championship/2025/doubles/none/boys/', 'tour_year'],
    ['/tournaments/all/zennihon-singles/matches/abc123/', 'tour_match'],
    ['/highschool/', 'hs_top'],
    ['/highschool/rankings/', 'hs_rankings'],
    ['/highschool/tournaments/', 'hs_rekidai_index'],
    ['/highschool/tournaments/senbatsu/', 'hs_rekidai'],
    ['/highschool/boys/nara/takadashou/', 'hs_school'],
    ['/highschool/girls/miyagi/', 'hs_pref'],
    ['/highschool/boys/', 'hs_gender'],
    ['/secondaryschool/', 'jhs_top'],
    ['/secondaryschool/pathways/boys/', 'jhs_pathways'],
    ['/secondaryschool/yamagata/nagaikita/', 'jhs_team'],
    ['/secondaryschool/yamagata/', 'jhs_pref'],
    ['/teams/', 'teams_index'],
    ['/teams/nttnishinihon/', 'team_hub'],
    ['/teams/nttnishinihon/2025/boys/', 'team_year'],
    ['/st-league/2025/', 'stleague'],
    ['/rankings/', 'rankings'],
    ['/news/highschool-championship-2026-preview/', 'news'],
    ['/matches/0a7e33bb/', 'match_bare'],
    ['/beta/matches-results/abc/', 'beta'],
    ['/about/', 'other'],
  ];
  for (const [path, expected] of cases) {
    assert.strictEqual(getPageType(path), expected, `${path} -> ${getPageType(path)} (expected ${expected})`);
  }
});

test('末尾スラッシュ無し・クエリ・ハッシュ付きでも同じ種別になる', () => {
  assert.strictEqual(getPageType('/highschool/boys/nara/takadashou'), 'hs_school');
  assert.strictEqual(getPageType('/highschool/boys/nara/takadashou/?utm_source=x'), 'hs_school');
  assert.strictEqual(getPageType('/highschool/boys/nara/takadashou/#members'), 'hs_school');
  assert.strictEqual(normalizePath('/players/1/results'), '/players/1/results/');
});

test('学校ページと都道府県ページを取り違えない（判定順の回帰）', () => {
  // /highschool/(boys|girls)/[pref]/[team]/ と /highschool/(boys|girls)/[pref]/ は
  // 1階層しか違わないため、規則の順序を入れ替えると静かに壊れる。
  assert.strictEqual(getPageType('/highschool/boys/hokkaido/obihironou/'), 'hs_school');
  assert.strictEqual(getPageType('/highschool/boys/hokkaido/'), 'hs_pref');
  // 大会ハブと年度別も同型
  assert.strictEqual(getPageType('/tournaments/highschool/highschool-japan-cup/'), 'tour_hub');
  assert.strictEqual(getPageType('/tournaments/highschool/highschool-japan-cup/2025/singles/none/boys/'), 'tour_year');
});

test('計測対象の内部リンクだけを拾う', () => {
  const from = '/highschool/boys/nara/takadashou/';
  assert.ok(isTrackableInternalHref('/players/1234/results/', from));
  assert.ok(isTrackableInternalHref('/', from));
  // 自ページ（アンカーのみのリンクを含む）は数えない
  assert.ok(!isTrackableInternalHref(from, from));
  assert.ok(!isTrackableInternalHref(`${from}#members`, from));
  // 外部・プロトコル相対・内部アセット
  assert.ok(!isTrackableInternalHref('https://example.com/', from));
  assert.ok(!isTrackableInternalHref('//example.com/', from));
  assert.ok(!isTrackableInternalHref('/_next/static/chunk.js', from));
  assert.ok(!isTrackableInternalHref('/api/players/', from));
  assert.ok(!isTrackableInternalHref('/llms.txt', from));
});

summary();
