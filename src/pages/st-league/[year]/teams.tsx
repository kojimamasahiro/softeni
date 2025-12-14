import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import TeamsRanking from '@/components/TeamsRanking';
import TeamsYearlySummary from '@/components/TeamsYearlySummary';
import {
  aggregateTeamResults,
  generateTeamInfo,
  TeamInfo,
} from '@/utils/team-data-aggregator';
import {
  calculatePlayerStats,
  calculateTeamYearlySummary,
  PlayerStats,
  YearlySummary,
} from '@/utils/team-stats-calculator';
import { loadAllTournamentData } from '@/utils/tournament-data-loader';

type ParticipantInfo = {
  teamId: string;
  name: string | string[];
  players?: {
    lastName: string;
    firstName: string;
  }[];
};

type ParticipantsData = {
  boys: ParticipantInfo[];
  girls: ParticipantInfo[];
};

type TeamData = {
  info: TeamInfo;
  summary: YearlySummary;
  stats: PlayerStats[];
};

type Props = {
  year: number;
  teams: {
    boys: TeamData[];
    girls: TeamData[];
  };
};

export default function STLeagueTeamsPage({ year, teams }: Props) {
  const [activeTab, setActiveTab] = useState<'boys' | 'girls'>('boys');

  const pageTitle = `STリーグ ${year} 出場チーム・選手`;
  const pageUrl = `https://softeni-pick.com/st-league/${year}/teams`;

  const activeTeams = teams[activeTab];

  return (
    <>
      <MetaHead
        title={`${pageTitle} | ソフトテニス情報`}
        description={`STリーグ${year}年度の出場チームと選手個人の成績詳細。`}
        url={pageUrl}
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: pageTitle,
              description: `STリーグ${year}年度の出場チームと選手個人の成績詳細。`,
              url: pageUrl,
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: 'STリーグ', href: '/st-league' },
              { label: `${year}年度`, href: `/st-league/${year}/teams` }, // Tentative link, maybe should be just text if index doesn't have year
            ]}
          />

          <h1 className="text-2xl font-bold">{pageTitle}</h1>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              className={`py-2 px-4 font-medium text-sm focus:outline-none ${
                activeTab === 'boys'
                  ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('boys')}
            >
              男子
            </button>
            <button
              className={`py-2 px-4 font-medium text-sm focus:outline-none ${
                activeTab === 'girls'
                  ? 'border-b-2 border-pink-500 text-pink-600 dark:text-pink-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
              onClick={() => setActiveTab('girls')}
            >
              女子
            </button>
          </div>

          {/* Content */}
          <div className="space-y-12">
            {activeTeams.map((team) => (
              <div
                key={team.info.id}
                className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {team.info.name}
                  </h2>
                </div>

                <TeamsYearlySummary summary={team.summary} />
                <TeamsRanking statsList={team.stats} />
              </div>
            ))}

            {activeTeams.length === 0 && (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                参加チームの情報がありません。
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const stLeagueDir = path.join(process.cwd(), 'data/st-league');
  const years: string[] = [];

  if (fs.existsSync(stLeagueDir)) {
    const entries = fs.readdirSync(stLeagueDir, { withFileTypes: true });
    entries.forEach((entry) => {
      if (entry.isDirectory() && /^\d{4}$/.test(entry.name)) {
        years.push(entry.name);
      }
    });
  }

  const paths = years.map((year) => ({
    params: { year },
  }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { year } = context.params as { year: string };
  const participantsPath = path.join(
    process.cwd(),
    `data/st-league/${year}/participants.json`,
  );

  if (!fs.existsSync(participantsPath)) {
    return { notFound: true };
  }

  const participantsData: ParticipantsData = JSON.parse(
    fs.readFileSync(participantsPath, 'utf-8'),
  );

  const preloadedData = loadAllTournamentData();

  const processTeams = (
    participants: ParticipantInfo[],
    gender: 'boys' | 'girls',
  ): TeamData[] => {
    return participants.map((p) => {
      // Create custom mappings for this team
      const customMappings: Record<string, string[]> = {};
      if (p.name) {
        const aliases = Array.isArray(p.name) ? p.name : [p.name];
        customMappings[p.teamId] = aliases;
      }

      const info = generateTeamInfo(p.teamId, customMappings, preloadedData);

      // Handle name logic: use p.name (first if array) if provided
      if (p.name) {
        const newName = Array.isArray(p.name) ? p.name[0] : p.name;
        info.name = newName;
      }

      // Manually add players from participants.json if they are missing
      if (p.players) {
        p.players.forEach((player) => {
          const fullName = `${player.lastName}${player.firstName}`;
          // Check if player exists (by name matching)
          const exists = Object.values(info.players).some(
            (existing) =>
              `${existing.lastName}${existing.firstName}` === fullName,
          );

          if (!exists) {
            // Generate a synthetic ID
            const syntheticId = `manual_${p.teamId}_${player.lastName}_${player.firstName}`;
            info.players[syntheticId] = {
              lastName: player.lastName,
              firstName: player.firstName,
            };
          }
        });
      }

      // Filter players if explicitly listed in participants.json
      if (p.players && p.players.length > 0) {
        const targetPlayers = new Set(
          p.players.map((pl) => `${pl.lastName}${pl.firstName}`),
        );

        // Rebuild info.players with only matching players
        const filteredPlayers: typeof info.players = {};
        for (const [pid, player] of Object.entries(info.players)) {
          const fullName = `${player.lastName}${player.firstName}`;
          if (targetPlayers.has(fullName)) {
            filteredPlayers[pid] = player;
          }
        }
        info.players = filteredPlayers;
      }

      const allResults = aggregateTeamResults(
        p.teamId,
        customMappings,
        preloadedData,
      );

      // Filter results for the target year
      const filteredResults = allResults.filter(
        (r) => r.year === Number(year) && r.gender === gender,
      );

      const summary = calculateTeamYearlySummary(filteredResults, info);
      const statsByPlayer = calculatePlayerStats(filteredResults, info);
      const stats = Object.values(statsByPlayer).sort(
        (a, b) => b.wins - a.wins,
      );

      return {
        info,
        summary,
        stats,
      };
    });
  };

  const boysTeams = processTeams(participantsData.boys, 'boys');
  const girlsTeams = processTeams(participantsData.girls, 'girls');

  return {
    props: {
      year: Number(year),
      teams: {
        boys: boysTeams,
        girls: girlsTeams,
      },
    },
  };
};
