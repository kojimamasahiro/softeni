// src/pages/index.tsx
import fs from 'fs';
import path from 'path';

import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import LiveResultsByTournament from '@/components/LiveResultsByTournament';
import MetaHead from '@/components/MetaHead';
import { PlayerInfo } from '@/types/index';

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
      const fullNameAndTeamName = (
        player.lastName +
        player.firstName +
        player.lastNameKana +
        player.firstNameKana +
        player.team
      ).toLowerCase();
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

  return (
    <>
      <MetaHead
        title="試合結果まとめ | ソフトテニス情報"
        description="最新試合結果・大会情報・成績をまとめたサイトです。"
        url="https://softeni-pick.com"
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'ホーム',
                  item: 'https://softeni-pick.com/',
                },
              ],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: 'Softeni Pick',
              url: 'https://softeni-pick.com/',
              inLanguage: 'ja',
              dateModified: new Date().toISOString().split('T')[0],
              publisher: {
                '@type': 'Organization',
                name: 'Softeni Pick',
              },
            }),
          }}
        />
      </Head>

      {!isClient ? null : (
        <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
          <div className="max-w-3xl mx-auto">
            <Breadcrumbs crumbs={[{ label: 'ホーム', href: '/' }]} />
          </div>

          {/* ✅ サイト紹介文（ページ最上部に設置） */}
          <section className="max-w-3xl mx-auto mb-10 px-4">
            <h1 className="text-2xl font-bold mb-4">Softeni Pickとは</h1>
            <p className="text-lg leading-relaxed mb-4">
              <strong>Softeni Pick（ソフテニ・ピック）</strong>
              は、ソフトテニスの大会結果や選手・チーム情報を整理・記録する、個人運営のデータベース型Webメディアです。
            </p>
            <p className="text-lg leading-relaxed mb-4">
              全国大会を中心に、出場選手の成績、チームごとの戦績、試合の勝敗データをわかりやすく掲載しています。選手ページでは、過去の出場履歴や勝率、所属チームでの活躍も確認できます。
            </p>
            <p className="text-lg leading-relaxed mb-4">
              学校やチームの枠を超え、ソフトテニスの競技としての魅力や流れを「記録」としてたどれる場を目指しています。
            </p>
            <p className="text-lg leading-relaxed">
              指導者・選手・ファンの皆様が、試合の振り返りや戦績の確認、育成・分析にご活用いただけるよう、今後も内容を拡充していきます。
            </p>
          </section>

          {/* ✅ 試合結果・大会リンク */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold mb-6">ソフトテニス情報</h2>

            <LiveResultsByTournament playersData={players} />

            {/* ✅ よく見られている選手（カード形式） */}
            <section className="max-w-4xl mx-auto mb-12 px-4">
              <h2 className="text-xl font-bold mb-4">よく見られている選手</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  {
                    id: 'uematsu-toshiki',
                    name: '上松 俊樹',
                    team: 'NTT西日本',
                  },
                  {
                    id: 'ueoka-shunsuke',
                    name: '上岡 俊介',
                    team: 'Up Rise',
                  },
                  {
                    id: 'uchida-riku',
                    name: '内田 理久',
                    team: 'NTT西日本',
                  },
                ].map((player) => (
                  <div
                    key={player.id}
                    onClick={() =>
                      (window.location.href = `/players/${player.id}`)
                    }
                    className="border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <h3 className="text-lg font-bold mb-1">{player.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {player.team}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* ✅ 最近追加された大会（カード形式） */}
            <section className="max-w-4xl mx-auto mb-12 px-4">
              <h2 className="text-xl font-bold mb-4">最近追加された大会</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4">
                {[
                  {
                    id: 'highschool/highschool-japan-cup',
                    year: 2025,
                    name: 'ハイスクールジャパンカップ',
                    category: 'ダブルス、シングルス',
                    startDate: '2025-06-20',
                  },
                  {
                    id: 'highschool/highschool-championship',
                    year: 2024,
                    name: '全国高等学校総合体育大会',
                    category: 'ダブルス、団体',
                    startDate: '2024-07-25',
                  },
                  {
                    id: 'zennihon-mix-doubles',
                    year: 2025,
                    name: '全日本ミックスダブルス選手権大会',
                    category: 'ダブルス',
                    startDate: '2025-06-14',
                  },
                  {
                    id: 'zennihon-singles',
                    year: 2025,
                    name: '全日本シングルス選手権大会',
                    category: 'シングルス',
                    startDate: '2025-05-17',
                  },
                ].map((tournament) => (
                  <div
                    key={`${tournament.id}-${tournament.year}-${tournament.category}`}
                    onClick={() =>
                      (window.location.href = `/tournaments/${tournament.id}/${tournament.year}`)
                    }
                    className="border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      開催日:
                      {new Date(tournament.startDate).toLocaleDateString(
                        'ja-JP',
                      )}
                      　{tournament.category}
                    </p>
                    <h3 className="text-lg font-bold">{tournament.name}</h3>
                  </div>
                ))}
              </div>
            </section>

            {/* ✅ 高校カテゴリへのリンク */}
            <section className="mb-12 px-4">
              <h2 className="text-xl font-semibold mb-4">属性別成績</h2>
              <div
                onClick={() => (window.location.href = `/highschool`)}
                className="border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <h3 className="text-lg font-bold mb-1">高校カテゴリ</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  最新の高校カテゴリ全国大会の結果から、各高校のチームや選手の活躍を確認できます。
                </p>
              </div>
            </section>

            {/* ✅ 所属別成績 */}
            <section className="mb-12 px-4">
              <h2 className="text-xl font-semibold mb-4">所属別成績</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => (window.location.href = `/teams/nssu`)}
                  className="border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <h3 className="text-lg font-bold mb-1">日本体育大学</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    年間成績・大会別成績・選手ごとの記録
                  </p>
                  <a
                    href="https://nittai-softtennis.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-700 dark:text-blue-300 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    公式サイト
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="ml-1 h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              </div>
            </section>

            {/* ✅ 選手一覧・検索 */}
            <section className="mb-8 px-4">
              <h2 className="text-xl font-semibold mb-4">選手一覧</h2>
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
                      onClick={() =>
                        (window.location.href = `/players/${player.id}`)
                      }
                      className={`border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer transition
              hover:bg-gray-50 dark:hover:bg-gray-700
              ${isRetired ? 'opacity-70' : ''}`}
                    >
                      <h2 className="text-lg font-bold mb-1">
                        {player.lastName} {player.firstName}（
                        {player.lastNameKana} {player.firstNameKana}）
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
      )}
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
