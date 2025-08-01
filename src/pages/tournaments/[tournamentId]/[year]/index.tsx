// src/pages/tournaments/[tournamentId]/[year]/index.tsx

import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import MatchResults from '@/components/Tournament/MatchResults';
import TeamResults from '@/components/Tournament/TeamResults';
import { getTournamentStaticPaths } from '@/lib/getTournamentStaticPaths';
import { getTournamentStaticProps } from '@/lib/getTournamentStaticProps';
import { resultPriority } from '@/lib/utils';
import { EntryInfo } from '@/types/entry';
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
  entries: EntryInfo[] | null;
  teamMap: Record<string, { teamId: string; prefectureId: string }>;
  highlight: string | null;
  otherYears: string[];
}

export default function TournamentYearResultPage({
  year,
  meta,
  data,
  allPlayers,
  unknownPlayers,
  entries,
  teamMap,
  highlight,
  otherYears,
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
    if ('playerIds' in entry) {
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
          const [lastName = '', firstName = '', team = '所属不明'] =
            id.split('_');
          const unknown = unknownPlayers[id];
          return {
            id,
            name: unknown
              ? `${unknown.lastName}${unknown.firstName}`
              : `${lastName}${firstName}`,
            team: unknown?.team ?? team,
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
    } else if ('team' in entry && typeof entry.team === 'string') {
      const team = entry.team;
      const resultOrder = resultPriority(entry.result);
      const displayParts = [{ text: team, noLink: true }];
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
    }
  }

  const sortedTeams = Object.values(teamGroups).sort((a, b) => {
    if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
    return a.team.localeCompare(b.team, 'ja');
  });

  const matches = useMemo(() => data.matches ?? [], [data.matches]);
  const allNames = useMemo(
    () => [...new Set(matches.map((m) => m.name))],
    [matches],
  );

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
  }, [searchQuery, allNames]);

  const seenPlayers = new Set<string>();
  const teamCounter: Record<string, number> = {};

  function findOpponentById(id: string): MatchOpponent | null {
    for (const match of matches) {
      for (const op of match.opponents ?? []) {
        if (op.playerId === id || op.tempId === id) return op;
      }
    }
    return null;
  }

  for (const match of matches) {
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

  const seedEntryNos = new Set<number>();

  for (const entry of entries ?? []) {
    if (entry.type === 'seed') {
      seedEntryNos.add(entry.entryNo);
    }
  }

  return (
    <>
      <MetaHead
        title={`${meta.name} ${year}年 大会結果 | ソフトテニス情報`}
        description={`${meta.name} ${year}年の大会結果・試合成績を掲載。開催地や日程、選手ごとの成績も確認できます。`}
        url={pageUrl}
        image={`https://softeni-pick.com/api/og/tournament/${meta.id}/${year}`}
        twitterCardType="summary_large_image"
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
            {entries && entries.length > 0 && (
              <p className="mt-2 text-sm">
                <Link
                  href={`/tournaments/${meta.id}/${year}/data`}
                  className="text-blue-600 hover:underline"
                >
                  ▶ 出場選手データ
                </Link>
              </p>
            )}
            {otherYears.length > 0 && (
              <section className="mt-4 mb-8 rounded-lg">
                <h3 className="text-l font-semi mb-2">他年度の大会結果</h3>
                <div className="space-y-8">
                  <ul className="flex flex-wrap gap-2">
                    {[...otherYears, year]
                      .sort((a, b) => Number(b) - Number(a))
                      .map((y) => (
                        <li key={y}>
                          {y === year ? (
                            <span className="inline-block bg-gray-300 text-gray-600 dark:bg-gray-700 dark:text-gray-400 px-3 py-1 rounded-full text-sm cursor-default">
                              {y}年
                            </span>
                          ) : (
                            <Link href={`/tournaments/${meta.id}/${y}`}>
                              <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full text-sm hover:opacity-80 transition">
                                {y}年
                              </span>
                            </Link>
                          )}
                        </li>
                      ))}
                  </ul>
                </div>
              </section>
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
              <MatchResults
                matches={matches}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                suggestions={suggestions}
                filter={filter}
                setFilter={setFilter}
                eliminatedEntries={[]}
                seedEntryNos={seedEntryNos}
              />
            </>
          )}

          {meta.source && (
            <section className="mt-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 text-sm text-gray-700 dark:text-gray-300 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">
                出典・参考情報
              </h2>
              <p className="mb-3">
                本ページの試合結果データは、以下の情報をもとに作成しています。
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  {meta.sourceUrl ? (
                    <a
                      href={meta.sourceUrl}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {meta.source}
                    </a>
                  ) : (
                    <span className="font-medium">{meta.source}</span>
                  )}
                </li>
                <li>
                  一部の情報は現地観戦や報道発表、X（旧Twitter）などから収集しています。
                </li>
              </ul>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                内容に誤りがある場合は、ページ下部のお問い合わせからご連絡ください。
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const basePath = path.join(process.cwd(), 'data/tournaments');
  const paths = getTournamentStaticPaths(basePath);
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { tournamentId, year } = context.params as {
    tournamentId: string;
    year: string;
  };
  const basePath = path.join(process.cwd(), 'data/tournaments');

  try {
    const props = await getTournamentStaticProps({
      basePath,
      tournamentId,
      year,
      readEntriesByCategory: false,
    });
    return { props };
  } catch (err) {
    console.error(err);
    return { notFound: true };
  }
};
