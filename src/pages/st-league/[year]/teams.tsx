import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import TeamsRanking from '@/components/TeamsRanking';
import TeamsYearlySummary from '@/components/TeamsYearlySummary';
import { DivisionMeta, getDivisions, getStLeagueYears, LeagueMeta, loadLeagueMeta } from '@/utils/st-league';
import { aggregateTeamResults, generateTeamInfo, normalizeJa, TeamInfo } from '@/utils/team-data-aggregator';
import { calculatePlayerStats, calculateTeamYearlySummary, PlayerStats, YearlySummary } from '@/utils/team-stats-calculator';
import { getAllTournamentFiles, loadTournamentData } from '@/utils/tournament-data-loader';

type ParticipantInfo = {
  teamId: string;
  division?: string;
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
  division: string;
  summary: YearlySummary;
  stats: PlayerStats[];
};

type Props = {
  year: number;
  meta: LeagueMeta | null;
  divisions: DivisionMeta[];
  teams: {
    boys: TeamData[];
    girls: TeamData[];
  };
};

export default function STLeagueTeamsPage({ year, meta, divisions, teams }: Props) {
  const [activeTab, setActiveTab] = useState<'boys' | 'girls'>('boys');
  const [divisionId, setDivisionId] = useState<string>(divisions[0]?.id ?? '1');

  const editionLabel = meta?.title ?? `STリーグ ${year}`;
  const pageTitle = `${editionLabel} 出場チーム・選手`;
  const pageUrl = `https://softeni-pick.com/st-league/${year}/teams/`;

  return (
    <>
      <MetaHead title={`${pageTitle} | ソフトテニス情報`} description={`STリーグ${year}年度の出場チームと選手個人の成績詳細。`} url={pageUrl} />
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

      <PageLayout maxWidth="4xl" className="space-y-8">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'STリーグ', href: '/st-league' },
            { label: `${year}`, href: `/st-league/${year}` },
            { label: '出場チーム・選手', href: `/st-league/${year}/teams` },
          ]}
        />
        <h1 className="text-2xl font-bold">{pageTitle}</h1>
        <p>STリーグⅠ・Ⅱ、男女別の出場チームと選手個人の成績を掲載しています。</p>
        <div className="rounded-lg border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning">
          ここに表示する「年間成績」「選手別成績」は、
          <strong>STリーグ本体の対戦を除いた{year}年度の大会成績</strong>
          （全日本選手権・全日本実業団など）です。STリーグ内の対戦成績・勝率は
          <Link href={`/st-league/${year}/analysis`} className="font-semibold text-info underline">
            分析ページ
          </Link>
          をご覧ください。
        </div>
        {/* Tabs */}
        <div className="flex border-b border-border">
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

        {/* リーグ（division）切替 */}
        <div className="flex flex-wrap gap-2">
          {divisions.map((d) => {
            const active = d.id === divisionId;
            return (
              <button
                key={d.id}
                onClick={() => setDivisionId(d.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-text-secondary border-border hover:border-blue-400'}`}
              >
                {d.name}
              </button>
            );
          })}
        </div>
        {/* Content: 全 gender×division パネルをHTMLに出力し、非アクティブは hidden で隠す（SEO） */}
        {(['boys', 'girls'] as const).map((g) =>
          divisions.map((d) => {
            const active = g === activeTab && d.id === divisionId;
            const panelTeams = teams[g].filter((t) => (t.division ?? '1') === d.id);
            return (
              <div key={`${g}-${d.id}`} className={active ? 'space-y-12' : 'hidden'} aria-hidden={!active}>
                {panelTeams.map((team) => (
                  <div key={team.info.id} className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                        <Link href={`/teams/${team.info.id}`} className="hover:text-blue-600 hover:underline">
                          {team.info.name}
                        </Link>
                      </h3>
                    </div>
                    <div>
                      <TeamsYearlySummary summary={team.summary} />
                      <TeamsRanking statsList={team.stats} />
                    </div>
                  </div>
                ))}

                {panelTeams.length === 0 && (
                  <div className="text-center py-12 bg-surface rounded-xl border border-dashed border-border text-text-muted">
                    {d.name}の出場チーム情報は準備中です。
                  </div>
                )}
              </div>
            );
          }),
        )}
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: getStLeagueYears().map((y) => ({ params: { year: String(y) } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps = async (context) => {
  const { year } = context.params as { year: string };
  const participantsPath = path.join(process.cwd(), `data/st-league/${year}/participants.json`);

  if (!fs.existsSync(participantsPath)) {
    return { notFound: true };
  }

  const participantsData: ParticipantsData = JSON.parse(fs.readFileSync(participantsPath, 'utf-8'));

  const targetYear = Number(year);
  const preloadedData = getAllTournamentFiles()
    .filter((f) => f.year === targetYear)
    .flatMap((f) => {
      const data = loadTournamentData(f.filePath);
      return data ? [{ descriptor: f, data }] : [];
    });

  const processTeams = (participants: ParticipantInfo[], gender: 'boys' | 'girls'): TeamData[] => {
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
          const fullName = normalizeJa(`${player.lastName}${player.firstName}`);
          // Check if player exists (by name matching; 半角/全角・異体字を吸収)
          const exists = Object.values(info.players).some((existing) => normalizeJa(`${existing.lastName}${existing.firstName}`) === fullName);

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
        const targetPlayers = new Set(p.players.map((pl) => normalizeJa(`${pl.lastName}${pl.firstName}`)));

        // Rebuild info.players with only matching players（半角/全角・異体字を吸収）
        const filteredPlayers: typeof info.players = {};
        for (const [pid, player] of Object.entries(info.players)) {
          const fullName = normalizeJa(`${player.lastName}${player.firstName}`);
          if (targetPlayers.has(fullName)) {
            filteredPlayers[pid] = player;
          }
        }
        info.players = filteredPlayers;
      }

      const allResults = aggregateTeamResults(p.teamId, customMappings, preloadedData);

      // Filter results for the target year
      const filteredResults = allResults.filter((r) => r.year === Number(year) && r.gender === gender);

      const summary = calculateTeamYearlySummary(filteredResults, info);
      const statsByPlayer = calculatePlayerStats(filteredResults, info);
      const stats = Object.values(statsByPlayer).sort((a, b) => b.wins - a.wins);

      return {
        info,
        division: p.division ?? '1',
        summary,
        stats,
      };
    });
  };

  const boysTeams = processTeams(participantsData.boys, 'boys');
  const girlsTeams = processTeams(participantsData.girls, 'girls');

  const meta = loadLeagueMeta(year);
  const divisions = getDivisions(meta);

  return {
    props: {
      year: Number(year),
      meta,
      divisions,
      teams: {
        boys: boysTeams,
        girls: girlsTeams,
      },
    },
  };
};
