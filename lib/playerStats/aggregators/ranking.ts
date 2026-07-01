// lib/playerStats/aggregators/ranking.ts
// ランキング推移 rankingTrend。エンジン内では再計算しない（設計 §5-4）。
// 事前計算済み data/rankings/{year}-{discipline}.json から当該選手の行を引くだけ。
// ランキング未生成時は空配列。

import fs from 'fs';
import path from 'path';

import type { RankingPoint } from '../../../src/types/playerStatistics';

/** rankings/{year}-{discipline}.json の形（generate-rankings.ts が出力）。 */
export interface RankingFile {
  year: number;
  discipline: string;
  outOf: number;
  entries: Array<{
    rank: number;
    playerId: number | null;
    playerKey: string;
    playerName: string;
    points: number;
    rating?: number;
  }>;
}

const RANKINGS_DIR = ['data', 'rankings'];

export function readRankingTrend(
  playerId: number,
  root?: string,
): RankingPoint[] {
  const cwd = root || process.cwd();
  const dir = path.join(cwd, ...RANKINGS_DIR);
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const points: RankingPoint[] = [];
  for (const file of files) {
    let data: RankingFile | null = null;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    } catch {
      data = null;
    }
    if (!data) continue;
    const row = data.entries.find((e) => e.playerId === playerId);
    if (!row) continue;
    points.push({
      year: data.year,
      discipline: data.discipline,
      rank: row.rank,
      outOf: data.outOf,
      points: row.points,
      ...(row.rating !== undefined ? { rating: row.rating } : {}),
    });
  }
  points.sort((a, b) => a.year - b.year || a.discipline.localeCompare(b.discipline));
  return points;
}
