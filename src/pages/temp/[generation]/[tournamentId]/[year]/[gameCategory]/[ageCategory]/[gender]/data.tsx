// src/pages/temp/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/data.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import EntryOverview from '@/components/EntryOverview';
import MetaHead from '@/components/MetaHead';

interface EntryInfo {
  entryNo: number;
  information: {
    lastName: string;
    firstName: string;
    team: string;
    playerId?: string;
    tempId?: string;
    prefecture?: string;
  }[];
  team?: string;
  prefecture?: string;
  type?: string;
}

interface TournamentMeta {
  id: string;
  sortId: number;
  name: string;
  region: string;
  type: string;
  category: string;
  officialUrl?: string;
  isMajorTitle?: boolean;
  source?: string;
  sourceUrl?: string;
}

interface MatchResult {
  round: string;
  player1: { entryNo: number; won: number; lost: number };
  player2: { entryNo: number; won: number; lost: number };
  winner: number;
}

interface Props {
  generation: string;
  tournamentId: string;
  year: string;
  gameCategory: string;
  ageCategory: string;
  gender: string;
  entries: EntryInfo[];
  matches: MatchResult[] | null;
  meta: TournamentMeta;
}

export default function EntryDataPage({
  generation,
  tournamentId,
  year,
  gameCategory,
  ageCategory,
  gender,
  entries,
  matches,
  meta,
}: Props) {
  const jsonStr = JSON.stringify(entries, null, 2);

  return (
    <>
      <MetaHead
        title={`${meta.name} ${year} 大会データ（JSON形式） - ソフトテニス情報`}
        description={`${meta.name} ${year} 年の大会出場選手データを掲載。`}
        url={`https://softeni-pick.com/temp/${generation}/${tournamentId}/${year}/${gameCategory}/${ageCategory}/${gender}/data`}
        type="article"
      />

      <Head>
        <title>
          {meta.name} {year} 大会データ | ソフトテニス情報
        </title>
      </Head>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            {
              label: meta.name,
              href: `/temp/${generation}/${tournamentId}/${year}/${gameCategory}/${ageCategory}/${gender}`,
            },
            { label: '出場選手データ', href: '#' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-4">
          {meta.name} {year}年 出場選手データ
        </h1>

        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm max-h-[300px] overflow-auto whitespace-pre-wrap">
          {jsonStr}
        </pre>

        <button
          onClick={() => {
            navigator.clipboard.writeText(jsonStr);
            alert('クリップボードにコピーしました');
          }}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          JSONをコピー
        </button>

        {matches && (
          <>
            <h2 className="text-xl font-semibold mt-10 mb-2">対戦結果データ</h2>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm max-h-[300px] overflow-auto whitespace-pre-wrap">
              {JSON.stringify(matches, null, 2)}
            </pre>
          </>
        )}

        <EntryOverview entries={{ default: entries }} />

        <div className="mt-6">
          <Link
            href={`/temp/${generation}/${tournamentId}/${year}/${gameCategory}/${ageCategory}/${gender}`}
            className="text-sm text-blue-600 hover:underline"
          >
            大会結果ページ
          </Link>
        </div>
      </main>
    </>
  );
}

// ✅ 新しい Path 対応
export const getStaticPaths: GetStaticPaths = async () => {
  const baseDir = path.join(process.cwd(), 'data/temp');
  const generations = fs.readdirSync(baseDir);

  const paths: {
    params: {
      generation: string;
      tournamentId: string;
      year: string;
      gameCategory: string;
      ageCategory: string;
      gender: string;
    };
  }[] = [];

  for (const generation of generations) {
    const generationDir = path.join(baseDir, generation);
    const tournamentIds = fs.readdirSync(generationDir);

    for (const tid of tournamentIds) {
      const yearDir = path.join(generationDir, tid);
      if (!fs.statSync(yearDir).isDirectory()) continue;

      const years = fs.readdirSync(yearDir);
      for (const y of years) {
        // ここだけ置き換え
        const categoriesPath = path.join(yearDir, y, 'categories.json');
        if (!fs.existsSync(categoriesPath)) continue;

        const raw = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
        const categories: Array<{
          id?: string;
          label?: string;
          category: string; // "doubles" / "versus" など
          gender: string; // "boys" / "girls" など
          age?: string; // 無ければ general
        }> = Array.isArray(raw) ? raw : [];

        // categories.json が空/不正でも落ちないようにガード
        for (const c of categories) {
          if (!c || typeof c !== 'object') continue;

          const gameCategory = c.category;
          const gender = c.gender;
          const ageCategory = c.age && c.age.length > 0 ? c.age : 'general';

          if (!gameCategory || !gender) continue;

          paths.push({
            params: {
              generation,
              tournamentId: tid,
              year: y,
              gameCategory,
              ageCategory,
              gender,
            },
          });
        }
      }
    }
  }

  return { paths, fallback: false };
};

// ✅ 該当カテゴリの entries / matches 読み込み
export const getStaticProps: GetStaticProps = async (context) => {
  const { generation, tournamentId, year, gameCategory, ageCategory, gender } =
    context.params as {
      generation: string;
      tournamentId: string;
      year: string;
      gameCategory: string;
      ageCategory: string;
      gender: string;
    };

  const basePath = path.join(
    process.cwd(),
    'data/temp',
    generation,
    tournamentId,
    year,
  );

  const metaPath = path.join(path.dirname(basePath), 'meta.json');
  const meta: TournamentMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

  const categoryKey = `${gameCategory}-${ageCategory}-${gender}`;
  const entriesPath = path.join(basePath, 'entries', `${categoryKey}.json`);
  const matchesPath = path.join(basePath, 'matches', `${categoryKey}.json`);

  const entries = fs.existsSync(entriesPath)
    ? JSON.parse(fs.readFileSync(entriesPath, 'utf-8'))
    : [];
  const matches = fs.existsSync(matchesPath)
    ? JSON.parse(fs.readFileSync(matchesPath, 'utf-8'))
    : null;

  return {
    props: {
      generation,
      tournamentId,
      year,
      gameCategory,
      ageCategory,
      gender,
      entries,
      matches,
      meta,
    },
  };
};
