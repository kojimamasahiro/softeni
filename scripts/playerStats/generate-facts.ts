// scripts/playerStats/generate-facts.ts
// 逆引き索引（data/players/_index/by-player.json）と _facts/{id}.json を生成する。
// P7: contentHash manifest（data/players/_manifest.json）による増分が既定。
//   変更大会 → 逆引きで影響選手を求め、その選手だけ _facts を再生成する。
//   無変更なら再計算ゼロ。engineVersion / グローバル入力の変更時のみ全再計算。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/generate-facts.ts
//   [--full] 全再計算を強制  [--ids=1,2,3] 対象限定（デバッグ用・manifest 更新なし）
//
// 設計: 実行計画 P1/P7、エンジン設計 §6.2、データ契約 §H。

import fs from 'fs';
import path from 'path';

import { ENGINE_VERSION, buildFacts } from '../../lib/playerStats/facts';
import { Identity, loadIdentity } from '../../lib/playerStats/identity';
import {
  BuildManifest,
  ManifestLastRun,
  computeConfigHash,
  computeGlobalHash,
  diffFiles,
  expandDiffToCatKeys,
  isEmptyDiff,
  readManifest,
  snapshotFiles,
  writeManifest,
  yearsOfCatKeys,
} from '../../lib/playerStats/manifest';
import { applyReverseIndexDelta, buildReverseIndex, readReverseIndex, writeReverseIndex } from '../../lib/playerStats/reverseIndex';
import { SourceAdapter } from '../../lib/playerStats/sourceAdapter';
import type { ReverseIndex } from '../../lib/playerStats/types';

const FACTS_DIR = ['data', 'players', '_facts'];

function parseArgs(): { ids: number[] | null; full: boolean } {
  let ids: number[] | null = null;
  let full = false;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--ids=')) {
      ids = arg
        .slice('--ids='.length)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
    } else if (arg === '--full') {
      full = true;
    }
  }
  return { ids, full };
}

function log(msg: string): void {
  console.log(`[generate-facts] ${msg}`);
}

/** 対象選手の _facts を書く。facts が空なら既存ファイルを消す。 */
function writeFactsFor(
  root: string,
  ids: Iterable<number>,
  adapter: SourceAdapter,
  identity: Identity,
  reverseIndex: ReverseIndex,
): { written: number; deleted: number } {
  const factsDir = path.join(root, ...FACTS_DIR);
  fs.mkdirSync(factsDir, { recursive: true });
  let written = 0;
  let deleted = 0;
  for (const id of ids) {
    const filePath = path.join(factsDir, `${id}.json`);
    const facts = buildFacts(id, adapter, identity, reverseIndex);
    if (facts.matches.length === 0 && facts.entries.length === 0) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted += 1;
      }
      continue;
    }
    fs.writeFileSync(filePath, JSON.stringify(facts), 'utf-8');
    written += 1;
  }
  return { written, deleted };
}

/** 索引に存在しない選手の stale な _facts を消す（全再計算時のみ）。 */
function pruneStaleFacts(root: string, reverseIndex: ReverseIndex): number {
  const factsDir = path.join(root, ...FACTS_DIR);
  if (!fs.existsSync(factsDir)) return 0;
  let pruned = 0;
  for (const file of fs.readdirSync(factsDir)) {
    if (!file.endsWith('.json')) continue;
    const idStr = file.replace(/\.json$/, '');
    if (!(idStr in reverseIndex)) {
      fs.unlinkSync(path.join(factsDir, file));
      pruned += 1;
    }
  }
  return pruned;
}

