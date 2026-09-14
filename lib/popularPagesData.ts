// lib/popularPagesData.ts
//
// data/popular-pages.json（GA4 から取り込んだ上位ページの並び）を読み、トップページのカードに出す名前を解決する。
// 取り込みは scripts/import-popular-pages.ts、並びの求め方は lib/popularPages.ts。
//
// fs を使うため getStaticProps とスクリプトからのみ import すること。
// スクリプト（ts-node）からも読むので import は相対パスで書く。

import fs from 'fs';
import path from 'path';

import { getGenderLabel, isVisibleGender } from './highschool';
import { classifyPopularPath } from './popularPages';
import { getTeam as getPrimarySchoolTeam } from './primaryschool';
import { getTeam as getSecondarySchoolTeam } from './secondaryschool';

export const POPULAR_PAGES_PATH = 'data/popular-pages.json';

export interface PopularPagesFile {
  source: string;
  /** YYYY-MM-DD。集計期間（GA4 の CSV の開始日・終了日） */
  startDate: string | null;
  endDate: string | null;
  /** リンク先を多い順に並べたもの。表示回数は公開リポジトリに残さないため持たない */
  players: string[];
  teams: string[];
}

export interface PopularCard {
  href: string;
  title: string;
  subtitle: string;
}

export interface PopularPages {
  players: PopularCard[];
  teams: PopularCard[];
  /** 表示中の並びが GA4 由来のときの集計期間。固定の選手だけで埋めたときは null */
  period: { startDate: string; endDate: string } | null;
}

/**
 * GA4 のデータが無い・足りないときに埋める選手。2026-09-14 まではこの3人を手で選んで固定表示していた。
 */
const FALLBACK_PLAYER_HREFS = ['/players/19/results/', '/players/20/results/', '/players/12/results/'];

// パスは呼び出し側で path.join(process.cwd(), 'data', ...) とリテラルで書く。配列を展開して渡すと
// nft（output file tracing）が解決を諦めてリポジトリ全体を走査する（docs/wiki/deployment.md）
function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

// ---- 選手 ----

let playerCache: Map<string, { name: string; team: string }> | null = null;

/** 結果ページがある選手（data/players/index.json の count>=5。results.tsx の getStaticPaths と同じ条件） */
function getPlayers(): Map<string, { name: string; team: string }> {
  if (playerCache) return playerCache;
  const index = readJson<{ id: number; lastName: string; firstName: string; count?: number }[]>(path.join(process.cwd(), 'data', 'players', 'index.json'), []);
  // 所属は選手一覧の検索インデックスと同じもの（最新の所属）を使う
  const search = readJson<{ sameNameGroups: { playerId: string | null; team?: string }[] }>(path.join(process.cwd(), 'public', 'data', 'players-search.json'), {
    sameNameGroups: [],
  });
  const teamById = new Map(search.sameNameGroups.filter((g) => g.playerId != null).map((g) => [String(g.playerId), g.team ?? '']));
  playerCache = new Map(
    index.filter((p) => (p.count ?? 0) >= 5).map((p) => [String(p.id), { name: `${p.lastName} ${p.firstName}`, team: teamById.get(String(p.id)) ?? '' }]),
  );
  return playerCache;
}

// ---- チーム（/teams/[teamId]） ----

let teamPageCache: Map<string, { name: string; stLeague: boolean }> | null = null;

/** /teams/[teamId] があるチーム。getStaticPaths と同じく mapping のキーと STリーグ出場チーム */
function getTeamPages(): Map<string, { name: string; stLeague: boolean }> {
  if (teamPageCache) return teamPageCache;
  const map = new Map<string, { name: string; stLeague: boolean }>();
  const stRoot = path.join(process.cwd(), 'data', 'st-league');
  const years = fs.existsSync(stRoot) ? fs.readdirSync(stRoot).filter((y) => /^\d{4}$/.test(y)) : [];
  // 新しい年度の表記を優先する（src/utils/st-league.ts の aggregateStLeagueTeam は後勝ち）
  for (const year of years.sort()) {
    const participants = readJson<Partial<Record<'boys' | 'girls', { teamId: string; name: string[] }[]>>>(path.join(stRoot, year, 'participants.json'), {});
    for (const team of [...(participants.boys ?? []), ...(participants.girls ?? [])]) {
      map.set(team.teamId, { name: team.name[0] ?? team.teamId, stLeague: true });
    }
  }
  const mappings = readJson<Record<string, string[]>>(path.join(process.cwd(), 'data', 'teams', 'team-name-mappings.json'), {});
  for (const [id, names] of Object.entries(mappings)) {
    const cur = map.get(id);
    // 名前は mapping の正式名を優先する（team-data-aggregator の generateTeamInfo と同じ）
    map.set(id, { name: names[0] ?? cur?.name ?? id, stLeague: cur?.stLeague ?? false });
  }
  teamPageCache = map;
  return map;
}

