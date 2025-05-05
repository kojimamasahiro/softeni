// ディレクトリ構成:
// src/pages/tournaments/[tournamentId]/[year].tsx

import fs from 'fs';
import path from 'path';
import { GetStaticPaths, GetStaticProps } from 'next';
import metaData from '@/data/tournaments/zennihon-indoor/meta.json';

interface Result {
  playerIds: string[];
  result: string;
}

interface TournamentYearData {
  status: string;
  startDate: string;
  endDate: string;
  location: string;
  url?: string;
  results: Result[];
}

const players: Record<string, string> = {
  'uchimoto-takafumi': '内本隆文',
  'uchida-riku': '内田理久',
  'hirooka-sora': '廣岡宙',
  'nagae-koichi': '長江光一',
  'uematsu-toshiki': '上松俊貴',
  'kawabata-kohei': '川端晃平',
  'kataoka-aki': '片岡暁',
  'kurosaka-takuya': '黒坂拓也',
};

export default function TournamentYearResultPage({
  tournamentId,
  year,
  meta,
  data
}: {
  tournamentId: string;
  year: string;
  meta: typeof metaData;
  data: TournamentYearData;
}) {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold mb-2">{meta.name} {year}年 結果</h1>
      <p className="text-sm text-gray-500 mb-4">
        開催地: {data.location} / 日程: {data.startDate}〜{data.endDate}
      </p>

      <ul className="space-y-3">
        {data.results.map((entry, i) => (
          <li key={i} className="bg-white dark:bg-gray-800 shadow p-4 rounded">
            <div className="text-lg font-semibold">{entry.result}</div>
            <div className="text-gray-700 dark:text-gray-300">
              {entry.playerIds.map(id => players[id] || id).join('・')}
            </div>
          </li>
        ))}
      </ul>

      {data.url && (
        <p className="mt-6 text-sm text-blue-600 underline">
          <a href={data.url} target="_blank" rel="noopener noreferrer">
            大会詳細を見る
          </a>
        </p>
      )}
    </section>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
    const basePath = path.join(process.cwd(), 'data/tournaments');
    const tournamentDirs = fs.readdirSync(basePath);
  
    const paths: { params: { tournamentId: string; year: string } }[] = [];
  
    for (const tournamentId of tournamentDirs) {
      const yearsPath = path.join(basePath, tournamentId, 'years');
      if (!fs.existsSync(yearsPath)) continue;
  
      const yearFiles = fs.readdirSync(yearsPath).filter(file => file.endsWith('.json'));
      for (const file of yearFiles) {
        const year = file.replace('.json', '');
        paths.push({ params: { tournamentId, year } });
      }
    }
  
    return {
      paths,
      fallback: false
    };
  };

  export const getStaticProps: GetStaticProps = async (context) => {
    const { tournamentId, year } = context.params as { tournamentId: string; year: string };
  
    const basePath = path.join(process.cwd(), 'data/tournaments');
  
    try {
      const meta = JSON.parse(
        fs.readFileSync(path.join(basePath, tournamentId, 'meta.json'), 'utf-8')
      );
      const data = JSON.parse(
        fs.readFileSync(path.join(basePath, tournamentId, 'years', `${year}.json`), 'utf-8')
      );
  
      return {
        props: {
          tournamentId,
          year,
          meta,
          data
        }
      };
    } catch (err) {
      console.error(err);
      return { notFound: true };
    }
  };
  
