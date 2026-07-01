// scripts/playerStats/generate-facts.ts
// 逆引き索引を構築（data/players/_index/by-player.json）し、全選手ぶん
// _facts/{id}.json を出力する（増分対応は P7）。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/generate-facts.ts [--ids=1,2,3]
//
// 設計: 実行計画 P1 / データ契約 §H。ファサードのロジックは再利用し重複を作らない。

import fs from 'fs';
import path from 'path';

import { buildFacts } from '../../lib/playerStats/facts';
import { loadIdentity } from '../../lib/playerStats/identity';
import {
  buildReverseIndex,
  readReverseIndex,
  writeReverseIndex,
} from '../../lib/playerStats/reverseIndex';
import { SourceAdapter } from '../../lib/playerStats/sourceAdapter';
import type { ReverseIndex } from '../../lib/playerStats/types';

const FACTS_DIR = ['data', 'players', '_facts'];

function parseArgs(): { ids: number[] | null; reuseIndex: boolean } {
  let ids: number[] | null = null;
  let reuseIndex = false;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--ids=')) {
      ids = arg
        .slice('--ids='.length)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
    } else if (arg === '--reuse-index') {
      reuseIndex = true;
    }
  }
  return { ids, reuseIndex };
}

function main(): void {
  const root = process.cwd();
  const { ids, reuseIndex } = parseArgs();
  const adapter = new SourceAdapter(root);
  const identity = loadIdentity(root);

  let reverseIndex: ReverseIndex | null = reuseIndex
    ? readReverseIndex(root)
    : null;
  if (!reverseIndex) {
    // eslint-disable-next-line no-console
    console.log('[generate-facts] building reverse index (full scan)…');
    reverseIndex = buildReverseIndex(adapter, identity);
    writeReverseIndex(root, reverseIndex);
    // eslint-disable-next-line no-console
    console.log(
      `[generate-facts] reverse index: ${Object.keys(reverseIndex).length} players`,
    );
  }

  const targetIds = ids ?? Object.keys(reverseIndex).map((k) => Number(k));
  const factsDir = path.join(root, ...FACTS_DIR);
  fs.mkdirSync(factsDir, { recursive: true });

  let count = 0;
  for (const id of targetIds) {
    const facts = buildFacts(id, adapter, identity, reverseIndex);
    if (facts.matches.length === 0 && facts.entries.length === 0) continue;
    fs.writeFileSync(
      path.join(factsDir, `${id}.json`),
      JSON.stringify(facts),
      'utf-8',
    );
    count += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`[generate-facts] wrote _facts for ${count} players`);
}

main();
