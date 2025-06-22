import { TournamentSummary } from '@/types/index';
import fs from 'fs';
import path from 'path';

export const getAllTournaments = (): TournamentSummary[] => {
  const tournamentsPath = path.join(process.cwd(), 'data', 'tournaments');
  const tournamentDirs = fs.readdirSync(tournamentsPath);

  const allTournaments: TournamentSummary[] = [];

  for (const tournamentId of tournamentDirs) {
    const tournamentDir = path.join(tournamentsPath, tournamentId);
    const metaPath = path.join(tournamentDir, 'meta.json');

    // meta.jsonがなければスキップ（中間フォルダ対応）
    if (!fs.existsSync(metaPath)) continue;

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

    const yearDirs = fs
      .readdirSync(tournamentDir)
      .filter((name) =>
        /^\d{4}$/.test(name) &&
        fs.statSync(path.join(tournamentDir, name)).isDirectory()
      );

    const years = yearDirs.map((year) => {
      const data = JSON.parse(
        fs.readFileSync(
          path.join(tournamentDir, year, 'results.json'),
          'utf-8'
        )
      );
      return { year, ...data };
    });

    allTournaments.push({
      id: tournamentId,
      meta,
      years,
    });
  }

  return allTournaments;
};
