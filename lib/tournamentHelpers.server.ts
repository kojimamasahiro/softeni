// lib/tournamentHelpers.server.ts - Server-side only functions
// This file should ONLY be imported in getStaticProps, getServerSideProps, or API routes

import fs from 'fs';
import path from 'path';

import type { TournamentCategoryInfo, TournamentIndexEntry, TournamentInformationEntry } from '@/types/tournament';

export interface TournamentMeta {
  id: string;
  name: string;
  generation: string;
  categoryTypes: string[];
  isMajorTitle: boolean;
  officialUrl?: string;
}

export interface TournamentYearMeta {
  year: number;
  startDate: string;
  endDate: string;
  location: string;
  status: string;
  specialRules?: string;
  note?: string;
  source?: string;
  sourceUrl?: string;
}

export interface TournamentInfo {
  meta: TournamentMeta;
  yearMeta: TournamentYearMeta;
  fullName: string;
  detailUrl: string;
  exists: boolean; // 大会データが実際に存在するかどうか
}

type TournamentLookup = {
  rawId: string;
  baseId: string;
  explicitYear: number | null;
};

const readJsonSafe = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch (error) {
    console.error(`Failed to parse JSON: ${filePath}`, error);
    return null;
  }
};

const parseTournamentLookup = (rawId: string): TournamentLookup => {
  const match = rawId.match(/^(.*)-(\d{4})$/);
  if (!match) {
    return {
      rawId,
      baseId: rawId,
      explicitYear: null,
    };
  }

  return {
    rawId,
    baseId: match[1],
    explicitYear: Number(match[2]),
  };
};

const loadTournamentIndexEntries = (): TournamentIndexEntry[] => {
  const tournamentRoot = path.join(process.cwd(), 'data', 'tournaments');
  const mainIndex = readJsonSafe<TournamentIndexEntry[]>(path.join(tournamentRoot, 'index.json')) ?? [];
  const localIndex = readJsonSafe<TournamentIndexEntry[]>(path.join(tournamentRoot, 'local_index.json')) ?? [];

  return [...mainIndex, ...localIndex];
};

const findTournamentEntry = (lookup: TournamentLookup, entries: TournamentIndexEntry[]): TournamentIndexEntry | null => {
  return (
    entries.find((entry) => entry.tournamentId === lookup.rawId) ??
    entries.find((entry) => entry.tournamentId === lookup.baseId) ??
    entries.find((entry) => entry.label === lookup.rawId) ??
    entries.find((entry) => entry.label === lookup.baseId) ??
    null
  );
};

const loadTournamentInformation = (tournamentId: string): TournamentInformationEntry[] => {
  const filePath = path.join(process.cwd(), 'data', 'tournaments', 'information', `${tournamentId}.json`);
  return readJsonSafe<TournamentInformationEntry[]>(filePath) ?? [];
};

const loadDetailCategoryIds = (tournamentId: string, year: number): string[] => {
  const detailDir = path.join(process.cwd(), 'data', 'tournaments', 'details', tournamentId, String(year));

  if (!fs.existsSync(detailDir)) {
    return [];
  }

  return fs
    .readdirSync(detailDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace(/\.json$/i, ''))
    .sort();
};

