// lib/tournamentRecords.ts
// 大会非依存の「歴代優勝者（historical-winners）」抽出コア。
// data/tournaments/details/<tournamentId>/<year>/<categoryId>.json と
// data/tournaments/information/<tournamentId>.json を読み、種目ごとの歴代優勝者と
// 連覇判定を含む historical-winners ブロックを生成する。
//
// 設計: docs/raw/2026-06-21-historical-winners-logic.md / ADR-005。
// 既存の lib/highschoolNationalTournaments.ts（高校限定の歴代抽出）を一般化したもの。
// このモジュールは高校固有の依存（学校ページ link 解決）を持たず、任意の大会に使える。
// fs を使うため getStaticProps またはビルドスクリプトからのみ import すること。

import fs from 'fs';
import path from 'path';

import type { TournamentInformationEntry } from '@/types/tournament';

// ---- 出力型（docs/raw/2026-06-21-historical-winners-logic.md 準拠） ----

/** 歴代優勝の 1 年ぶん */
export type ChampionEntry = {
  year: number;
  /** 個人: 選手名一覧 / 団体: 空配列 */
  players: string[];
  /** 所属（個人=ペアの所属校、団体=校名） */
  teams: string[];
  prefectures: string[];
  /** 表示用文字列（個人:「鈴木・佐藤（◯◯高）」/ 団体:「◯◯高」）。優勝者不明年は null */
  display: string | null;
};

/** 連覇情報（対象年が連続優勝区間の末尾にある場合） */
export type RepeatChampion = {
  /** 連続優勝年数（2 以上で連覇） */
  streak: number;
  /** 連覇開始年 */
  since: number;
};

/** 1 種目ぶんの historical-winners ブロック */
export type HistoricalWinnersBlock = {
  blockType: 'historical-winners';
  tournamentId: string;
  categoryId: string;
  categoryLabel: string;
  /** 新しい年が先頭 */
  champions: ChampionEntry[];
  edition: {
    targetYear: number | null;
    /** 優勝者を特定できた開催回数 */
    totalEditions: number;
    repeatChampion: RepeatChampion | null;
  };
  /** 集計に使った年（鮮度・dateModified 用） */
  sourceYears: number[];
};

// ---- 入力（raw JSON）型 ----

export type RawParticipant = {
  id: string;
  lastName?: string | null;
  firstName?: string | null;
  team?: string | null;
  prefecture?: string | null;
};

export type RawEntry = { entryNo: number; playerIds: string[] };

type RawRank = { kind?: string; bestLevel?: number; round?: number };

type RawResult = {
  entryNo: number;
  tournament?: { label?: string; rank?: RawRank } | null;
};

/** 1 試合ぶん（champion-defeat 検出に必要な最小フィールドのみ） */
export type RawMatch = {
  entries?: number[];
  winnerEntryNo?: number;
  round?: string | null;
  stage?: string | null;
  retired?: boolean;
};

export type RawDetail = {
  participants?: RawParticipant[];
  entries?: RawEntry[];
  results?: RawResult[];
  matches?: RawMatch[];
};

// ---- 内部ヘルパ ----

const DETAILS_ROOT = ['data', 'tournaments', 'details'];

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

function readInformation(tournamentId: string): TournamentInformationEntry[] {
  const infoPath = path.join(
    resolveRoot(),
    'data',
    'tournaments',
    'information',
    `${tournamentId}.json`,
  );
  if (!fs.existsSync(infoPath)) return [];
  const parsed = readJson<unknown>(infoPath);
  return Array.isArray(parsed) ? (parsed as TournamentInformationEntry[]) : [];
}

/** categoryId（例: doubles-none-boys）を分解。不正なら null。 */
export function parseCategoryFile(fileName: string): {
  categoryId: string;
  category: string;
  age: string;
  gender: string;
} | null {
  const base = fileName.replace(/\.json$/, '');
  const parts = base.split('-');
  if (parts.length < 3) return null;
  const gender = parts.pop() as string;
  const age = parts.pop() as string;
  const category = parts.join('-');
  return { categoryId: `${category}-${age}-${gender}`, category, age, gender };
}

