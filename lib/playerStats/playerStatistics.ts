// lib/playerStats/playerStatistics.ts
// L3 Facade（唯一の公開ファサード）。オーケストレーションのみ。
// Facts をキャッシュ/計算で用意 → 必要 Aggregator を実行 → PlayerStatistics を組み立てる。
// fs を使うため getStaticProps / ビルドスクリプト専用（クライアント import 不可）。
//
// 設計: docs/raw/2026-07-01-player-statistics-engine.md §3, §4, §7。

import fs from 'fs';
import path from 'path';

import type {
  PlayerMeta,
  PlayerStatistics,
  PlayerStatisticsOptions,
  StatSection,
} from '../../src/types/playerStatistics';
import { aggregateByPartner } from './aggregators/byPartner';
import { aggregateByTeam } from './aggregators/byTeam';
import { aggregateByTournament } from './aggregators/byTournament';
import { aggregateByYear } from './aggregators/byYear';
import { aggregateCareer } from './aggregators/career';
import { aggregateCareerTimeline } from './aggregators/careerTimeline';
import { aggregateHeadToHead } from './aggregators/headToHead';
import { aggregateHighlights } from './aggregators/highlights';
import { aggregateMilestones } from './aggregators/milestones';
import { readRankingTrend } from './aggregators/ranking';
import { aggregateReachRates } from './aggregators/reachRates';
import { aggregateRecords } from './aggregators/records';
import { aggregateTitles } from './aggregators/titles';
import { loadRankingConfig, PlayerStatsConfig } from './config';
import { ENGINE_VERSION, buildFacts } from './facts';
import { Identity, loadIdentity } from './identity';
import {
  buildReverseIndex,
  readReverseIndex,
} from './reverseIndex';
import { SourceAdapter } from './sourceAdapter';
import type { PlayerFacts, ReverseIndex } from './types';

const ALL_SECTIONS: StatSection[] = [
  'career',
  'byYear',
  'byTournament',
  'byPartner',
  'byTeam',
  'headToHead',
  'records',
  'highlights',
  'reachRates',
  'titles',
  'milestones',
  'rankingTrend',
  'careerTimeline',
];

// ---- プロセス内キャッシュ（同一ビルド/SSR プロセスで使い回す） ----
interface Engine {
  root: string;
  adapter: SourceAdapter;
  identity: Identity;
  config: PlayerStatsConfig;
  reverseIndex: ReverseIndex;
}
const engineCache = new Map<string, Engine>();
const factsCache = new Map<string, PlayerFacts>();
const statsCache = new Map<string, PlayerStatistics>();

function getEngine(root: string): Engine {
  const hit = engineCache.get(root);
  if (hit) return hit;
  const adapter = new SourceAdapter(root);
  const identity = loadIdentity(root);
  const config = loadRankingConfig(root);
  const reverseIndex =
    readReverseIndex(root) ?? buildReverseIndex(adapter, identity);
  const engine: Engine = { root, adapter, identity, config, reverseIndex };
  engineCache.set(root, engine);
  return engine;
}

function getFacts(
  engine: Engine,
  playerId: number,
  freshness: 'cache' | 'recompute',
): PlayerFacts {
  const key = `${engine.root}:${playerId}`;
  if (freshness === 'cache') {
    const memo = factsCache.get(key);
    if (memo) return memo;
    // 成果物キャッシュ（_facts）
    const filePath = path.join(
      engine.root,
      'data',
      'players',
      '_facts',
      `${playerId}.json`,
    );
    try {
      const cached = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as PlayerFacts;
      if (cached.engineVersion === ENGINE_VERSION) {
        factsCache.set(key, cached);
        return cached;
      }
    } catch {
      // fall through to compute
    }
  }
  const facts = buildFacts(
    playerId,
    engine.adapter,
    engine.identity,
    engine.reverseIndex,
  );
  factsCache.set(key, facts);
  return facts;
}

/** discipline フィルタ（指定時、その種目の match/entry のみに絞る）。 */
function filterFactsByDiscipline(
  facts: PlayerFacts,
  discipline: PlayerStatisticsOptions['discipline'],
): PlayerFacts {
  if (!discipline) return facts;
  return {
    ...facts,
    matches: facts.matches.filter((m) => m.category === discipline),
    entries: facts.entries.filter((e) => e.category === discipline),
  };
}