// ---- 高校の学校ページ ----

const prefectureNameCache = new Map<string, string>();
const hsSummaryCache = new Map<string, { teamId: string; team: string; gender: string }[]>();

function getPrefectureName(prefectureId: string): string | null {
  if (!prefectureNameCache.size) {
    for (const p of readJson<{ id: string; name: string }[]>(path.join(process.cwd(), 'data', 'prefectures.json'), [])) prefectureNameCache.set(p.id, p.name);
  }
  return prefectureNameCache.get(prefectureId) ?? null;
}

function getHighschoolSummary(prefectureId: string) {
  if (!hsSummaryCache.has(prefectureId)) {
    hsSummaryCache.set(prefectureId, readJson(path.join(process.cwd(), 'data', 'highschool', 'prefectures', prefectureId, 'summary.json'), []));
  }
  return hsSummaryCache.get(prefectureId)!;
}

/** リンク先のページが今もあれば、カードに出す名前を返す。無ければ null（掲載閾値を下回った等）。 */
export function resolvePopularCard(href: string): PopularCard | null {
  const target = classifyPopularPath(href);
  if (!target || target.href !== href) return null;
  const segs = href.split('/').filter(Boolean);

  switch (target.kind) {
    case 'player': {
      const player = getPlayers().get(segs[1]);
      return player ? { href, title: player.name, subtitle: player.team } : null;
    }
    case 'team': {
      const team = getTeamPages().get(segs[1]);
      if (!team) return null;
      const subtitle = team.stLeague ? 'STリーグ' : /大学|大學/.test(team.name) ? '大学' : 'チーム';
      return { href, title: team.name, subtitle };
    }
    case 'hs_school': {
      const [, gender, prefectureId, teamId] = segs as [string, 'boys' | 'girls', string, string];
      const prefecture = getPrefectureName(prefectureId);
      const entry = getHighschoolSummary(prefectureId).find((e) => e.teamId === teamId && isVisibleGender(e.gender, gender));
      return prefecture && entry ? { href, title: entry.team, subtitle: `高校${getGenderLabel(gender)}・${prefecture}` } : null;
    }
    case 'jhs_team': {
      const team = getSecondarySchoolTeam(segs[1], segs[2]);
      return team ? { href, title: team.name, subtitle: `中学生・${team.prefecture}` } : null;
    }
    case 'es_team': {
      const team = getPrimarySchoolTeam(segs[1], segs[2]);
      return team ? { href, title: team.name, subtitle: `小学生・${team.prefecture}` } : null;
    }
  }
}

function resolveUpTo(hrefs: string[], limit: number): PopularCard[] {
  const cards: PopularCard[] = [];
  const seen = new Set<string>();
  for (const href of hrefs) {
    if (cards.length >= limit) break;
    if (seen.has(href)) continue;
    seen.add(href);
    const card = resolvePopularCard(href);
    if (card) cards.push(card);
  }
  return cards;
}

/**
 * トップページに出す上位。JSON が無い・壊れているときは固定の選手だけを出し、チームは0件にする。
 * 選手が limit に満たないときは固定の選手で埋める（セクションの見た目を崩さないため）。
 */
export function loadPopularPages(limit: number): PopularPages {
  const file = readJson<PopularPagesFile | null>(path.join(process.cwd(), 'data', 'popular-pages.json'), null);
  const players = resolveUpTo(file?.players ?? [], limit);
  const fromGa4 = players.length > 0 || resolveUpTo(file?.teams ?? [], 1).length > 0;
  if (players.length < limit) {
    for (const card of resolveUpTo(FALLBACK_PLAYER_HREFS, limit)) {
      if (players.length >= limit) break;
      if (!players.some((p) => p.href === card.href)) players.push(card);
    }
  }
  return {
    players,
    teams: resolveUpTo(file?.teams ?? [], limit),
    period: fromGa4 && file?.startDate && file?.endDate ? { startDate: file.startDate, endDate: file.endDate } : null,
  };
}
