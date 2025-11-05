// pages/api/tournaments/index.ts
import fs from 'fs';
import path from 'path';

import { NextApiRequest, NextApiResponse } from 'next';

interface TournamentMeta {
  id: string;
  name: string;
  generation: string;
  categoryTypes: string[];
  isMajorTitle: boolean;
  officialUrl?: string;
}

interface TournamentYearMeta {
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

interface TournamentOption {
  id: string;
  name: string;
  meta: TournamentMeta;
  yearMeta: TournamentYearMeta;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tournamentsDir = path.join(process.cwd(), 'data/tournaments');
    const generations = fs
      .readdirSync(tournamentsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    const tournaments: TournamentOption[] = [];

    for (const generation of generations) {
      const generationDir = path.join(tournamentsDir, generation);

      try {
        const tournamentDirs = fs
          .readdirSync(generationDir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);

        for (const tournamentId of tournamentDirs) {
          const tournamentDir = path.join(generationDir, tournamentId);
          const metaPath = path.join(tournamentDir, 'meta.json');

          // meta.jsonが存在するかチェック
          if (!fs.existsSync(metaPath)) continue;

          try {
            const meta: TournamentMeta = JSON.parse(
              fs.readFileSync(metaPath, 'utf8'),
            );

            // 年度フォルダーを取得
            const yearDirs = fs
              .readdirSync(tournamentDir, { withFileTypes: true })
              .filter(
                (dirent) => dirent.isDirectory() && /^\d{4}$/.test(dirent.name),
              )
              .map((dirent) => dirent.name)
              .sort((a, b) => parseInt(b) - parseInt(a)); // 新しい年度順

            for (const year of yearDirs) {
              const yearDir = path.join(tournamentDir, year);
              const yearMetaPath = path.join(yearDir, 'meta.json');
              const categoriesPath = path.join(yearDir, 'categories.json');

              // 必要なファイルが存在するかチェック
              if (
                !fs.existsSync(yearMetaPath) ||
                !fs.existsSync(categoriesPath)
              )
                continue;

              try {
                const yearMeta: TournamentYearMeta = JSON.parse(
                  fs.readFileSync(yearMetaPath, 'utf8'),
                );

                tournaments.push({
                  id: `${tournamentId}-${year}`,
                  name: `${meta.name} ${year}`,
                  meta,
                  yearMeta,
                });
              } catch (error) {
                console.warn(
                  `Failed to parse year meta for ${tournamentId}/${year}:`,
                  error,
                );
              }
            }
          } catch (error) {
            console.warn(`Failed to parse meta for ${tournamentId}:`, error);
          }
        }
      } catch (error) {
        console.warn(
          `Failed to read generation directory ${generation}:`,
          error,
        );
      }
    }

    res.status(200).json({ tournaments });
  } catch (error) {
    console.error('Failed to fetch tournaments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
