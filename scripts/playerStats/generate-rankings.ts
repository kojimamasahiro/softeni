// scripts/playerStats/generate-rankings.ts
// 全選手 Facts → 年度×種目のシーズンポイント → data/rankings/{year}-{discipline}.json（順位表）。
// 実行: ts-node --project scripts/playerStats/tsconfig.json scripts/playerStats/generate-rankings.ts [--years=2024,2025]
//
// 増分: --years で変更年度のみ再生成できる（シーズンポイントは年度独立）。
// 設計 §6.3。Elo（config.ranking.rating.enabled=false）は今回未実行。

import fs from 'fs';
import path from 'path';

import { RankingFile } from '../../lib/playerStats/aggregators/ranking';
import { computeSeasonPoints } from '../../lib/playerStats/aggregators/rankingCompute';
import { loadRankingConfig } from '../../lib/playerStats/config';
import { playerKey } from '../../lib/playerStats/identity';
import type { PlayerFacts } from '../../lib/playerStats/types';

const FACTS_DIR = ['data', 'players', '_facts'];
const RANKINGS_DIR = ['data', 'rankings'];

function parseArgs(): { years: Set<number> | null } {
  let years: Set<number> | null = null;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--years=')) {
      years = new Set(
        arg
          .slice('--years='.length)
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isFinite(n)),
      );
    }
  }
  return { years };
}

interface Row {
  playerId: number;
  playerKey: string;
  playerName: string;
  points: number;
}

function main(): void {
  const root = process.cwd();
  const { years } = parseArgs();
  const config = loadRankingConfig(root);
  const factsDir = path.join(root, ...FACTS_DIR);
  if (!fs.existsSync(factsDir)) {
    // eslint-disable-next-line no-console
    console.error('[generate-rankings] _facts が無い。先に generate-facts を実行。');
    process.exit(1);
  }

  // (year, discipline) → 順位表行
  const boards = new Map<string, Row[]>();

  const files = fs.readdirSync(factsDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    let facts: PlayerFacts;
    try {
      facts = JSON.parse(fs.readFileSync(path.join(factsDir, file), 'utf-8'));
    } catch {
      continue;
    }
    const seasons = computeSeasonPoints(facts.entries, config);
    for (const s of seasons) {
      if (years && !years.has(s.year)) continue;
      if (s.points <= 0) continue;
      const key = `${s.year}\t${s.discipline}`;
      const arr = boards.get(key) ?? [];
      arr.push({
        playerId: facts.playerId,
        playerKey: playerKey(facts.displayName, facts.currentTeam),
        playerName: facts.displayName,
        points: s.points,
      });
      boards.set(key, arr);
    }
  }

  const outDir = path.join(root, ...RANKINGS_DIR);
  fs.mkdirSync(outDir, { recursive: true });

  let written = 0;
  for (const [key, rows] of boards) {
    rows.sort((a, b) => b.points - a.points || a.playerId - b.playerId);
    const [yearStr, discipline] = key.split('\t');
    const out: RankingFile = {
      year: Number(yearStr),
      discipline,
      outOf: rows.length,
      entries: rows.map((r, i) => ({
        rank: i + 1,
        playerId: r.playerId,
        playerKey: r.playerKey,
        playerName: r.playerName,
        points: r.points,
      })),
    };
    fs.writeFileSync(
      path.join(outDir, `${yearStr}-${discipline}.json`),
      JSON.stringify(out),
      'utf-8',
    );
    written += 1;
  }
  // eslint-disable-next-line no-console
  console.log(
    `[generate-rankings] wrote ${written} leaderboards${years ? ` (years: ${[...years].join(',')})` : ''}`,
  );
}

main();
