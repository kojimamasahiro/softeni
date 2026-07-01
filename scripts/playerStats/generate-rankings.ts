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
    // #2: 年度別の順位表には「その年度の所属」を刻む（現所属で過去年度を汚染しない）。
    // (year, discipline) ごとに、その季の entries から最頻の selfTeam を採る。
    const teamBySeason = new Map<string, string | null>();
    const teamCounts = new Map<string, Map<string, number>>();
    for (const e of facts.entries) {
      if (!e.selfTeam) continue;
      const k = `${e.year}\t${e.category}`;
      const cm = teamCounts.get(k) ?? new Map<string, number>();
      cm.set(e.selfTeam, (cm.get(e.selfTeam) ?? 0) + 1);
      teamCounts.set(k, cm);
    }
    for (const [k, cm] of teamCounts) {
      let best: string | null = null;
      let bestN = 0;
      for (const [team, n] of cm) {
        if (n > bestN) {
          bestN = n;
          best = team;
        }
      }
      teamBySeason.set(k, best);
    }

    const seasons = computeSeasonPoints(facts.entries, config);
    for (const s of seasons) {
      if (years && !years.has(s.year)) continue;
      if (s.points <= 0) continue;
      const key = `${s.year}\t${s.discipline}`;
      const seasonTeam = teamBySeason.get(key) ?? facts.currentTeam;
      const arr = boards.get(key) ?? [];
      arr.push({
        playerId: facts.playerId,
        playerKey: playerKey(facts.displayName, seasonTeam),
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
    // 表示順は points 降順（同点は playerId 昇順で決定的に）。
    rows.sort((a, b) => b.points - a.points || a.playerId - b.playerId);
    const [yearStr, discipline] = key.split('\t');
    // #3: 標準競技順位（1224 方式）。同ポイントは同順位、次は件数分飛ばす。
    let prevPoints: number | null = null;
    let prevRank = 0;
    const out: RankingFile = {
      year: Number(yearStr),
      discipline,
      outOf: rows.length,
      entries: rows.map((r, i) => {
        const rank = prevPoints !== null && r.points === prevPoints ? prevRank : i + 1;
        prevPoints = r.points;
        prevRank = rank;
        return {
          rank,
          playerId: r.playerId,
          playerKey: r.playerKey,
          playerName: r.playerName,
          points: r.points,
        };
      }),
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
