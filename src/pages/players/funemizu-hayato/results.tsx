import fs from 'fs';
import path from 'path';
import MajorTitles from '../../components/MajorTitles';
import PlayerResults from '../../components/PlayerResults';
import { PlayerData } from '../../../types/types';

export default function FunemizuPage({ playerData }: { playerData: PlayerData }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>{playerData.player} のページ</h1>
      <MajorTitles playerData={playerData} />
      <PlayerResults playerData={ playerData } />
    </div>
  );
}

// getStaticProps 内でのデータ確認
export async function getStaticProps() {
  const filePath = path.join(process.cwd(), 'data/players/funemizu-hayato/results.json');
  const jsonData = fs.readFileSync(filePath, 'utf-8');
  
  // データをログで確認
  const playerData: PlayerData = JSON.parse(jsonData);
  console.log(playerData);  // データ構造を確認

  return {
    props: {
      playerData,
    },
  };
}

