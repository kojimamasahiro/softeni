// scripts/playerStats/verify-facts-golden.ts
// P1 受け入れ基準: 代表選手で Facts から素朴集計した総試合数・勝敗・ゲーム率が
// 既存 analysis.json と一致（retired 除外分は説明可能な差として報告）。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/verify-facts-golden.ts

import fs from 'fs';
import path from 'path';

import { buildFacts } from '../../lib/playerStats/facts';
import { CURATED_FIXTURES } from '../../lib/playerStats/fixtures';
import { loadIdentity } from '../../lib/playerStats/identity';
import { buildReverseIndex } from '../../lib/playerStats/reverseIndex';
import { SourceAdapter } from '../../lib/playerStats/sourceAdapter';
import type { PlayerFacts } from '../../lib/playerStats/types';

interface GoldenAnalysis {
  totalMatches: number;
  wins: number;
  losses: number;
  games: { total: number; won: number; lost: number };
}

/** Facts 全 match を素朴集計（golden と同じく retired を含む）。 */
function naiveAggregateAll(facts: PlayerFacts) {
  let total = 0;
  let wins = 0;
  let losses = 0;
  let gWon = 0;
  let gLost = 0;
  for (const m of facts.matches) {
    total += 1;
    if (m.result === 'win') wins += 1;
    else if (m.result === 'lose') losses += 1;
    gWon += m.gamesWon;
    gLost += m.gamesLost;
  }
  return { total, wins, losses, gWon, gLost, gTotal: gWon + gLost };
}

function retiredCount(facts: PlayerFacts): number {
  return facts.matches.filter((m) => !m.countsForWinRate).length;
}

function main(): void {
  const root = process.cwd();
  const adapter = new SourceAdapter(root);
  const identity = loadIdentity(root);
  const reverseIndex = buildReverseIndex(adapter, identity);

  let exact = 0;
  let explainable = 0;
  let failed = 0;

  for (const fx of CURATED_FIXTURES) {
    if (!fx.slug) continue;
    const goldenPath = path.join(root, 'data', 'players', fx.slug, 'analysis.json');
    let golden: GoldenAnalysis | null = null;
    try {
      golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));
    } catch {
      golden = null;
    }
    if (!golden) continue;

    const facts = buildFacts(fx.id, adapter, identity, reverseIndex);
    const agg = naiveAggregateAll(facts);
    const retired = retiredCount(facts);

    const okAll =
      agg.total === golden.totalMatches &&
      agg.wins === golden.wins &&
      agg.losses === golden.losses &&
      agg.gTotal === golden.games.total &&
      agg.gWon === golden.games.won &&
      agg.gLost === golden.games.lost;

    if (okAll) {
      exact += 1;
      console.log(
        `  ✓ ${fx.slug} (id=${fx.id}) matches golden exactly | M=${agg.total} W=${agg.wins} L=${agg.losses} G=${agg.gWon}-${agg.gLost} | retired=${retired}`,
      );
    } else {
      // 差分を説明: retired を除いた集計と比較（説明可能か）
      const diffM = agg.total - golden.totalMatches;
      const diffW = agg.wins - golden.wins;
      const diffL = agg.losses - golden.losses;
      const diffG = agg.gTotal - golden.games.total;
      const explainableByRetired = diffM === 0 && diffW === 0 && diffL === 0 && diffG === 0;
      if (explainableByRetired) {
        explainable += 1;
      } else {
        failed += 1;
      }
      console.log(
        `  ✗ ${fx.slug} (id=${fx.id}) DIFF | facts M=${agg.total} W=${agg.wins} L=${agg.losses} G=${agg.gWon}-${agg.gLost} vs golden M=${golden.totalMatches} W=${golden.wins} L=${golden.losses} G=${golden.games.won}-${golden.games.lost} | ΔM=${diffM} ΔW=${diffW} ΔL=${diffL} ΔG=${diffG} retired=${retired}`,
      );
    }
  }

  console.log(
    `\n  exact=${exact} explainable=${explainable} failed=${failed}`,
  );
  if (failed > 0) process.exitCode = 1;
}

main();
