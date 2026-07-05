// lib/careerRecord.ts
// 文脈ブロック「career-record」生成（優先度A）。
// 「当サイト掲載大会分の通算成績」を出す。既存資産を最大限再利用する:
//  - 通算成績: data/players/<slug>/analysis.json（generate-player-analysis.mjs 生成）
//  - 優勝歴(titles): Step1 lib/tournamentRecords.ts の歴代優勝者を全大会走査し、
//    優勝者名に主役名が含まれるかで抽出する
//
// 設計: docs/raw/2026-06-21-career-record-logic.md / ADR-005。
// fs を使うため getStaticProps またはビルドスクリプトからのみ import すること。
//
// 重要: 集計はすべて「当サイト掲載大会分」であり生涯記録ではない。
// 出力に scope:'site-covered' と scopeNote を必ず付け、描画側で明示する。

import fs from 'fs';
import path from 'path';

import { getAllHistoricalWinners } from './tournamentRecords';

export type CareerTitle = {
  tournamentId: string;
  categoryId: string;
  tournamentLabel: string;
  year: number;
  categoryLabel: string;
  isMajorTitle: boolean;
  generationId?: string;
};

export type CareerRecordBlock = {
  blockType: 'career-record';
  subject: { slug: string; display: string; team: string | null };
  /** 集計範囲が当サイト掲載分であることを示す。描画側で必ず明示する。 */
  scope: 'site-covered';
  scopeNote: string;
  totals: {
    matches: number;
    wins: number;
    losses: number;
    winRate: number;
    games?: { total: number; won: number; lost: number; gameRate: number };
  };
  /** 優勝歴（主要タイトル優先・新しい年が先頭） */
  titles: CareerTitle[];
  latest?: { tournament: string; date: string; result: string };
};

const SCOPE_NOTE = '当サイト掲載大会分の集計に基づく';

const DETAILS_ROOT = ['data', 'tournaments', 'details'];
const PLAYERS_ROOT = ['data', 'players'];

