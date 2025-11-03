// pages/api/tournaments/[tournamentId]/categories.ts
import fs from 'fs';
import path from 'path';

import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tournamentId } = req.query;

  if (!tournamentId || typeof tournamentId !== 'string') {
    return res.status(400).json({ error: 'Tournament ID is required' });
  }

  try {
    // tournamentId の形式: "highschool-championship-2024"
    const parts = tournamentId.split('-');
    if (parts.length < 3) {
      return res.status(400).json({ error: 'Invalid tournament ID format' });
    }

    const year = parts[parts.length - 1];
    const tournamentPath = parts.slice(0, -1).join('-');

    // 世代ディレクトリを検索
    const tournamentsDir = path.join(process.cwd(), 'data/tournaments');
    const generations = fs
      .readdirSync(tournamentsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    let categoriesPath: string | null = null;

    // 該当する大会を検索
    for (const generation of generations) {
      const tournamentDir = path.join(
        tournamentsDir,
        generation,
        tournamentPath,
        year,
      );
      const testCategoriesPath = path.join(tournamentDir, 'categories.json');

      if (fs.existsSync(testCategoriesPath)) {
        categoriesPath = testCategoriesPath;
        break;
      }
    }

    if (!categoriesPath) {
      return res.status(404).json({ error: 'Tournament categories not found' });
    }

    // categories.json を読み込み
    const categoriesData = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));

    res.status(200).json({ categories: categoriesData });
  } catch (error) {
    console.error('Failed to fetch tournament categories:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
