// src/pages/highschool/[prefectureId]/[teamId].tsx
import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

type Analysis = {
  totalAppearances: number;
  byCategory: Record<string, number>;
  bestResults: Record<string, string>;
  uniquePlayers: number;
  topPlayers: { id: string; appearances: number }[];
};

type Prefecture = {
  id: string;
  name: string;
  region: string;
};

type Entry = {
  year: number;
  tournamentId: string;
  result: string;
  category: string;
  playerIds?: string[];
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

type Props = {
  prefectureName: string;
  prefectureId: string;
  teamId: string;
  teamName: string;
  entries: Entry[];
  analysis: Analysis | null;
};

export default function TeamPage({
  prefectureName,
  prefectureId,
  teamId,
  teamName,
  entries,
  analysis,
}: Props) {
  const pageUrl = `https://softeni-pick.com/highschool/${prefectureId}/${teamId}`;

  const grouped = entries.reduce(
    (acc, entry) => {
      if (!acc[entry.year]) acc[entry.year] = {};
      if (!acc[entry.year][entry.tournamentId])
        acc[entry.year][entry.tournamentId] = {};
      if (!acc[entry.year][entry.tournamentId][entry.category]) {
        acc[entry.year][entry.tournamentId][entry.category] = [];
      }
      acc[entry.year][entry.tournamentId][entry.category].push(entry);
      return acc;
    },
    {} as Record<string, Record<string, Record<string, Entry[]>>>,
  );

  return (
    <>
      <MetaHead
        title={`${teamName}の成績 | ソフトテニス情報`}
        description={`${teamName}のソフトテニス大会別成績を掲載。出場ペアや結果を年度・大会ごとに整理。${prefectureName}代表としての活躍記録をまとめています。`}
        url={pageUrl}
        type="article"
      />
      <Head>
        <title>{teamName}の成績 | ソフトテニス情報</title>
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
                  item: 'https://softeni-pick.com/highschool',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: prefectureName,
                  item: 'https://softeni-pick.com/highschool/' + prefectureId,
                },
                {
                  '@type': 'ListItem',
                  position: 4,
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
              {
                label: prefectureName,
                href: `/highschool/${prefectureId}`,
              },
              {
                label: teamName,
                href: `/highschool/${prefectureId}/${teamId}`,
              },
            ]}
          />
          <h1 className="text-2xl font-bold mb-6">{teamName}の成績</h1>
          <p className="text-sm text-gray-600 mb-6">
            {teamName}（{prefectureName}
            ）のソフトテニス部の大会別成績を掲載しています。
            出場選手の構成や試合結果を、年度・大会・カテゴリ（シングルス・ダブルス・団体戦）ごとに整理。
            学校のこれまでの戦績を振り返りながら、今後の活躍にもご注目ください。
          </p>

          <h1 className="text-2xl font-bold mb-4">{teamName}の成績</h1>

          {analysis && (
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded mb-8 text-sm">
              <p>出場大会数: {analysis.totalAppearances}</p>
              <p>選手数: {analysis.uniquePlayers}</p>
              <p className="mt-2 font-semibold">種目別出場数:</p>
              <ul className="ml-4 list-disc">
                {Object.entries(analysis.byCategory).map(([cat, num]) => (
                  <li key={cat}>
                    {getCategoryLabel(cat)}: {num}回
                  </li>
                ))}
              </ul>
              <p className="mt-2 font-semibold">種目別最高成績:</p>
              <ul className="ml-4 list-disc">
                {Object.entries(analysis.bestResults).map(([cat, result]) => (
                  <li key={cat}>
                    {getCategoryLabel(cat)}: {result}
                  </li>
                ))}
              </ul>
              {analysis.topPlayers.length > 0 && (
                <>
                  <p className="mt-2 font-semibold">出場回数が多い選手:</p>
                  <ul className="ml-4 list-disc">
                    {analysis.topPlayers.map((p) => {
                      const [last, first] = p.id.split('_');
                      return (
                        <li key={p.id}>
                          {last} {first}（{p.appearances}回）
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* 試合成績リスト（既存表示） */}
          {Object.keys(grouped).length === 0 ? (
            <p className="text-gray-600">成績情報がありません。</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped)
                .sort((a, b) => Number(b[0]) - Number(a[0]))
                .map(([year, tourneys]) => (
                  <section key={year}>
                    <h2 className="text-xl font-semibold mb-2">{year}年</h2>
                    {Object.entries(tourneys).map(([tId, cats]) => (
                      <div key={tId} className="mb-4 ml-4">
                        <h3 className="text-lg font-bold">
                          <Link
                            href={`/tournaments/${tId}/${year}`}
                            className="text-blue-700 dark:text-blue-300 hover:underline"
                          >
                            {getTournamentLabel(tId)}
                          </Link>
                        </h3>
                        <ul className="ml-4 mt-2 space-y-2">
                          {Object.entries(cats).map(([cat, items]) => (
                            <li key={cat}>
                              <p className="font-semibold">
                                {getCategoryLabel(cat)}（{items[0].result}）
                              </p>
                              {items[0].playerIds && (
                                <p className="text-sm text-gray-500">
                                  選手:{' '}
                                  {items[0].playerIds
                                    .map((pid) => {
                                      const parts = pid.split('_');
                                      return parts.length >= 2
                                        ? `${parts[0]} ${parts[1]}`
                                        : pid;
                                    })
                                    .join('・')}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function getTournamentLabel(id: string): string {
  switch (id) {
    case 'highschool-japan-cup':
      return 'ハイスクールジャパンカップ';
    case 'highschool-championship':
      return '全国高等学校総合体育大会';
    case 'highschool-senbatsu':
      return '選抜';
    case 'highschool-kokutai':
      return '国体';
    default:
      return id;
  }
}

function getCategoryLabel(cat: string): string {
  return cat === 'singles'
    ? 'シングルス'
    : cat === 'doubles'
      ? 'ダブルス'
      : '団体戦';
}

export const getStaticPaths: GetStaticPaths = async () => {
  const prefDir = path.join(process.cwd(), 'data/highschool');
  const prefectures = fs.readdirSync(prefDir);
  const paths: { params: { prefectureId: string; teamId: string } }[] = [];

  for (const prefId of prefectures) {
    const summaryPath = path.join(prefDir, prefId, 'summary.json');
    if (!fs.existsSync(summaryPath)) continue;

    const summary: SummaryEntry[] = JSON.parse(
      fs.readFileSync(summaryPath, 'utf-8'),
    );
    const teamIds = [...new Set(summary.map((e) => e.teamId))];

    for (const teamId of teamIds) {
      paths.push({ params: { prefectureId: prefId, teamId } });
    }
  }

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const prefFile = path.join(process.cwd(), 'data/prefectures.json');
  const allPrefs: Prefecture[] = JSON.parse(fs.readFileSync(prefFile, 'utf-8'));
  const { prefectureId, teamId } = context.params as {
    prefectureId: string;
    teamId: string;
  };
  const prefecture = allPrefs.find((p) => p.id === prefectureId);

  if (!prefecture) return { notFound: true };

  const summaryPath = path.join(
    process.cwd(),
    'data/highschool',
    prefectureId,
    'summary.json',
  );

  if (!fs.existsSync(summaryPath)) {
    return { notFound: true };
  }

  const allEntries: SummaryEntry[] = JSON.parse(
    fs.readFileSync(summaryPath, 'utf-8'),
  );
  const entries = allEntries.filter((e) => e.teamId === teamId);
  const teamName = entries[0]?.team || '';

  if (!teamName) return { notFound: true };

  // analysis 読み込み
  const analysisPath = path.join(
    process.cwd(),
    'data/highschool',
    prefectureId,
    teamId,
    'analysis.json',
  );
  const analysis: Analysis | null = fs.existsSync(analysisPath)
    ? JSON.parse(fs.readFileSync(analysisPath, 'utf-8'))
    : null;

  return {
    props: {
      prefectureName: prefecture.name,
      prefectureId,
      teamId,
      teamName,
      entries,
      analysis,
    },
  };
};
