// src/pages/highschool/[gender]/[prefectureId]/[teamId].tsx
import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import {
  getCategoryLabel,
  getTournamentLabel,
  resultPriority,
} from '@/lib/utils';

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
  gender: 'boys' | 'girls';
  playerIds?: string[];
};

type Props = {
  prefectureName: string;
  prefectureId: string;
  gender: 'boys' | 'girls';
  genderLabel: string;
  teamId: string;
  teamName: string;
  entries: Entry[];
  analysis: Analysis | null;
};

const tournamentPriority: Record<string, number> = {
  'highschool-kokutai': 1,
  'highschool-championship': 2,
  'highschool-japan-cup': 3,
  'highschool-senbatsu': 4,
};

const categoryPriority: Record<string, number> = {
  team: 1,
  doubles: 2,
  singles: 3,
};

export default function TeamPage({
  prefectureName,
  prefectureId,
  gender,
  genderLabel,
  teamId,
  teamName,
  entries,
  analysis,
}: Props) {
  const pageUrl = `https://softeni-pick.com/highschool/${gender}/${prefectureId}/${teamId}`;
  const championshipEntries = entries.filter(
    (entry) => entry.tournamentId === 'highschool-championship',
  );
  const championshipAppearances = championshipEntries.length;
  const latestChampionshipEntry =
    championshipEntries.length > 0
      ? championshipEntries.slice().sort((a, b) => {
          if (b.year !== a.year) return b.year - a.year;
          return resultPriority(a.result) - resultPriority(b.result);
        })[0]
      : null;
  const bestChampionshipEntry =
    championshipEntries.length > 0
      ? championshipEntries.slice().sort((a, b) => {
          const rankDiff = resultPriority(a.result) - resultPriority(b.result);
          if (rankDiff !== 0) return rankDiff;
          return b.year - a.year;
        })[0]
      : null;
  const faqItems = [
    {
      question: `${teamName}の高校${genderLabel}の全国大会成績では何が分かりますか？`,
      answer: `${teamName}の全国高等学校総合体育大会、高校総体、ハイスクールジャパンカップ、選抜大会などの実績を年度別・種目別に確認できます。`,
    },
    {
      question: 'インターハイの成績も確認できますか？',
      answer:
        championshipAppearances > 0
          ? `${teamName}は全国高等学校総合体育大会の記録も収録しており、最新結果や過去の最高成績をこのページで確認できます。`
          : `${teamName}のインターハイ成績は、収録済みデータがある年度から順次このページで確認できます。`,
    },
    {
      question: '同じ都道府県の他校も見られますか？',
      answer: `${prefectureName}の一覧ページへ戻ると、同じ都道府県の高校${genderLabel}の全国大会成績をまとめて確認できます。`,
    },
  ];

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
        title={`${teamName} 高校${genderLabel} 全国大会成績 | ソフトテニス情報`}
        description={`${teamName}の高校${genderLabel}の全国大会成績を掲載。ソフトテニスの全国高等学校総合体育大会や高校総体を含む主要大会の結果を年度別・種目別に整理しています。`}
        url={pageUrl}
        type="article"
      />
      <Head>
        <title>
          {teamName} 高校{genderLabel} 全国大会成績 | ソフトテニス情報
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
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: prefectureName,
                  item: `https://softeni-pick.com/highschool/${gender}/${prefectureId}`,
                },
                {
                  '@type': 'ListItem',
                  position: 4,
                  name: teamName,
                  item: pageUrl,
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
              headline: `${teamName} 高校${genderLabel} 全国大会成績`,
              description: `${teamName}の高校${genderLabel}の全国大会成績を、インターハイを含む主要大会ごとに整理したページです。`,
              inLanguage: 'ja',
              mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
              author: { '@type': 'Organization', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
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
              {
                label: prefectureName,
                href: `/highschool/${gender}/${prefectureId}`,
              },
              {
                label: teamName,
                href: `/highschool/${gender}/${prefectureId}/${teamId}`,
              },
            ]}
          />
          <h1 className="text-2xl font-bold mb-6">
            {teamName} 高校{genderLabel} 全国大会成績
          </h1>

          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            {teamName}
            の高校{genderLabel}
            について、全国高等学校総合体育大会、高校総体、ハイスクールジャパンカップ、
            選抜大会などソフトテニス主要大会での成績を年度別・種目別にまとめています。
          </p>

          <section className="grid gap-4 sm:grid-cols-4 mb-8">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                収録成績数
              </p>
              <p className="text-2xl font-bold">{entries.length}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                収録選手数
              </p>
              <p className="text-2xl font-bold">
                {analysis?.uniquePlayers ?? '-'}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                インターハイ掲載数
              </p>
              <p className="text-2xl font-bold">{championshipAppearances}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                インターハイ最高成績
              </p>
              <p className="text-2xl font-bold">
                {bestChampionshipEntry?.result ?? '-'}
              </p>
            </div>
          </section>

          <section className="mb-8 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-5">
            <h2 className="text-xl font-semibold mb-3">
              {teamName}のインターハイ実績サマリー
            </h2>
            {championshipAppearances > 0 ? (
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                <p>
                  全国高等学校総合体育大会の掲載成績は
                  <strong>{championshipAppearances}件</strong>あります。
                </p>
                {latestChampionshipEntry && (
                  <p>
                    最新の掲載成績は
                    <strong>
                      {latestChampionshipEntry.year}年{' '}
                      {getCategoryLabel(latestChampionshipEntry.category)}{' '}
                      {latestChampionshipEntry.result}
                    </strong>
                    です。
                  </p>
                )}
                {bestChampionshipEntry && (
                  <p>
                    記録上の最高成績は
                    <strong>
                      {bestChampionshipEntry.year}年{' '}
                      {getCategoryLabel(bestChampionshipEntry.category)}{' '}
                      {bestChampionshipEntry.result}
                    </strong>
                    です。
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-200">
                現時点では、この学校の全国高等学校総合体育大会の掲載成績は確認中です。掲載済みの主要大会結果は以下から確認できます。
              </p>
            )}
          </section>

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

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">関連ページ</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href={`/highschool/${gender}/${prefectureId}`}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <p className="font-semibold">{prefectureName}の学校一覧</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  同県の高校{genderLabel}成績をまとめて見る
                </p>
              </Link>
              <Link
                href={`/highschool/${gender}`}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <p className="font-semibold">高校{genderLabel}都道府県別一覧</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  他県の注目校や成績ページへ移動
                </p>
              </Link>
              <Link
                href="/tournaments/major"
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <p className="font-semibold">主要大会一覧</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  大会単位で結果を追いたい場合はこちら
                </p>
              </Link>
            </div>
          </section>

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
                      .sort((a, b) => {
                        const priorityDiff =
                          (tournamentPriority[a[0]] ?? 99) -
                          (tournamentPriority[b[0]] ?? 99);
                        if (priorityDiff !== 0) return priorityDiff;
                        return getTournamentLabel(a[0]).localeCompare(
                          getTournamentLabel(b[0]),
                          'ja',
                        );
                      })
                      .map(([tournamentId, categories]) => (
                        <div key={tournamentId} className="mb-4 ml-4">
                          <h3 className="text-lg font-bold">
                            {getTournamentLabel(tournamentId)}
                          </h3>
                          <ul className="ml-4 mt-2 space-y-2">
                            {Object.entries(categories)
                              .sort((a, b) => {
                                const priorityDiff =
                                  (categoryPriority[a[0]] ?? 99) -
                                  (categoryPriority[b[0]] ?? 99);
                                if (priorityDiff !== 0) return priorityDiff;
                                return getCategoryLabel(a[0]).localeCompare(
                                  getCategoryLabel(b[0]),
                                  'ja',
                                );
                              })
                              .map(([cat, items]) => {
                                // 同じcategory内のgenderは統一されていると仮定（必要に応じて調整）
                                const categoryGender = gender; // Use the gender prop from component
                                return (
                                  <li key={cat}>
                                    <p className="font-semibold">
                                      <Link
                                        href={`/tournaments/highschool/${tournamentId}/${year}/${cat}/none/${categoryGender}`}
                                        className="text-blue-700 dark:text-blue-300 hover:underline"
                                      >
                                        {getCategoryLabel(cat)}
                                      </Link>
                                    </p>
                                    <ul className="ml-4 space-y-1">
                                      {items
                                        .slice()
                                        .sort(
                                          (a, b) =>
                                            resultPriority(a.result) -
                                            resultPriority(b.result),
                                        )
                                        .map((item, index) => (
                                          <li key={index}>
                                            <p className="text-sm">
                                              成績: {item.result}
                                              {item.playerIds && (
                                                <>
                                                  <br />
                                                  選手:{' '}
                                                  {item.playerIds
                                                    .map((pid) => {
                                                      const parts =
                                                        pid.split('_');
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
                                );
                              })}
                          </ul>
                        </div>
                      ))}
                  </section>
                ))}
            </div>
          )}

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
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const prefDir = path.join(process.cwd(), 'data/highschool/prefectures');
  const prefectures = fs.readdirSync(prefDir);
  const paths: {
    params: { gender: string; prefectureId: string; teamId: string };
  }[] = [];

  for (const gender of ['boys', 'girls']) {
    for (const prefId of prefectures) {
      const summaryPath = path.join(prefDir, prefId, 'summary.json');
      if (!fs.existsSync(summaryPath)) continue;

      const summary: SummaryEntry[] = JSON.parse(
        fs.readFileSync(summaryPath, 'utf-8'),
      );

      // Filter by gender and get unique team IDs
      const teamIds = [
        ...new Set(
          summary.filter((e) => e.gender === gender).map((e) => e.teamId),
        ),
      ];

      for (const teamId of teamIds) {
        paths.push({ params: { gender, prefectureId: prefId, teamId } });
      }
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
  const { prefectureId, teamId, gender } = context.params as {
    prefectureId: string;
    teamId: string;
    gender: 'boys' | 'girls';
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

  // Filter by teamId and gender
  const entries = allEntries.filter(
    (e) => e.teamId === teamId && e.gender === gender,
  );
  const teamName = entries[0]?.team || '';

  if (!teamName) return { notFound: true };

  // analysis 読み込み (gender-specific path)
  const analysisPath = path.join(
    process.cwd(),
    'data/highschool/prefectures',
    prefectureId,
    teamId,
    gender,
    'analysis.json',
  );
  const analysis: Analysis | null = fs.existsSync(analysisPath)
    ? JSON.parse(fs.readFileSync(analysisPath, 'utf-8'))
    : null;

  const genderLabel = gender === 'boys' ? '男子' : '女子';

  return {
    props: {
      prefectureName: prefecture.name,
      prefectureId,
      gender,
      genderLabel,
      teamId,
      teamName,
      entries,
      analysis,
    },
  };
};
