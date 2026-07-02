// scripts/playerStats/generate-public-json.ts
// 公開 JSON 生成: facade を通し public/data/player-stats/{id}.json を出力
// （クライアント遅延取得用フル。既存 players-lite/ とは別ディレクトリ）。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/generate-public-json.ts
//   [--full] 全選手を強制  [--ids=1,2] / [--curated] 対象限定（デバッグ用）
//
// P7 増分: 既定は manifest.lastRun に従い、facts 変更選手 ∪ 順位表変動選手のみ再生成。
//   無変更ならスキップ。facts が消えた選手の公開 JSON は削除する。
// 設計 §7.2。SSR とビルド JSON はロジック単一（同じ facade）なので必ず一致。

import fs from 'fs';
import path from 'path';

import { CURATED_FIXTURES } from '../../lib/playerStats/fixtures';
import { readManifest } from '../../lib/playerStats/manifest';
import { getAllPlayerIds, getPlayerStatistics } from '../../lib/playerStats/playerStatistics';

const OUT_DIR = ['public', 'data', 'player-stats'];

function log(msg: string): void {
  console.log(`[generate-public-json] ${msg}`);
}

async function main(): Promise<void> {
  const root = process.cwd();
  const args = process.argv.slice(2);
  let ids: number[] | null = null;
  let curatedOnly = false;
  let full = false;
  for (const a of args) {
    if (a.startsWith('--ids=')) {
      ids = a
        .slice('--ids='.length)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
    } else if (a === '--curated') {
      curatedOnly = true;
    } else if (a === '--full') {
      full = true;
    }
  }

  if (!ids && curatedOnly) ids = CURATED_FIXTURES.map((f) => f.id);

  // ---- P7 増分: 対象 id を manifest.lastRun から決める ----
  if (!ids && !full) {
    const lastRun = readManifest(root)?.lastRun;
    if (lastRun && lastRun.mode === 'incremental' && !lastRun.configChanged) {
      const target = new Set<number>(lastRun.affectedPlayers);
      for (const id of lastRun.rankingAffectedPlayers ?? []) target.add(id);
      if (target.size === 0) {
        log('no changes (skipped)');
        return;
      }
      ids = [...target].sort((a, b) => a - b);
      log(`incremental: ${ids.length} players`);
    }
  }
  if (!ids) ids = await getAllPlayerIds(root);

  const outDir = path.join(root, ...OUT_DIR);
  fs.mkdirSync(outDir, { recursive: true });

  let count = 0;
  let deleted = 0;
  for (const id of ids) {
    const outPath = path.join(outDir, `${id}.json`);
    const stats = await getPlayerStatistics(id, { includeFull: true }, root);
    if (stats.coverage.totalMatches === 0 && stats.coverage.totalEntries === 0) {
      // 出場が消えた選手（大会データ差し替え等）の公開 JSON は残さない
      if (fs.existsSync(outPath)) {
        fs.unlinkSync(outPath);
        deleted += 1;
      }
      continue;
    }
    fs.writeFileSync(outPath, JSON.stringify(stats), 'utf-8');
    count += 1;
  }
  log(`wrote ${count} player-stats JSON${deleted > 0 ? ` (deleted ${deleted})` : ''}`);
}

main();