function emptyWinLoss() {
  return { total: 0, wins: 0, losses: 0, winRate: 0 };
}
function emptyGames() {
  return { total: 0, won: 0, lost: 0, gameRate: 0 };
}

function defaultStats(
  facts: PlayerFacts,
  slug?: string,
): PlayerStatistics {
  const dates: string[] = [];
  for (const m of facts.matches) if (m.date) dates.push(m.date);
  for (const e of facts.entries) if (e.date) dates.push(e.date);
  dates.sort();
  return {
    playerId: facts.playerId,
    identity: {
      displayName: facts.displayName,
      currentTeam: facts.currentTeam,
      slug,
      homonymRisk: facts.homonymRisk,
    },
    scope: 'site-covered',
    scopeNote: '当サイト掲載大会分の集計に基づく（実戦のみ。不戦勝・途中棄権は除外）',
    coverage: {
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
      totalMatches: facts.matches.length,
      totalEntries: facts.entries.length,
    },
    career: {
      overall: { matches: emptyWinLoss(), games: emptyGames() },
      byDiscipline: {},
      span: { from: null, to: null },
    },
    byYear: [],
    byTournament: [],
    byPartner: [],
    byTeam: [],
    headToHead: [],
    records: {
      longestWinStreak: { length: 0, from: null, to: null, fromTournament: null, toTournament: null },
      longestLoseStreak: { length: 0, from: null, to: null, fromTournament: null, toTournament: null },
      bestSeason: null,
    },
    highlights: {
      mostFacedOpponent: null,
      mostFrequentPartner: null,
      toughOpponents: [],
      favorableOpponents: [],
    },
    reachRates: { denominator: 0, finalReachRate: 0, semifinalReachRate: 0 },
    titles: {
      total: 0,
      major: 0,
      byTournament: {},
      streaks: [],
      nth: {},
      firsts: { firstNational: null, firstNationalTitle: null },
    },
    milestones: [],
    rankingTrend: [],
    careerTimeline: [],
    meta: {
      generatedAt: new Date().toISOString(),
      engineVersion: facts.engineVersion,
      sourceHash: facts.sourceHash,
    },
  };
}