function resolveRoot(): string {
  return process.cwd();
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

type PlayerInformation = {
  lastName?: string;
  firstName?: string;
  team?: string | null;
};

type PlayerAnalysis = {
  totalMatches?: number;
  wins?: number;
  losses?: number;
  totalWinRate?: number;
  games?: { total: number; won: number; lost: number; gameRate: number };
  latestMatch?: {
    tournament?: string;
    date?: string;
    result?: string;
  } | null;
};

type TournamentMeta = {
  label: string;
  isMajorTitle: boolean;
  generationId?: string;
};

let cachedTournamentMeta: Map<string, TournamentMeta> | null = null;

function getTournamentMeta(): Map<string, TournamentMeta> {
  if (cachedTournamentMeta) return cachedTournamentMeta;
  const map = new Map<string, TournamentMeta>();
  const idx = readJson<
    Array<{
      tournamentId: string;
      label?: string;
      isMajorTitle?: boolean;
      generationId?: string;
    }>
  >(path.join(resolveRoot(), 'data', 'tournaments', 'index.json'));
  for (const t of idx ?? []) {
    map.set(t.tournamentId, {
      label: t.label ?? t.tournamentId,
      isMajorTitle: Boolean(t.isMajorTitle),
      generationId: t.generationId,
    });
  }
  cachedTournamentMeta = map;
  return map;
}

/** details 配下の全 tournamentId（結果データが存在する大会） */
function listTournamentIds(): string[] {
  const root = path.join(resolveRoot(), ...DETAILS_ROOT);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter((name) => {
    try {
      return fs.statSync(path.join(root, name)).isDirectory();
    } catch {
      return false;
    }
  });
}

function normalizeName(s: string): string {
  return s.replace(/\s+/g, '').normalize('NFKC');
}

/** 連結済み氏名（姓+名）で curated slug を解決する。曖昧（複数該当）なら null。 */
export function resolveSlugByFullName(fullName: string): string | null {
  const root = path.join(resolveRoot(), ...PLAYERS_ROOT);
  if (!fs.existsSync(root)) return null;
  const target = normalizeName(fullName);
  if (!target) return null;
  const hits: string[] = [];
  for (const slug of fs.readdirSync(root)) {
    const infoPath = path.join(root, slug, 'information.json');
    if (!fs.existsSync(infoPath)) continue;
    const info = readJson<PlayerInformation>(infoPath);
    if (!info?.lastName || !info?.firstName) continue;
    if (normalizeName(`${info.lastName}${info.firstName}`) === target) {
      hits.push(slug);
    }
  }
  return hits.length === 1 ? hits[0] : null;
}

/** 姓・名で curated slug を解決する。曖昧（複数該当）なら null。 */
export function resolveSlugByName(lastName: string, firstName: string): string | null {
  return resolveSlugByFullName(`${lastName}${firstName}`);
}

type TitleHit = {
  tournamentId: string;
  categoryId: string;
  categoryLabel: string;
  year: number;
};

// 選手ページ(getStaticProps)は選手数ぶん(数千回)呼ばれるため、全大会の優勝者を
// 選手ごとに毎回スキャンする(O(選手数 × 優勝データ量))と選手・大会データが増える
// につれビルドが線形以上に遅くなる。ここでは「正規化氏名 → タイトル一覧」の
// 逆引きMapをプロセス内で一度だけ構築し、各選手の照合をO(1)にする。
let cachedTitlesByName: Map<string, TitleHit[]> | null = null;

function getTitlesByName(): Map<string, TitleHit[]> {
  if (cachedTitlesByName) return cachedTitlesByName;
  const index = new Map<string, TitleHit[]>();

  for (const tournamentId of listTournamentIds()) {
    const blocks = getAllHistoricalWinners(tournamentId);
    for (const block of blocks) {
      for (const champ of block.champions) {
        if (!champ.display) continue;
        for (const p of champ.players) {
          const key = normalizeName(p);
          if (!key) continue;
          const hit: TitleHit = {
            tournamentId,
            categoryId: block.categoryId,
            categoryLabel: block.categoryLabel,
            year: champ.year,
          };
          const existing = index.get(key);
          if (existing) existing.push(hit);
          else index.set(key, [hit]);
        }
      }
    }
  }

  cachedTitlesByName = index;
  return index;
}

/** 主役名（優勝者表示の players 要素）で全大会の優勝歴を集める */
function collectTitles(subjectFullName: string): CareerTitle[] {
  const meta = getTournamentMeta();
  const hits = getTitlesByName().get(subjectFullName) ?? [];
  const titles: CareerTitle[] = [];
  const seen = new Set<string>();

  for (const hit of hits) {
    const key = `${hit.tournamentId}|${hit.categoryId}|${hit.year}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const m = meta.get(hit.tournamentId);
    titles.push({
      tournamentId: hit.tournamentId,
      categoryId: hit.categoryId,
      tournamentLabel: m?.label ?? hit.tournamentId,
      year: hit.year,
      categoryLabel: hit.categoryLabel,
      isMajorTitle: m?.isMajorTitle ?? false,
      generationId: m?.generationId,
    });
  }

  // 主要タイトル優先、その中で新しい年が先頭
  titles.sort((a, b) => {
    if (a.isMajorTitle !== b.isMajorTitle) return a.isMajorTitle ? -1 : 1;
    return b.year - a.year;
  });
  return titles;
}

/**
 * curated slug の career-record を生成する。analysis.json が無い（掲載試合が
 * 少なく未生成）場合は null（誤った 0 勝表示を避ける）。
 */
export function getCareerRecord(slug: string): CareerRecordBlock | null {
  const dir = path.join(resolveRoot(), ...PLAYERS_ROOT, slug);
  const info = readJson<PlayerInformation>(path.join(dir, 'information.json'));
  const analysis = readJson<PlayerAnalysis>(path.join(dir, 'analysis.json'));
  if (!info?.lastName || !info?.firstName) return null;
  if (!analysis || typeof analysis.totalMatches !== 'number') return null;

  const display = `${info.lastName}${info.firstName}`;
  const subjectFullName = display.replace(/\s+/g, '').normalize('NFKC');

  const titles = collectTitles(subjectFullName);

  const latest =
    analysis.latestMatch && analysis.latestMatch.tournament && analysis.latestMatch.result
      ? {
          tournament: analysis.latestMatch.tournament,
          date: analysis.latestMatch.date ?? '',
          result: analysis.latestMatch.result,
        }
      : undefined;

  return {
    blockType: 'career-record',
    subject: { slug, display, team: info.team ?? null },
    scope: 'site-covered',
    scopeNote: SCOPE_NOTE,
    totals: {
      matches: analysis.totalMatches,
      wins: analysis.wins ?? 0,
      losses: analysis.losses ?? 0,
      winRate: analysis.totalWinRate ?? 0,
      games: analysis.games,
    },
    titles,
    latest,
  };
}

/** 姓・名から career-record を生成する便宜関数（slug 解決込み）。曖昧なら null。 */
export function getCareerRecordByName(lastName: string, firstName: string): CareerRecordBlock | null {
  const slug = resolveSlugByName(lastName, firstName);
  return slug ? getCareerRecord(slug) : null;
}

/** 連結済み氏名（例: 「船水颯人」）から career-record を生成する。曖昧なら null。 */
export function getCareerRecordByFullName(fullName: string): CareerRecordBlock | null {
  const slug = resolveSlugByFullName(fullName);
  return slug ? getCareerRecord(slug) : null;
}
