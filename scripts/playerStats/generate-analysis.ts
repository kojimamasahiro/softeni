// scripts/playerStats/generate-analysis.ts
// data/players/<slug>/analysis.json をエンジン（Facts）由来で生成する（P6・単一の真）。
// 外部 JSON 形は既存と互換（buildLegacyAnalysis が byte 一致を保証）。
// 旧 scripts/generate-player-analysis.mjs はこの生成器へ委譲する薄いラッパになった。
//
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/generate-analysis.ts

import fs from 'fs';
import path from 'path';

import { buildFacts } from '../../lib/playerStats/facts';
import { loadIdentity, nameKey } from '../../lib/playerStats/identity';
import { buildLegacyAnalysis } from '../../lib/playerStats/legacyAnalysis';
import {
  buildReverseIndex,
  readReverseIndex,
} from '../../lib/playerStats/reverseIndex';
import { SourceAdapter } from '../../lib/playerStats/sourceAdapter';

function main(): void {
  const root = process.cwd();
  const adapter = new SourceAdapter(root);
  const identity = loadIdentity(root);
  const reverseIndex =
    readReverseIndex(root) ?? buildReverseIndex(adapter, identity);

  const playersRoot = path.join(root, 'data', 'players');
  const slugs = fs
    .readdirSync(playersRoot)
    .filter((s) => {
      try {
        return fs.statSync(path.join(playersRoot, s)).isDirectory();
      } catch {
        return false;
      }
    });

  let count = 0;
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

    const facts = buildFacts(id, adapter, identity, reverseIndex);
    const analysis = buildLegacyAnalysis(
      facts,
      adapter,
      info.lastName,
      info.firstName,
    );
    fs.writeFileSync(
      path.join(playersRoot, slug, 'analysis.json'),
      `${JSON.stringify(analysis, null, 2)}\n`,
      'utf-8',
    );
    count += 1;
  }
  // eslint-disable-next-line no-console
  console.log(`[generate-analysis] wrote analysis.json for ${count} players (engine-sourced)`);
}

main();
