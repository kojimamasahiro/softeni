import LiveResultsByTournament from '@/components/LiveResultsByTournament';
import MetaHead from '@/components/MetaHead';
import { PlayerInfo } from '@/types/index';
import fs from 'fs';
import Head from 'next/head';
import Link from 'next/link';
import path from 'path';
import { useEffect, useState } from 'react';

interface HomeProps {
  players: PlayerInfo[];
}

export default function Home({ players }: HomeProps) {
  const [isClient, setIsClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPlayers, setFilteredPlayers] = useState(players);

  // クライアントサイドでのみ処理を実行
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 検索結果をフィルタリングする関数
  const handleSearch = (query: string) => {
    setSearchQuery(query);

    const filtered = players.filter((player) => {
      const fullName =
        (player.lastName + player.firstName + player.lastNameKana + player.firstNameKana).toLowerCase();
      const normalizedQuery = query.replace(/\s/g, '').toLowerCase();

      let currentIndex = 0;

      for (const char of normalizedQuery) {
        currentIndex = fullName.indexOf(char, currentIndex);
        if (currentIndex === -1) return false;
        currentIndex++; // 次の文字はこの位置以降で探す
      }

      return true;
    });

    const sortedFiltered = filtered.sort((a, b) => {
      const fullNameA = a.lastNameKana + a.firstNameKana;
      const fullNameB = b.lastNameKana + b.firstNameKana;
      return fullNameA.localeCompare(fullNameB, 'ja');
    });

    setFilteredPlayers(sortedFiltered);
  };


  if (!isClient) {
    return null; // クライアントサイドでない場合はレンダリングしない
  }

  return (
    <>
      <MetaHead
        title="試合結果まとめ | ソフトテニス情報"
        description="最新試合結果・大会情報・成績をまとめたサイトです。"
        url="https://softeni.vercel.app"
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

        <section>
          <LiveResultsByTournament playersData={players} />
          <div className="text-right mb-2">
            <Link href={`/tournaments`} className="text-sm text-blue-500 hover:underline">
              大会結果一覧
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-4">🎾 選手一覧</h2>
          {/* 名前検索フォーム */}
          <div className="mb-4">
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="選手名で検索"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredPlayers.map((player) => (
              <div
                key={player.id}
                onClick={() => (window.location.href = `/players/${player.id}`)}
                className="border border-gray-300 rounded-xl p-4 shadow-md bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
                  {player.lastName} {player.firstName}（{player.lastNameKana} {player.firstNameKana}）
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">{player.team}</p>
                <div className="flex justify-start mt-4">
                  <Link
                    href={`/players/${player.id}/results`}
                    className="px-3 py-1 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                    onClick={(e) => e.stopPropagation()} // カードクリックと干渉しないように
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
