// lib/playerStats/config.ts
// data/ranking-config.json のローダ（型付き・既定値フォールバック・プロセス内キャッシュ）。
// 閾値・係数はコードに埋めず、ここ 1 箇所から読む（設計 §4.2）。
// tier 分類ロジック（major/national/local 判定）はコード側（下記 resolveTier）に置き、
// 重みだけを config に置く。

import fs from 'fs';
import path from 'path';

export interface RankingConfig {
  topNTournamentsPerSeason: number;
  tier: { major: number; national: number; local: number };
  placementCoefficient: {
    winner: number;
    runnerup: number;
    best4: number;
    best8: number;
    entry: number;
  };
  disciplines: string[];
  rating: {
    enabled: boolean;
    initial: number;
    kByTier: { major: number; national: number; local: number };
    provisionalMatches: number;
  };
}

export interface StatsConfig {
  minMatchesForSeasonWinRate: number;
  minMeetingsForH2H: number;
  headToHeadDefaultAxis: string;
  reachRate: {
    denominatorStage: string;
    denominatorCategories: string[];
  };
}

export interface PlayerStatsConfig {
  version: number;
  ranking: RankingConfig;
  stats: StatsConfig;
}

export const DEFAULT_CONFIG: PlayerStatsConfig = {
  version: 1,
  ranking: {
    topNTournamentsPerSeason: 3,
    tier: { major: 100, national: 60, local: 20 },
    placementCoefficient: {
      winner: 1.0,
      runnerup: 0.7,
      best4: 0.5,
      best8: 0.3,
      entry: 0.1,
    },
    disciplines: ['singles', 'doubles'],
    rating: {
      enabled: false,
      initial: 1500,
      kByTier: { major: 40, national: 32, local: 24 },
      provisionalMatches: 10,
    },
  },
  stats: {
    minMatchesForSeasonWinRate: 10,
    minMeetingsForH2H: 3,
    headToHeadDefaultAxis: 'individual',
    reachRate: {
      denominatorStage: 'knockout',
      denominatorCategories: ['singles', 'doubles', 'mixed'],
    },
  },
};

function deepMerge<T>(base: T, override: unknown): T {
  if (typeof base !== 'object' || base === null || Array.isArray(base) || typeof override !== 'object' || override === null || Array.isArray(override)) {
    return (override === undefined ? base : (override as T)) ?? base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  const ov = override as Record<string, unknown>;
  for (const key of Object.keys(out)) {
    if (key in ov) {
      out[key] = deepMerge(out[key], ov[key]);
    }
  }
  return out as T;
}

let cached: PlayerStatsConfig | null = null;

/** ranking-config.json を読む。既定値へフォールバック。プロセス内キャッシュ。 */
export function loadRankingConfig(root?: string): PlayerStatsConfig {
  if (cached) return cached;
  const cwd = root || process.cwd();
  const configPath = path.join(cwd, 'data', 'ranking-config.json');
  let raw: unknown = null;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    raw = null;
  }
  cached = raw ? deepMerge(DEFAULT_CONFIG, raw) : DEFAULT_CONFIG;
  return cached;
}

/** テスト用: キャッシュを破棄する。 */
export function __resetConfigCache(): void {
  cached = null;
}

/**
 * 大会格 tier を分類する（分類ロジックはコード側・重みは config）。
 * major=isMajorTitle / national=isNational かつ非 major / local=非 isNational。
 */
export function resolveTier(meta: { isMajorTitle: boolean; isNational: boolean }): 'major' | 'national' | 'local' {
  if (meta.isMajorTitle) return 'major';
  if (meta.isNational) return 'national';
  return 'local';
}
