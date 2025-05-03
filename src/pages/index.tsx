import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import MetaHead from '@/components/MetaHead';
import LiveResultsByTournament from '@/components/LiveResultsByTournament';
import Head from 'next/head';

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
      <MetaHead
        title="試合結果まとめ | ソフトテニス情報"
        description="最新試合結果・大会情報・成績をまとめたサイトです。"
        url="https://softeni.vercel.app"
        image="/og-image.jpg"
      />

      <Head>
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
                }
              ]
            }),
          }}
        />
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">試合結果まとめ | ソフトテニス情報</h1>

        <LiveResultsByTournament playersData={players} /><section className="mt-10">
          <h2 className="text-xl font-semibold mb-4">🎾 選手一覧</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sortedPlayers.map((player) => (
              <div
                key={player.id}
                className="border border-gray-300 rounded-xl p-4 shadow-md bg-white dark:bg-gray-800 dark:border-gray-700"
              >
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
                  {player.lastName} {player.firstName}（{player.lastNameKana} {player.firstNameKana}）
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{player.team}</p>
                <div className="flex justify-start mt-4">
                  <Link
                    href={`/players/${player.id}`}
                    className="px-3 py-1 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                  >
                    プロフィール
                  </Link>
                  <Link
                    href={`/players/${player.id}/results`}
                    className="px-3 py-1 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 ml-2"
                  >
                    試合結果
                  </Link>
                </div>
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
