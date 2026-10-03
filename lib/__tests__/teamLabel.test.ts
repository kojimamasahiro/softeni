// lib/__tests__/teamLabel.test.ts
// 実行: npm run team-label:test
//
// 団体戦のチーム名に添える都道府県（formatTeamWithPrefecture）を固定する。
// 国民スポーツ大会はチーム＝都道府県なので、そのまま添えると「愛知県（愛知県）」と重なる。

import { assert, summary, test } from '../playerStats/__tests__/harness';
import { formatTeamWithPrefecture } from '../../src/utils/playerName';

test('学校チームは都道府県を括弧で添える', () => {
  assert.strictEqual(formatTeamWithPrefecture('尽誠学園', '香川県'), '尽誠学園（香川県）');
});

test('チーム名が都道府県そのものなら添えない', () => {
  assert.strictEqual(formatTeamWithPrefecture('愛知県', '愛知県'), '愛知県');
});

test('都道府県が無ければチーム名だけ', () => {
  assert.strictEqual(formatTeamWithPrefecture('日本', null), '日本');
  assert.strictEqual(formatTeamWithPrefecture('日本', ''), '日本');
});

summary();
