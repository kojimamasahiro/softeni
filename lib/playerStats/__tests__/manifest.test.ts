// lib/playerStats/__tests__/manifest.test.ts
// P7: manifest の diff / info 展開 / 年度抽出（純関数）の単体テスト。
import { diffFiles, expandDiffToCatKeys, isEmptyDiff, yearsOfCatKeys } from '../manifest';
import { assert, summary, test } from './harness';

console.log('manifest.test.ts');

test('diffFiles detects changed / added / removed', () => {
  const oldFiles = { 'a/2024/x': '1', 'b/2024/y': '2', 'c/2025/z': '3' };
  const newFiles = { 'a/2024/x': '1', 'b/2024/y': '9', 'd/2025/w': '4' };
  const diff = diffFiles(oldFiles, newFiles);
  assert.deepStrictEqual(diff.changed, ['b/2024/y']);
  assert.deepStrictEqual(diff.added, ['d/2025/w']);
  assert.deepStrictEqual(diff.removed, ['c/2025/z']);
  assert.strictEqual(isEmptyDiff(diff), false);
});

test('diffFiles returns empty diff when identical', () => {
  const files = { 'a/2024/x': '1', 'info:a': '2' };
  const diff = diffFiles(files, { ...files });
  assert.strictEqual(isEmptyDiff(diff), true);
});

test('expandDiffToCatKeys passes through detail changes', () => {
  const oldFiles = { 'a/2024/x': '1', 'info:a': 'i1' };
  const newFiles = { 'a/2024/x': '2', 'info:a': 'i1' };
  const diff = diffFiles(oldFiles, newFiles);
  const { detailsChanged, affected } = expandDiffToCatKeys(diff, oldFiles, newFiles);
  assert.deepStrictEqual(detailsChanged, ['a/2024/x']);
  assert.deepStrictEqual(affected, ['a/2024/x']);
});

test('expandDiffToCatKeys expands info change to all catKeys of the tournament', () => {
  const oldFiles = {
    'a/2024/x': '1',
    'a/2025/y': '2',
    'b/2024/z': '3',
    'info:a': 'i1',
    'info:b': 'i2',
  };
  const newFiles = { ...oldFiles, 'info:a': 'i9' };
  const diff = diffFiles(oldFiles, newFiles);
  const { detailsChanged, affected } = expandDiffToCatKeys(diff, oldFiles, newFiles);
  assert.deepStrictEqual(detailsChanged, []); // 索引の更新は不要
  assert.deepStrictEqual(affected, ['a/2024/x', 'a/2025/y']); // facts は再生成
});

test('expandDiffToCatKeys handles removed detail file', () => {
  const oldFiles = { 'a/2024/x': '1', 'info:a': 'i1' };
  const newFiles = { 'info:a': 'i1' };
  const diff = diffFiles(oldFiles, newFiles);
  const { detailsChanged, affected } = expandDiffToCatKeys(diff, oldFiles, newFiles);
  assert.deepStrictEqual(detailsChanged, ['a/2024/x']);
  assert.deepStrictEqual(affected, ['a/2024/x']);
});

test('yearsOfCatKeys extracts sorted unique years', () => {
  assert.deepStrictEqual(yearsOfCatKeys(['a/2025/x', 'b/2024/y', 'c/2025/z']), [2024, 2025]);
  assert.deepStrictEqual(yearsOfCatKeys([]), []);
});

summary();