const loadDetailYears = (tournamentId: string): number[] => {
  const detailDir = path.join(process.cwd(), 'data', 'tournaments', 'details', tournamentId);

  if (!fs.existsSync(detailDir)) {
    return [];
  }

  return fs
    .readdirSync(detailDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .filter((year) => !Number.isNaN(year))
    .sort((a, b) => b - a);
};

const getAllAvailableYears = (tournamentId: string, informationEntries: TournamentInformationEntry[]): number[] => {
  const years = new Set<number>();

  for (const info of informationEntries) {
    years.add(info.year);
  }

  for (const year of loadDetailYears(tournamentId)) {
    years.add(year);
  }

  return [...years].sort((a, b) => b - a);
};

const inferCategoryTypes = (informationEntries: TournamentInformationEntry[], tournamentId: string, year: number | null): string[] => {
  const types = new Set<string>();

  for (const info of informationEntries) {
    for (const category of info.categories ?? []) {
      if (category.category) {
        types.add(category.category);
      }
    }
  }

  if (types.size > 0) {
    return [...types];
  }

  const fallbackYear = year ?? loadDetailYears(tournamentId)[0] ?? null;
  if (fallbackYear === null) {
    return [];
  }

  for (const categoryId of loadDetailCategoryIds(tournamentId, fallbackYear)) {
    const parts = categoryId.split('-');
    if (parts[0]) {
      types.add(parts[0]);
    }
  }

  return [...types];
};

const categoryIdToPathParts = (categoryId: string): { gameCategory: string; ageCategory: string; gender: string } | null => {
  const parts = categoryId.split('-');
  if (parts.length < 3) {
    return null;
  }

  const gender = parts.pop();
  const ageCategory = parts.pop();
  const gameCategory = parts.join('-');

  if (!gender || !ageCategory || !gameCategory) {
    return null;
  }

  return { gameCategory, ageCategory, gender };
};

const buildDetailUrl = (generationId: string, tournamentId: string, year: number | null, yearInfo: TournamentInformationEntry | null): string => {
  if (year === null) {
    return '';
  }

  const categories: TournamentCategoryInfo[] = yearInfo?.categories ?? [];
  for (const category of categories) {
    const detailPath = path.join(process.cwd(), 'data', 'tournaments', 'details', tournamentId, String(year), `${category.categoryId}.json`);

    if (fs.existsSync(detailPath)) {
      return `/tournaments/${generationId}/${tournamentId}/${year}/${category.category}/${category.age}/${category.gender}`;
    }
  }

  const fallbackCategoryId = loadDetailCategoryIds(tournamentId, year)[0];
  if (!fallbackCategoryId) {
    return '';
  }

  const pathParts = categoryIdToPathParts(fallbackCategoryId);
  if (!pathParts) {
    return '';
  }

  return `/tournaments/${generationId}/${tournamentId}/${year}/${pathParts.gameCategory}/${pathParts.ageCategory}/${pathParts.gender}`;
};

const buildUnknownTournamentInfo = (rawTournamentId: string, explicitYear: number | null): TournamentInfo => ({
  meta: {
    id: rawTournamentId,
    name: rawTournamentId,
    generation: 'unknown',
    categoryTypes: [],
    isMajorTitle: false,
  },
  yearMeta: {
    year: explicitYear ?? 2024,
    startDate: '',
    endDate: '',
    location: '',
    status: 'unknown',
  },
  fullName: explicitYear ? `${rawTournamentId} ${explicitYear}` : rawTournamentId,
  detailUrl: '',
  exists: false,
});

/**
 * サーバーサイドで大会情報を取得する（新構造: index/local_index/information/details）
 */
export const getTournamentInfoSSR = async (tournamentId: string): Promise<TournamentInfo | null> => {
  try {
    const lookup = parseTournamentLookup(tournamentId);
    const entries = loadTournamentIndexEntries();
    const entry = findTournamentEntry(lookup, entries);

    if (!entry) {
      return buildUnknownTournamentInfo(lookup.rawId, lookup.explicitYear);
    }

    const informationEntries = loadTournamentInformation(entry.tournamentId);
    const availableYears = getAllAvailableYears(entry.tournamentId, informationEntries);
    const targetYear = lookup.explicitYear ?? informationEntries[0]?.year ?? availableYears[0] ?? null;

    const yearInfo = (targetYear !== null ? (informationEntries.find((info) => info.year === targetYear) ?? null) : null) ?? null;

    const detailCategoryIds = targetYear !== null ? loadDetailCategoryIds(entry.tournamentId, targetYear) : [];
    const hasDetails = detailCategoryIds.length > 0;

    const meta: TournamentMeta = {
      id: entry.tournamentId,
      name: entry.label,
      generation: entry.generationId,
      categoryTypes: inferCategoryTypes(informationEntries, entry.tournamentId, targetYear),
      isMajorTitle: entry.isMajorTitle,
      officialUrl: entry.officialUrl,
    };

    const yearMeta: TournamentYearMeta = {
      year: targetYear ?? 2024,
      startDate: yearInfo?.startDate ?? '',
      endDate: yearInfo?.endDate ?? '',
      location: yearInfo?.location ?? '',
      status: hasDetails ? 'completed' : 'unknown',
      source: yearInfo?.source,
      sourceUrl: yearInfo?.sourceUrl,
    };

    return {
      meta,
      yearMeta,
      fullName: targetYear !== null ? `${meta.name} ${targetYear}` : meta.name,
      detailUrl: buildDetailUrl(meta.generation, entry.tournamentId, targetYear, yearInfo),
      exists: true,
    };
  } catch (error) {
    console.error('getTournamentInfoSSR error:', error);
    return null;
  }
};

/**
 * 大会IDから利用可能な年のリストを取得する
 */
export const getTournamentYearsSSR = async (tournamentId: string): Promise<number[]> => {
  try {
    const lookup = parseTournamentLookup(tournamentId);
    const entries = loadTournamentIndexEntries();
    const entry = findTournamentEntry(lookup, entries);
    const resolvedTournamentId = entry?.tournamentId ?? lookup.baseId;
    const informationEntries = loadTournamentInformation(resolvedTournamentId);

    return getAllAvailableYears(resolvedTournamentId, informationEntries);
  } catch (error) {
    console.error('getTournamentYearsSSR error:', error);
    return [];
  }
};

/**
 * 複数の大会情報を効率的に取得する（動的データ読み込み）
 */
export const getTournamentInfosSSR = async (tournamentIds: string[]): Promise<Record<string, TournamentInfo>> => {
  const results: Record<string, TournamentInfo> = {};
  const uniqueIds = [...new Set(tournamentIds)];

  const promises = uniqueIds.map(async (id) => {
    const info = await getTournamentInfoSSR(id);
    if (info) {
      results[id] = info;
    }
    return { id, info };
  });

  try {
    await Promise.all(promises);
  } catch (error) {
    console.error('Error fetching tournament infos:', error);
  }

  return results;
};
