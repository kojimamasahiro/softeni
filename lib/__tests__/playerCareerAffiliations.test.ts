// lib/__tests__/playerCareerAffiliations.test.ts
// 実行: npm run career:test
//
// 選手結果ページの description / JSON-LD に出す所属歴の整形を固定する。
// ここが壊れると 1,547 枚（index 対象の 89.8%）のメタデータが静かに変わるので、
// 規則を足すときは必ずここに1件足すこと。

import { assert, summary, test } from '../playerStats/__tests__/harness';
import {
  careerAffiliationNodes,
  careerAffiliations,
  careerAffiliationsDescriptionPhrase,
  composeDescriptionTail,
  displayWidth,
} from '../playerCareerAffiliations';
import type { TeamRow } from '../../src/types/playerStatistics';

console.log('playerCareerAffiliations.test.ts');

const row = (team: string, from: string | null): TeamRow => ({
  team,
  span: { from, to: from },
  matches: { total: 0, wins: 0, losses: 0, winRate: 0 },
  games: { total: 0, won: 0, lost: 0, gameRate: 0 },
  titles: 0,
});

test('所属歴は古い順に並び、最新の所属は除かれる', () => {
  // 木原恵菜（id=198）の実データ形。title が持つのは最新の「サンワxエナジークラブ」だけで、
  // 世間が使う「ナガセケンコー」は本文の所属別成績表にしか無い、というのが本施策の発端。
  const byTeam = [row('ナガセケンコー', '2021-04-01'), row('サンワxエナジークラブ', '2026-05-01'), row('高田商', '2017-06-01')];
  assert.deepEqual(careerAffiliations(byTeam, 'サンワxエナジークラブ'), ['高田商', 'ナガセケンコー']);
});

test('表記ゆれ（記号・中黒・全半角の差）は畳んで1件にする', () => {
  const byTeam = [row('道後・八千代クラブ', '2024-01-01'), row('道後八千代クラブ', '2025-01-01')];
  assert.deepEqual(careerAffiliations(byTeam, '道後八千代クラブ'), []);
  assert.deepEqual(careerAffiliations(byTeam, null), ['道後・八千代クラブ']);
});

test('記号差ではなく語尾が違う表記ゆれは畳まない（既知の制約）', () => {
  // 「サンワxエナジー」は正規化しても「サンワエナジークラブ」と別文字列なので残る。
  // 前方一致で畳む案は「中京」と「中京大学」のような別実体を誤結合するため採らない。
  // 実測で該当は index 対象 1,723 枚中 2 枚（木原恵菜・簗田亮）なので許容する。
  const byTeam = [row('サンワエナジークラブ', '2026-01-01'), row('サンワxエナジー', '2026-02-01'), row('サンワxエナジークラブ', '2026-03-01')];
  assert.deepEqual(careerAffiliations(byTeam, 'サンワxエナジークラブ'), ['サンワxエナジー']);
});

test('所属が1つだけ・空・未定義なら空配列', () => {
  assert.deepEqual(careerAffiliations([row('広島翔洋', '2024-01-01')], '広島翔洋'), []);
  assert.deepEqual(careerAffiliations([], '広島翔洋'), []);
  assert.deepEqual(careerAffiliations(undefined, '広島翔洋'), []);
});

test('description フレーズは該当が無ければ null', () => {
  assert.equal(careerAffiliationsDescriptionPhrase([]), null);
  assert.equal(careerAffiliationsDescriptionPhrase(['高田商', 'ナガセケンコー']), 'これまでの所属は高田商・ナガセケンコー。');
});

test('学校マーカーを持つものだけ alumniOf、それ以外は memberOf', () => {
  const { alumniOf, memberOf } = careerAffiliationNodes(['九度山中学校', '早稲田大学', 'ナガセケンコー']);
  assert.deepEqual(alumniOf, [
    { '@type': 'EducationalOrganization', name: '九度山中学校' },
    { '@type': 'EducationalOrganization', name: '早稲田大学' },
  ]);
  assert.deepEqual(memberOf, [{ '@type': 'Organization', name: 'ナガセケンコー' }]);
});

test('略称の学校は memberOf 側へ落ちる（既知の制約・正式名対応表が無いため）', () => {
  const { alumniOf, memberOf } = careerAffiliationNodes(['高田商']);
  assert.equal(alumniOf.length, 0);
  assert.deepEqual(memberOf, [{ '@type': 'Organization', name: '高田商' }]);
});

test('表示幅は全角1・半角0.5で数える', () => {
  assert.equal(displayWidth('あいう'), 3);
  assert.equal(displayWidth('abcd'), 2);
  assert.equal(displayWidth('勝率55%'), 3.5);
});

test('末尾は予算内なら主なペアと所属歴の両方を出す', () => {
  const head = 'あ'.repeat(80);
  const partner = '主なペアは早川日向。'; // 10 全角
  const career = 'これまでの所属は高田商・ナガセケンコー。'; // 19 全角
  assert.equal(composeDescriptionTail(head, partner, career), head + partner + career, '80+10+19=109 全角');
});

test('両方は入らないとき主なペアを落として所属歴を残す', () => {
  const head = 'あ'.repeat(100);
  const partner = '主なペアは早川日向。';
  const career = 'これまでの所属は高田商・ナガセケンコー。';
  assert.equal(composeDescriptionTail(head, partner, career), head + career, '100+19=119 全角なので所属歴を優先');
});

test('所属歴も入らないときは改修前と同じ主なペアのみへ戻す', () => {
  const head = 'あ'.repeat(115);
  const partner = '主なペアは早川日向。';
  const career = 'これまでの所属は高田商・ナガセケンコー。';
  assert.equal(composeDescriptionTail(head, partner, career), head + partner, '予算超過でも既存文言は削らない');
});

test('所属歴が無ければ主なペアだけを足す', () => {
  const head = 'あ'.repeat(80);
  assert.equal(composeDescriptionTail(head, '主なペアは早川日向。', null), head + '主なペアは早川日向。');
  assert.equal(composeDescriptionTail(head, '', null), head);
});

summary();
