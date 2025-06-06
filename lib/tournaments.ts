import { TournamentSummary } from '@/types/index';
import fs from 'fs';
import path from 'path';

export const getAllTournaments = (): TournamentSummary[] => {
  const tournamentsPath = path.join(process.cwd(), 'data', 'tournaments');
  const tournamentDirs = fs.readdirSync(tournamentsPath);

  const allTournaments = tournamentDirs.map((tournamentId) => {
    const metaPath = path.join(tournamentsPath, tournamentId, 'meta.json');
    const tournamentDir = path.join(tournamentsPath, tournamentId);
    const yearDirs = fs
      .readdirSync(tournamentDir)
      .filter((name) =>
        /^\d{4}$/.test(name) &&
        fs.statSync(path.join(tournamentDir, name)).isDirectory()
      );

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    const years = yearDirs.map((year) => {
      const data = JSON.parse(
        fs.readFileSync(
          path.join(tournamentDir, year, 'results.json'),
          'utf-8'
        )
      );
      return { year, ...data };
    });

    return {
      id: tournamentId,
      meta,
      years,
    };
  });

  return allTournaments;
};
