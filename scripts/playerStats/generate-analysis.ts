// scripts/playerStats/generate-analysis.ts
// data/players/<slug>/analysis.json をエンジン（Facts）由来で生成する（P6・単一の真）。
// 外部 JSON 形は既存と互換（buildLegacyAnalysis が byte 一致を保証）。
// 旧 scripts/generate-player-analysis.mjs はこの生成器へ委譲する薄いラッパになった。
//
// P7 増分: 既定は manifest.lastRun に従い、facts が変わった curated 選手のみ再生成
//   （analysis.json は config 非依存）。Facts は _facts キャッシュを優先して再計算を避ける。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/generate-analysis.ts [--full]

import fs from 'fs';
import path from 'path';

import { ENGINE_VERSION, buildFacts } from '../../lib/playerStats/facts';
import { loadIdentity, nameKey } from '../../lib/playerStats/identity';
import { buildLegacyAnalysis } from '../../lib/playerStats/legacyAnalysis';
import { readManifest } from '../../lib/playerStats/manifest';
import { buildReverseIndex, readReverseIndex } from '../../lib/playerStats/reverseIndex';
import { SourceAdapter } from '../../lib/playerStats/sourceAdapter';
import type { PlayerFacts } from '../../lib/playerStats/types';

function readCachedFacts(root: string, id: number): PlayerFacts | null {
  try {
    const facts = JSON.parse(fs.readFileSync(path.join(root, 'data', 'players', '_facts', `${id}.json`), 'utf-8')) as PlayerFacts;
    return facts.engineVersion === ENGINE_VERSION ? facts : null;
  } catch {
    return null;
  }
}

function main(): void {
  const root = process.cwd();
  const full = process.argv.slice(2).includes('--full');
  const adapter = new SourceAdapter(root);
  const identity = loadIdentity(root);
  const reverseIndex = readReverseIndex(root) ?? buildReverseIndex(adapter, identity);

  // P7 増分: 影響選手集合（null = 全件）。
  const lastRun = readManifest(root)?.lastRun;
  const affected: Set<number> | null = !full && lastRun && lastRun.mode === 'incremental' ? new Set(lastRun.affectedPlayers) : null;

  const playersRoot = path.join(root, 'data', 'players');
  const slugs = fs.readdirSync(playersRoot).filter((s) => {
    try {
      return fs.statSync(path.join(playersRoot, s)).isDirectory();
    } catch {
      return false;
    }
  });

  let count = 0;
  let skipped = 0;
  for (const slug of slugs) {
    const infoPath = path.join(playersRoot, slug, 'information.json');
    if (!fs.existsSync(infoPath)) continue;
    let info: { lastName?: string; firstName?: string };
    try {
      info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    } catch {
      continue;
    }
    if (!info.lastName || !info.firstName) continue;
    const id = identity.byName.get(nameKey(info.lastName, info.firstName));
    if (id == null) continue;

    const outPath = path.join(playersRoot, slug, 'analysis.json');
    if (affected && !affected.has(id) && fs.existsSync(outPath)) {
      skipped += 1;
      continue;
    }

    const facts = readCachedFacts(root, id) ?? buildFacts(id, adapter, identity, reverseIndex);
    const analysis = buildLegacyAnalysis(facts, adapter, info.lastName, info.firstName);
    fs.writeFileSync(outPath, `${JSON.stringify(analysis, null, 2)}\n`, 'utf-8');
    count += 1;
  }

  console.log(`[generate-analysis] wrote analysis.json for ${count} players (engine-sourced${skipped > 0 ? `, skipped ${skipped} unchanged` : ''})`);
}

main();