/** entry を選手名・所属・表示文字列へ解決する（団体は校名表示） */
function resolveEntry(
  entry: RawEntry,
  participantById: Map<string, RawParticipant>,
): {
  display: string;
  players: string[];
  teams: string[];
  prefectures: string[];
} {
  const players: string[] = [];
  const teams: string[] = [];
  const prefectures: string[] = [];

  for (const id of entry.playerIds) {
    const p = participantById.get(id);
    if (!p) {
      // 参加者情報が無い場合は id をそのまま名前として扱う
      players.push(id);
      continue;
    }
    const name = `${p.lastName ?? ''}${p.firstName ?? ''}`.trim();
    if (name) players.push(name);
    if (p.team && !teams.includes(p.team)) teams.push(p.team);
    if (p.prefecture && !prefectures.includes(p.prefecture)) {
      prefectures.push(p.prefecture);
    }
  }

  const nameStr = players.join('・');
  let display: string;
  if (!nameStr) {
    display = teams.join('・'); // 団体戦
  } else if (teams.length > 0) {
    display = `${nameStr}（${teams.join('・')}）`;
  } else {
    display = nameStr;
  }

  return { display, players, teams, prefectures };
}

/** 1 種目ファイルから「優勝」エントリのみ抽出して ChampionEntry を作る */
function extractWinner(detailPath: string, year: number): ChampionEntry | null {
  const data = readJson<RawDetail>(detailPath);
  if (!data) return null;

  const participantById = new Map<string, RawParticipant>(
    (data.participants ?? []).map((p) => [p.id, p] as const),
  );
  const entryByNo = new Map<number, RawEntry>(
    (data.entries ?? []).map((e) => [e.entryNo, e] as const),
  );

  for (const result of data.results ?? []) {
    if (result.tournament?.rank?.kind !== 'winner') continue;
    const entry = entryByNo.get(result.entryNo);
    if (!entry) continue;
    const resolved = resolveEntry(entry, participantById);
    return {
      year,
      players: resolved.players,
      teams: resolved.teams,
      prefectures: resolved.prefectures,
      display: resolved.display || null,
    };
  }
  // 優勝者を特定できない年も「年の存在」は示す（捏造しない）
  return { year, players: [], teams: [], prefectures: [], display: null };
}

/**
 * 指定大会・年・種目の生 detail（matches を含む）を読む。無ければ null。
 * champion-defeat 等、優勝者以外の試合（敗退試合）を参照したい呼び出し側が使う。
 */
export function readYearDetail(
  tournamentId: string,
  year: number,
  categoryId: string,
): RawDetail | null {
  const detailPath = path.join(
    resolveRoot(),
    ...DETAILS_ROOT,
    tournamentId,
    String(year),
    `${categoryId}.json`,
  );
  if (!fs.existsSync(detailPath)) return null;
  return readJson<RawDetail>(detailPath);
}

/** detail.participants から id→participant の Map を作る */
export function buildParticipantMap(
  detail: RawDetail,
): Map<string, RawParticipant> {
  return new Map((detail.participants ?? []).map((p) => [p.id, p] as const));
}

/**
 * 任意の entry を ChampionEntry へ解決する（championKey による比較に使える）。
 * historical-winners の優勝者と同じ resolveEntry を通すため、キーが整合する。
 */
export function resolveEntryToChampion(
  entry: RawEntry,
  participantById: Map<string, RawParticipant>,
  year: number,
): ChampionEntry {
  const r = resolveEntry(entry, participantById);
  return {
    year,
    players: r.players,
    teams: r.teams,
    prefectures: r.prefectures,
    display: r.display || null,
  };
}

/**
 * 連覇・同一優勝者判定用のキー。個人は所属＋名前、団体は校名で比較（表記揺れは正規化）。
 * playerId 名寄せに依存せず、ChampionEntry の解決済み表示要素のみで決まる安全な比較キー。
 */
export function championKey(c: ChampionEntry): string | null {
  if (!c.display) return null;
  const base =
    c.players.length > 0
      ? `${c.players.slice().sort().join('|')}@${c.teams.slice().sort().join('|')}`
      : c.teams.slice().sort().join('|');
  return base.replace(/\s+/g, '').normalize('NFKC') || null;
}

/** 対象年が連続優勝区間の末尾にある場合の連覇情報を返す */
function computeRepeatChampion(
  championsDesc: ChampionEntry[],
  targetYear: number | null,
): RepeatChampion | null {
  if (targetYear == null) return null;
  const asc = championsDesc.slice().sort((a, b) => a.year - b.year);
  const idx = asc.findIndex((c) => c.year === targetYear);
  if (idx < 0) return null;
  const targetKey = championKey(asc[idx]);
  if (!targetKey) return null;

  let streak = 1;
  let since = asc[idx].year;
  for (let i = idx - 1; i >= 0; i--) {
    // 連続する開催年であることも条件にする（隔年・欠落は連覇を切る）
    if (asc[i + 1].year - asc[i].year !== 1) break;
    if (championKey(asc[i]) !== targetKey) break;
    streak += 1;
    since = asc[i].year;
  }
  return streak >= 2 ? { streak, since } : null;
}

