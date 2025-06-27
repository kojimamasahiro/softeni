// src/pages/tournaments/index.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

interface Tournament {
  id: string;
  name: string;
  years: number[];
  sortId: number;
}

export default function TournamentListPage({
  tournaments,
  highschoolTournaments,
}: {
  tournaments: Tournament[];
  highschoolTournaments: Tournament[];
}) {
  const pageUrl = `https://softeni-pick.com/tournaments`;

  return (
    <>
      <MetaHead
        title={'大会結果一覧 | ソフトテニス情報'}
        description={`過去の大会結果・試合成績を掲載`}
        url={pageUrl}
        type="article"
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: `大会結果一覧`,
              author: {
                '@type': 'Person',
                name: 'Softeni Pick',
              },
              publisher: {
                '@type': 'Organization',
                name: 'Softeni Pick',
              },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': pageUrl,
              },
              description: `過去の大会結果・試合成績を掲載`,
            }),
          }}
        ></script>

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
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: `大会結果一覧`,
                  item: 'https://softeni-pick.com/tournaments',
                },
              ],
            }),
          }}
        ></script>
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: '大会結果一覧', href: '/tournaments' },
            ]}
          />

          {/* ✅ 追加: 紹介文セクション */}
          <section className="mb-10">
            <h1 className="text-2xl font-bold mb-4">
              大会一覧 | ソフトテニス主要大会
            </h1>
            <p className="text-lg leading-relaxed mb-4">
              こちらは、Softeni
              Pickが収録しているソフトテニスの大会一覧ページです。
              主要な全日本大会をはじめ、インターハイ・選抜、大学大会や実業団大会なども整理して掲載していく予定です。
            </p>
            <p className="text-lg leading-relaxed">
              各大会のページでは、年度ごとの出場選手や試合結果、所属別の記録などを確認することができます。
              下記から大会カテゴリごとにご覧いただけます。
            </p>
          </section>

          {/* ✅ 見出しをh2に変更（ページ全体でh1は1つに） */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-6">大会結果一覧</h2>

            <div className="space-y-8">
              {tournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow"
                >
                  <h3 className="text-lg font-semibold mb-4 border-b text-gray-800 dark:text-white">
                    {tournament.name}
                  </h3>

                  <ul className="flex flex-wrap gap-2">
                    {tournament.years.map((year) => (
                      <li key={year}>
                        <Link href={`/tournaments/${tournament.id}/${year}`}>
                          <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full text-sm hover:opacity-80 transition">
                            {year}年
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* 高校カテゴリ */}
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-6">
              高校カテゴリの大会一覧
            </h2>
            <div className="space-y-8">
              {highschoolTournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow"
                >
                  <h3 className="text-lg font-semibold mb-4 border-b text-gray-800 dark:text-white">
                    {tournament.name}
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {tournament.years.map((year) => (
                      <li key={year}>
                        <Link
                          href={`/tournaments/highschool/${tournament.id}/${year}`}
                        >
                          <span className="inline-block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-3 py-1 rounded-full text-sm hover:opacity-80 transition">
                            {year}年
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const loadTournaments = (
    dataDir: string,
    urlPrefix: string,
  ): Tournament[] => {
    const fullPath = path.join(process.cwd(), dataDir);
    if (!fs.existsSync(fullPath)) return [];

    return fs.readdirSync(fullPath).flatMap((tournamentId) => {
      const metaPath = path.join(fullPath, tournamentId, 'meta.json');
      const tournamentDir = path.join(fullPath, tournamentId);
      if (!fs.existsSync(metaPath)) return [];

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const yearDirs = fs
        .readdirSync(tournamentDir)
        .filter(
          (name) =>
            /^\d{4}$/.test(name) &&
            fs.statSync(path.join(tournamentDir, name)).isDirectory(),
        );

      const years: number[] = [];

      for (const year of yearDirs) {
        const dataPath = path.join(tournamentDir, year, 'results.json');
        try {
          const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
          if (data.status === 'completed') {
            years.push(parseInt(year, 10));
          }
        } catch (err) {
          console.warn(
            `読み込みエラー: ${dataDir}/${tournamentId}/${year}`,
            err,
          );
        }
      }

      if (years.length === 0) return [];

      return [
        {
          id: tournamentId,
          name: meta.name || tournamentId,
          years: years.sort((a, b) => b - a),
          sortId: meta.sortId ?? 9999,
          baseUrl: urlPrefix,
        },
      ];
    });
  };

  const generalTournaments = loadTournaments(
    'data/tournaments',
    '/tournaments',
  );
  const highschoolTournaments = loadTournaments(
    'data/tournaments/highschool',
    '/tournaments/highschool',
  );

  return {
    props: {
      tournaments: generalTournaments.sort((a, b) => a.sortId - b.sortId),
      highschoolTournaments: highschoolTournaments.sort(
        (a, b) => a.sortId - b.sortId,
      ),
    },
  };
};
