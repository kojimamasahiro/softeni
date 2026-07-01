// scripts/playerStats/generate-public-json.ts
// 公開 JSON 生成: 全 ID を facade に通し public/data/player-stats/{id}.json を出力
// （クライアント遅延取得用フル。既存 players-lite/ とは別ディレクトリ）。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/generate-public-json.ts [--ids=1,2] [--curated]
//
// 設計 §7.2。SSR とビルド JSON はロジック単一（同じ facade）なので必ず一致。

import fs from 'fs';
import path from 'path';

import { CURATED_FIXTURES } from '../../lib/playerStats/fixtures';
import {
  getAllPlayerIds,
  getPlayerStatistics,
} from '../../lib/playerStats/playerStatistics';

const OUT_DIR = ['public', 'data', 'player-stats'];

async function main(): Promise<void> {
  const root = process.cwd();
  const args = process.argv.slice(2);
  let ids: number[] | null = null;
  let curatedOnly = false;
  for (const a of args) {
    if (a.startsWith('--ids=')) {
      ids = a
        .slice('--ids='.length)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
    } else if (a === '--curated') {
      curatedOnly = true;
    }
  }

  if (!ids && curatedOnly) ids = CURATED_FIXTURES.map((f) => f.id);
  if (!ids) ids = await getAllPlayerIds(root);

  const outDir = path.join(root, ...OUT_DIR);
  fs.mkdirSync(outDir, { recursive: true });

  let count = 0;
  for (const id of ids) {
    const stats = await getPlayerStatistics(id, { includeFull: true }, root);
    if (stats.coverage.totalMatches === 0 && stats.coverage.totalEntries === 0) {
      continue;
    }
    fs.writeFileSync(
      path.join(outDir, `${id}.json`),
      JSON.stringify(stats),
      'utf-8',
    );
    count += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`[generate-public-json] wrote ${count} player-stats JSON`);
}

main();
