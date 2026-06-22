import { cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const rootDir = resolve(import.meta.dirname, '..');
const sourceDir = resolve(rootDir, 'adinsight-site');
const outputDir = resolve(rootDir, 'out');

await rm(outputDir, { force: true, recursive: true });
await cp(sourceDir, outputDir, { recursive: true });
