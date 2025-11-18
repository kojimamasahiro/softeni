import fs from 'fs';
import path from 'path';

import type {
  TournamentDetailData,
  TournamentIndexEntry,
  TournamentInformationEntry,
} from '@/types/tournament';

// Load tournament index.json as array
export const loadTournamentIndex = (root?: string): TournamentIndexEntry[] => {
  const cwd = root || process.cwd();
  const indexPath = path.join(cwd, 'data', 'tournament', 'index.json');
  if (!fs.existsSync(indexPath)) return [];
  try {
    const raw = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(raw) as TournamentIndexEntry[];
  } catch {
    return [];
  }
};

// Load all information/*.json files into a map keyed by tournamentId
export const loadInformationMap = (
  root?: string,
): Map<string, TournamentInformationEntry[]> => {
  const cwd = root || process.cwd();
  const informationRoot = path.join(cwd, 'data', 'tournament', 'information');
  const map = new Map<string, TournamentInformationEntry[]>();
  if (!fs.existsSync(informationRoot)) return map;

  const files = fs
    .readdirSync(informationRoot)
    .filter((f) => f.endsWith('.json'));

  for (const f of files) {
    try {
      const tid = path.basename(f, '.json');
      const raw = fs.readFileSync(path.join(informationRoot, f), 'utf-8');
      const parsed = JSON.parse(raw) as TournamentInformationEntry[];
      map.set(tid, parsed || []);
    } catch {
      // ignore
    }
  }
  return map;
};

// Return all detail files as records containing tournamentId, year and parsed detail
export const getAllDetailRecords = (
  root?: string,
): Array<{
  tournamentId: string;
  year: string;
  fileName: string;
  filePath: string;
  detail: TournamentDetailData;
}> => {
  const cwd = root || process.cwd();
  const detailsRoot = path.join(cwd, 'data', 'tournament', 'details');
  const out: Array<{
    tournamentId: string;
    year: string;
    fileName: string;
    filePath: string;
    detail: TournamentDetailData;
  }> = [];
  if (!fs.existsSync(detailsRoot)) return out;

  const tournamentDirs = fs
    .readdirSync(detailsRoot)
    .filter((n) => fs.statSync(path.join(detailsRoot, n)).isDirectory());

  for (const tournamentId of tournamentDirs) {
    const tournamentDir = path.join(detailsRoot, tournamentId);
    const yearDirs = fs
      .readdirSync(tournamentDir)
      .filter((n) => fs.statSync(path.join(tournamentDir, n)).isDirectory());

    for (const year of yearDirs) {
      const yearDir = path.join(tournamentDir, year);
      const files = fs.readdirSync(yearDir).filter((f) => f.endsWith('.json'));
      for (const f of files) {
        const filePath = path.join(yearDir, f);
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(raw) as TournamentDetailData;
          out.push({
            tournamentId,
            year,
            fileName: f,
            filePath,
            detail: parsed,
          });
        } catch {
          // ignore
        }
      }
    }
  }
  return out;
};
