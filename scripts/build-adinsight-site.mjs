import { cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const sourceDir = resolve(rootDir, 'adinsight-site');
const outputDir = resolve(rootDir, 'out');
// 運用メモと設定の雛形は公開しない
const excluded = new Set(['README.md', 'config.js.example'].map((name) => resolve(sourceDir, name)));

await rm(outputDir, { force: true, recursive: true });
await cp(sourceDir, outputDir, {
  recursive: true,
  filter: (src) => !excluded.has(src),
});
