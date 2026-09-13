// lib/primaryschool.ts
//
// 小学生カテゴリ（/primaryschool）の公開ページが読むデータ層。
// 索引の生成は scripts/build-primaryschool-index.mjs、
// 進路の生成は scripts/build-primaryschool-pathways.mjs。
// 仕様は docs/wiki/primaryschool.md、経緯は
// docs/raw/2026-09-12-idea-primaryschool-category.md。
//
// 中学カテゴリ（lib/secondaryschool.ts）とはロジックを共有しない。前提が違うため:
//   - 対象大会が全日本小学生選手権の1つだけ（中学は4種類・掲載判定と集計で使い分けがある）
//   - 掲載団体はほぼ全部がクラブ・少年団なので「学校/クラブ」の種別を持たない
//   - 順位づけをする節を一切持たない
// 共有すると分岐が増えて壊れやすくなる（中学が高校と共有しなかったのと同じ理由）。
//
// fs を使うため getStaticProps / getStaticPaths からのみ import すること。

import fs from 'fs';
import path from 'path';

import type { AchievementGroup } from '../src/types/prefectureAchievements';

/** 1件の大会成績 */
export interface PrimarySchoolResult {
  tournamentId: string;
  tournamentLabel: string;
  /** 「全日本小学生」などの短いラベル */
  short: string;
  year: number;
  categoryId: string;
  /** 'doubles' | 'singles' | 'team' */
  category: string;
  gender: string;
  label: string | null;
  /** 成績の序列（大きいほど上位）。代表成績の決定に使う */
  score: number;
  players: string[];
}

export interface PrimarySchoolTeam {
  id: string;
  name: string;
  prefecture: string;
  prefectureId: string;
  /** 出場延べ。掲載閾値の判定に使った値 */
  count: number;
  years: number[];
  genders: string[];
  tournamentIds: string[];
  best: PrimarySchoolResult | null;
  results: PrimarySchoolResult[];
  members: { name: string; years: number[] }[];
}

/**
 * 都道府県の集計。**ポイント・順位は持たない。**
 *
 * 全日本小学生選手権は47都道府県が毎年すべて出場し、開催県以外は全県4ペア枠という
 * サイト内で最も規則正しいデータだが、それでもポイント化はしない。中学が県別ポイントを
 * 廃止した理由（配点が Assumption になる）がそのまま当てはまるため。
 * docs/wiki/primaryschool.md「都道府県ページ」
 */
export interface PrimarySchoolPrefecture {
  id: string;
  name: string;
  region: string;
  teamCount: number;
}

/**
 * 都道府県の全国大会での成績（ベスト8以上）1件。生成は scripts/build-primaryschool-index.mjs。
 * 県代表・県内チームとして出場した記録で、所属が混成のペアも含む（団体の成績と違う）。
 */
export interface PrimaryPrefectureAchievement {
  tournamentId: string;
  year: number;
  categoryId: string;
  category: string;
  gender: string;
  label: string | null;
  score: number;
  /** 団体戦は name が null（チーム名だけ） */
  players: { name: string | null; team: string | null }[];
}

export interface PrimaryAchievementTournament {
  id: string;
  label: string;
  years: number[];
}

/** 進路（小学 → 中学）。採用条件は build-primaryschool-pathways.mjs と ADR-014 参照 */
export interface PrimaryPathwayRecord {
  player: string;
  primaryLastYear: number;
  secondaryschool: string;
  secondaryschoolPrefecture: string | null;
  secondaryschoolFirstYear: number;
  /** 採用根拠。確度は pair > pref > name の順。UIには出さない（後追い用） */
  basis: 'pair' | 'pref' | 'pair+pref' | 'name';
}

interface IndexPayload {
  threshold: number;
  tournamentIds: string[];
  prefectures: PrimarySchoolPrefecture[];
  teams: PrimarySchoolTeam[];
  /** 都道府県の実績に使う大会と収録年度（古い index.json には無い） */
  achievementTournaments?: PrimaryAchievementTournament[];
  /** prefectureId -> ベスト8以上の実績（成績上位順 → 年度降順） */
  achievementsByPrefecture?: Record<string, PrimaryPrefectureAchievement[]>;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    // nft（output file tracing）が静的解決できるようパスセグメントはリテラルで書く。
    // docs/wiki/deployment.md「output file tracing（nft）のワイルドカード走査」
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'primaryschool', file), 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

let indexCache: IndexPayload | null = null;
let pathwayCache: Record<string, PrimaryPathwayRecord[]> | null = null;

function getIndex(): IndexPayload {
  if (!indexCache) indexCache = readJson<IndexPayload>('index.json', { threshold: 5, tournamentIds: [], prefectures: [], teams: [] });
  return indexCache;
}

function getPathwayMap(): Record<string, PrimaryPathwayRecord[]> {
  if (!pathwayCache) pathwayCache = readJson<{ pathways: Record<string, PrimaryPathwayRecord[]> }>('pathways.json', { pathways: {} }).pathways;
  return pathwayCache;
}

/** 掲載閾値（出場延べ）。ページ本文の注記にも使う */
export function getThreshold(): number {
  return getIndex().threshold;
}

/** 47都道府県。掲載団体が0件の県も含めて返す */
export function getPrefectures(): PrimarySchoolPrefecture[] {
  return getIndex().prefectures;
}

