// src/pages/tournaments/highschool/[tournamentId]/[year]/index.tsx

import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { resultPriority } from '@/lib/utils';
import MetaHead from '@/components/MetaHead';
import { getAllPlayers } from '@/lib/players';
import {
  MatchOpponent,
  PlayerInfo,
  TournamentMeta,
  TournamentYearData,
} from '@/types/index';
import MatchResults from '@/components/Tournament/MatchResults';
import Statistics from '@/components/Tournament/Statistics';
import TeamResults from '@/components/Tournament/TeamResults';
import Breadcrumbs from '@/components/Breadcrumb';

type EntryInformation = {
  lastName: string;
  firstName: string;
  team: string;
  playerId?: string | null;
  tempId?: string;
  prefecture?: string;
};

type Entry = {
  entryNo: number;
  information: EntryInformation[];
};

type EntriesJson = {
  [category: string]: Entry[];
};

type StandingEntry = {
  id: number;
  name: string;
  wins: number;
  losses: number;
  points: number;
  scoreDiff: number;
  rank: number;
};

type StandingGroup = StandingEntry[];

type Standings = {
  [category: string]: {
    [groupName: string]: StandingGroup;
  };
};

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
}

export default function TournamentYearResultPage({
  year,
  meta,
  data,
  allPlayers,
  unknownPlayers,
  hasEntries,
}: TournamentYearResultPageProps) {
  const pageUrl = `https://softeni-pick.com/tournaments/highschool/${meta.id}/${year}`; //差分

  const tournamentMatches = data.matches ?? [];
  const roundRobinMatches = data.roundRobinMatches ?? [];

  const matches = [...roundRobinMatches, ...tournamentMatches];
  const results = data.results ?? [];

  const hasCategoryField =
    matches.some((m) => 'category' in m) ||
    results.some((r) => 'category' in r);

  const availableCategories = hasCategoryField
    ? Array.from(
      new Set([
        ...matches.map((m) => m.category).filter(Boolean),
        ...results.map((r) => r.category).filter(Boolean),
      ]),
    )
    : ['default'];

  const [selectedCategory, setSelectedCategory] = useState(
    availableCategories[0],
  );

  useEffect(() => {
    if (!hasCategoryField) return;
    const hash = window.location.hash.replace('#', '');
    if (availableCategories.includes(hash)) {
      setSelectedCategory(hash);
    }
  }, []);

  useEffect(() => {
    if (!hasCategoryField) return;
    history.replaceState(null, '', `#${selectedCategory}`);
  }, [selectedCategory]);

  const filteredMatches = hasCategoryField
    ? matches.filter((m) => m.category === selectedCategory)
    : matches;
  const filteredResults = hasCategoryField
    ? results.filter((r) => r.category === selectedCategory)
    : results;

  const tournamentMatchSet = new Set(
    tournamentMatches.map((m) => `${m.name}|${m.category ?? 'default'}`),
  );

  const roundRobinMatchSet = new Set(
    roundRobinMatches.map((m) => `${m.name}|${m.category ?? 'default'}`),
  );

  // RoundRobin にいて Tournament にいない = 予選敗退
  const eliminatedEntries = [...roundRobinMatchSet]
    .filter((key) => !tournamentMatchSet.has(key))
    .map((key) => {
      const [name, category] = key.split('|');
      return { name, result: '予選敗退', category };
    });

  const filteredEliminatedEntries = hasCategoryField
    ? eliminatedEntries.filter((e) => e.category === selectedCategory)
    : eliminatedEntries;

  const teamGroups: Record<
    string,
    {
      team: string;
      members: {
        result: string;
        resultOrder: number;
        displayParts: { text: string; id?: string; noLink?: boolean }[];
      }[];
      bestRank: number;
    }
  > = {};

  for (const entry of filteredResults) {
    const players = entry.playerIds.map((id) => {
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

      if (!teamGroups[team]) {
        teamGroups[team] = { team, members: [], bestRank: resultOrder };
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
        if (!teamGroups[p.team]) {
          teamGroups[p.team] = {
            team: p.team,
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

  const allNames = [...new Set(matches.map((m) => m.name))];
  const totalMatches = filteredMatches.filter((m) => m.result === 'win').length;

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
    for (const match of filteredMatches) {
      for (const op of match.opponents) {
        if (op.playerId === id || op.tempId === id) return op;
      }
    }
    return null;
  }

  for (const match of filteredMatches) {
    if (match.result === 'win') {
      const won = parseInt(match.games.won, 10);
      const lost = parseInt(match.games.lost, 10);
      if (!isNaN(won)) totalGamesWon += won;
      if (!isNaN(lost)) totalGamesLost += lost;
    }
    for (const id of match.pair) {
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
                href: `/tournaments/highschool/${meta.id}/${year}`,
              }, // ✅ 差分
            ]}
          />

          <h1
            id={hasCategoryField ? selectedCategory : undefined}
            className="text-2xl font-bold mb-4"
          >
            {meta.name} {year}年
            {hasCategoryField
              ? selectedCategory === 'singles'
                ? ' シングルス'
                : selectedCategory === 'doubles'
                  ? ' ダブルス'
                  : ` ${selectedCategory}`
              : ''}{' '}
            大会結果
          </h1>

          <section className="mb-6 px-1">
            <p className="text-lg leading-relaxed mb-2">
              {meta.name}は、{meta.category}
              カテゴリの主要大会として、全国の強豪選手が集結する注目の大会です。
              本ページでは{year}
              年に開催された本大会の試合結果、出場チーム別の成績、対戦情報などを掲載しています。
            </p>
            {data.location && data.startDate && data.endDate && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                開催地：{data.location} ／ 日程：{data.startDate}〜
                {data.endDate}
              </p>
            )}
            {hasEntries && (
              <p className="mt-2 text-sm">
                <Link
                  href={`/tournaments/highschool/${meta.id}/${year}/data`}
                  className="text-blue-600 hover:underline"
                >
                  ▶ 出場選手データ（JSON形式）
                </Link>
              </p>
            )}
          </section>

          {hasCategoryField && availableCategories.length > 1 && (
            <div className="flex gap-4 mb-6">
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  className={`px-4 py-2 rounded ${cat === selectedCategory ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <a href={`#${cat}`}>
                    {cat === 'singles'
                      ? 'シングルス'
                      : cat === 'doubles'
                        ? 'ダブルス'
                        : cat}
                  </a>
                </button>
              ))}
            </div>
          )}

          <TeamResults sortedTeams={sortedTeams} />

          <div className="text-right mt-10 mb-2">
            <Link
              href="/tournaments"
              className="text-sm text-blue-500 hover:underline"
            >
              大会結果一覧
            </Link>
          </div>

          {filteredMatches.length > 0 && (
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
                matches={filteredMatches}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                suggestions={suggestions}
                filter={filter}
                setFilter={setFilter}
                eliminatedEntries={filteredEliminatedEntries}
              />
            </>
          )}
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const basePath = path.join(process.cwd(), 'data/tournaments/highschool'); // ✅ 修正済み
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
  const basePath = path.join(process.cwd(), 'data/tournaments/highschool');
  const playersPath = path.join(process.cwd(), 'data/players');
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

    const entriesByCategory: Record<
      string,
      { entryNo: number; playerIds: string[] }[]
    > = {};
    if (hasEntries) {
      const raw: EntriesJson = JSON.parse(fs.readFileSync(entriesPath, 'utf-8'));

      for (const category of Object.keys(raw)) {
        entriesByCategory[category] = raw[category].map((e) => ({
          entryNo: Number(e.entryNo),
          playerIds: (e.information ?? [])
            .map((info) => info.playerId || info.tempId)
            .filter((id): id is string => typeof id === 'string'),
        }));
      }
    }

    // ✅ standings → "予選敗退" 処理（カテゴリ別に対応）
    if (data.standings && data.results) {
      const existingKeySet = new Set(
        (data.results as { playerIds: string[] }[]).map((r) =>
          r.playerIds.join(','),
        ),
      );
      const standings: Standings = data.standings;

      for (const category of Object.keys(standings)) {
        const groups = standings[category];
        const entries = entriesByCategory[category] ?? [];

        for (const group of Object.values(groups)) {
          for (const entry of group) {
            const entryNo = Number(entry.id);
            const matchedEntry = entries.find((e) => e.entryNo === entryNo);
            if (!matchedEntry || matchedEntry.playerIds.length === 0) continue;

            const key = matchedEntry.playerIds.join(',');
            const alreadyExists = existingKeySet.has(key);

            if (!alreadyExists && entry.rank > 1) {
              data.results.push({
                playerIds: matchedEntry.playerIds,
                result: '予選敗退',
                category: category,
              });
              existingKeySet.add(key);
            }
          }
        }
      }
    }

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
