import { GetStaticPaths, GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';
import MajorTitles from '@/components/MajorTitles';
import PlayerResults from '@/components/PlayerResults';
import LiveResults from '@/components/LiveResults';
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
  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{playerInfo.lastName} {playerInfo.firstName}</h1>

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
