import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import HighschoolGenderToggle from '@/components/highschool/HighschoolGenderToggle';
import PageLayout from '@/components/PageLayout';
import {
  getGenderLabel,
  isBest8Result,
  isVisibleGender,
} from '@/lib/highschool';

type Prefecture = {
  id: string;
  name: string;
  region: string;
};

type SummaryEntry = {
  teamId: string;
  result: string;
  year: number;
  gender: 'boys' | 'girls' | 'mixed';
};

type PrefectureStat = {
  id: string;
  name: string;
  region: string;
  teamCount: number;
  best8Count: number;
  latestYear: number | null;
};

type Props = {
  grouped: Record<string, Prefecture[]>;
  gender: 'boys' | 'girls';
  statsByPrefecture: Record<string, PrefectureStat>;
  featuredPrefectures: PrefectureStat[];
  totalTeams: number;
  totalBest8Schools: number;
  latestIndexedYear: number | null;
};

export default function HighschoolGenderIndex({
  grouped,
  gender,
  statsByPrefecture,
  featuredPrefectures,
  totalTeams,
  totalBest8Schools,
  latestIndexedYear,
}: Props) {
  const pageUrl = `https://softeni-pick.com/highschool/${gender}/`;
  const genderLabel = getGenderLabel(gender);
  const faqItems = [
    {
      question: `高校${genderLabel} 全国大会成績ページでは何が分かりますか？`,
      answer: `都道府県ごとの出場校一覧、学校ごとの全国大会成績、全国高等学校総合体育大会やハイスクールジャパンカップなど主要大会での実績を確認できます。`,
    },
    {
      question: 'インターハイに近い情報を追うにはどこを見ればよいですか？',
      answer: `各都道府県ページでは最新年度の好成績校や学校別実績をまとめています。気になる学校を開くと、全国高等学校総合体育大会を含む年度別の成績を確認できます。`,
    },
    {
      question: '男子と女子は分かれていますか？',
      answer:
        '男子・女子はページを分けて整理しており、それぞれ都道府県別、学校別にたどれます。',
    },
  ];

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: `高校${genderLabel} 全国大会成績・都道府県別一覧`,
              description: `高校${genderLabel}の全国大会成績を都道府県別に掲載し、学校ごとの主要大会実績を確認できる一覧ページです。`,
              url: pageUrl,
              inLanguage: 'ja',
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqItems.map((item) => ({
                '@type': 'Question',
                name: item.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: item.answer,
                },
              })),
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              name: `高校${genderLabel} 都道府県別ページ一覧`,
              itemListElement: Object.values(statsByPrefecture)
                .filter((prefecture) => prefecture.teamCount > 0)
                .map((prefecture, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: prefecture.name,
                  url: `https://softeni-pick.com/highschool/${gender}/${prefecture.id}`,
                })),
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl">
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

        <HighschoolGenderToggle
          gender={gender}
          boysHref="/highschool/boys"
          girlsHref="/highschool/girls"
          className="mb-8 max-w-sm mx-auto"
        />

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

        <section className="grid gap-4 sm:grid-cols-3 mb-8">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              収録学校数
            </p>
            <p className="text-2xl font-bold">{totalTeams}校</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ベスト8以上経験校
            </p>
            <p className="text-2xl font-bold">{totalBest8Schools}校</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              最新収録年度
            </p>
            <p className="text-2xl font-bold">
              {latestIndexedYear ? `${latestIndexedYear}年` : '-'}
            </p>
          </div>
        </section>

        {featuredPrefectures.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-semibold mb-3">
              今、注目したい都道府県
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              ベスト8以上の学校数と最新年度の掲載状況をもとに、回遊しやすい県を先にまとめています。
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {featuredPrefectures.map((prefecture) => (
                <Link
                  key={prefecture.id}
                  href={`/highschool/${gender}/${prefecture.id}`}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold">{prefecture.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {prefecture.region} / 収録 {prefecture.teamCount}校
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold">
                        ベスト8以上 {prefecture.best8Count}校
                      </p>
                      <p className="text-gray-500 dark:text-gray-400">
                        最新 {prefecture.latestYear ?? '-'}年
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="space-y-8">
          {Object.entries(grouped).map(([region, prefs]) => (
            <section key={region}>
              <h2 className="text-lg font-semibold mb-2">{region}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {prefs.map((pref) => {
                  const stat = statsByPrefecture[pref.id];
                  const teamCount = stat?.teamCount ?? 0;

                  if (teamCount === 0) {
                    return (
                      <div
                        key={pref.id}
                        className="block px-4 py-3 border border-dashed border-gray-300 rounded-md bg-gray-50 dark:bg-gray-900 dark:border-gray-700"
                      >
                        <span className="block font-semibold text-gray-400 dark:text-gray-500">
                          {pref.name}
                        </span>
                        <span className="block mt-1 text-xs text-gray-400 dark:text-gray-500">
                          収録準備中
                        </span>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={pref.id}
                      href={`/highschool/${gender}/${pref.id}`}
                      className="block px-4 py-3 border border-gray-300 rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      <span className="block font-semibold">{pref.name}</span>
                      <span className="block mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {teamCount}校 / ベスト8以上 {stat?.best8Count ?? 0}校
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
          <h2 className="text-xl font-semibold mb-4">よくある質問</h2>
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
            {faqItems.map((item) => (
              <div
                key={item.question}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <h3 className="font-semibold mb-2">{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </PageLayout>
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
  const highschoolDir = path.join(process.cwd(), 'data/highschool/prefectures');

  const grouped = prefectures.reduce(
    (acc: Record<string, Prefecture[]>, pref) => {
      if (!acc[pref.region]) acc[pref.region] = [];
      acc[pref.region].push(pref);
      return acc;
    },
    {},
  );

  const statsByPrefecture: Record<string, PrefectureStat> = {};
  let totalTeams = 0;
  let totalBest8Schools = 0;
  let latestIndexedYear: number | null = null;

  for (const prefecture of prefectures) {
    const summaryPath = path.join(highschoolDir, prefecture.id, 'summary.json');
    const entries: SummaryEntry[] = fs.existsSync(summaryPath)
      ? JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
      : [];
    const filteredEntries = entries.filter((entry) =>
      isVisibleGender(entry.gender, gender),
    );
    const teamIds = new Set(filteredEntries.map((entry) => entry.teamId));
    const best8Teams = new Set(
      filteredEntries
        .filter((entry) => isBest8Result(entry.result))
        .map((entry) => entry.teamId),
    );
    const prefectureLatestYear =
      filteredEntries.length > 0
        ? Math.max(...filteredEntries.map((entry) => entry.year))
        : null;

    statsByPrefecture[prefecture.id] = {
      id: prefecture.id,
      name: prefecture.name,
      region: prefecture.region,
      teamCount: teamIds.size,
      best8Count: best8Teams.size,
      latestYear: prefectureLatestYear,
    };

    totalTeams += teamIds.size;
    totalBest8Schools += best8Teams.size;
    if (
      prefectureLatestYear !== null &&
      (latestIndexedYear === null || prefectureLatestYear > latestIndexedYear)
    ) {
      latestIndexedYear = prefectureLatestYear;
    }
  }

  const featuredPrefectures = Object.values(statsByPrefecture)
    .filter((prefecture) => prefecture.teamCount > 0)
    .sort((a, b) => {
      if (b.best8Count !== a.best8Count) return b.best8Count - a.best8Count;
      if ((b.latestYear ?? 0) !== (a.latestYear ?? 0)) {
        return (b.latestYear ?? 0) - (a.latestYear ?? 0);
      }
      if (b.teamCount !== a.teamCount) return b.teamCount - a.teamCount;
      return a.name.localeCompare(b.name, 'ja');
    })
    .slice(0, 6);

  return {
    props: {
      grouped,
      gender,
      statsByPrefecture,
      featuredPrefectures,
      totalTeams,
      totalBest8Schools,
      latestIndexedYear,
    },
  };
};
