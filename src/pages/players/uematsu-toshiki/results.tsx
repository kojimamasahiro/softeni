import fs from 'fs';
import path from 'path';
import MajorTitles from '../../../components/MajorTitles';
import PlayerResults from '../PlayerResults';
import { PlayerData } from '../../../types/types';

export default function UematsuToshikiPage({ playerData }: { playerData: PlayerData }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>{playerData.name} のページ</h1>
      <MajorTitles playerData={playerData} />
      <PlayerResults playerData={ playerData } />
    </div>
  );
}

// getStaticProps 内でのデータ確認
export async function getStaticProps() {
  const filePath = path.join(process.cwd(), 'data/players/uematsu-toshiki/results.json');
  const jsonData = fs.readFileSync(filePath, 'utf-8');
  const playerData: PlayerData = JSON.parse(jsonData);

  return {
    props: {
      playerData,
    },
  };
}

