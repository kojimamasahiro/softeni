// scripts/playerStats/verify-analysis-migration.ts
// P6: エンジン由来の analysis.json 互換出力が既存 analysis.json と byte 一致することを確認。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/verify-analysis-migration.ts

import fs from 'fs';
import path from 'path';

import { CURATED_FIXTURES } from '../../lib/playerStats/fixtures';
import { buildFacts } from '../../lib/playerStats/facts';
import { loadIdentity } from '../../lib/playerStats/identity';
import { buildLegacyAnalysis } from '../../lib/playerStats/legacyAnalysis';
import { buildReverseIndex } from '../../lib/playerStats/reverseIndex';
import { SourceAdapter } from '../../lib/playerStats/sourceAdapter';

function main(): void {
  const root = process.cwd();
  const adapter = new SourceAdapter(root);
  const identity = loadIdentity(root);
  const reverseIndex = buildReverseIndex(adapter, identity);

  let match = 0;
  let diff = 0;
  for (const fx of CURATED_FIXTURES) {
    if (!fx.slug) continue;
    const goldenPath = path.join(root, 'data', 'players', fx.slug, 'analysis.json');
    const goldenText = fs.readFileSync(goldenPath, 'utf-8');
    const golden = JSON.parse(goldenText);
    const info = identity.byId.get(fx.id)!;
    const facts = buildFacts(fx.id, adapter, identity, reverseIndex);
    const built = buildLegacyAnalysis(facts, adapter, info.lastName, info.firstName);

    // 同一シリアライズ（2 スペース）で比較
    const builtText = JSON.stringify(built, null, 2);
    const goldenNorm = JSON.stringify(golden, null, 2);
    if (builtText === goldenNorm) {
      match += 1;
    } else {
      diff += 1;
      // eslint-disable-next-line no-console
      console.log(`  ✗ ${fx.slug}: DIFF`);
      // 最初の差異キーを示す
      for (const k of Object.keys(golden)) {
        const a = JSON.stringify((golden as any)[k]);
        const b = JSON.stringify((built as any)[k]);
        if (a !== b) {
          // eslint-disable-next-line no-console
          console.log(`      key=${k}\n        golden=${a.slice(0, 200)}\n        built =${b.slice(0, 200)}`);
        }
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(`\n  byte-match=${match} diff=${diff}`);
  if (diff > 0) process.exitCode = 1;
}

main();