function main(): void {
  const root = process.cwd();
  const { ids, full } = parseArgs();
  const adapter = new SourceAdapter(root);
  const identity = loadIdentity(root);

  // ---- デバッグ用: 対象限定モード（manifest 更新なし） ----
  if (ids) {
    const reverseIndex = readReverseIndex(root) ?? buildReverseIndex(adapter, identity);
    const { written } = writeFactsFor(root, ids, adapter, identity, reverseIndex);
    log(`wrote _facts for ${written} players (targeted; manifest untouched)`);
    return;
  }

  const oldManifest = readManifest(root);
  const configHash = computeConfigHash(root);
  const globalHash = computeGlobalHash(root);
  const configChanged = !oldManifest || oldManifest.configHash !== configHash;
  const existingIndex = readReverseIndex(root);

  const fullNeeded =
    full ||
    !oldManifest ||
    !existingIndex ||
    oldManifest.engineVersion !== ENGINE_VERSION ||
    oldManifest.globalHash !== globalHash ||
    !fs.existsSync(path.join(root, ...FACTS_DIR));

  const newFiles = snapshotFiles(root, adapter);
  let lastRun: ManifestLastRun;

  if (fullNeeded) {
    const reason = full
      ? '--full'
      : !oldManifest
        ? 'no manifest'
        : !existingIndex
          ? 'no reverse index'
          : oldManifest.engineVersion !== ENGINE_VERSION
            ? `engineVersion ${oldManifest.engineVersion} -> ${ENGINE_VERSION}`
            : oldManifest.globalHash !== globalHash
              ? 'global inputs changed'
              : 'no _facts dir';
    log(`full rebuild (${reason})…`);
    const reverseIndex = buildReverseIndex(adapter, identity);
    writeReverseIndex(root, reverseIndex);
    log(`reverse index: ${Object.keys(reverseIndex).length} players`);

    const allIds = Object.keys(reverseIndex).map((k) => Number(k));
    const { written, deleted } = writeFactsFor(root, allIds, adapter, identity, reverseIndex);
    const pruned = pruneStaleFacts(root, reverseIndex);
    log(`wrote _facts for ${written} players (deleted ${deleted + pruned} stale)`);

    lastRun = {
      mode: 'full',
      at: new Date().toISOString(),
      changedFiles: [],
      affectedPlayers: [],
      changedYears: [],
      configChanged,
    };
  } else {
    // ---- 増分 ----
    const diff = diffFiles(oldManifest!.files, newFiles);
    if (isEmptyDiff(diff)) {
      log('no changes (0 files changed, 0 players recomputed)');
      lastRun = {
        mode: 'incremental',
        at: new Date().toISOString(),
        changedFiles: [],
        affectedPlayers: [],
        changedYears: [],
        configChanged,
      };
    } else {
      const { detailsChanged, affected } = expandDiffToCatKeys(diff, oldManifest!.files, newFiles);
      const reverseIndex = existingIndex!;

      // detail 本体の変更 → 索引を増分更新し、影響選手を得る
      const affectedIds = applyReverseIndexDelta(reverseIndex, adapter, identity, detailsChanged);
      // information（開催日）だけの変更 → 索引は不変。現保持者を影響選手に加える
      const detailsChangedSet = new Set(detailsChanged);
      const infoOnlyKeys = affected.filter((k) => !detailsChangedSet.has(k));
      if (infoOnlyKeys.length > 0) {
        const keySet = new Set(infoOnlyKeys);
        for (const [idStr, entry] of Object.entries(reverseIndex)) {
          if (entry.categories.some((c) => keySet.has(c))) {
            affectedIds.add(Number(idStr));
          }
        }
      }
      if (detailsChanged.length > 0) writeReverseIndex(root, reverseIndex);

      const { written, deleted } = writeFactsFor(root, affectedIds, adapter, identity, reverseIndex);
      const changedFiles = [...diff.changed, ...diff.added, ...diff.removed];
      log(`incremental: ${changedFiles.length} files changed -> ${affectedIds.size} players (wrote ${written}, deleted ${deleted})`);
      lastRun = {
        mode: 'incremental',
        at: new Date().toISOString(),
        changedFiles,
        affectedPlayers: [...affectedIds].sort((a, b) => a - b),
        changedYears: yearsOfCatKeys(affected),
        configChanged,
      };
    }
  }

  const manifest: BuildManifest = {
    engineVersion: ENGINE_VERSION,
    configHash,
    globalHash,
    files: newFiles,
    lastRun,
    generatedAt: new Date().toISOString(),
  };
  writeManifest(root, manifest);
}

main();
