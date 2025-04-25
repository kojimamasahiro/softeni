import fs from 'fs';
import path from 'path';
import MajorTitles from '../../components/MajorTitles';
import PlayerResults from '../../components/PlayerResults';

export default function FunemizuPage({ playerData }: { playerData: any }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>{playerData.player} のページ</h1>
      <MajorTitles playerData={playerData} />
      <PlayerResults playerData={{ player: playerData.player, matches: playerData.matches }} />
    </div>
  );
}

export async function getStaticProps() {
  const filePath = path.join(process.cwd(), 'data/players/funemizu-hayato/results.json');
  const jsonData = fs.readFileSync(filePath, 'utf-8');
  const playerData = JSON.parse(jsonData);

  return {
    props: {
      playerData,
    },
  };
}
