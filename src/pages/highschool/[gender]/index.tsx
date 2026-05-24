import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

type Prefecture = {
  id: string;
  name: string;
  region: string;
};

type Props = {
  grouped: Record<string, Prefecture[]>;
  gender: 'boys' | 'girls';
};

export default function HighschoolGenderIndex({ grouped, gender }: Props) {
  const pageUrl = `https://softeni-pick.com/highschool/${gender}`;
  const genderLabel = gender === 'boys' ? '男子' : '女子';

  return (
    <>
      <MetaHead
        title={`高校${genderLabel} 全国大会成績・都道府県別一覧 | ソフトテニス情報`}
        description={`高校${genderLabel}の全国大会成績を都道府県別に掲載。ソフトテニスの全国高等学校総合体育大会やハイスクールジャパンカップなど主要大会の結果確認に対応。`}
        url={pageUrl}
        type="article"
      />

      <Head>
        <title>
          高校{genderLabel} 全国大会成績・都道府県別一覧 | ソフトテニス情報
        </title>

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
                  name: `高校${genderLabel}`,
                  item: `https://softeni-pick.com/highschool/${gender}`,
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              {
                label: `高校${genderLabel}`,
                href: `/highschool/${gender}`,
              },
            ]}
          />

          <h1 className="text-2xl font-bold mb-6">
            高校{genderLabel} 全国大会成績
          </h1>

          <div className="mb-8">
            <div className="flex gap-4 justify-center">
              <Link
                href="/highschool/boys"
                className={`px-8 py-4 rounded-lg border-2 transition block text-center ${
                  gender === 'boys'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                    : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="text-3xl mb-2">👦</div>
                <div className="text-lg font-bold">男子</div>
              </Link>

              <Link
                href="/highschool/girls"
                className={`px-8 py-4 rounded-lg border-2 transition block text-center ${
                  gender === 'girls'
                    ? 'border-pink-500 bg-pink-50 dark:bg-pink-900'
                    : 'border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="text-3xl mb-2">👧</div>
                <div className="text-lg font-bold">女子</div>
              </Link>
            </div>
          </div>

          <div className="mb-8 space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <p>
              高校{genderLabel}
              の全国大会成績を、都道府県別に確認できる一覧ページです。
              全国高等学校総合体育大会、高校総体、ハイスクールジャパンカップ、
              選抜大会など、ソフトテニス主要大会での学校別実績をたどれます。
            </p>
            <p>
              地域または都道府県を選ぶと、その県の出場校一覧、近年の好成績校、
              学校ごとの詳細成績ページへ進めます。
            </p>
          </div>

          <div className="space-y-8">
            {Object.entries(grouped).map(([region, prefs]) => (
              <section key={region}>
                <h2 className="text-lg font-semibold mb-2">{region}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {prefs.map((pref) => (
                    <Link
                      key={pref.id}
                      href={`/highschool/${gender}/${pref.id}`}
                      className="block px-4 py-2 text-center border border-gray-300 rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      {pref.name}
                    </Link>
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

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: [{ params: { gender: 'boys' } }, { params: { gender: 'girls' } }],
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { gender } = context.params as { gender: 'boys' | 'girls' };

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
    props: { grouped, gender },
  };
};
