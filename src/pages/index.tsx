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

  // クライアントサイドでのみ処理を実行
  useEffect(() => {
    setIsClient(true);
  }, []);

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
              全国大会を中心に、出場選手の成績、チームごとの戦績、試合の勝敗データを掲載しています。選手ページでは、過去の出場履歴や勝率といった活躍を確認できます。
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

            {/* <LiveResultsByTournament playersData={players} /> */}

            {/* ✅ 最近追加された大会（カード形式） */}
            <section className="max-w-4xl mx-auto mb-12 px-4">
              <h2 className="text-xl font-bold mb-4">最近追加された大会</h2>

              <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">
                全日本選手権や高校の全国大会を中心に、最新の試合結果を随時掲載しています。過去の大会を後から追加した場合も、こちらに表示されます。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 mb-4">
                {[
                  {
                    id: 'highschool/highschool-championship',
                    year: 2025,
                    name: '全国高等学校総合体育大会',
                    category: 'ダブルス、団体',
                    startDate: '2025-07-25',
                  },
                  {
                    id: 'east',
                    year: 2025,
                    name: '東日本ソフトテニス選手権大会',
                    category: 'ダブルス',
                    startDate: '2025-07-19',
                  },
                  {
                    id: 'west',
                    year: 2025,
                    name: '西日本ソフトテニス選手権大会',
                    category: 'ダブルス',
                    startDate: '2025-07-12',
                  },
                  {
                    id: 'highschool/highschool-japan-cup',
                    year: 2025,
                    name: 'ハイスクールジャパンカップ',
                    category: 'ダブルス、シングルス',
                    startDate: '2025-06-20',
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

              <div className="text-right mb-10">
                <Link
                  href="/tournaments"
                  className="text-sm text-blue-500 hover:underline"
                >
                  過去の大会結果一覧はこちら
                </Link>
              </div>
            </section>

            {/* ✅ よく見られている選手（カード形式） */}
            <section className="max-w-4xl mx-auto mb-12 px-4">
              <h2 className="text-xl font-bold mb-4">よく見られている選手</h2>

              <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">
                本サイトにてよく見られている選手です。選手ごとにプロフィールや大会の成績を確認できます。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
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
                    id: 'maruyama-kaito',
                    name: '丸山 海斗',
                    team: 'one team',
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

              {/* ✅ 一覧ページへのリンク */}
              <div className="text-right mb-10">
                <Link
                  href="/players"
                  className="text-sm text-blue-500 hover:underline"
                >
                  掲載中の選手一覧はこちら
                </Link>
              </div>
            </section>

            {/* ✅ 高校カテゴリへのリンク */}
            <section className="mb-12 px-4">
              <h2 className="text-xl font-semibold mb-4">属性別成績</h2>

              <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">
                全国大会での成績を属性別にまとめています。都道府県ごとにも確認できるので、出身地や気になる地域の情報もチェックしてみてください。
              </p>

              <div
                onClick={() => (window.location.href = `/highschool`)}
                className="border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <h3 className="text-lg font-bold mb-1">高校カテゴリ</h3>
              </div>
            </section>

            {/* ✅ 所属別成績 */}
            <section className="mb-12 px-4">
              <h2 className="text-xl font-semibold mb-4">所属別成績</h2>

              <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">
                所属ごとに選手の年間成績や大会別の記録をまとめています。所属単位での活躍や個人の成績なども確認できます。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => (window.location.href = `/teams/nssu`)}
                  className="border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <h3 className="text-lg font-bold mb-1">日本体育大学</h3>
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

                <div className="border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 opacity-60">
                  <h3 className="text-lg font-bold mb-1 text-gray-500 dark:text-gray-400">
                    Coming Soon
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    準備中...
                  </p>
                </div>
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
