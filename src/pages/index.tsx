import LiveResultsByTournament from '@/components/LiveResultsByTournament';
import MetaHead from '@/components/MetaHead';
import { PlayerInfo } from '@/types/index';
import fs from 'fs';
import Head from 'next/head';
import Link from 'next/link';
import path from 'path';
import { useEffect, useState } from 'react';
import tennisIcon from '@/assets/tennis.png';
import schoolIcon from '@/assets/school.png';
import Image from 'next/image';

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

  // ✅ 初期表示時にプレイヤーを名前順でソート
  useEffect(() => {
    const sorted = [...players].sort((a, b) => {
      const fullNameA = a.lastNameKana + a.firstNameKana;
      const fullNameB = b.lastNameKana + b.firstNameKana;
      return fullNameA.localeCompare(fullNameB, 'ja');
    });
    setFilteredPlayers(sorted);
  }, [players]);

  // 検索結果をフィルタリングする関数
  // 検索処理
  const handleSearch = (query: string) => {
    setSearchQuery(query);

    const filtered = players.filter((player) => {
      const fullNameAndTeamName =
        (player.lastName + player.firstName + player.lastNameKana + player.firstNameKana + player.team).toLowerCase();
      const normalizedQuery = query.replace(/\s/g, '').toLowerCase();

      let currentIndex = 0;
      for (const char of normalizedQuery) {
        currentIndex = fullNameAndTeamName.indexOf(char, currentIndex);
        if (currentIndex === -1) return false;
        currentIndex++;
      }

      return true;
    });

    // ✅ 検索後も名前順でソート
    const sortedFiltered = [...filtered].sort((a, b) => {
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

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">試合結果まとめ | ソフトテニス情報</h1>

          <LiveResultsByTournament playersData={players} />

          <div className="text-right mb-2">
            <Link href={`/tournaments`} className="text-sm text-blue-500 hover:underline">
              大会結果一覧
            </Link>
          </div>

          <section className="mb-8 px-4">
            <h2 className="text-xl flex font-semibold mb-4"><Image src={schoolIcon} alt="お知らせ" width={24} height={24} /> 所属別成績</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => (window.location.href = `/teams/nssu`)}
                className="border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">日本体育大学</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">年間成績・大会別成績・選手ごとの記録</p>
                <a
                  href="https://nittai-softtennis.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-700 dark:text-blue-300 underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  公式サイト
                </a>
              </div>
            </div>
          </section>

          <section className="mb-8 px-4">
            <h2 className="text-xl flex font-semibold mb-4"><Image src={tennisIcon} alt="お知らせ" width={24} height={24} /> 選手一覧</h2>
            {/* 名前検索フォーム */}
            <div className="mb-4">
              <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="選手名や所属で検索"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredPlayers.map((player) => {
                const isRetired = player.retired;

                return (
                  <div
                    key={player.id}
                    onClick={() => (window.location.href = `/players/${player.id}`)}
                    className={`border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer transition
          hover:bg-gray-50 dark:hover:bg-gray-700
          ${isRetired ? 'opacity-70' : ''}`}
                  >
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
                      {player.lastName} {player.firstName}（{player.lastNameKana} {player.firstNameKana}）
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                      {isRetired ? (
                        <span className="inline-block px-2 py-0.5 text-xs text-white bg-gray-500 rounded">
                          引退済み
                        </span>
                      ) : (
                        player.team
                      )}
                    </p>

                    <div className="flex justify-start mt-4">
                      <Link
                        href={`/players/${player.id}/results`}
                        className="px-3 py-1 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        試合結果
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
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
