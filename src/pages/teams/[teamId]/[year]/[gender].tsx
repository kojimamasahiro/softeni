import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useMemo } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import TeamsEventSummary from '@/components/TeamsEventSummary';
import TeamsRanking from '@/components/TeamsRanking';
import TeamsYearlySummary from '@/components/TeamsYearlySummary';
import type {
  EventResult,
  Player,
  TeamInfo,
} from '@/utils/team-data-aggregator';
import {
  calculatePlayerStats,
  calculateTeamYearlySummary,
} from '@/utils/team-stats-calculator';

type Props = {
  info: TeamInfo;
  results: EventResult[];
  year: number;
  gender: string;
  playerLinks?: Record<string, number>;
};

export default function TeamYearGenderPage({
  info,
  results,
  year,
  gender,
  playerLinks = {},
}: Props) {
  const teamName = info.name;
  const genderLabel =
    gender === 'boys' ? '男子' : gender === 'girls' ? '女子' : 'ミックス';
  const pageTitle = `${teamName} ${year}年度 ${genderLabel} 成績`;
  const pageUrl = `https://softeni-pick.com/teams/${info.id}/${year}/${gender}/`;

  const calculateSummary = useMemo(() => {
    return calculateTeamYearlySummary(results, info);
  }, [results, info]);

  const overallTable = useMemo(
    () =>
      [...results]
        .sort((a, b) => {
          const aDate = Date.parse(a.endDate || a.startDate || '');
          const bDate = Date.parse(b.endDate || b.startDate || '');

          if (!Number.isNaN(aDate) && !Number.isNaN(bDate) && aDate !== bDate) {
            return bDate - aDate;
          }

          if (!Number.isNaN(aDate) && Number.isNaN(bDate)) {
            return -1;
          }

          if (Number.isNaN(aDate) && !Number.isNaN(bDate)) {
            return 1;
          }

          if (a.year !== b.year) {
            return b.year - a.year;
          }

          return a.tournament.localeCompare(b.tournament, 'ja');
        })
        .map((event) => {
          // Extract unique players who participated in this event
          const uniquePlayerIds = new Set<string>();
          event.matches.forEach((m) => {
            m.pair.forEach((pid) => {
              if (info.players[pid]) {
                uniquePlayerIds.add(pid);
              }
            });
          });

          // Convert player IDs to names (with optional link IDs)
          const playerNames = Array.from(uniquePlayerIds)
            .map((pid) => {
              const player = info.players[pid];
              if (!player) return null;
              return {
                name: player.lastName + player.firstName,
                playerId: playerLinks[pid],
              };
            })
            .filter(Boolean) as { name: string; playerId?: number }[];

          const resultWithNames = event.results
            .map((r) => {
              // Check if at least one player is in the team
              if (!r.playerIds.some((pid) => pid in info.players)) {
                return null;
              }

              const playerNames = r.playerIds.map((pid) => {
                const player = info.players[pid];
                return player ? player.lastName + player.firstName : null;
              });

              // Filter out nulls (partners from other teams) and join
              const validNames = playerNames.filter(Boolean);
              return `${validNames.join('・')}（${r.result}）`;
            })
            .filter(Boolean)
            .join('、');

          return {
            name: event.tournament,
            categoryLabel: event.categoryLabel,
            link: event.link || '',
            results: resultWithNames,
            players: playerNames,
          };
        }),
    [results, info.players, playerLinks],
  );

  const calculatePlayerStatsValues = useMemo(() => {
    return calculatePlayerStats(results, info);
  }, [results, info]);

  const statsList = useMemo(
    () =>
      Object.values(calculatePlayerStatsValues).sort((a, b) => b.wins - a.wins),
    [calculatePlayerStatsValues],
  );

  return (
    <>
      <MetaHead
        title={`${pageTitle} | ソフトテニス情報`}
        description={`${teamName}の${year}年度${genderLabel}の大会成績詳細。`}
        url={pageUrl}
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: pageTitle,
              author: {
                '@type': 'Organization',
                name: 'Softeni Pick',
              },
              publisher: {
                '@type': 'Organization',
                name: 'Softeni Pick',
              },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': pageUrl,
              },
              description: `${teamName}の${year}年度${genderLabel}の大会成績詳細。`,
              about: {
                '@type': 'SportsTeam',
                name: teamName,
                url: pageUrl,
              },
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
                  name: teamName,
                  item: `https://softeni-pick.com/teams/${info.id}`,
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: `${year}年度 ${genderLabel}`,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <PageLayout className="space-y-6">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: teamName, href: `/teams/${info.id}` },
            { label: `${year}年度 ${genderLabel}`, href: pageUrl },
          ]}
        />

        <h1 className="text-2xl font-bold">{pageTitle}</h1>

        <TeamsYearlySummary summary={calculateSummary} />

        <TeamsEventSummary overallTable={overallTable} />

        <TeamsRanking statsList={statsList} playerLinks={playerLinks} />

        <div className="mt-8">
          <Link
            href={`/teams/${info.id}`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← {teamName} トップへ戻る
          </Link>
        </div>
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const {
    aggregateTeamResults,
    loadTeamNameMappings,
    gendersWithRealPresence,
  } = await import('@/utils/team-data-aggregator');

  const teamNameMappings = loadTeamNameMappings();
  const paths: {
    params: { teamId: string; year: string; gender: string };
  }[] = [];

  for (const teamId of Object.keys(teamNameMappings)) {
    const results = aggregateTeamResults(teamId);
    // 混合ダブルスしか無い性別（実体の無い性別）はページを生成しない。
    const realGenders = gendersWithRealPresence(results);
    const combinations = new Set<string>();

    for (const result of results) {
      if (
        (result.gender === 'boys' || result.gender === 'girls') &&
        !realGenders.has(result.gender)
      ) {
        continue;
      }
      const key = `${result.year}-${result.gender}`;
      if (!combinations.has(key)) {
        combinations.add(key);
        paths.push({
          params: {
            teamId,
            year: String(result.year),
            gender: result.gender,
          },
        });
      }
    }
  }

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { aggregateTeamResults, generateTeamInfo, normalizeJa } = await import(
    '@/utils/team-data-aggregator'
  );
  const { teamId, year, gender } = context.params as {
    teamId: string;
    year: string;
    gender: string;
  };

  try {
    const info = generateTeamInfo(teamId);
    const allResults = aggregateTeamResults(teamId);

    // Filter results by year and gender, and exclude team/versus matches
    const filteredResults = allResults.filter(
      (r) =>
        r.year === Number(year) &&
        r.gender === gender &&
        !['team', 'versus'].includes(r.gameCategory),
    );

    // Filter players based on gender context
    // 1. Try to load from participants.json if available
    const participantsPath = path.join(
      process.cwd(),
      `data/st-league/${year}/participants.json`,
    );

    let targetPlayerNames: Set<string> | null = null;

    if (fs.existsSync(participantsPath)) {
      try {
        const participantsData = JSON.parse(
          fs.readFileSync(participantsPath, 'utf-8'),
        );
        const genderKey = gender === 'boys' ? 'boys' : 'girls';
        const teamList = participantsData[genderKey] as {
          teamId: string;
          players?: { lastName: string; firstName: string }[];
        }[];

        // Find the team in the participant list
        // We have to use strict check or the same matching logic as aggregator
        // But since we are looking for THIS team's legitimate roster for THIS gender:
        const targetTeamEntry = teamList.find((t) => t.teamId === teamId);

        if (targetTeamEntry && targetTeamEntry.players) {
          targetPlayerNames = new Set(
            targetTeamEntry.players.map((p) =>
              normalizeJa(`${p.lastName}${p.firstName}`),
            ),
          );
        }
      } catch (e) {
        console.error('Failed to parse participants.json', e);
      }
    }

    // Reuse info, but filter players
    const filteredPlayers: Record<string, Player> = {};

    if (targetPlayerNames) {
      // Approach 1: We have an explicit roster
      Object.entries(info.players).forEach(([pid, player]) => {
        const fullName = normalizeJa(`${player.lastName}${player.firstName}`);
        if (targetPlayerNames!.has(fullName)) {
          filteredPlayers[pid] = player;
        }
      });
    } else {
      // Approach 2: No roster, so only show players who actually played in this gender's results
      const activePlayerIds = new Set<string>();
      filteredResults.forEach((r) => {
        r.results.forEach((res) => {
          res.playerIds.forEach((pid) => activePlayerIds.add(pid));
        });
        r.matches.forEach((m) => {
          m.pair.forEach((pid) => activePlayerIds.add(pid));
        });
      });

      Object.entries(info.players).forEach(([pid, player]) => {
        if (activePlayerIds.has(pid)) {
          filteredPlayers[pid] = player;
        }
      });
    }

    // Update info with filtered players
    info.players = filteredPlayers;

    if (
      !info.players ||
      Object.keys(info.players).length === 0 ||
      filteredResults.length === 0
    ) {
      return { notFound: true };
    }

    // 選手結果ページ（/players/{id}/results）への内部リンク用に pid→数値id を解決する。
    // data/players/index.json と姓名一致、count>=5 のみ（高校ページと同じ規約）。
    const playerLinks: Record<string, number> = {};
    const playersIndexPath = path.join(
      process.cwd(),
      'data',
      'players',
      'index.json',
    );
    if (fs.existsSync(playersIndexPath)) {
      try {
        const playersIndex = JSON.parse(
          fs.readFileSync(playersIndexPath, 'utf-8'),
        ) as Array<{
          id: number;
          lastName: string;
          firstName: string;
          count: number;
        }>;
        const nameToId = new Map<string, number>();
        for (const p of playersIndex) {
          if (p.count < 5) continue;
          const key = `${p.lastName}::${p.firstName}`;
          // 同姓同名は最初の ID を使う（players/index.tsx と同じ規約）
          if (!nameToId.has(key)) nameToId.set(key, p.id);
        }
        for (const [pid, player] of Object.entries(info.players)) {
          const id = nameToId.get(`${player.lastName}::${player.firstName}`);
          if (id !== undefined) playerLinks[pid] = id;
        }
      } catch (err) {
        console.error('failed to parse players index.json', err);
      }
    }

    return {
      props: {
        info,
        results: filteredResults,
        year: Number(year),
        gender,
        playerLinks,
      },
    };
  } catch (error) {
    console.error(`Error generating team data for ${teamId}:`, error);
    return { notFound: true };
  }
};
