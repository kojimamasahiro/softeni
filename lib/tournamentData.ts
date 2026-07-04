// Avoid top-level imports of Node built-ins so this module can be imported
// from client-side code without causing bundler resolution errors. Use
// dynamic imports of 'fs' and 'path' inside server-only functions.
import type { TournamentDetailData, TournamentIndexEntry, TournamentInformationEntry } from '@/types/tournament';

type DetailRecord = {
  tournamentId: string;
  year: string;
  fileName: string;
  filePath: string;
  detail: TournamentDetailData;
  name?: string;
  tournamentName?: string;
  generation?: string;
};

type TournamentDataCacheEntry = {
  tournamentIndex?: Promise<TournamentIndexEntry[]>;
  informationMap?: Promise<Map<string, TournamentInformationEntry[]>>;
  detailRecords?: Promise<DetailRecord[]>;
  generations?: Promise<GenerationEntry[]>;
};

const tournamentDataCache = new Map<string, TournamentDataCacheEntry>();

const getCacheEntry = (root?: string): TournamentDataCacheEntry => {
  const cwd = root || process.cwd();
  let cacheEntry = tournamentDataCache.get(cwd);
  if (!cacheEntry) {
    cacheEntry = {};
    tournamentDataCache.set(cwd, cacheEntry);
  }
  return cacheEntry;
};

// Load tournament index.json and local_index.json as array
export const loadTournamentIndex = async (root?: string): Promise<TournamentIndexEntry[]> => {
  const cacheEntry = getCacheEntry(root);
  if (cacheEntry.tournamentIndex) {
    return cacheEntry.tournamentIndex;
  }

  // Dynamically import Node built-ins so this module can be used in
  // environments where top-level 'fs' is not available to the bundler.
  cacheEntry.tournamentIndex = (async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cwd = root || process.cwd();

    let result: TournamentIndexEntry[] = [];

    // 1. data/tournaments/index.json
    const indexPath = path.join(cwd, 'data', 'tournaments', 'index.json');
    if (fs.existsSync(indexPath)) {
      try {
        const raw = fs.readFileSync(indexPath, 'utf-8');
        const data = JSON.parse(raw) as TournamentIndexEntry[];
        if (Array.isArray(data)) result = result.concat(data);
      } catch {
        // ignore
      }
    }

    // 2. data/tournaments/local_index.json
    const localIndexPath = path.join(cwd, 'data', 'tournaments', 'local_index.json');
    if (fs.existsSync(localIndexPath)) {
      try {
        const raw = fs.readFileSync(localIndexPath, 'utf-8');
        const data = JSON.parse(raw) as TournamentIndexEntry[];
        if (Array.isArray(data)) result = result.concat(data);
      } catch {
        // ignore
      }
    }

    return result;
  })();

  return cacheEntry.tournamentIndex;
};

// Load all information/*.json files into a map keyed by tournamentId
export const loadInformationMap = async (root?: string): Promise<Map<string, TournamentInformationEntry[]>> => {
  const cacheEntry = getCacheEntry(root);
  if (cacheEntry.informationMap) {
    return cacheEntry.informationMap;
  }

  cacheEntry.informationMap = (async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cwd = root || process.cwd();
    const informationRoot = path.join(cwd, 'data', 'tournaments', 'information');
    const map = new Map<string, TournamentInformationEntry[]>();
    if (!fs.existsSync(informationRoot)) return map;

    const files = fs.readdirSync(informationRoot).filter((f: string) => f.endsWith('.json'));

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
  })();

  return cacheEntry.informationMap;
};

// Return all detail files as records containing tournamentId, year and parsed detail
export const getAllDetailRecords = async (root?: string): Promise<DetailRecord[]> => {
  const cacheEntry = getCacheEntry(root);
  if (cacheEntry.detailRecords) {
    return cacheEntry.detailRecords;
  }

  cacheEntry.detailRecords = (async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cwd = root || process.cwd();
    const detailsRoot = path.join(cwd, 'data', 'tournaments', 'details');
    const out: DetailRecord[] = [];
    if (!fs.existsSync(detailsRoot)) return out;
    // Build a map of tournamentId -> TournamentIndexEntry so we can attach
    // generation and human-friendly label to detail objects.
    const index = await loadTournamentIndex(root);
    const indexMap = new Map<string, TournamentIndexEntry>();
    for (const it of index) {
      if (it && it.tournamentId) indexMap.set(it.tournamentId, it);
    }

    const tournamentDirs = fs.readdirSync(detailsRoot).filter((n: string) => fs.statSync(path.join(detailsRoot, n)).isDirectory());

    for (const tournamentId of tournamentDirs) {
      const tournamentDir = path.join(detailsRoot, tournamentId);
      const yearDirs = fs.readdirSync(tournamentDir).filter((n: string) => fs.statSync(path.join(tournamentDir, n)).isDirectory());

      for (const year of yearDirs) {
        const yearDir = path.join(tournamentDir, year);
        const files = fs.readdirSync(yearDir).filter((f: string) => f.endsWith('.json'));
        for (const f of files) {
          const filePath = path.join(yearDir, f);
          try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw) as TournamentDetailData;
            // declared TournamentDetailData type.
            try {
              const idx = indexMap.get(tournamentId);
              const gen = idx?.generationId ?? 'all';
              const label = idx?.label;
              out.push({
                tournamentId,
                year,
                fileName: f,
                filePath,
                detail: parsed,
                tournamentName: label,
                generation: gen,
              });
            } catch {
              // ignore any attach errors
            }
          } catch {
            // ignore
          }
        }
      }
    }
    return out;
  })();

  return cacheEntry.detailRecords;
};

// Generation entry stored in data/tournament/generations.json
export interface GenerationEntry {
  generationId: string;
  label: string;
}

// Load generations.json which contains an array of generation entries.
export const loadGenerations = async (root?: string): Promise<GenerationEntry[]> => {
  const cacheEntry = getCacheEntry(root);
  if (cacheEntry.generations) {
    return cacheEntry.generations;
  }

  cacheEntry.generations = (async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cwd = root || process.cwd();
    const genPath = path.join(cwd, 'data', 'tournaments', 'generations.json');
    if (!fs.existsSync(genPath)) return [];
    try {
      const raw = fs.readFileSync(genPath, 'utf-8');
      return JSON.parse(raw) as GenerationEntry[];
    } catch {
      return [];
    }
  })();

  return cacheEntry.generations;
};

// Convenience lookup by id. Returns undefined if not found.
export const getGenerationById = async (generationId: string, root?: string): Promise<GenerationEntry | undefined> => {
  const gens = await loadGenerations(root);
  return gens.find((g) => g.generationId === generationId);
};
