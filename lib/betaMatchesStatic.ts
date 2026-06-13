import fs from 'fs/promises';
import path from 'path';

import type { Match } from '@/types/database';

const betaMatchesRoot = path.join(
  process.cwd(),
  'public',
  'data',
  'beta-matches',
);

type TeamSide = 'A' | 'B';
type RawPlayer = {
  last_name?: unknown;
  first_name?: unknown;
  name?: unknown;
};
type RawTeam = {
  name?: unknown;
  players?: RawPlayer[];
};
type BetaMatchesIndex = {
  generatedAt?: string;
  matches?: Match[];
};
type BetaMatchesMeta = {
  matchIds?: string[];
};
type BetaMatchDetail = {
  generatedAt?: string;
  match?: Match;
};

const readJson = async <T>(filePath: string): Promise<T | null> => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

const stringifyNamePart = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : '';
};

const formatPlayers = (players: RawPlayer[]) => {
  return players
    .map((player) => {
      const lastName = stringifyNamePart(player.last_name);
      const firstName = stringifyNamePart(player.first_name);
      const name = stringifyNamePart(player.name);

      if (lastName && firstName) return `${lastName} ${firstName}`;
      return lastName || name || firstName;
    })
    .filter(Boolean)
    .join('・');
};

const formatRawTeamName = (teamName: unknown): string => {
  if (!teamName) return '';
  if (typeof teamName === 'string') return teamName.trim();
  if (Array.isArray(teamName)) {
    return teamName
      .map((value) => formatRawTeamName(value))
      .filter(Boolean)
      .join('・');
  }

  if (typeof teamName === 'object') {
    const team = teamName as RawTeam;
    const players = Array.isArray(team.players)
      ? formatPlayers(team.players)
      : '';
    const name = stringifyNamePart(team.name);
    return players || name || '';
  }

  return String(teamName);
};

export const getBetaTeamDisplayName = (match: Match, team: TeamSide) => {
  const player1LastName =
    team === 'A'
      ? match.team_a_player1_last_name
      : match.team_b_player1_last_name;
  const player2LastName =
    team === 'A'
      ? match.team_a_player2_last_name
      : match.team_b_player2_last_name;

  if (player1LastName) {
    return [player1LastName, player2LastName].filter(Boolean).join('・');
  }

  const structuredTeam = match.teams?.[team];
  if (structuredTeam?.players?.length) {
    const structuredName = formatPlayers(structuredTeam.players);
    if (structuredName) return structuredName;
  }

  return formatRawTeamName(team === 'A' ? match.team_a : match.team_b);
};

export const getLatestBetaMatches = async () => {
  const indexPath = path.join(betaMatchesRoot, 'index.json');
  const data = await readJson<BetaMatchesIndex>(indexPath);
  return data?.matches ?? [];
};

export const getLatestBetaMatchIds = async () => {
  const metaPath = path.join(betaMatchesRoot, 'meta.json');
  const meta = await readJson<BetaMatchesMeta>(metaPath);
  if (meta?.matchIds) return meta.matchIds;

  const matches = await getLatestBetaMatches();
  return matches.map((match) => match.id);
};

export const getBetaMatchById = async (matchId: string) => {
  const detailPath = path.join(betaMatchesRoot, 'matches', `${matchId}.json`);
  const data = await readJson<BetaMatchDetail>(detailPath);
  return data?.match ?? null;
};

export interface SiteLinkedMatchPath {
  generation: string;
  tournamentId: string;
  year: string;
  gameCategory: string;
  ageCategory: string;
  gender: string;
  matchId: string;
}

// 掲載大会に紐づく試合（siteLink あり）の、ネスト URL 用パスセグメント一覧。
// tournamentPath は `/tournaments/{generation}/{tournamentId}/{year}/{gameCategory}/{ageCategory}/{gender}`。
export const getSiteLinkedMatchPaths = async (): Promise<
  SiteLinkedMatchPath[]
> => {
  const matches = await getLatestBetaMatches();
  const paths: SiteLinkedMatchPath[] = [];

  for (const match of matches) {
    const tournamentPath = match.siteLink?.tournamentPath;
    if (!tournamentPath) continue;

    const segments = tournamentPath.split('/').filter(Boolean);
    // ['tournaments', generation, tournamentId, year, gameCategory, ageCategory, gender]
    if (segments.length !== 7 || segments[0] !== 'tournaments') continue;

    const [
      ,
      generation,
      tournamentId,
      year,
      gameCategory,
      ageCategory,
      gender,
    ] = segments;

    paths.push({
      generation,
      tournamentId,
      year,
      gameCategory,
      ageCategory,
      gender,
      matchId: match.id,
    });
  }

  return paths;
};
