// src/pages/highschool/[prefectureId]/[teamId].tsx
import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import { getCategoryLabel, getTournamentLabel } from '@/lib/utils';

type EntryResult = {
  year: number;
  tournamentId: string;
  category: string;
  result: string;
};

type CategoryResult = {
  recentlyResult?: EntryResult | null;
  historicalBest?: EntryResult | null;
};

type Analysis = {
  totalAppearances: number;
  byCategory: Record<string, number>;
  resultsByCategory: Record<string, CategoryResult>;
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

          {analysis?.resultsByCategory &&
            Object.keys(analysis.resultsByCategory).map((category) => {
              const result = analysis.resultsByCategory[category];
              if (!result) return null;

              const { recentlyResult, historicalBest } = result;

              const isSame =
                recentlyResult &&
                historicalBest &&
                recentlyResult.year === historicalBest.year &&
                recentlyResult.tournamentId === historicalBest.tournamentId &&
                recentlyResult.result === historicalBest.result;

              return (
                <div
                  key={category}
                  className="mb-6 text-sm text-gray-800 dark:text-gray-300"
                >
                  <h4 className="font-semibold mb-1">
                    {getCategoryLabel(category)}
                  </h4>

                  {isSame && historicalBest ? (
                    <p>
                      直近3年間の大会の最高の成績は、（{historicalBest.year}年{' '}
                      {getTournamentLabel(historicalBest.tournamentId)}）で
                      <strong>{historicalBest.result}</strong>となります。
                      これは同校にとって記録された情報での
                      <strong>最高の成績</strong>でもあります。
                    </p>
                  ) : (
                    <>
                      {recentlyResult ? (
                        <p>
                          直近3年間の大会の最高の成績は、（{recentlyResult.year}
                          年 {getTournamentLabel(recentlyResult.tournamentId)}
                          ）にて、
                          <strong>{recentlyResult.result}</strong>
                          となっています。
                        </p>
                      ) : (
                        <p>直近3年間の大会では出場情報がありません。</p>
                      )}
                      {historicalBest && (
                        <p>
                          記録された情報での過去最高の成績は、
                          {historicalBest.year}年の
                          {getTournamentLabel(historicalBest.tournamentId)}での
                          <strong>{historicalBest.result}</strong>です。
                        </p>
                      )}
                    </>
                  )}
                </div>
              );
            })}

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
                {Object.entries(analysis.resultsByCategory).map(
                  ([cat, { recentlyResult, historicalBest }]) => (
                    <li key={cat}>
                      {getCategoryLabel(cat)}:{' '}
                      {recentlyResult?.result || historicalBest?.result}
                    </li>
                  ),
                )}
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
                .sort((a, b) => Number(b[0]) - Number(a[0])) // 年で降順
                .map(([year, tourneys]) => (
                  <section key={year}>
                    <h2 className="text-xl font-semibold mb-2">{year}年</h2>

                    {Object.entries(tourneys)
                      .sort((a, b) => a[0].localeCompare(b[0])) // tournamentIdで昇順
                      .map(([tournamentId, categories]) => (
                        <div key={tournamentId} className="mb-4 ml-4">
                          <h3 className="text-lg font-bold">
                            <Link
                              href={`/tournaments/highschool/${tournamentId}/${year}`}
                              className="text-blue-700 dark:text-blue-300 hover:underline"
                            >
                              {getTournamentLabel(tournamentId)}
                            </Link>
                          </h3>
                          <ul className="ml-4 mt-2 space-y-2">
                            {Object.entries(categories).map(([cat, items]) => (
                              <li key={cat}>
                                <p className="font-semibold">
                                  {getCategoryLabel(cat)}
                                </p>
                                <ul className="ml-4 space-y-1">
                                  {items.map((item, index) => (
                                    <li key={index}>
                                      <p className="text-sm">
                                        成績: {item.result}
                                        {item.playerIds && (
                                          <>
                                            <br />
                                            選手:{' '}
                                            {item.playerIds
                                              .map((pid) => {
                                                const parts = pid.split('_');
                                                return parts.length >= 2
                                                  ? `${parts[0]} ${parts[1]}`
                                                  : pid;
                                              })
                                              .join('・')}
                                          </>
                                        )}
                                      </p>
                                    </li>
                                  ))}
                                </ul>
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

export const getStaticPaths: GetStaticPaths = async () => {
  const prefDir = path.join(process.cwd(), 'data/highschool/prefectures');
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
    'data/highschool/prefectures',
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
    'data/highschool/prefectures',
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
