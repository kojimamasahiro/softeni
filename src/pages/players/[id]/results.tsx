import { GetStaticPaths, GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';
import MajorTitles from '@/components/MajorTitles';
import PlayerResults from '../PlayerResults';
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
  const fullName = `${playerInfo.lastName} ${playerInfo.firstName}（${playerInfo.lastNameKana} ${playerInfo.firstNameKana}）`;
  return (
    <div style={{ padding: '2rem' }}>
      <h1>{fullName} - 試合結果</h1>
      <LiveResults playerId={playerId} />
      <MajorTitles id={playerId} />
      <PlayerResults playerData={playerData} />
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  // playersディレクトリ内のファイルを取得し、IDをリストアップ
  const playersDir = path.join(process.cwd(), 'data/players');
  const playerDirs = fs.readdirSync(playersDir);

  const paths = playerDirs.map((dir) => ({
    params: { id: dir },
  }));

  return {
    paths,
    fallback: false, // 選手のデータが存在しない場合、404ページを表示
  };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const playerId = params?.id as string;

  // 試合結果の読み込み
  const resultsPath = path.join(process.cwd(), 'data', 'players', playerId, 'results.json');
  const playerData: PlayerData = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  const filePath = path.join(process.cwd(), 'data', 'players', playerId, 'information.json');
  const fileContents = fs.readFileSync(filePath, 'utf-8');
  const playerInfo = JSON.parse(fileContents);

  return {
    props: {
      playerData,
      playerInfo,
      playerId,
    },
  };
};
