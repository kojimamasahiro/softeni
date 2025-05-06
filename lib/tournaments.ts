import { TournamentSummary } from '@/types/index';
import fs from 'fs';
import path from 'path';

export const getAllTournaments = (): TournamentSummary[] => {
  const tournamentsPath = path.join(process.cwd(), 'data', 'tournaments');
  const tournamentDirs = fs.readdirSync(tournamentsPath);

  const allTournaments = tournamentDirs.map((tournamentId) => {
    const metaPath = path.join(tournamentsPath, tournamentId, 'meta.json');
    const yearsPath = path.join(tournamentsPath, tournamentId, 'years');
    const yearFiles = fs.readdirSync(yearsPath);

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    const years = yearFiles.map((file) => {
      const year = file.replace('.json', '');
      const data = JSON.parse(fs.readFileSync(path.join(yearsPath, file), 'utf-8'));
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
