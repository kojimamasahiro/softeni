// src/pages/highschool/index.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Head from 'next/head';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

type Entry = {
  team: string;
  teamId: string;
  prefecture: string;
  prefectureId: string;
  result: string;
  category: 'singles' | 'doubles' | 'team';
  tournamentId: string;
  year: number;
};

type Props = {
  data: Entry[];
};

const TOURNAMENT_LABEL = 'ハイスクールジャパンカップ';
const TOURNAMENT_YEAR = 2025;
const PAGE_URL = 'https://softeni-pick.com/highschool';

const categoryLabel = (category: string): string => {
  switch (category) {
    case 'singles':
      return 'シングルス';
    case 'doubles':
      return 'ダブルス';
    case 'team':
      return '団体戦';
    default:
      return category;
  }
};

export default function HighschoolIndex({ data }: Props) {
  const grouped = data.reduce((acc: Record<string, Entry[]>, item) => {
    if (!acc[item.prefecture]) acc[item.prefecture] = [];
    acc[item.prefecture].push(item);
    return acc;
  }, {});

  return (
    <>
      <MetaHead
        title={`高校カテゴリの大会成績一覧（${TOURNAMENT_YEAR} ${TOURNAMENT_LABEL}）`}
        description={`2025年の${TOURNAMENT_LABEL}における都道府県ごとの上位校を種目別に掲載`}
        url={PAGE_URL}
        image={`https://softeni-pick.com/api/og/highschool?tournament=${TOURNAMENT_LABEL}&year=${TOURNAMENT_YEAR}`}
        type="article"
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
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: '高校カテゴリ成績一覧',
                  item: PAGE_URL,
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
              '@type': 'Article',
              headline: `高校カテゴリ成績一覧（${TOURNAMENT_YEAR} ${TOURNAMENT_LABEL}）`,
              author: { '@type': 'Person', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
              datePublished: `${TOURNAMENT_YEAR}-07-01`,
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': PAGE_URL,
              },
              description: `2025年の${TOURNAMENT_LABEL}における都道府県ごとの上位校を種目別に掲載`,
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: '高校カテゴリ成績一覧', href: '/highschool' },
            ]}
          />

          <h1 className="text-2xl font-bold">高校カテゴリ上位校一覧</h1>

          <section className="text-m text-gray-700 dark:text-gray-300 leading-relaxed">
            <p className="mb-2">
              本ページは高校カテゴリのトップページとして、
              {TOURNAMENT_YEAR}年の{TOURNAMENT_LABEL}
              における都道府県ごとの上位校をまとめています。
            </p>
            <p>
              ダブルス・シングルス・団体戦のカテゴリごとに、
              都道府県内で最も成績の良かった高校を掲載しています。
            </p>
          </section>

          <div className="space-y-6">
            {Object.entries(grouped).map(([prefecture, entries]) => (
              <section
                key={prefecture}
                className="border-t pt-4 border-gray-300 dark:border-gray-700"
              >
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                  {prefecture}
                </h2>
                <ul className="list-disc ml-5 space-y-1">
                  {entries.map((entry) => (
                    <li key={`${entry.category}-${entry.teamId}`}>
                      {categoryLabel(entry.category)}：
                      {/* <a
                        href={`/highschool/${entry.prefectureId}/${entry.teamId}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline ml-1"
                      >
                        {entry.team}
                      </a> */}
                      {entry.team}（{entry.result}）
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const filePath = path.join(
    process.cwd(),
    'data/highschool/prefecture-summary.json',
  );
  const json = fs.readFileSync(filePath, 'utf-8');
  const data: Entry[] = JSON.parse(json);

  return {
    props: { data },
  };
};
