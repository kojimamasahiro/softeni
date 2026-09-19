// lib/__tests__/categoryFormat.test.ts
// 実行: npm run format:test
//
// 競技方式ブロック（ADR-021）とラウンド欄の文言を固定する。
// 要は次の3点。どれかが静かに壊れると、推定が断りなく事実として出る／
// 予選リーグの組が画面から消える。
//
// 1) 出典が欠けた format は表示しない（推測と転記の区別が付かなくなるため）
// 2) 推定（assumptions）は本文と分けて返す
// 3) 予選リーグの試合は「予選 グループA」、決勝Tの試合は round をそのまま出す

import { assert, summary, test } from '../playerStats/__tests__/harness';
import { buildCategoryFormat, findCategoryFormat, formatCheckedOn } from '../categoryFormat';
import { formatRoundLabel } from '../roundLabel';
import type { TournamentCategoryInfo, TournamentInformationEntry } from '../../src/types/tournament';

console.log('categoryFormat.test.ts');

function category(over: Partial<TournamentCategoryInfo> = {}): TournamentCategoryInfo {
  return {
    categoryId: 'doubles-none-mixed',
    label: '混合ダブルス',
    category: 'doubles',
    gender: 'mixed',
    age: 'none',
    ...over,
  };
}

const FULL = category({
  format: {
    summary: '19組を6つの予選リーグに分ける。',
    assumptions: ['上位2組が通過することは当サイトの推定です。'],
    source: '公式リザルトサイト',
    sourceUrl: 'https://example.invalid/',
    checkedOn: '2026-09-19',
  },
});

test('format を持たない種目は null（ほとんどの大会はこちら）', () => {
  assert.strictEqual(buildCategoryFormat(category()), null);
  assert.strictEqual(buildCategoryFormat(null), null);
  assert.strictEqual(buildCategoryFormat(undefined), null);
});

test('出典が欠けていたら表示しない', () => {
  const noSource = category({ format: { summary: 'あ', source: '', sourceUrl: 'https://example.invalid/' } });
  const noUrl = category({ format: { summary: 'あ', source: '公式', sourceUrl: '' } });
  const noSummary = category({ format: { summary: '   ', source: '公式', sourceUrl: 'https://example.invalid/' } });
  assert.strictEqual(buildCategoryFormat(noSource), null);
  assert.strictEqual(buildCategoryFormat(noUrl), null);
  assert.strictEqual(buildCategoryFormat(noSummary), null);
});

test('本文と推定を分けて返す', () => {
  const f = buildCategoryFormat(FULL);
  assert.ok(f);
  assert.strictEqual(f!.summary, '19組を6つの予選リーグに分ける。');
  assert.strictEqual(f!.assumptions.length, 1);
  assert.strictEqual(f!.checkedOn, '2026-09-19');
});

test('推定が無ければ空配列（シングルスのように一意に決まる種目）', () => {
  const f = buildCategoryFormat(category({ format: { summary: 'あ', source: '公式', sourceUrl: 'https://example.invalid/' } }));
  assert.strictEqual(f!.assumptions.length, 0);
});

test('壊れた checkedOn は落とす（「いつ時点か」を誤って出さない）', () => {
  const f = buildCategoryFormat(category({ format: { ...FULL.format!, checkedOn: '2026/09/19' } }));
  assert.strictEqual(f!.checkedOn, null);
});

test('findCategoryFormat は categoryId で引く', () => {
  const edition = { categories: [FULL, category({ categoryId: 'singles-none-boys' })] } as TournamentInformationEntry;
  assert.ok(findCategoryFormat(edition, 'doubles-none-mixed'));
  assert.strictEqual(findCategoryFormat(edition, 'singles-none-boys'), null);
  assert.strictEqual(findCategoryFormat(edition, 'team-none-boys'), null);
  assert.strictEqual(findCategoryFormat(null, 'doubles-none-mixed'), null);
});

test('formatCheckedOn は和暦風の日付に整える', () => {
  assert.strictEqual(formatCheckedOn('2026-09-19'), '2026年9月19日');
  assert.strictEqual(formatCheckedOn('こわれた'), 'こわれた');
});

test('ラウンド欄: 決勝Tは round、予選は組つき', () => {
  assert.strictEqual(formatRoundLabel({ round: '準決勝', group: 'A' }), '準決勝');
  assert.strictEqual(formatRoundLabel({ round: null, group: 'A' }), '予選 グループA');
  assert.strictEqual(formatRoundLabel({ group: '12' }), '予選 グループ12');
  assert.strictEqual(formatRoundLabel({ round: null, group: null }), '予選');
  assert.strictEqual(formatRoundLabel({}), '予選');
  assert.strictEqual(formatRoundLabel({ group: '  ' }), '予選');
});

summary();