export function getPrefecture(prefectureId: string): PrimarySchoolPrefecture | null {
  return getIndex().prefectures.find((p) => p.id === prefectureId) ?? null;
}

/** 県内の掲載団体。出場延べの多い順（索引の並びをそのまま使う） */
export function getTeamsByPrefecture(prefectureId: string): PrimarySchoolTeam[] {
  return getIndex().teams.filter((t) => t.prefectureId === prefectureId);
}

export function getTeam(prefectureId: string, teamId: string): PrimarySchoolTeam | null {
  return getIndex().teams.find((t) => t.prefectureId === prefectureId && t.id === teamId) ?? null;
}

export function getAllTeams(): PrimarySchoolTeam[] {
  return getIndex().teams;
}

/** 団体の進路（小学→中学）。掲載閾値で絞っていないので全団体ぶんある */
export function getPathways(team: Pick<PrimarySchoolTeam, 'name' | 'prefecture'>): PrimaryPathwayRecord[] {
  return getPathwayMap()[`${team.name}\t${team.prefecture}`] ?? [];
}

/** 進路が1件以上ある団体数（入口ページの説明文で使う） */
export function countTeamsWithPathways(): number {
  return Object.keys(getPathwayMap()).length;
}

export function countPathways(): number {
  return Object.values(getPathwayMap()).reduce((n, l) => n + l.length, 0);
}

/**
 * 選手名 → 選手結果ページの数値ID。結果ページが実在する選手だけリンクする（デッドリンク防止）。
 * 条件は `players/[id]/results.tsx` の getStaticPaths と同じ `count >= 5`。
 * 中学の `resolvePlayerId()` と同じ規約だが、カテゴリ間でロジックを共有しない方針に従い実装を分けている。
 */
let playerIdCache: Map<string, number> | null = null;
export function resolvePlayerId(fullName: string): number | null {
  if (!playerIdCache) {
    playerIdCache = new Map();
    let list: { id: number; lastName: string; firstName: string; count: number }[] = [];
    try {
      list = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'players', 'index.json'), 'utf-8'));
    } catch {
      list = [];
    }
    for (const p of list) {
      if (!p?.lastName || !p?.firstName || (p.count ?? 0) < 5) continue;
      const key = `${p.lastName}${p.firstName}`;
      if (!playerIdCache.has(key)) playerIdCache.set(key, p.id);
    }
  }
  return playerIdCache.get(fullName.replace(/[\s　]/g, '')) ?? null;
}

/** 中学チームページ（/secondaryschool/...）のURL。存在しない中学は null（デッドリンク防止） */
let jhsHrefCache: Map<string, string> | null = null;
export function resolveSecondarySchoolHref(name: string, prefecture: string | null): string | null {
  if (!jhsHrefCache) {
    jhsHrefCache = new Map();
    let teams: { name: string; prefecture: string; prefectureId: string; id: string }[] = [];
    try {
      teams = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'secondaryschool', 'index.json'), 'utf-8')).teams ?? [];
    } catch {
      teams = [];
    }
    for (const t of teams) jhsHrefCache.set(`${t.name}\t${t.prefecture}`, `/secondaryschool/${t.prefectureId}/${t.id}/`);
  }
  return jhsHrefCache.get(`${name}\t${prefecture ?? ''}`) ?? null;
}

/** 代表成績を1行の文字列にする（例: 「全日本小学生 2025 男子ダブルス ベスト8」） */
export function describeResult(r: PrimarySchoolResult): string {
  const cat = r.category === 'team' ? '団体' : r.category === 'singles' ? 'シングルス' : 'ダブルス';
  const gender = r.gender === 'boys' ? '男子' : r.gender === 'girls' ? '女子' : '';
  return [r.short, `${r.year}`, `${gender}${cat}`, r.label].filter(Boolean).join(' ');
}

function disciplineLabel(category: string, gender: string): string {
  const cat = category === 'team' ? '団体' : category === 'singles' ? 'シングルス' : 'ダブルス';
  const g = gender === 'boys' ? '男子' : gender === 'girls' ? '女子' : '';
  return `${g}${cat}`;
}

/**
 * 都道府県ページの「全国大会での成績（ベスト8以上）」。大会ごとに分けて返す。
 * **県をまたいだ比較はしない**（このデータを横に並べて順位にしないこと）。
 * 選手・チームへのリンクは実在するページだけ張る（デッドリンク防止）。
 */
export function getPrefectureAchievementGroups(prefectureId: string): AchievementGroup[] {
  const index = getIndex();
  const entries = index.achievementsByPrefecture?.[prefectureId] ?? [];
  const teamHref = new Map(getTeamsByPrefecture(prefectureId).map((t) => [t.name, `/primaryschool/${prefectureId}/${t.id}/`] as const));
  return (index.achievementTournaments ?? []).map((t) => ({
    tournamentId: t.id,
    label: t.label,
    years: t.years,
    rows: entries
      .filter((e) => e.tournamentId === t.id)
      .map((e, i) => ({
        key: `${e.year}-${e.categoryId}-${e.label ?? ''}-${i}`,
        year: e.year,
        discipline: disciplineLabel(e.category, e.gender),
        label: e.label ?? '',
        players: e.players.map((p) => ({
          name: p.name,
          playerId: p.name ? resolvePlayerId(p.name) : null,
          team: p.team,
          teamHref: p.team ? (teamHref.get(p.team) ?? null) : null,
        })),
      })),
  }));
}
