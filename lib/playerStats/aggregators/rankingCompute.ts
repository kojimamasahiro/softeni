// lib/playerStats/aggregators/rankingCompute.ts
// 年度ランキングのシーズンポイント算出（純関数）。全選手横断の集約は generate-rankings.ts。
// ポイント = 年度×種目で「tier重み × 順位係数」を大会ごとに求め、上位 N 大会を合算（掲載偏り補正）。
//
// 設計 §4.2 / §5-4 / §11。tier 分類はコード（resolveTier）、重み・係数は config。

import { PlayerStatsConfig, resolveTier } from '../config';
import type { PlayerEntryFact } from '../types';

/** placement から順位係数を引く。 */
export function placementCoefficient(placement: PlayerEntryFact['placement'], config: PlayerStatsConfig): number {
  const c = config.ranking.placementCoefficient;
  switch (placement.kind) {
    case 'winner':
      return c.winner;
    case 'runnerup':
      return c.runnerup;
    case 'best':
      return placement.bestLevel === 4 ? c.best4 : c.best8;
    case 'roundLoss':
    case 'groupOnly':
    case 'unknown':
    default:
      return c.entry;
  }
}

/** 1 出場のスコア = tier重み × 順位係数。 */
export function entryScore(entry: PlayerEntryFact, config: PlayerStatsConfig): number {
  const tier = resolveTier({
    isMajorTitle: entry.isMajorTitle,
    isNational: entry.isNational,
  });
  const weight = config.ranking.tier[tier];
  return weight * placementCoefficient(entry.placement, config);
}

export interface SeasonPoints {
  year: number;
  discipline: string;
  points: number;
  /** 合算に使った出場数（上位 N 以内）。 */
  counted: number;
}

/**
 * 選手 1 人の entries から (year, discipline) ごとのシーズンポイントを算出する。
 * discipline は config.ranking.disciplines のみ対象（既定 singles/doubles）。
 */
export function computeSeasonPoints(entries: PlayerEntryFact[], config: PlayerStatsConfig): SeasonPoints[] {
  const disciplines = new Set(config.ranking.disciplines);
  const topN = config.ranking.topNTournamentsPerSeason;
  const groups = new Map<string, number[]>();

  for (const e of entries) {
    if (!disciplines.has(e.category)) continue;
    const key = `${e.year}\t${e.category}`;
    const arr = groups.get(key) ?? [];
    arr.push(entryScore(e, config));
    groups.set(key, arr);
  }

  const out: SeasonPoints[] = [];
  for (const [key, scores] of groups) {
    scores.sort((a, b) => b - a);
    const counted = Math.min(topN, scores.length);
    const points = scores.slice(0, topN).reduce((s, v) => s + v, 0);
    const [yearStr, discipline] = key.split('\t');
    out.push({
      year: Number(yearStr),
      discipline,
      points: Math.round(points * 1000) / 1000,
      counted,
    });
  }
  return out;
}
