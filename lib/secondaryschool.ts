// lib/secondaryschool.ts
//
// 中学カテゴリ（/secondaryschool）の公開ページが読むデータ層。
// 索引の生成は scripts/build-secondaryschool-index.mjs、
// 進路の生成は scripts/build-secondaryschool-pathways.mjs。
// 仕様は docs/wiki/secondaryschool.md、経緯は
// docs/raw/2026-08-12-idea-juniorhigh-category-pages.md。
//
// 高校カテゴリ（lib/highschool*.ts）とはロジックを共有しない。中学は
//   - チームの4割が地域クラブなので「学校」を前提にできない
//   - 性別をURLに入れない（男女別にすると32%が5件未満になる）
//   - ブロック大会は掲載判定にのみ使い県別スコアには使わない
// と前提が違うため、共有すると分岐が増えて壊れやすくなる（高校側が地区大会を
// カテゴリ機能へ統合しなかったのと同じ理由）。
//
// fs を使うため getStaticProps / getStaticPaths からのみ import すること。

import fs from 'fs';
import path from 'path';

export type TeamKind = 'school' | 'club' | 'unknown';

/** 1件の大会成績 */
export interface SecondarySchoolResult {
  tournamentId: string;
  tournamentLabel: string;
  /** 「全中」「県対抗」「ブロック」などの短いラベル */
  short: string;
  year: number;
  categoryId: string;
  /** 'doubles' | 'team' | 'singles' */
  category: string;
  gender: string;
  label: string | null;
  /** 成績の序列（大きいほど上位）。代表成績の決定に使う */
  score: number;
  players: string[];
}

export interface SecondarySchoolTeam {
  id: string;
  name: string;
  kind: TeamKind;
  prefecture: string;
  prefectureId: string;
  /** 出場延べ。掲載閾値の判定に使った値 */
  count: number;
  years: number[];
  genders: string[];
  tournamentIds: string[];
  best: SecondarySchoolResult | null;
  results: SecondarySchoolResult[];
  members: { name: string; years: number[] }[];
}

/**
 * 都道府県の集計。**ポイント・順位は持たない**（2026-08-12 廃止）。
 *
 * 当初は都道府県対抗の成績をポイント化して県を順位づけていたが、
 * (1) 配点が運用判断の初期値（Assumption）だった
 * (2) 実装が全中・クラブ選手権プレも合算しており「47県が同じ枠数だから公平」という
 *     説明と食い違っていた（全中は県により出場枠が20倍違う）
 * の2点から取りやめた。このカテゴリは順位づけをせず「収録チームの名鑑＋進路」に絞る。
 * docs/wiki/secondaryschool.md「都道府県ページ」
 */
export interface SecondarySchoolPrefecture {
  id: string;
  name: string;
  region: string;
  teamCount: number;
  schoolCount: number;
  clubCount: number;
}

export interface PathwayRecord {
  player: string;
  jhsLastYear: number;
  highschool: string;
  highschoolPrefecture: string | null;
  highschoolFirstYear: number;
  basis: 'pair' | 'pref' | 'pair+pref';
}

interface IndexPayload {
  threshold: number;
  tournamentIds: string[];
  scoreableTournamentIds: string[];
  prefectures: SecondarySchoolPrefecture[];
  teams: SecondarySchoolTeam[];
}

const DATA_DIR = ['data', 'secondaryschool'];

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), ...DATA_DIR, file), 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

let indexCache: IndexPayload | null = null;
let pathwayCache: Record<string, PathwayRecord[]> | null = null;

function getIndex(): IndexPayload {
  if (!indexCache) {
    indexCache = readJson<IndexPayload>('index.json', {
      threshold: 5,
      tournamentIds: [],
      scoreableTournamentIds: [],
      prefectures: [],
      teams: [],
    });
  }
  return indexCache;
}

function getPathwayMap(): Record<string, PathwayRecord[]> {
  if (!pathwayCache) {
    pathwayCache = readJson<{ pathways: Record<string, PathwayRecord[]> }>('pathways.json', { pathways: {} }).pathways;
  }
  return pathwayCache;
}

/** 掲載閾値（出場延べ）。ページ本文の注記にも使う */
export function getThreshold(): number {
  return getIndex().threshold;
}

/** 47都道府県。掲載チームが0件の県も含めて返す（一覧で「収録準備中」と出すため） */
export function getPrefectures(): SecondarySchoolPrefecture[] {
  return getIndex().prefectures;
}

export function getPrefecture(prefectureId: string): SecondarySchoolPrefecture | null {
  return getIndex().prefectures.find((p) => p.id === prefectureId) ?? null;
}

/** 県内の掲載チーム。出場延べの多い順 */
export function getTeamsByPrefecture(prefectureId: string): SecondarySchoolTeam[] {
  return getIndex().teams.filter((t) => t.prefectureId === prefectureId);
}

export function getTeam(prefectureId: string, teamId: string): SecondarySchoolTeam | null {
  return getIndex().teams.find((t) => t.prefectureId === prefectureId && t.id === teamId) ?? null;
}

export function getAllTeams(): SecondarySchoolTeam[] {
  return getIndex().teams;
}

/** チームの進路（中学→高校）。採用条件は build-secondaryschool-pathways.mjs 参照 */
export function getPathways(team: Pick<SecondarySchoolTeam, 'name' | 'prefecture'>): PathwayRecord[] {
  return getPathwayMap()[`${team.name}\t${team.prefecture}`] ?? [];
}

/** 進路が1件以上あるチーム数（入口ページの説明文で使う） */
export function countTeamsWithPathways(): number {
  return Object.keys(getPathwayMap()).length;
}

export function countPathways(): number {
  return Object.values(getPathwayMap()).reduce((n, l) => n + l.length, 0);
}

/** チーム種別の表示ラベル。「学校」と言い切らない（4割がクラブのため） */
export function teamKindLabel(kind: TeamKind): string {
  if (kind === 'school') return '中学校';
  if (kind === 'club') return '地域クラブ';
  return 'チーム';
}

/**
 * 選手名 → 選手結果ページの数値ID。結果ページが実在する選手だけリンクする（デッドリンク防止）。
 *
 * 条件は `players/[id]/results.tsx` の getStaticPaths と同じ `count >= 5`。
 * 同姓同名は最初のIDを使う（学校ページ・players/index.tsx と同じ規約）。
 * 高校側の `getPlayerResolver()` と同じ規約だが、カテゴリ間でロジックを共有しない方針
 * （このファイル冒頭の注記）に従い実装を分けている。
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
  // 大会データの氏名は「姓 名」（空白区切り）で持っているため空白を落として突き合わせる
  return playerIdCache.get(fullName.replace(/[\s　]/g, '')) ?? null;
}

/** 代表成績を1行の文字列にする（例: 「全中 2025 男子ダブルス ベスト8」） */
export function describeResult(r: SecondarySchoolResult): string {
  const cat = r.category === 'team' ? '団体' : r.category === 'singles' ? 'シングルス' : 'ダブルス';
  const gender = r.gender === 'boys' ? '男子' : r.gender === 'girls' ? '女子' : '';
  return [r.short, `${r.year}`, `${gender}${cat}`, r.label].filter(Boolean).join(' ');
}
