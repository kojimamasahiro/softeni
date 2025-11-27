// src/pages/teams/[teamId].tsx

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

type Player = {
  firstName: string;
  lastName: string;
};

type TeamInfo = {
  id: string;
  name: string;
  players: Record<string, Player>;
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

type MatchOpponent = {
  lastName: string;
  firstName: string;
  team: string;
  playerId: string | null;
  tempId: string;
  prefecture?: string;
  originalTeam?: string;
};

type Props = {
  info: TeamInfo;
  results: EventResult[];
};

export default function TeamResultsPage({ info, results }: Props) {
  const teamName = info.name;
  const pageUrl = `https://softeni-pick.com/teams/${info.id}`;

  return (
    <>
      <MetaHead
        title={`${teamName} 所属別成績 | ソフトテニス情報`}
        description={`${teamName}の大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`}
        url={pageUrl}
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: `${teamName} 所属別成績`,
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
              description: `${teamName}の大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`,
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
            ]}
          />

          <h1 className="text-2xl font-bold">{teamName} | 所属別成績</h1>

          {/* ✅ チーム紹介文の追加 */}
          <section className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            <p className="mb-2">
              {teamName}
              は、全国大会や地域大会で活躍するソフトテニスチームであり、多くの選手が主要大会で優れた成績を収めています。
              このページでは、大会ごとの成績、出場選手の勝敗、ペア別実績などを一覧で確認できます。
            </p>
            <p>今後の分析や応援、記録管理などにぜひお役立てください。</p>
          </section>


          {/* Group results by year and gender */}
          {Object.entries(
            results.reduce(
              (acc, event) => {
                const year = event.year;
                if (!acc[year]) acc[year] = [];
                acc[year].push(event);
                return acc;
              },
              {} as Record<number, EventResult[]>,
            ),
          )
            .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))
            .map(([year, yearEvents]) => (
              <div key={year} className="mb-12">
                <h2 className="text-2xl font-bold mb-6 border-b-2 border-gray-200 dark:border-gray-700 pb-2">
                  {year}年
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {['boys', 'girls'].map((gender) => {
                    const genderEvents = yearEvents.filter(
                      (e) => e.gender === gender,
                    );
                    if (genderEvents.length === 0) return null;

                    const genderLabel = gender === 'boys' ? '男子' : '女子';

                    return (
                      <Link
                        key={gender}
                        href={`/teams/${info.id}/${year}/${gender}`}
                        className="block bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                      >
                        <h3 className="text-lg font-bold mb-2 text-gray-800 dark:text-gray-100">
                          {genderLabel}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          大会数: {genderEvents.length}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const fs = await import('fs');
  const path = await import('path');

  // Read team IDs from team-name-mappings.json
  const mappingsPath = path.join(process.cwd(), 'data/teams/team-name-mappings.json');

  if (!fs.existsSync(mappingsPath)) {
    return {
      paths: [],
      fallback: 'blocking',
    };
  }

  const mappingsContent = fs.readFileSync(mappingsPath, 'utf-8');
  const teamNameMappings = JSON.parse(mappingsContent) as Record<string, string[]>;

  const paths = Object.keys(teamNameMappings).map((teamId) => ({
    params: { teamId },
  }));

  return {
    paths,
    fallback: 'blocking',
  };
};


export const getStaticProps: GetStaticProps = async (context) => {
  const { aggregateTeamResults, generateTeamInfo } = await import('@/utils/team-data-aggregator');
  const { teamId } = context.params as { teamId: string };

  try {
    // Generate team information and results from tournament data
    const info = generateTeamInfo(teamId);
    const results = aggregateTeamResults(teamId);

    // If no data found, return 404
    if (!info.players || Object.keys(info.players).length === 0) {
      return { notFound: true };
    }

    return {
      props: {
        info,
        results,
      },
    };
  } catch (error) {
    console.error(`Error generating team data for ${teamId}:`, error);
    return { notFound: true };
  }
};

