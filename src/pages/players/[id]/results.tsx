import { GetStaticPaths, GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';
import MajorTitles from '@/components/MajorTitles';
import PlayerResults from '@/components/PlayerResults';
import LiveResults from '@/components/LiveResults';
import MetaHead from '@/components/MetaHead';
import Head from 'next/head';
import { PlayerData, PlayerInfo, TournamentSummary } from '@/types/types';
import Link from 'next/link';
import { getAllPlayers } from '@/lib/players';
import { getAllTournaments } from '@/lib/tournaments';

type PlayerResultsProps = {
  playerId: string;
  playerData: PlayerData;
  playerInfo: PlayerInfo;
  allPlayers: PlayerInfo[];
  allTournaments: TournamentSummary[];
};

export default function PlayerResultsPage({
  playerId,
  playerData,
  playerInfo,
  allPlayers,
  allTournaments,
}: PlayerResultsProps) {
  const fullName = `${playerInfo.lastName} ${playerInfo.firstName}`;
  const pageUrl = `https://softeni.vercel.app/players/${playerId}/results`;

  return (
    <>
      <MetaHead
        title={`${fullName} 試合結果 | ソフトテニス情報`}
        description={`${fullName}（${playerInfo.team}所属）の主要大会結果や試合速報を掲載`}
        url={pageUrl}
        type="article"
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Article",
              "headline": `${fullName}の試合結果・大会成績`,
              "author": {
                "@type": "Person",
                "name": "Softeni Pick",
              },
              "datePublished": new Date().toISOString().split('T')[0],
              "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": pageUrl,
              },
              "description": `${fullName}（${playerInfo.team}所属）の主要大会結果や試合速報を掲載`,
              "about": {
                "@type": "Person",
                "name": fullName,
                "memberOf": playerInfo.team,
                "url": pageUrl,
              },
            }),
          }}
        />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                {
                  "@type": "ListItem",
                  "position": 1,
                  "name": "ホーム",
                  "item": "https://softeni.vercel.app/",
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": `${fullName}`,
                  "item": `https://softeni.vercel.app/players/${playerId}`,
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": `試合結果`,
                  "item": pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">{fullName}</h1>

          <section className="mb-8">
            <LiveResults playerId={playerId} />
          </section>

          <section className="mb-8">
            <MajorTitles id={playerId} tournaments={allTournaments} />
          </section>

          <section>
            <PlayerResults playerData={playerData} allPlayers={allPlayers} />
            <div className="text-right mb-2">
              <Link href={`/players/${playerId}`} className="text-sm text-blue-500 hover:underline">
                {fullName}選手プロフィール
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const playersDir = path.join(process.cwd(), 'data/players');
  const playerDirs = fs.readdirSync(playersDir);

  const paths = playerDirs.map((dir) => ({
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
  const resultsPath = path.join(process.cwd(), 'data', 'players', playerId, 'results.json');
  const playerData: PlayerData = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  // 選手情報を取得
  const infoPath = path.join(process.cwd(), 'data', 'players', playerId, 'information.json');
  const playerInfo: PlayerInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));

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
    },
  };
};
