// lib/playerStats/config.ts
// data/ranking-config.json のローダ（型付き・既定値フォールバック・プロセス内キャッシュ）。
// 閾値・係数はコードに埋めず、ここ 1 箇所から読む（設計 §4.2）。
// tier 分類ロジック（major/national/local 判定）はコード側（下記 resolveTier）に置き、
// 重みだけを config に置く。

import fs from 'fs';
import path from 'path';

export type TierName = 'major' | 'national' | 'local';

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
  /**
   * 大会単位の tier 上書き（resolveTier より優先）。
   * レート由来の大会強度監査（scripts/ranking/backtest.mjs --rated-tier）で検出した
   * ミスプライシングを、静的 tier の説明可能性を保ったまま修正する運用ループ用
   * （docs/raw/2026-07-11-ranking-calibration-harness-plan.md §9.1）。
   */
  tierOverrides: Record<string, TierName>;
  /**
   * ランキング集計（シーズンポイント）から除外する大会。
   * 外国選手が参加しローマ字表記の名寄せ・実力評価の信頼性が担保できない
   * 真の国際大会（generationId='international'）を想定。
   */
  excludeTournaments: string[];
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
    tierOverrides: {},
    excludeTournaments: [],
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
  // deepMerge は base 側のキーだけを走査するため、既定が空オブジェクトの tierOverrides は
  // マージ結果が常に {} になる。JSON の値を明示的に採用する。
  const rawRanking = (raw as { ranking?: { tierOverrides?: Record<string, TierName> } } | null)?.ranking;
  if (rawRanking?.tierOverrides && typeof rawRanking.tierOverrides === 'object') {
    // "_note" 等のメタキーは除外し、有効な tier 値のみ採用する
    const overrides: Record<string, TierName> = {};
    for (const [key, value] of Object.entries(rawRanking.tierOverrides)) {
      if (key.startsWith('_')) continue;
      if (value === 'major' || value === 'national' || value === 'local') overrides[key] = value;
    }
    cached = { ...cached, ranking: { ...cached.ranking, tierOverrides: overrides } };
  }
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
