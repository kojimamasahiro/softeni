// src/pages/players/[id]/results.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import LiveResults from '@/components/LiveResults';
import MajorTitles from '@/components/MajorTitles';
import MetaHead from '@/components/MetaHead';
import PlayerResults from '@/components/PlayerResults';
import { getAllPlayers } from '@/lib/players';
import { getAllTournaments } from '@/lib/tournaments';
import {
  PlayerData,
  PlayerInfo,
  PlayerStats,
  TournamentSummary,
} from '@/types/index';

type PlayerResultsProps = {
  playerId: string;
  playerData: PlayerData;
  playerInfo: PlayerInfo;
  allPlayers: PlayerInfo[];
  allTournaments: TournamentSummary[];
  playerStats: PlayerStats;
};

export default function PlayerResultsPage({
  playerId,
  playerData,
  playerInfo,
  allPlayers,
  allTournaments,
  playerStats,
}: PlayerResultsProps) {
  const fullName = `${playerInfo.lastName}${playerInfo.firstName}`;
  const pageUrl = `https://softeni-pick.com/players/${playerId}/results`;

  return (
    <>
      <MetaHead
        title={`${fullName} 試合結果 | ソフトテニス情報`}
        description={`${fullName}（${playerInfo.team}所属）の主要大会結果や試合速報を掲載`}
        url={pageUrl}
        image={`https://softeni-pick.com/api/og/player?name=${encodeURIComponent(fullName)}`}
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
              headline: `${fullName}の試合結果・大会成績`,
              author: {
                '@type': 'Person',
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
              description: `${fullName}（${playerInfo.team}所属）の主要大会結果や試合速報を掲載`,
              about: {
                '@type': 'Person',
                name: fullName,
                memberOf: playerInfo.team,
                url: pageUrl,
                ...(playerInfo.profileLinks?.length
                  ? {
                      sameAs: playerInfo.profileLinks.map((link) => link.url),
                    }
                  : {}),
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
                  name: '選手一覧',
                  item: 'https://softeni-pick.com/players',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: `${fullName}`,
                  item: `https://softeni-pick.com/players/${playerId}`,
                },
                {
                  '@type': 'ListItem',
                  position: 4,
                  name: `試合結果`,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-10">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              {
                label: '選手一覧',
                href: '/players',
              },
              {
                label: `${fullName}`,
                href: `/players/${playerId}`,
              },
              {
                label: '試合結果',
                href: `/players/${playerId}/results`,
              },
            ]}
          />

          <header>
            <h1 className="text-2xl font-bold">{fullName} 選手の試合結果</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              本ページでは、{fullName}{' '}
              選手の出場大会や成績、主な勝ち上がり情報を掲載しています。
            </p>
          </header>

          {playerData.highlight && (
            <section className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold mb-1">最近の主な活躍</h2>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {playerData.highlight}
              </p>
            </section>
          )}

          <section>
            <LiveResults playerId={playerId} />
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-2">主な成績（タイトル）</h2>
            <MajorTitles id={playerId} tournaments={allTournaments} />
          </section>

          <div className="text-right">
            <Link
              href="/tournaments"
              className="text-sm text-blue-600 hover:underline"
            >
              大会結果一覧はこちら
            </Link>
          </div>

          <section>
            <h2 className="text-xl font-semibold mb-2">
              {fullName}選手の出場履歴と戦績
            </h2>
            <PlayerResults
              playerData={playerData}
              playerStats={playerStats}
              allPlayers={allPlayers}
            />
          </section>

          <div className="text-right">
            <Link
              href={`/players/${playerId}`}
              className="text-sm text-blue-600 hover:underline"
            >
              {fullName}選手のプロフィールを見る
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const playersDir = path.join(process.cwd(), 'data/players');
  const entries = fs.readdirSync(playersDir);

  const paths = entries
    .filter((entry) => {
      const fullPath = path.join(playersDir, entry);
      return fs.statSync(fullPath).isDirectory(); // ディレクトリのみ
    })
    .map((dir) => ({
      params: { id: dir },
    }));

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const playerId = params?.id as string;

  // 試合結果を取得
  const resultsPath = path.join(
    process.cwd(),
    'data',
    'players',
    playerId,
    'results.json',
  );
  const playerData: PlayerData = JSON.parse(
    fs.readFileSync(resultsPath, 'utf-8'),
  );

  // 選手情報を取得
  const infoPath = path.join(
    process.cwd(),
    'data',
    'players',
    playerId,
    'information.json',
  );
  const playerInfo: PlayerInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));

  // 解析情報を取得
  const statsPath = path.join(
    process.cwd(),
    'data',
    'players',
    playerId,
    'analysis.json',
  );
  let playerStats: PlayerStats | null = null;
  if (fs.existsSync(statsPath)) {
    playerStats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
    if (playerStats) {
      playerStats.playerId = playerId;
    }
  }

  // 全選手情報を取得
  const allPlayers = getAllPlayers();

  // 全トーナメント情報を取得
  const allTournaments = getAllTournaments();

  return {
    props: {
      playerId,
      playerData,
      playerInfo,
      allPlayers,
      allTournaments,
      playerStats,
    },
  };
};
