// scripts/playerStats/run-tests.ts
// lib/playerStats/__tests__/*.test.ts を順に実行する極小テストランナー。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/run-tests.ts

import fs from 'fs';
import path from 'path';

const testsDir = path.join(process.cwd(), 'lib', 'playerStats', '__tests__');
const files = fs
  .readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort();

for (const f of files) {
  // 動的なテストファイル読み込みのため require を使う（import() は ts-node CJS で非同期になるため）
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(path.join(testsDir, f));
}
