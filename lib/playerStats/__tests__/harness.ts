// lib/playerStats/__tests__/harness.ts
// 依存ゼロの極小テストハーネス（ts-node 実行）。外部テストフレームワーク未導入のため。
// 使い方: test('desc', () => { assert(...) }); 末尾で summary() を呼ぶ。

import assert from 'assert';

let passed = 0;
let failed = 0;
const failures: string[] = [];

export function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    // eslint-disable-next-line no-console
    console.log(`  ✗ ${name}\n      ${msg}`);
  }
}

export function summary(): void {
  // eslint-disable-next-line no-console
  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

export { assert };
