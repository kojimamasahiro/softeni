import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Head from 'next/head';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

type Prefecture = {
  id: string;
  name: string;
  region: string;
};

type Props = {
  grouped: Record<string, Prefecture[]>;
};

export default function HighschoolIndex({ grouped }: Props) {
  const pageUrl = 'https://softeni-pick.com/highschool';

  return (
    <>
      <MetaHead
        title="高校カテゴリ | ソフトテニス情報"
        description="全国の高校ソフトテニスの成績を都道府県別に掲載"
        url={pageUrl}
        type="article"
      />

      <Head>
        <title>高校カテゴリ | ソフトテニス情報</title>

        {/* ✅ 構造化データ（パンくずリスト） */}
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
                  name: '高校カテゴリ',
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          {/* ✅ パンくずリスト */}
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: '高校カテゴリ', href: '/highschool' },
            ]}
          />

          <h1 className="text-2xl font-bold mb-6">高校カテゴリ</h1>
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
            全国の高校ソフトテニス成績を都道府県ごとにまとめています。地域を選んでご覧ください。
          </p>

          <div className="space-y-8">
            {Object.entries(grouped).map(([region, prefs]) => (
              <section key={region}>
                <h2 className="text-lg font-semibold mb-2">{region}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {prefs.map((pref) => (
                    <a
                      key={pref.id}
                      href={`/highschool/${pref.id}`}
                      className="block px-4 py-2 text-center border border-gray-300 rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      {pref.name}
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const filePath = path.join(process.cwd(), 'data/prefectures.json');
  const json = fs.readFileSync(filePath, 'utf-8');
  const prefectures: Prefecture[] = JSON.parse(json);

  const grouped = prefectures.reduce(
    (acc: Record<string, Prefecture[]>, pref) => {
      if (!acc[pref.region]) acc[pref.region] = [];
      acc[pref.region].push(pref);
      return acc;
    },
    {},
  );

  return {
    props: { grouped },
  };
};
