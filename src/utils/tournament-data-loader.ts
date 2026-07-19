// src/utils/tournament-data-loader.ts

import fs from 'fs';
import path from 'path';

import type { TournamentDetailData, TournamentIndexEntry, TournamentInformationEntry } from '@/types/tournament';

type TournamentFileDescriptor = {
  tournamentId: string;
  year: number;
  category: string;
  filePath: string;
};

// ビルド時、この2関数は「大会ディレクトリ全走査」と「大会JSONの読み込み+parse」を
// 呼ばれるたびに実行していた。team-data-aggregator は 1回の集計の中でも Pass1 /
// Pass1.5(不動点ループ) / Pass2 で全ファイルを読み直すため、1ページ生成あたり
// 297ファイル × 数回 の readFileSync + JSON.parse が走っていた。
// 内容はビルド中に変化しないので、プロセス内で一度だけ読んでキャッシュする。
// （全297ファイルを保持してもヒープ約36MB。実測 parse 208ms/回。）
let cachedTournamentFiles: TournamentFileDescriptor[] | null = null;
const tournamentDataCache = new Map<string, TournamentDetailData | null>();

/**
 * Recursively scan data/tournaments/details/ for all JSON files
 * @returns Array of { tournamentId, year, category, filePath }
 */
export function getAllTournamentFiles(): TournamentFileDescriptor[] {
  if (cachedTournamentFiles) return cachedTournamentFiles;

  const detailsDir = path.join(process.cwd(), 'data/tournaments/details');
  const results: TournamentFileDescriptor[] = [];

  if (!fs.existsSync(detailsDir)) {
    cachedTournamentFiles = results;
    return results;
  }

  // Scan tournament directories
  const tournamentDirs = fs.readdirSync(detailsDir).filter((file) => fs.statSync(path.join(detailsDir, file)).isDirectory());

  for (const tournamentId of tournamentDirs) {
    const tournamentDir = path.join(detailsDir, tournamentId);
    const yearDirs = fs.readdirSync(tournamentDir).filter((file) => fs.statSync(path.join(tournamentDir, file)).isDirectory());

    for (const yearStr of yearDirs) {
      const year = parseInt(yearStr, 10);
      if (isNaN(year)) continue;

      const yearDir = path.join(tournamentDir, yearStr);
      const jsonFiles = fs.readdirSync(yearDir).filter((file) => file.endsWith('.json') && !file.startsWith('og'));

      for (const jsonFile of jsonFiles) {
        const category = jsonFile.replace('.json', '');
        const filePath = path.join(yearDir, jsonFile);
        results.push({ tournamentId, year, category, filePath });
      }
    }
  }

  cachedTournamentFiles = results;
  return results;
}

/**
 * Load and parse a single tournament JSON file
 *
 * 返り値はプロセス内で共有されるキャッシュ済みオブジェクト。呼び出し側で
 * 破壊的変更をしてはならない（読み取り専用として扱うこと）。
 */
export function loadTournamentData(filePath: string): TournamentDetailData | null {
  const cached = tournamentDataCache.get(filePath);
  if (cached !== undefined) return cached;

  let parsed: TournamentDetailData | null = null;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    parsed = JSON.parse(content) as TournamentDetailData;
  } catch (error) {
    console.error(`Failed to load tournament data from ${filePath}:`, error);
    parsed = null;
  }

  tournamentDataCache.set(filePath, parsed);
  return parsed;
}

/**
 * Get tournament information from data/tournaments/information/{tournamentId}.json
 */
export function getTournamentInfo(tournamentId: string, year?: number): TournamentInformationEntry | null {
  const infoPath = path.join(process.cwd(), `data/tournaments/information/${tournamentId}.json`);

  if (!fs.existsSync(infoPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(infoPath, 'utf-8');
    const infoArray = JSON.parse(content) as TournamentInformationEntry[];

    if (year) {
      return infoArray.find((info) => info.year === year) || null;
    }

    // Return the most recent entry if no year specified
    return infoArray.sort((a, b) => b.year - a.year)[0] || null;
  } catch (error) {
    console.error(`Failed to load tournament info from ${infoPath}:`, error);
    return null;
  }
}

/**
 * Get tournament label from data/tournaments/index.json
 */
export function getTournamentLabel(tournamentId: string): string {
  const indexPath = path.join(process.cwd(), 'data/tournaments/index.json');

  if (!fs.existsSync(indexPath)) {
    return tournamentId;
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const tournaments = JSON.parse(content) as TournamentIndexEntry[];
    const tournament = tournaments.find((t) => t.tournamentId === tournamentId);
    return tournament?.label || tournamentId;
  } catch (error) {
    console.error(`Failed to load tournament index:`, error);
    return tournamentId;
  }
}

/**
 * Get all tournament information entries
 */
export function getAllTournamentInfo(tournamentId: string): TournamentInformationEntry[] {
  const infoPath = path.join(process.cwd(), `data/tournaments/information/${tournamentId}.json`);

  if (!fs.existsSync(infoPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(infoPath, 'utf-8');
    return JSON.parse(content) as TournamentInformationEntry[];
  } catch (error) {
    console.error(`Failed to load tournament info from ${infoPath}:`, error);
    return [];
  }
}
/**
 * Get all tournament index entries
 */
export function getAllTournamentIndex(): TournamentIndexEntry[] {
  const indexPath = path.join(process.cwd(), 'data/tournaments/index.json');

  if (!fs.existsSync(indexPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(content) as TournamentIndexEntry[];
  } catch (error) {
    console.error(`Failed to load tournament index:`, error);
    return [];
  }
}

export type TournamentDescriptor = {
  tournamentId: string;
  year: number;
  category: string;
  filePath: string;
};

export type PreloadedTournamentData = {
  descriptor: TournamentDescriptor;
  data: TournamentDetailData;
};

/**
 * Load all tournament data into memory
 */
export function loadAllTournamentData(): PreloadedTournamentData[] {
  const files = getAllTournamentFiles();
  const results: PreloadedTournamentData[] = [];

  for (const file of files) {
    const data = loadTournamentData(file.filePath);
    if (data) {
      results.push({
        descriptor: file,
        data,
      });
    }
  }

  return results;
}
