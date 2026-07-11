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

/** 1 出場のスコア = tier重み × 順位係数。tierOverrides があれば resolveTier より優先。 */
export function entryScore(entry: PlayerEntryFact, config: PlayerStatsConfig): number {
  const tier =
    config.ranking.tierOverrides?.[entry.tournamentId] ??
    resolveTier({
      isMajorTitle: entry.isMajorTitle,
      isNational: entry.isNational,
    });
  const weight = config.ranking.tier[tier];
  return weight * placementCoefficient(entry.placement, config);
}

/**
 * placement を「好成績」表示ラベルに写す。優勝〜ベスト8のみラベル化し、
 * 単なる出場（roundLoss/groupOnly/unknown）は null（＝表示しない）。
 * タイブレークの数値計算とは独立（数値は entryScore、こちらは表示用）。
 */
function notablePlacementLabel(placement: PlayerEntryFact['placement']): string | null {
  switch (placement.kind) {
    case 'winner':
      return '優勝';
    case 'runnerup':
      return '準優勝';
    case 'best':
      return placement.bestLevel === 4 ? 'ベスト4' : 'ベスト8';
    default:
      return null;
  }
}

export interface SinglesBest {
  /** 並び替えキー。その年度のシングルス最高成績 1 大会の entryScore（合算しない＝best-1）。 */
  value: number;
  /** 表示用ラベル（例「全日本シングルス選手権大会 優勝」）。好成績時のみ、無ければ null。 */
  title: string | null;
}

/**
 * 選手 1 人の entries から (year, gender) ごとの「シングルス best-1」を求める。
 * ダブルスの順位表で **同点の並び替えキー**に使う（採点そのものはダブルスのみ。
 * 2026-07-11、docs/raw/2026-07-11-idea-singles-ranking-retire.md）。
 * best-1（最高成績 1 大会のみ）にすることで、出場機会の多い層が積み上げで有利になる
 * ＝一度撤退させた不平等が並び順に再流入するのを防ぐ。除外大会は算入しない。
 */
export function singlesBestBySeason(entries: PlayerEntryFact[], config: PlayerStatsConfig): Map<string, SinglesBest> {
  const excluded = new Set(config.ranking.excludeTournaments ?? []);
  const out = new Map<string, SinglesBest>();
  for (const e of entries) {
    if (e.category !== 'singles') continue;
    if (excluded.has(e.tournamentId)) continue;
    const value = entryScore(e, config);
    const key = `${e.year}\t${e.gender}`;
    const cur = out.get(key);
    const label = notablePlacementLabel(e.placement);
    const name = e.tournamentName.trim();
    if (!cur || value > cur.value) {
      out.set(key, { value, title: label ? `${name} ${label}` : null });
    } else if (value === cur.value && cur.title === null && label) {
      // 同値なら好成績ラベルのある方をタイトルに採る（数値順位は不変）。
      out.set(key, { value: cur.value, title: `${name} ${label}` });
    }
  }
  return out;
}

export interface SeasonPoints {
  year: number;
  discipline: string;
  /** 男女別（boys/girls）。個人戦 singles/doubles は必ずどちらか。 */
  gender: string;
  points: number;
  /** 合算に使った出場数（上位 N 以内）。 */
  counted: number;
}

/**
 * 選手 1 人の entries から (year, discipline, gender) ごとのシーズンポイントを算出する。
 * discipline は config.ranking.disciplines のみ対象（2026-07-11〜 doubles 限定。
 * シングルスはランキング撤退。docs/raw/2026-07-11-idea-singles-ranking-retire.md）。
 * 順位表は男女別（2026-07-02 決定。混合の順位表は競技慣行に合わないため）。
 */
export function computeSeasonPoints(entries: PlayerEntryFact[], config: PlayerStatsConfig): SeasonPoints[] {
  const disciplines = new Set(config.ranking.disciplines);
  const topN = config.ranking.topNTournamentsPerSeason;
  // 除外大会（外国選手参加の国際大会等）はシーズンポイントに算入しない
  // （docs/raw/2026-07-11-ranking-calibration-harness-plan.md §9.1）。
  const excluded = new Set(config.ranking.excludeTournaments ?? []);
  const groups = new Map<string, number[]>();

  for (const e of entries) {
    if (!disciplines.has(e.category)) continue;
    if (excluded.has(e.tournamentId)) continue;
    const key = `${e.year}\t${e.category}\t${e.gender}`;
    const arr = groups.get(key) ?? [];
    arr.push(entryScore(e, config));
    groups.set(key, arr);
  }

  const out: SeasonPoints[] = [];
  for (const [key, scores] of groups) {
    scores.sort((a, b) => b - a);
    const counted = Math.min(topN, scores.length);
    const points = scores.slice(0, topN).reduce((s, v) => s + v, 0);
    const [yearStr, discipline, gender] = key.split('\t');
    out.push({
      year: Number(yearStr),
      discipline,
      gender,
      points: Math.round(points * 1000) / 1000,
      counted,
    });
  }
  return out;
}
