// src/pages/highschool/[prefectureId]/index.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

type TeamSummary = {
  teamId: string;
  teamName: string;
  results: Record<
    string,
    {
      tournament: string;
      result: string;
    }
  >;
};

type SummaryEntry = {
  team: string;
  teamId: string;
  prefecture: string;
  prefectureId: string;
  result: string;
  category: 'singles' | 'doubles' | 'team';
  tournamentId: string;
  year: number;
  playerIds?: string[];
};

type Prefecture = {
  id: string;
  name: string;
  region: string;
};

type Props = {
  prefecture: Prefecture;
  teams: TeamSummary[];
};

export default function PrefectureHighschoolPage({ prefecture, teams }: Props) {
  const pageUrl = `https://softeni-pick.com/highschool/${prefecture.id}`;
  const prefectureName = prefecture.name;

  return (
    <>
      <MetaHead
        title={`${prefectureName}の高校成績 | ソフトテニス情報`}
        description={`${prefectureName}の高校の大会成績を一覧で掲載。`}
        url={pageUrl}
        type="article"
      />

      <Head>
        <script
          title={`${prefectureName}の高校成績 | ソフトテニス情報`}
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
                  item: 'https://softeni-pick.com/highschool',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: prefectureName,
                  item: pageUrl,
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
              { label: '高校カテゴリ', href: '/highschool' },
              { label: prefecture.name, href: `/highschool/${prefecture.id}` },
            ]}
          />

          <h1 className="text-2xl font-bold mb-2">
            {prefecture.name}の高校成績
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            {prefecture.region}地域の{prefecture.name}
            における高校ソフトテニスの全国大会成績を掲載しています。
          </p>

          <div className="mb-6">
            <p className="text-sm">
              出場校数：{teams.length}校（ベスト8以上：
              {
                teams.filter((t) =>
                  Object.values(t.results).some((r) =>
                    ['優勝', '準優勝', 'ベスト4', 'ベスト8'].includes(r.result),
                  ),
                ).length
              }
              校）
            </p>
          </div>

          <ul className="space-y-4">
            {teams.map((team) => (
              <li
                key={team.teamId}
                className="border rounded p-4 bg-white dark:bg-gray-800 dark:border-gray-700"
              >
                <a
                  href={`/highschool/${prefecture.id}/${team.teamId}`}
                  className="text-lg font-semibold text-blue-600 dark:text-blue-300 hover:underline"
                >
                  {team.teamName}
                </a>
                <ul className="text-sm mt-2">
                  {Object.entries(team.results ?? {}).length === 0 ? (
                    <p className="text-sm text-gray-500">
                      成績情報がありません
                    </p>
                  ) : (
                    <ul className="text-sm mt-2">
                      {Object.entries(team.results)
                        .sort((a, b) => Number(b[0]) - Number(a[0]))
                        .map(([year, res]) => (
                          <li key={year}>
                            {year}年：{res.tournament}（{res.result}）
                          </li>
                        ))}
                    </ul>
                  )}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const file = path.join(process.cwd(), 'data/prefectures.json');
  const prefectures: Prefecture[] = JSON.parse(fs.readFileSync(file, 'utf-8'));

  const paths = prefectures.map((pref) => ({
    params: { prefectureId: pref.id },
  }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { prefectureId } = context.params as { prefectureId: string };

  const prefFile = path.join(process.cwd(), 'data/prefectures.json');
  const allPrefs: Prefecture[] = JSON.parse(fs.readFileSync(prefFile, 'utf-8'));
  const prefecture = allPrefs.find((p) => p.id === prefectureId);

  if (!prefecture) return { notFound: true };

  const summaryPath = path.join(
    process.cwd(),
    `data/highschool/${prefectureId}/summary.json`,
  );

  const rawData: SummaryEntry[] = fs.existsSync(summaryPath)
    ? JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
    : [];

  // ✅ チームごとにグループ化
  const grouped: Record<string, TeamSummary> = {};
  for (const entry of rawData) {
    const { teamId, team, year, tournamentId, result } = entry;
    if (!grouped[teamId]) {
      grouped[teamId] = {
        teamId,
        teamName: team,
        results: {},
      };
    }

    grouped[teamId].results[year] = {
      tournament:
        tournamentId === 'highschool-japan-cup'
          ? 'ハイスクールジャパンカップ'
          : tournamentId,
      result,
    };
  }

  const teams: TeamSummary[] = Object.values(grouped);

  return {
    props: {
      prefecture,
      teams,
    },
  };
};
