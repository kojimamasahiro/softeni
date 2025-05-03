import { GetStaticPaths, GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';
import MajorTitles from '@/components/MajorTitles';
import PlayerResults from '@/components/PlayerResults';
import LiveResults from '@/components/LiveResults';
import MetaHead from '@/components/MetaHead';
import Head from 'next/head';
import { PlayerData } from '@/types/types';

type PlayerInfo = {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  team: string;
  position: string;
  handedness: string;
  birthDate: string;
  height: number;
  profileLinks: {
    label: string;
    url: string;
  }[];
};

type PlayerResultsProps = {
  playerData: PlayerData;
  playerInfo: PlayerInfo;
  playerId: string;
};

export default function PlayerResultsPage({ playerData, playerInfo, playerId }: PlayerResultsProps) {
  const fullName = `${playerInfo.lastName}${playerInfo.firstName}`;
  const pageUrl = `https://softeni.vercel.app/players/${playerId}/results`;

  return (
    <>
      <MetaHead
        title={`${fullName} 試合結果 | ソフトテニス選手情報`}
        description={`${fullName}（${playerInfo.team}所属）の主要大会結果や試合速報を掲載`}
        url={pageUrl}
        image="/og-image.jpg"
        type="article"
      />

      {/* 構造化データ（JSON-LD） */}
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
                "name": "Softeni Curator"
              },
              "datePublished": new Date().toISOString().split('T')[0],
              "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": pageUrl
              },
              "description": `${fullName}（${playerInfo.team}所属）の主要大会結果や試合速報を掲載`,
              "about": {
                "@type": "Person",
                "name": fullName,
                "birthDate": playerInfo.birthDate,
                "height": `${playerInfo.height}cm`,
                "memberOf": playerInfo.team,
                "url": pageUrl
              }
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
                  "item": "https://softeni.vercel.app/"
                },
                {
                  "@type": "ListItem",
                  "position": 2,
                  "name": "選手一覧",
                  "item": "https://softeni.vercel.app/players"
                },
                {
                  "@type": "ListItem",
                  "position": 3,
                  "name": `${playerInfo.lastName}${playerInfo.firstName}`,
                  "item": `https://softeni.vercel.app/players/${playerId}/results`
                }
              ]
            }),
          }}
        />
      </Head>

      {/* ページ本体 */}
      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">{fullName}</h1>

          <section className="mb-8">
            <LiveResults playerId={playerId} />
          </section>

          <section className="mb-8">
            <MajorTitles id={playerId} />
          </section>

          <section>
            <PlayerResults playerData={playerData} />
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

  const resultsPath = path.join(process.cwd(), 'data', 'players', playerId, 'results.json');
  const playerData: PlayerData = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  const infoPath = path.join(process.cwd(), 'data', 'players', playerId, 'information.json');
  const playerInfo = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));

  return {
    props: {
      playerData,
      playerInfo,
      playerId,
    },
  };
};
