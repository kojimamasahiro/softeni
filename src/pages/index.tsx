import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import Head from 'next/head';
import LiveResultsByTournament from '@/components/LiveResultsByTournament';

interface PlayerInfo {
  id: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  team: string;
}

interface HomeProps {
  players: PlayerInfo[];
}

export default function Home({ players }: HomeProps) {
  const sortedPlayers = players.sort((a, b) => {
    const fullNameA = a.lastNameKana + a.firstNameKana;
    const fullNameB = b.lastNameKana + b.firstNameKana;
    return fullNameA.localeCompare(fullNameB, 'ja');
  });

  return (
    <>
      <Head>
        <title>試合結果まとめ | ソフトテニス情報</title>
        <meta name="description" content="最新試合結果・大会情報・成績をまとめた非公式ファンサイトです。" />
        <meta property="og:title" content="試合結果まとめ" />
        <meta property="og:description" content="最新試合情報を随時更新中！" />
        <meta property="og:image" content="/public/og-image.jpg" />
        <meta property="og:url" content="https://softeni.vercel.app" />
        <meta property="og:type" content="website" />
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">試合結果まとめ | ソフトテニス情報</h1>

        <LiveResultsByTournament playersData={players} />

        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-4">🎾 選手一覧</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sortedPlayers.map((player) => (
              <div key={player.id} className="border border-gray-300 rounded-xl p-4 shadow-md bg-white dark:bg-gray-800">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
                  {player.lastName} {player.firstName}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{player.team}所属</p>
                <Link
                  href={`/players/${player.id}/information`}
                  className="inline-block mt-1 text-blue-600 dark:text-blue-400 underline text-sm"
                >
                  詳細を見る
                </Link>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export async function getStaticProps() {
  const playersDir = path.join(process.cwd(), 'data/players');
  const playerIds = fs.readdirSync(playersDir);
  const players: PlayerInfo[] = [];

  for (const id of playerIds) {
    const filePath = path.join(playersDir, id, 'information.json');
    if (fs.existsSync(filePath)) {
      const jsonData = fs.readFileSync(filePath, 'utf-8');
      const playerData = JSON.parse(jsonData);
      players.push({ id, ...playerData });
    }
  }

  return {
    props: {
      players,
    },
  };
}
