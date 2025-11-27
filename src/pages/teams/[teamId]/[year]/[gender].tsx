import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useMemo } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import TeamsEventSummary from '@/components/TeamsEventSummary';
import TeamsRanking from '@/components/TeamsRanking';
import TeamsYearlySummary from '@/components/TeamsYearlySummary';

type PlayerStats = {
  id: string;
  name: string;
  appearances: number;
  wins: number;
  losses: number;
  winsByRound: Record<string, number>;
};

type Player = {
  firstName: string;
  lastName: string;
};

type TeamInfo = {
  id: string;
  name: string;
  players: Record<string, Player>;
};

type MatchOpponent = {
  lastName: string;
  firstName: string;
  team: string;
  playerId: string | null;
  tempId: string;
  prefecture?: string | null;
  originalTeam?: string | null;
};

type EventResult = {
  year: number;
  gender: string;
  tournament: string;
  link?: string;
  results: {
    playerIds: string[];
    result: string;
  }[];
  matches: {
    round: string;
    pair: string[];
    opponents: MatchOpponent[];
    result: 'win' | 'lose';
    games: { won: string; lost: string };
  }[];
};

type Props = {
  info: TeamInfo;
  results: EventResult[];
  year: number;
  gender: string;
};

export default function TeamYearGenderPage({
  info,
  results,
  year,
  gender,
}: Props) {
  const teamName = info.name;
  const genderLabel =
    gender === 'boys' ? '男子' : gender === 'girls' ? '女子' : 'ミックス';
  const pageTitle = `${teamName} ${year}年 ${genderLabel} 成績`;
  const pageUrl = `https://softeni-pick.com/teams/${info.id}/${year}/${gender}`;

  const calculateSummary = useMemo(() => {
    let champions = 0,
      runnersUp = 0,
      top8OrBetter = 0,
      totalPairs = 0;

    results.forEach((event) => {
      const validResults = event.results.filter((r) =>
        r.playerIds.every((pid) => pid in info.players),
      );

      validResults.forEach((r) => {
        const count = r.playerIds.length; // 1人 or 2人ペアの対応

        if (r.result === '優勝') champions += count;
        if (r.result === '準優勝') runnersUp += count;
        if (['優勝', '準優勝', 'ベスト4', 'ベスト8'].includes(r.result)) {
          top8OrBetter += count;
        }

        totalPairs++; // totalPairs はペアの数そのまま（ペア単位）
      });
    });

    return {
      tournaments: results.length,
      champions,
      runnersUp,
      top8OrBetter,
      totalPairs,
    };
  }, [results, info.players]);

  const overallTable = useMemo(
    () =>
      results.map((event) => {
        // Extract unique players who participated in this event
        const uniquePlayerIds = new Set<string>();
        event.matches.forEach((m) => {
          m.pair.forEach((pid) => {
            if (info.players[pid]) {
              uniquePlayerIds.add(pid);
            }
          });
        });

        // Convert player IDs to full names
        const playerNames = Array.from(uniquePlayerIds)
          .map((pid) => {
            const player = info.players[pid];
            return player ? player.lastName + player.firstName : null;
          })
          .filter(Boolean) as string[];

        const resultWithNames = event.results
          .map((r) => {
            const playerNames = r.playerIds.map((pid) => {
              const player = info.players[pid];
              return player ? player.lastName + player.firstName : null;
            });

            if (playerNames.includes(null)) {
              return null;
            }

            return `${playerNames.join('・')}（${r.result}）`;
          })
          .filter(Boolean)
          .join('、');

        return {
          name: event.tournament,
          link: event.link || '',
          results: resultWithNames,
          players: playerNames,
        };
      }),
    [results, info.players],
  );

  const calculatePlayerStats = useMemo(() => {
    const stats: Record<string, PlayerStats> = {};

    const initializePlayerStats = (pid: string, player: Player) => {
      if (!stats[pid]) {
        stats[pid] = {
          id: pid,
          name: `${player.lastName} ${player.firstName}`,
          appearances: 0,
          wins: 0,
          losses: 0,
          winsByRound: {},
        };
      }
    };

    results.forEach((event) => {
      event.results.forEach((summry) => {
        summry.playerIds.forEach((pid) => {
          const player = info.players?.[pid];
          if (!player) return;
          initializePlayerStats(pid, player);

          if (summry.result) {
            stats[pid].winsByRound[summry.result] =
              (stats[pid].winsByRound[summry.result] || 0) + 1;
          }
        });
      });

      const countedPlayers = new Set<string>(); // このevent内でappearancesを数えたプレイヤーID

      event.matches.forEach((match) => {
        match.pair.forEach((pid) => {
          const player = info.players?.[pid];
          if (!player) return;
          initializePlayerStats(pid, player);

          // 勝敗数は全試合でカウント
          if (match.result === 'win') stats[pid].wins++;
          else stats[pid].losses++;

          // 出場回数はイベントごとに1回だけ
          if (!countedPlayers.has(pid)) {
            stats[pid].appearances++;
            countedPlayers.add(pid);
          }
        });
      });
    });

    return stats;
  }, [results, info.players]);

  const statsList = useMemo(
    () => Object.values(calculatePlayerStats).sort((a, b) => b.wins - a.wins),
    [calculatePlayerStats],
  );

  return (
    <>
      <MetaHead
        title={`${pageTitle} | ソフトテニス情報`}
        description={`${teamName}の${year}年${genderLabel}の大会成績詳細。`}
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
              description: `${teamName}の${year}年${genderLabel}の大会成績詳細。`,
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
                  name: `${year}年 ${genderLabel}`,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: teamName, href: `/teams/${info.id}` },
              { label: `${year}年 ${genderLabel}`, href: pageUrl },
            ]}
          />

          <h1 className="text-2xl font-bold">{pageTitle}</h1>

          <TeamsYearlySummary summary={calculateSummary} />

          <TeamsEventSummary overallTable={overallTable} />

          <TeamsRanking statsList={statsList} />

          <div className="mt-8">
            <Link
              href={`/teams/${info.id}`}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← {teamName} トップへ戻る
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const { aggregateTeamResults, loadTeamNameMappings } = await import(
    '@/utils/team-data-aggregator'
  );

  const teamNameMappings = loadTeamNameMappings();
  const paths: {
    params: { teamId: string; year: string; gender: string };
  }[] = [];

  for (const teamId of Object.keys(teamNameMappings)) {
    const results = aggregateTeamResults(teamId);
    const combinations = new Set<string>();

    for (const result of results) {
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
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { aggregateTeamResults, generateTeamInfo } = await import(
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

    // Filter results by year and gender
    const filteredResults = allResults.filter(
      (r) => r.year === Number(year) && r.gender === gender,
    );

    if (
      !info.players ||
      Object.keys(info.players).length === 0 ||
      filteredResults.length === 0
    ) {
      return { notFound: true };
    }

    return {
      props: {
        info,
        results: filteredResults,
        year: Number(year),
        gender,
      },
    };
  } catch (error) {
    console.error(`Error generating team data for ${teamId}:`, error);
    return { notFound: true };
  }
};
