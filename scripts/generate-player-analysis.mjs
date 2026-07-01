// scripts/generate-player-analysis.mjs
// P6 以降: 薄いラッパ。集計ロジックは Player Statistics Engine（lib/playerStats）へ一本化した。
// data/players/<slug>/analysis.json の算出は scripts/playerStats/generate-analysis.ts に委譲する
// （エンジン Facts が単一の真。外部 JSON 形は従来と互換）。
//
// 旧実装（独自の全大会スキャン＋集計）は削除し二重ロジックを解消（設計 §8）。
// 集計の詳細は docs/raw/2026-07-01-player-statistics-engine*.md / docs/wiki/players-pages.md。

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const tsNode = path.join(projectRoot, 'node_modules', '.bin', 'ts-node');
const tsconfig = path.join(projectRoot, 'scripts', 'playerStats', 'tsconfig.json');
const generator = path.join(
  projectRoot,
  'scripts',
  'playerStats',
  'generate-analysis.ts',
);

const result = spawnSync(
  tsNode,
  ['--project', tsconfig, generator],
  { stdio: 'inherit', cwd: projectRoot },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
