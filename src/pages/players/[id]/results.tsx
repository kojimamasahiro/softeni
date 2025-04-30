import { GetStaticPaths, GetStaticProps } from 'next';
import fs from 'fs';
import path from 'path';
import MajorTitles from '../../../components/MajorTitles';
import PlayerResults from '../PlayerResults';
import LiveResults from '@/components/LiveResults';
import { PlayerData } from '../../../types/types';

type PlayerResultsProps = {
  playerData: PlayerData;
};

export default function PlayerResultsPage({ playerData }: PlayerResultsProps) {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>{playerData.name} - 試合結果</h1>
      <LiveResults playerId={playerData.id} />
      <MajorTitles playerData={playerData} />
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
  const resultsPath = path.join(process.cwd(), 'data/players', playerId, 'results.json');
  const playerData: PlayerData = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  return {
    props: {
      playerData,
    },
  };
};
