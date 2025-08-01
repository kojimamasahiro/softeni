// lib/getTournamentStaticProps.ts
import fs from 'fs';
import path from 'path';

import { TournamentMeta } from '@/types';

import { getAllPlayers } from './players';

export async function getTournamentStaticProps({
  basePath,
  tournamentId,
  year,
  readEntriesByCategory = true,
}: {
  basePath: string;
  tournamentId: string;
  year: string;
  readEntriesByCategory?: boolean;
}) {
  const playersPath = path.join(process.cwd(), 'data/players');
  const highschoolDataPath = path.join(process.cwd(), 'data/highschool');

  const allPlayers = getAllPlayers();

  const meta: TournamentMeta = JSON.parse(
    fs.readFileSync(path.join(basePath, tournamentId, 'meta.json'), 'utf-8'),
  );
  const data = JSON.parse(
    fs.readFileSync(
      path.join(basePath, tournamentId, year, 'results.json'),
      'utf-8',
    ),
  );
  const unknownPlayers = JSON.parse(
    fs.readFileSync(path.join(playersPath, 'unknown.json'), 'utf-8'),
  );

  const entriesPath = path.join(basePath, tournamentId, year, 'entries.json');
  const hasEntries = fs.existsSync(entriesPath);
  const entriesRaw = hasEntries
    ? JSON.parse(fs.readFileSync(entriesPath, 'utf-8'))
    : {};
  const entries = readEntriesByCategory
    ? entriesRaw
    : (Object.values(entriesRaw)[0] ?? []);

  const highlight: string | null = data.highlight ?? null;

  const teamsPath = path.join(highschoolDataPath, 'teams.json');
  const teamList: {
    id: string;
    name: string;
    prefecture: string;
    prefectureId: string;
  }[] = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));

  const teamMap = Object.fromEntries(
    teamList.map((t) => [
      t.name,
      { teamId: t.id, prefectureId: t.prefectureId },
    ]),
  );

  const tournamentDir = path.join(basePath, tournamentId);
  const allYearDirs = fs
    .readdirSync(tournamentDir)
    .filter((name) => /^\d{4}$/.test(name));

  const otherYears: string[] = [];

  for (const y of allYearDirs) {
    if (y === year) continue;
    const resultsPath = path.join(tournamentDir, y, 'results.json');
    if (!fs.existsSync(resultsPath)) continue;
    try {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      if (results.status === 'completed') {
        otherYears.push(y);
      }
    } catch {
      console.warn(`Failed to read results.json for ${tournamentId}/${y}`);
    }
  }

  otherYears.sort((a, b) => Number(b) - Number(a));

  return {
    year,
    meta,
    data,
    allPlayers,
    unknownPlayers,
    highlight,
    teamMap,
    otherYears,
    ...(readEntriesByCategory ? { entriesByCategory: entries } : { entries }),
  };
}