// ---- 公開 API ----

export type HistoricalWinnersOptions = {
  /** 連覇判定・edition の基準年（速報/プレビュー対象年）。省略時は最新年 */
  targetYear?: number;
};

/**
 * 指定大会・種目の historical-winners ブロックを生成する。
 * 対象 categoryId の details が 1 年も無い場合は null。
 */
export function getHistoricalWinners(
  tournamentId: string,
  categoryId: string,
  options: HistoricalWinnersOptions = {},
): HistoricalWinnersBlock | null {
  const tournamentDir = path.join(resolveRoot(), ...DETAILS_ROOT, tournamentId);
  if (!fs.existsSync(tournamentDir)) return null;

  const years = fs
    .readdirSync(tournamentDir)
    .filter((name) => /^\d{4}$/.test(name))
    .map((name) => Number(name))
    .sort((a, b) => a - b);

  const champions: ChampionEntry[] = [];
  for (const year of years) {
    const detailPath = path.join(
      tournamentDir,
      String(year),
      `${categoryId}.json`,
    );
    if (!fs.existsSync(detailPath)) continue;
    const champ = extractWinner(detailPath, year);
    if (champ) champions.push(champ);
  }
  if (champions.length === 0) return null;

  // categoryLabel は information から引く（無ければ categoryId）
  const information = readInformation(tournamentId);
  let categoryLabel = categoryId;
  for (const entry of information) {
    const hit = (entry.categories ?? []).find(
      (c) => c.categoryId === categoryId,
    );
    if (hit?.label) {
      categoryLabel = hit.label;
      break;
    }
  }

  const sourceYears = champions.map((c) => c.year);
  const targetYear =
    options.targetYear ?? sourceYears[sourceYears.length - 1] ?? null;

  const championsDesc = champions.slice().sort((a, b) => b.year - a.year);
  const repeatChampion = computeRepeatChampion(champions, targetYear);
  const totalEditions = champions.filter((c) => c.display).length;

  return {
    blockType: 'historical-winners',
    tournamentId,
    categoryId,
    categoryLabel,
    champions: championsDesc,
    edition: { targetYear, totalEditions, repeatChampion },
    sourceYears,
  };
}

/**
 * 指定大会の全種目について historical-winners をまとめて返す。
 * details 配下の全年から categoryId 集合を収集して種目ごとに生成する。
 */
/**
 * ビルド時メモ化。collectTitles（lib/careerRecord.ts）は選手・優勝者ごとに全大会の
 * getAllHistoricalWinners を呼ぶため、同一引数の全年走査が大量に重複する。
 * 既存の cachedTournamentMeta 同様プロセス内キャッシュで重複 I/O を排除する
 * （静的ビルド前提。dev で JSON を編集した場合はサーバ再起動が必要）。
 */
let cachedAllWinners: Map<string, HistoricalWinnersBlock[]> | null = null;

export function getAllHistoricalWinners(
  tournamentId: string,
  options: HistoricalWinnersOptions = {},
): HistoricalWinnersBlock[] {
  if (!cachedAllWinners) cachedAllWinners = new Map();
  const cacheKey = `${tournamentId}::${options.targetYear ?? 'latest'}`;
  const cached = cachedAllWinners.get(cacheKey);
  if (cached) return cached;

  const tournamentDir = path.join(resolveRoot(), ...DETAILS_ROOT, tournamentId);
  if (!fs.existsSync(tournamentDir)) return [];

  const categoryIds = new Set<string>();
  for (const yearDir of fs.readdirSync(tournamentDir)) {
    if (!/^\d{4}$/.test(yearDir)) continue;
    const dir = path.join(tournamentDir, yearDir);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const parsed = parseCategoryFile(file);
      if (parsed) categoryIds.add(parsed.categoryId);
    }
  }

  const blocks: HistoricalWinnersBlock[] = [];
  for (const categoryId of categoryIds) {
    const block = getHistoricalWinners(tournamentId, categoryId, options);
    if (block) blocks.push(block);
  }
  cachedAllWinners.set(cacheKey, blocks);
  return blocks;
}
