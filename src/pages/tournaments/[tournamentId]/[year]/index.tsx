// src/pages/tournaments/[tournamentId]/[year]/index.tsx

import MetaHead from '@/components/MetaHead';
import { processTournamentData } from '@/lib/tournamentLogic';
import fs from 'fs';
import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import path from 'path';
import { useEffect, useState } from 'react';

import { getAllPlayers } from '@/lib/players';
import { PlayerInfo, TournamentMeta, TournamentYearData } from '@/types/index';

import MatchResults from '@/components/Tournament/MatchResults';
import Statistics from '@/components/Tournament/Statistics';
import TeamResults from '@/components/Tournament/TeamResults';

interface TournamentYearResultPageProps {
  year: string;
  meta: TournamentMeta;
  data: TournamentYearData;
  allPlayers: PlayerInfo[];
  unknownPlayers: Record<string, { firstName: string; lastName: string; team: string }>;
  hasEntries: boolean;
}

export default function TournamentYearResultPage({ year, meta, data, allPlayers, unknownPlayers, hasEntries }: TournamentYearResultPageProps) {
  const pageUrl = `https://softeni-pick.com/tournaments/${meta.id}/${year}`;

  const {
    sortedTeams,
    allNames,
    totalMatches,
    totalPlayers,
    uniqueTeams,
    totalGamesWon,
    totalGamesLost,
    rankedTeams,
  } = processTournamentData(data, allPlayers, unknownPlayers);

  const matches = data.matches ?? [];

  const [filter, setFilter] = useState<'all' | 'top8' | 'winners'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    if (q.length > 0) {
      setSuggestions(allNames.filter((name) => name.toLowerCase().includes(q)).slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }, [searchQuery, allNames]);

  return (
    <>
      <MetaHead
        title={`${meta.name} ${year}年 大会結果 | ソフトテニス情報`}
        description={`${meta.name} ${year}年の大会結果・試合成績を掲載。開催地や日程、選手ごとの成績も確認できます。`}
        url={pageUrl}
        type="article"
      />
      <Head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": `${meta.name} ${year}年 大会結果`,
            "author": { "@type": "Person", "name": "Softeni Pick" },
            "publisher": { "@type": "Organization", "name": "Softeni Pick" },
            "datePublished": new Date().toISOString().split('T')[0],
            "dateModified": new Date().toISOString().split('T')[0],
            "inLanguage": "ja",
            "mainEntityOfPage": { "@type": "WebPage", "@id": pageUrl },
            "description": `${meta.name} ${year}年 のソフトテニス大会結果を確認できます。過去の大会結果も掲載`,
          })
        }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://softeni-pick.com/" },
              { "@type": "ListItem", "position": 2, "name": "大会結果一覧", "item": "https://softeni-pick.com/tournaments" },
              { "@type": "ListItem", "position": 3, "name": `${meta.name} ${year}年`, "item": pageUrl }
            ]
          })
        }} />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">{meta.name} {year}年 大会結果</h1>
<p className="text-sm text-gray-600 dark:text-gray-300 mb-6 flex flex-wrap gap-4 items-center">
  <span>{data.location}</span>
  <span>{data.startDate}〜{data.endDate}</span>
  {hasEntries && (
    <Link
      href={`/tournaments/${meta.id}/${year}/data`}
      className="text-blue-600 hover:underline text-sm"
    >
      出場選手データ（JSON形式）
    </Link>
  )}
</p>

          <TeamResults sortedTeams={sortedTeams} />

          <div className="text-right mt-10 mb-2">
            <Link href="/tournaments" className="text-sm text-blue-500 hover:underline">
              大会結果一覧
            </Link>
          </div>

          {matches.length > 0 && (
            <>
              <Statistics
                totalPlayers={totalPlayers}
                uniqueTeams={uniqueTeams}
                totalMatches={totalMatches}
                totalGamesWon={totalGamesWon}
                totalGamesLost={totalGamesLost}
                rankedTeams={rankedTeams}
              />
              <MatchResults
                matches={matches}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                suggestions={suggestions}
                filter={filter}
                setFilter={setFilter}
              />
            </>
          )}
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const basePath = path.join(process.cwd(), 'data/tournaments');
  const tournamentDirs = fs.readdirSync(basePath);
  const paths: { params: { tournamentId: string; year: string } }[] = [];

  for (const tournamentId of tournamentDirs) {
    const tournamentDir = path.join(basePath, tournamentId);
    const yearDirs = fs
      .readdirSync(tournamentDir)
      .filter((name) =>
        /^\d{4}$/.test(name) &&
        fs.statSync(path.join(tournamentDir, name)).isDirectory()
      );
    for (const year of yearDirs) {
      const resultsPath = path.join(tournamentDir, year, 'results.json');
      if (!fs.existsSync(resultsPath)) continue;
      paths.push({ params: { tournamentId, year } });
    }
  }

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { tournamentId, year } = context.params as { tournamentId: string; year: string };
  const basePath = path.join(process.cwd(), 'data/tournaments');
  const playersPath = path.join(process.cwd(), 'data/players');
  const allPlayers = getAllPlayers();

  try {
    const meta = JSON.parse(fs.readFileSync(path.join(basePath, tournamentId, 'meta.json'), 'utf-8'));
    const data = JSON.parse(fs.readFileSync(path.join(basePath, tournamentId, year, 'results.json'), 'utf-8'));
    const unknownPlayers = JSON.parse(fs.readFileSync(path.join(playersPath, 'unknown.json'), 'utf-8'));

    const entriesPath = path.join(basePath, tournamentId, year, 'entries.json');
    const hasEntries = fs.existsSync(entriesPath);

    return {
      props: {
        year,
        meta,
        data,
        allPlayers,
        unknownPlayers,
        hasEntries,
      },
    };
  } catch (err) {
    console.error(err);
    return { notFound: true };
  }
};
