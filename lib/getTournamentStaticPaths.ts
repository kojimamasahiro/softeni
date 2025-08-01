// lib/getTournamentStaticPaths.ts
import fs from 'fs';
import path from 'path';

export function getTournamentStaticPaths(basePath: string) {
  const paths: { params: { tournamentId: string; year: string } }[] = [];

  const tournamentDirs = fs.readdirSync(basePath);

  for (const tournamentId of tournamentDirs) {
    const tournamentDir = path.join(basePath, tournamentId);
    const yearDirs = fs
      .readdirSync(tournamentDir)
      .filter(
        (name) =>
          /^\d{4}$/.test(name) &&
          fs.statSync(path.join(tournamentDir, name)).isDirectory(),
      );

    for (const year of yearDirs) {
      const resultsPath = path.join(tournamentDir, year, 'results.json');
      if (!fs.existsSync(resultsPath)) continue;
      paths.push({ params: { tournamentId, year } });
    }
  }

  return paths;
}
