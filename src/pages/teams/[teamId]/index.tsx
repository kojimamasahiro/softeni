// src/pages/teams/[teamId]/index.tsx

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { aggregateStLeagueTeam, getAllStLeagueTeamIds, StLeagueTeamSummary } from '@/utils/st-league';

type TeamInfo = {
  id: string;
  name: string;
};

type TeamYearlyStats = {
  year: number;
  stats: {
    gender: 'boys' | 'girls';
    count: number;
  }[];
};

type Props = {
  info: TeamInfo;
  stats: TeamYearlyStats[];
  // tournament の年度別ページ（/teams/[id]/[year]/[gender]）が生成される対象か。
  // 対象外（STリーグのみ等）のチームでは該当リンクを描画しない（404 回避）。
  hasSubPages: boolean;
  stLeague: StLeagueTeamSummary | null;
};

const GENDER_LABEL: Record<'boys' | 'girls', string> = {
  boys: '男子',
  girls: '女子',
};

export default function TeamResultsPage({ info, stats, hasSubPages, stLeague }: Props) {
  const teamName = info.name;
  const pageUrl = `https://softeni-pick.com/teams/${info.id}/`;

  const hasStLeague = !!stLeague && stLeague.seasons.length > 0;
  const title = hasStLeague ? `${teamName}｜STリーグ出場成績・順位 | ソフトテニス情報` : `${teamName} 所属別成績 | ソフトテニス情報`;
  const description = hasStLeague
    ? `${teamName}のSTリーグ（ソフトテニス実業団リーグ）出場成績。年度別の所属リーグ・対戦成績・順位${
        stLeague!.titlesTop > 0 ? `・優勝${stLeague!.titlesTop}回` : ''
      }をまとめています。`
    : `${teamName}の大会別成績、選手別勝敗、出場ペア数などの詳細を掲載。`;

  return (
    <>
      <MetaHead title={title} description={description} url={pageUrl} />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: title.split(' | ')[0],
              author: { '@type': 'Organization', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
              description,
              about: {
                '@type': 'SportsTeam',
                name: teamName,
                url: pageUrl,
              },
            }),
          }}
        />

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
                  name: teamName,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <PageLayout className="space-y-6">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: teamName, href: `/teams/${info.id}` },
          ]}
        />

        <h1 className="text-2xl font-bold">{teamName} | 成績</h1>

        <section className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          <p className="mb-2">
            {teamName}
            のソフトテニスにおける成績をまとめたページです。
            {hasStLeague && 'STリーグ（実業団リーグ）の年度別成績・順位、'}
            大会ごとの記録などを確認できます。
          </p>
        </section>

        {/* STリーグでの成績 */}
        {hasStLeague && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-xl font-bold">STリーグでの成績</h2>
              <Link href="/st-league" className="text-sm text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                STリーグ トップ →
              </Link>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              出場: {stLeague!.firstYear}〜{stLeague!.lastYear}
              {stLeague!.titlesTop > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">🏆 Ⅰ部優勝 {stLeague!.titlesTop}回</span>
              )}
            </p>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="py-2.5 px-3 text-left font-medium">年度</th>
                    <th className="py-2.5 px-2 text-left font-medium">区分</th>
                    <th className="py-2.5 px-2 text-center font-medium">成績</th>
                    <th className="py-2.5 px-3 text-center font-medium">順位</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {stLeague!.seasons.map((s) => (
                    <tr key={`${s.year}-${s.gender}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                        <Link href={`/st-league/${s.year}/matches`} className="hover:text-blue-600 hover:underline">
                          {s.year}
                          {s.edition ? `（第${s.edition}回）` : ''}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {GENDER_LABEL[s.gender]}・{s.divisionName}
                      </td>
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {s.played > 0 ? (
                          <span className="font-mono">
                            <span className="font-bold">{s.won}</span>
                            <span className="text-gray-400">-</span>
                            <span className="text-gray-500">{s.lost}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {s.isChampion ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">🏆 優勝</span>
                        ) : s.rank ? (
                          `${s.rank}位`
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-400">各年度の対戦結果・順位表は年度リンクから確認できます。</p>
          </section>
        )}

        {/* 大会別成績（tournament の年度別ページがある対象のみ） */}
        {hasSubPages && stats.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-4">大会別成績</h2>
            {stats.map(({ year, stats: yearStats }) => (
              <div key={year} className="mb-10">
                <h3 className="text-lg font-bold mb-4 border-b-2 border-gray-200 dark:border-gray-700 pb-2">{year}年度</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {yearStats.map(({ gender, count }) => (
                    <Link
                      key={gender}
                      href={`/teams/${info.id}/${year}/${gender}`}
                      className="block bg-white dark:bg-gray-800 rounded-xl shadow p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                    >
                      <h4 className="text-lg font-bold mb-2 text-gray-800 dark:text-gray-100">{GENDER_LABEL[gender]}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">大会数: {count}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const fs = await import('fs');
  const path = await import('path');

  const mappingsPath = path.join(process.cwd(), 'data/teams/team-name-mappings.json');

  const ids = new Set<string>();
  if (fs.existsSync(mappingsPath)) {
    const teamNameMappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8')) as Record<string, string[]>;
    Object.keys(teamNameMappings).forEach((id) => ids.add(id));
  }
  // STリーグ出場チームにもページを生成する（チーム名リンクの受け皿）
  getAllStLeagueTeamIds().forEach((id) => ids.add(id));

  return {
    paths: Array.from(ids).map((teamId) => ({ params: { teamId } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const fs = await import('fs');
  const path = await import('path');
  const { aggregateTeamResults, generateTeamInfo, gendersWithRealPresence } = await import('@/utils/team-data-aggregator');
  const { teamId } = context.params as { teamId: string };

  // tournament の年度別下層ページが生成される対象か（mapping キーのみ）。
  const mappingsPath = path.join(process.cwd(), 'data/teams/team-name-mappings.json');
  let hasSubPages = false;
  if (fs.existsSync(mappingsPath)) {
    const keys = Object.keys(JSON.parse(fs.readFileSync(mappingsPath, 'utf-8')) as Record<string, string[]>);
    hasSubPages = keys.includes(teamId);
  }

  const stLeague = aggregateStLeagueTeam(teamId);

  let name = teamId;
  let stats: TeamYearlyStats[] = [];

  // tournament データ（下層ページ対象チームのみ集計してリンクを出す）
  if (hasSubPages) {
    try {
      const fullInfo = generateTeamInfo(teamId);
      if (fullInfo.name) name = fullInfo.name;
      if (fullInfo.players && Object.keys(fullInfo.players).length > 0) {
        const allResults = aggregateTeamResults(teamId);
        // 混合ダブルスしか無い性別（実体の無い性別）は表示しない。
        const realGenders = gendersWithRealPresence(allResults);
        const statsMap = new Map<number, Map<'boys' | 'girls', number>>();
        for (const result of allResults) {
          const { year, gender } = result;
          if (gender !== 'boys' && gender !== 'girls') continue;
          if (!realGenders.has(gender)) continue;
          if (!statsMap.has(year)) statsMap.set(year, new Map());
          const yearStats = statsMap.get(year)!;
          yearStats.set(gender, (yearStats.get(gender) || 0) + 1);
        }
        stats = Array.from(statsMap.entries())
          .sort(([a], [b]) => b - a)
          .map(([year, genderCounts]) => ({
            year,
            stats: Array.from(genderCounts.entries())
              .map(([gender, count]) => ({ gender, count }))
              .sort((a, b) => a.gender.localeCompare(b.gender)),
          }));
      }
    } catch (error) {
      console.error(`Error generating tournament data for ${teamId}:`, error);
    }
  }

  // 表示名: STリーグ名を優先（mapping チームは tournament 名を使う）
  if (stLeague && (!hasSubPages || name === teamId)) {
    name = stLeague.name;
  }

  // STリーグ・大会いずれのデータも無ければ 404
  if (!stLeague && stats.length === 0) {
    return { notFound: true };
  }

  return {
    props: {
      info: { id: teamId, name },
      stats,
      hasSubPages,
      stLeague,
    },
  };
};