/** curated slug 解決（data/players/<slug>/information.json の姓名一致）。 */
function resolveSlug(engine: Engine, facts: PlayerFacts): string | undefined {
  const info = engine.identity.byId.get(facts.playerId);
  if (!info) return undefined;
  const root = path.join(engine.root, 'data', 'players');
  try {
    for (const slug of fs.readdirSync(root)) {
      const infoPath = path.join(root, slug, 'information.json');
      if (!fs.existsSync(infoPath)) continue;
      const j = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      if (j?.lastName === info.lastName && j?.firstName === info.firstName) {
        return slug;
      }
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * 選手 1 人の全統計を返す（唯一の公開 API）。
 * options.sections で計算を絞れる（既定は全部）。
 */
export async function getPlayerStatistics(
  playerId: number,
  options: PlayerStatisticsOptions = {},
  root?: string,
): Promise<PlayerStatistics> {
  const cwd = root || process.cwd();
  const engine = getEngine(cwd);
  const freshness = options.freshness ?? 'cache';
  const sections = new Set<StatSection>(options.sections ?? ALL_SECTIONS);
  const includeFull = options.includeFull ?? false;

  const cacheKey = JSON.stringify({
    id: playerId,
    root: cwd,
    s: [...sections].sort(),
    d: options.discipline ?? '',
    f: freshness,
    full: includeFull,
  });
  if (freshness === 'cache') {
    const memo = statsCache.get(cacheKey);
    if (memo) return memo;
  }

  const rawFacts = getFacts(engine, playerId, freshness);
  const facts = filterFactsByDiscipline(rawFacts, options.discipline);
  const slug = resolveSlug(engine, rawFacts);
  const stats = defaultStats(facts, slug);

  // 依存関係を自動補完
  const need = (s: StatSection) => sections.has(s);
  const needH2H = need('headToHead') || need('highlights');
  const needPartner = need('byPartner') || need('highlights');
  const needByYear = need('byYear') || need('careerTimeline');
  const needByTeam = need('byTeam') || need('careerTimeline');
  const needTitles = need('titles') || need('careerTimeline');
  const needMilestones = need('milestones') || need('careerTimeline');

  if (need('career')) stats.career = aggregateCareer(facts);
  if (needByYear) stats.byYear = aggregateByYear(facts);
  if (need('byTournament')) stats.byTournament = aggregateByTournament(facts);
  if (needByTeam) stats.byTeam = aggregateByTeam(facts, cwd);
  if (needPartner) stats.byPartner = aggregateByPartner(facts);
  if (needH2H) stats.headToHead = aggregateHeadToHead(facts);
  if (need('records')) stats.records = aggregateRecords(facts, engine.config);
  if (need('highlights')) {
    stats.highlights = aggregateHighlights(
      stats.headToHead,
      stats.byPartner,
      engine.config,
    );
  }
  if (need('reachRates')) stats.reachRates = aggregateReachRates(facts);
  if (needTitles) stats.titles = aggregateTitles(facts);
  if (needMilestones) stats.milestones = aggregateMilestones(facts);
  if (need('rankingTrend')) {
    stats.rankingTrend = readRankingTrend(playerId, cwd);
  }
  if (need('careerTimeline')) {
    stats.careerTimeline = aggregateCareerTimeline(facts, {
      byYear: stats.byYear,
      byTeam: stats.byTeam,
      milestones: stats.milestones,
      titles: stats.titles,
    });
  }

  // includeFull=false のとき H2H / partner を上位のみに間引く（lite 相当は full）
  if (!includeFull) {
    if (need('headToHead')) stats.headToHead = stats.headToHead.slice(0, 20);
    if (need('byPartner')) stats.byPartner = stats.byPartner.slice(0, 20);
  }

  if (freshness === 'cache') statsCache.set(cacheKey, stats);
  return stats;
}

/** JSON 一括生成の反復用: 逆引き索引に載る全選手 id。 */
export async function getAllPlayerIds(root?: string): Promise<number[]> {
  const engine = getEngine(root || process.cwd());
  return Object.keys(engine.reverseIndex)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

/** SEO: title/description（所属・直近・通算を埋め込む。日付は coverage 由来）。 */
export function toPlayerMeta(stats: PlayerStatistics): PlayerMeta {
  const name = stats.identity.displayName;
  const team = stats.identity.currentTeam;
  const c = stats.career.overall.matches;
  const titleTotal = stats.titles.total;
  const teamPart = team ? `（${team}）` : '';
  const title = `${name}${teamPart} 戦績・プロフィール｜ソフトテニス`;

  const parts: string[] = [`${name}${teamPart}の当サイト掲載大会分の戦績`];
  if (c.total > 0) {
    parts.push(`通算${c.total}戦${c.wins}勝${c.losses}敗（勝率${c.winRate}）`);
  }
  if (titleTotal > 0) parts.push(`優勝${titleTotal}回`);
  const description = `${parts.join('、')}。年度別・大会別・ペア別・対戦相手の記録を掲載。`;
  return { title, description };
}

/** SEO: ProfilePage + Person（dateCreated=firstDate, dateModified=lastDate）。 */
export function toPlayerJsonLd(stats: PlayerStatistics): object {
  const name = stats.identity.displayName;
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    dateCreated: stats.coverage.firstDate ?? undefined,
    dateModified: stats.coverage.lastDate ?? undefined,
    mainEntity: {
      '@type': 'Person',
      name,
      ...(stats.identity.currentTeam
        ? { affiliation: { '@type': 'Organization', name: stats.identity.currentTeam } }
        : {}),
      ...(stats.identity.slug
        ? { identifier: stats.identity.slug }
        : {}),
    },
  };
}

/** テスト用: プロセス内キャッシュを破棄。 */
export function __resetEngineCache(): void {
  engineCache.clear();
  factsCache.clear();
  statsCache.clear();
}
