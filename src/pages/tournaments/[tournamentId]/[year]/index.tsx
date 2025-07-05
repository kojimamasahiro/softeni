// src/pages/tournaments/[tournamentId]/[year]/index.tsx

import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import MatchResults from '@/components/Tournament/MatchResults';
import Statistics from '@/components/Tournament/Statistics';
import TeamResults from '@/components/Tournament/TeamResults';
import { getAllPlayers } from '@/lib/players';
import { resultPriority } from '@/lib/utils';
import {
  MatchOpponent,
  PlayerInfo,
  TournamentMeta,
  TournamentYearData,
} from '@/types/index';

interface TournamentYearResultPageProps {
  year: string;
  meta: TournamentMeta;
  data: TournamentYearData;
  allPlayers: PlayerInfo[];
  unknownPlayers: Record<
    string,
    { firstName: string; lastName: string; team: string }
  >;
  hasEntries: boolean;
  teamMap: Record<string, { teamId: string; prefectureId: string }>;
  highlight: string | null;
}

export default function TournamentYearResultPage({
  year,
  meta,
  data,
  allPlayers,
  unknownPlayers,
  hasEntries,
  teamMap,
  highlight,
}: TournamentYearResultPageProps) {
  const pageUrl = `https://softeni-pick.com/tournaments/${meta.id}/${year}`;

  const teamGroups: Record<
    string,
    {
      team: string;
      teamId: string;
      prefectureId: string;
      members: {
        result: string;
        resultOrder: number;
        displayParts: { text: string; id?: string; noLink?: boolean }[];
      }[];
      bestRank: number;
    }
  > = {};

  for (const entry of data.results ?? []) {
    const players = (entry.playerIds ?? []).map((id) => {
      const player = allPlayers.find((p) => p.id === id);
      if (player) {
        return {
          id,
          name: `${player.lastName}${player.firstName}`,
          team: player.team ?? '所属不明',
          noLink: false,
        };
      } else {
        const unknown = unknownPlayers[id];
        return {
          id,
          name: unknown ? `${unknown.lastName}${unknown.firstName}` : id,
          team: unknown?.team ?? '所属不明',
          noLink: true,
        };
      }
    });

    const resultOrder = resultPriority(entry.result);

    if (players.length === 1 || players[0].team === players[1].team) {
      const team = players[0].team;
      const displayParts = players.flatMap((p, i) => [
        { text: p.name, id: p.noLink ? undefined : p.id, noLink: p.noLink },
        ...(i < players.length - 1 ? [{ text: '・' }] : []),
      ]);

      const extra = teamMap[team] ?? { teamId: '', prefectureId: '' };

      if (!teamGroups[team]) {
        teamGroups[team] = {
          team,
          teamId: extra.teamId,
          prefectureId: extra.prefectureId,
          members: [],
          bestRank: resultOrder,
        };
      }
      teamGroups[team].members.push({
        result: entry.result,
        resultOrder,
        displayParts,
      });
      teamGroups[team].bestRank = Math.min(
        teamGroups[team].bestRank,
        resultOrder,
      );
    } else {
      for (const p of players) {
        const displayParts = [
          { text: p.name, id: p.noLink ? undefined : p.id, noLink: p.noLink },
        ];
        const extra = teamMap[p.team] ?? { teamId: '', prefectureId: '' };

        if (!teamGroups[p.team]) {
          teamGroups[p.team] = {
            team: p.team,
            teamId: extra.teamId,
            prefectureId: extra.prefectureId,
            members: [],
            bestRank: resultOrder,
          };
        }
        teamGroups[p.team].members.push({
          result: entry.result,
          resultOrder,
          displayParts,
        });
        teamGroups[p.team].bestRank = Math.min(
          teamGroups[p.team].bestRank,
          resultOrder,
        );
      }
    }
  }

  const sortedTeams = Object.values(teamGroups).sort((a, b) => {
    if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
    return a.team.localeCompare(b.team, 'ja');
  });

  const matches = data.matches ?? [];
  const allNames = [...new Set(matches.map((m) => m.name))];
  const totalMatches = matches.filter((m) => m.result === 'win').length;

  const [filter, setFilter] = useState<'all' | 'top8' | 'winners'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    if (q.length > 0) {
      setSuggestions(
        allNames.filter((name) => name.toLowerCase().includes(q)).slice(0, 5),
      );
    } else {
      setSuggestions([]);
    }
  }, [searchQuery]);

  const seenPlayers = new Set<string>();
  const teamCounter: Record<string, number> = {};
  let totalGamesWon = 0;
  let totalGamesLost = 0;

  function findOpponentById(id: string): MatchOpponent | null {
    for (const match of matches) {
      for (const op of match.opponents ?? []) {
        if (op.playerId === id || op.tempId === id) return op;
      }
    }
    return null;
  }

  for (const match of matches) {
    if (match.result === 'win') {
      const won = parseInt(match.games.won, 10);
      const lost = parseInt(match.games.lost, 10);
      if (!isNaN(won)) totalGamesWon += won;
      if (!isNaN(lost)) totalGamesLost += lost;
    }
    for (const id of match.pair ?? []) {
      if (!seenPlayers.has(id)) {
        const player = findOpponentById(id);
        if (player?.team) {
          teamCounter[player.team] = (teamCounter[player.team] || 0) + 1;
          seenPlayers.add(id);
        }
      }
    }
  }

  const totalPlayers = seenPlayers.size;
  const uniqueTeams = Object.keys(teamCounter).length;
  const sorted = Object.entries(teamCounter).sort((a, b) => b[1] - a[1]);
  const rankedTeams: { rank: number; team: string; count: number }[] = [];
  let currentRank = 1;
  let prevCount: number | null = null;
  let offset = 0;

  for (let i = 0; i < sorted.length; i++) {
    const [team, count] = sorted[i];
    if (count === prevCount) {
      offset++;
    } else {
      currentRank = i + 1 + offset;
      offset = 0;
    }
    rankedTeams.push({ rank: currentRank, team, count });
    prevCount = count;
  }

  return (
    <>
      <MetaHead
        title={`${meta.name} ${year}年 大会結果 | ソフトテニス情報`}
        description={`${meta.name} ${year}年の大会結果・試合成績を掲載。開催地や日程、選手ごとの成績も確認できます。`}
        url={pageUrl}
        type="article"
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: `${meta.name} ${year}年 大会結果`,
              author: { '@type': 'Person', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
              description: `${meta.name} ${year}年 のソフトテニス大会結果を確認できます。過去の大会結果も掲載`,
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'ホーム',
                  item: 'https://softeni-pick.com/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: '大会結果一覧',
                  item: 'https://softeni-pick.com/tournaments',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: `${meta.name} ${year}年`,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: '大会結果一覧', href: '/tournaments' },
              {
                label: `${meta.name} ${year}年`,
                href: `/tournaments/${meta.id}/${year}`,
              },
            ]}
          />

          {/* ✅ h1 + 大会紹介文 */}
          <h1 className="text-2xl font-bold mb-4">
            {meta.name} {year}年 大会結果
          </h1>
          <section className="mb-6 px-1">
            {data.location && data.startDate && data.endDate && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                開催地：{data.location} ／ 日程：{data.startDate}〜
                {data.endDate}
              </p>
            )}
            {hasEntries && (
              <p className="mt-2 text-sm">
                <Link
                  href={`/tournaments/${meta.id}/${year}/data`}
                  className="text-blue-600 hover:underline"
                >
                  ▶ 出場選手データ（JSON形式）
                </Link>
              </p>
            )}
            {highlight && (
              <section className="mt-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-1">大会ハイライト</h2>
                {highlight.split('\n').map((line, i) => (
                  <p key={i} className="mb-1 inline-block">
                    {line}
                  </p>
                ))}
              </section>
            )}
          </section>

          {/* ✅ チーム別成績 */}
          <TeamResults sortedTeams={sortedTeams} />

          <div className="text-right mt-10 mb-2">
            <Link
              href="/tournaments"
              className="text-sm text-blue-500 hover:underline"
            >
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
                eliminatedEntries={[]}
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

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { tournamentId, year } = context.params as {
    tournamentId: string;
    year: string;
  };
  const basePath = path.join(process.cwd(), 'data/tournaments');
  const playersPath = path.join(process.cwd(), 'data/players');
  const highschoolDataPath = path.join(process.cwd(), 'data/highschool');
  const allPlayers = getAllPlayers();

  try {
    const meta = JSON.parse(
      fs.readFileSync(path.join(basePath, tournamentId, 'meta.json'), 'utf-8'),
    );
    const data = JSON.parse(
      fs.readFileSync(
        path.join(basePath, tournamentId, year, 'results.json'),
        'utf-8',
      ),
    );
    const unknownPlayers = JSON.parse(
      fs.readFileSync(path.join(playersPath, 'unknown.json'), 'utf-8'),
    );

    const entriesPath = path.join(basePath, tournamentId, year, 'entries.json');
    const hasEntries = fs.existsSync(entriesPath);
    const teamsPath = path.join(highschoolDataPath, 'teams.json');
    const teamList: {
      id: string;
      name: string;
      prefecture: string;
      prefectureId: string;
    }[] = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));

    const teamMap = Object.fromEntries(
      teamList.map((t) => [
        t.name,
        { teamId: t.id, prefectureId: t.prefectureId },
      ]),
    );

    const highlight: string | null = data.highlight ?? null;

    return {
      props: {
        year,
        meta,
        data,
        allPlayers,
        unknownPlayers,
        hasEntries,
        teamMap,
        highlight,
      },
    };
  } catch (err) {
    console.error(err);
    return { notFound: true };
  }
};
