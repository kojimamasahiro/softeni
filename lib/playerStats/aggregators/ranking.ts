// lib/playerStats/aggregators/ranking.ts
// ランキング推移 rankingTrend。エンジン内では再計算しない（設計 §5-4）。
// 事前計算済み data/rankings/{year}-{discipline}-{gender}.json から当該選手の行を引くだけ。
// ランキング未生成時は空配列。順位表は男女別（2026-07-02）。

import fs from 'fs';
import path from 'path';

import type { RankingPoint } from '../../../src/types/playerStatistics';

/** rankings/{year}-{discipline}-{gender}.json の形（generate-rankings.ts が出力）。 */
export interface RankingFile {
  year: number;
  discipline: string;
  /** boys / girls（男女別順位表）。 */
  gender: string;
  outOf: number;
  entries: Array<{
    rank: number;
    playerId: number | null;
    playerKey: string;
    playerName: string;
    /** その年度の所属（順位表生成時に確定）。 */
    team: string | null;
    points: number;
    rating?: number;
  }>;
}

const RANKINGS_DIR = ['data', 'rankings'];

export function readRankingTrend(playerId: number, root?: string): RankingPoint[] {
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
    // 旧形式（男女混合・gender 無し）は読まない（engineVersion 更新で再生成される）。
    if (!data || !data.gender) continue;
    const row = data.entries.find((e) => e.playerId === playerId);
    if (!row) continue;
    points.push({
      year: data.year,
      discipline: data.discipline,
      gender: data.gender,
      rank: row.rank,
      outOf: data.outOf,
      points: row.points,
      ...(row.rating !== undefined ? { rating: row.rating } : {}),
    });
  }
  points.sort((a, b) => a.year - b.year || a.discipline.localeCompare(b.discipline) || a.gender.localeCompare(b.gender));
  return points;
}
