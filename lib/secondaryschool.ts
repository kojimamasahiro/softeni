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
}

export interface PathwayRecord {
  player: string;
  jhsLastYear: number;
  highschool: string;
  highschoolPrefecture: string | null;
  highschoolFirstYear: number;
  /** 高校側の性別。高校の学校ページが男女別なので、リンク先の解決に使う。mixed は null */
  highschoolGender: 'boys' | 'girls' | null;
  /** 採用根拠。確度は pair > pref > name の順。UIには出さない（後追い用） */
  basis: 'pair' | 'pref' | 'pair+pref' | 'name';
}

interface IndexPayload {
  threshold: number;
  tournamentIds: string[];
  scoreableTournamentIds: string[];
  prefectures: SecondarySchoolPrefecture[];
  teams: SecondarySchoolTeam[];
}

function readJson<T>(file: string, fallback: T): T {
  try {
    // nft（output file tracing）が静的解決できるよう、パスセグメントはリテラルで書く。
    // `path.join(process.cwd(), ...ARRAY, 変数)` にすると nft が解決を諦め、
    // リポジトリ全体を再帰 glob する（ビルドが数分遅くなる）。
    // 詳細: docs/wiki/deployment.md「output file tracing（nft）のワイルドカード走査」
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'secondaryschool', file), 'utf-8')) as T;
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

/** 進路一覧ページ用。1つの中学から1つの高校へ進んだ選手のまとまり */
export interface FeederEntry {
  team: SecondarySchoolTeam;
  players: { name: string; jhsLastYear: number; highschoolFirstYear: number }[];
  /** 中学と高校で都道府県が違う（越境進学）。ペア継続で採用された分がここに出る */
  crossPrefecture: boolean;
  /** 中学名と高校名が同じ＝中高一貫の内部進学とみられる */
  affiliated: boolean;
}

/** 高校（性別ごと）と、そこへ進学した中学のまとまり */
export interface FeederGroup {
  highschool: string;
  prefecture: string | null;
  gender: 'boys' | 'girls' | null;
  feeders: FeederEntry[];
  playerCount: number;
}

/** 学校名の比較用に「◯◯中学校」「（拠）」等を落とした芯を取る */
function schoolCore(name: string): string {
  return name
    .replace(/（.*?）|\(.*?\)/g, '')
    .replace(/(中等教育学校|中学校|中学|中)$/, '')
    .trim();
}

/**
 * **高校から見た「出身中学」**のまとまり。進路一覧ページ（/secondaryschool/pathways/）で使う。
 *
 * 中学起点ではなく高校起点にしているのは、検索需要が高校名に偏っているのと、
 * この向きでしか見えない事実があるため（強豪校が県外の中学から集めている、など）。
 * 中学起点の見え方は各中学のチームページが担当する。docs/wiki/seo.md #13
 *
 * 並びは「出身中学の種類が多い順 → 人数が多い順 → 県名・校名」。
 * 種類数を先に見るのは、1中学から複数人という塊より
 * 複数の中学から集めている高校のほうが情報量が多いため。
 */
export function getFeederGroups(gender?: 'boys' | 'girls'): FeederGroup[] {
  const teams = getIndex().teams;
  const byHighschool = new Map<string, FeederGroup>();

  for (const [key, records] of Object.entries(getPathwayMap())) {
    const [name, prefecture] = key.split('\t');
    // 掲載閾値未満の中学は pathways.json に入らない規約（build-secondaryschool-pathways.mjs）だが、
    // 索引と食い違ったときに壊れたリンクを出さないよう、チームが引けなければ捨てる
    const team = teams.find((t) => t.name === name && t.prefecture === prefecture);
    if (!team) continue;

    for (const r of records) {
      // 進路一覧も高校の学校ページに合わせて男女別URLにしている（docs/wiki/seo.md #13）。
      // mixed（gender=null）は男女どちらにも出す規約（highschool.md）
      if (gender && r.highschoolGender && r.highschoolGender !== gender) continue;
      // 高校の学校ページは男女別なので、性別までを1つの単位にする
      const gkey = `${r.highschool}\t${r.highschoolPrefecture ?? ''}\t${r.highschoolGender ?? ''}`;
      const group = byHighschool.get(gkey) ?? {
        highschool: r.highschool,
        prefecture: r.highschoolPrefecture,
        gender: r.highschoolGender,
        feeders: [],
        playerCount: 0,
      };
      const feeder = group.feeders.find((f) => f.team.id === team.id && f.team.prefectureId === team.prefectureId) ?? {
        team,
        players: [],
        crossPrefecture: Boolean(r.highschoolPrefecture && team.prefecture !== r.highschoolPrefecture),
        affiliated: schoolCore(team.name) === schoolCore(r.highschool),
      };
      if (!group.feeders.includes(feeder)) group.feeders.push(feeder);
      feeder.players.push({ name: r.player, jhsLastYear: r.jhsLastYear, highschoolFirstYear: r.highschoolFirstYear });
      group.playerCount += 1;
      byHighschool.set(gkey, group);
    }
  }

  const groups = [...byHighschool.values()];
  for (const g of groups) {
    for (const f of g.feeders) f.players.sort((a, b) => b.highschoolFirstYear - a.highschoolFirstYear || a.name.localeCompare(b.name, 'ja'));
    // 県外の中学を先に出す（この一覧でしか見えない事実なので目立たせる）
    g.feeders.sort(
      (a, b) => Number(b.crossPrefecture) - Number(a.crossPrefecture) || b.players.length - a.players.length || a.team.name.localeCompare(b.team.name, 'ja'),
    );
  }
  return groups.sort(
    (a, b) =>
      b.feeders.length - a.feeders.length ||
      b.playerCount - a.playerCount ||
      (a.prefecture ?? '').localeCompare(b.prefecture ?? '', 'ja') ||
      a.highschool.localeCompare(b.highschool, 'ja'),
  );
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
