import fs from 'fs';
import path from 'path';
import MajorTitles from '../../../components/MajorTitles';
import PlayerResults from '../PlayerResults';
import { PlayerData } from '../../../types/types';
import LiveResults from '@/components/LiveResults';

export default function UchidaRikuPage({ playerData }: { playerData: PlayerData }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>{playerData.name} - 試合結果</h1>
      <LiveResults playerId={playerData.id} />
      <MajorTitles playerData={playerData} />
      <PlayerResults playerData={playerData} />
    </div>
  );
}

// getStaticProps 内でのデータ確認
export async function getStaticProps() {
  const filePath = path.join(process.cwd(), 'data/players/uchida-riku/results.json');
  const jsonData = fs.readFileSync(filePath, 'utf-8');
  const playerData: PlayerData = JSON.parse(jsonData);

  return {
    props: {
      playerData,
    },
  };
}

