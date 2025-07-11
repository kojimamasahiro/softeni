// src/pages/highschool/[prefectureId]/index.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import { getTournamentLabel, resultPriority } from '@/lib/utils';

type TeamSummary = {
  teamId: string;
  teamName: string;
  results: Record<
    string, // year
    {
      tournament: string;
      result: string;
    }[]
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

type TopTeam = {
  teamId: string;
  teamName: string;
  result: string;
  tournament: string;
  year: number;
};

type Props = {
  prefecture: Prefecture;
  teams: TeamSummary[];
  topTeams: TopTeam[];
};

const tournamentPriority: Record<string, number> = {
  'highschool-championship': 1, // インターハイ
  'highschool-senbatsu': 2, // 選抜
  'highschool-japan-cup': 3, // J杯
  kokutai: 4, // 国体
};

function compareTournamentPriority(a: SummaryEntry, b: SummaryEntry) {
  const pA = tournamentPriority[a.tournamentId] ?? 99;
  const pB = tournamentPriority[b.tournamentId] ?? 99;
  return pA - pB; // 小さいほど優先度が高い
}
export default function PrefectureHighschoolPage({
  prefecture,
  teams,
  topTeams,
}: Props) {
  const pageUrl = `https://softeni-pick.com/highschool/${prefecture.id}`;
  const prefectureName = prefecture.name;
  const getPerformanceLabel = (
    result: string,
  ): '好成績' | '健闘' | '敗退' | '予選敗退' | null => {
    if (['優勝', '準優勝', 'ベスト4', 'ベスト8'].includes(result))
      return '好成績';
    if (['6回戦敗退', '5回戦敗退', '4回戦敗退', '3回戦敗退'].includes(result))
      return '健闘';
    if (['2回戦敗退', '1回戦敗退'].includes(result)) return '敗退';
    if (result === '予選敗退') return '予選敗退';
    return null; // "未出場" やそれ以外は無視
  };

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

          {topTeams.length > 0 &&
            getPerformanceLabel(topTeams[0].result) !== null && (
              <div className="mb-4 text-sm text-gray-800 dark:text-gray-300">
                {topTeams[0].year}年の最新大会（{topTeams[0].tournament}）では、
                {topTeams.map((team, index) => (
                  <span key={team.teamId}>
                    {index > 0 ? '、' : ''}
                    <Link
                      href={`/highschool/${prefecture.id}/${team.teamId}`}
                      className="text-blue-700 dark:text-blue-300 hover:underline font-semibold"
                    >
                      {team.teamName}
                    </Link>
                  </span>
                ))}
                が<strong>{topTeams[0].result}</strong>
                {(() => {
                  const label = getPerformanceLabel(topTeams[0].result);
                  switch (label) {
                    case '好成績':
                      return 'という好成績を収めました。';
                    case '健闘':
                      return 'と健闘しました。';
                    case '敗退':
                      return 'となりました。';
                    case '予選敗退':
                      return 'となりました。';
                    default:
                      return '';
                  }
                })()}
              </div>
            )}

          <div className="mb-6">
            <p className="text-sm">
              出場校数：{teams.length}校（ベスト8以上：
              {
                teams.filter((t) =>
                  Object.values(t.results).some((r) =>
                    r.some((entry) =>
                      ['優勝', '準優勝', 'ベスト4', 'ベスト8'].includes(
                        entry.result,
                      ),
                    ),
                  ),
                ).length
              }
              校）
            </p>
          </div>

          <ul className="space-y-4">
            {teams.map((team) => (
              <li key={team.teamId}>
                <Link
                  href={`/highschool/${prefecture.id}/${team.teamId}`}
                  className="block border rounded p-4 bg-white dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <p className="text-lg font-semibold text-blue-900 dark:text-blue-200">
                    {team.teamName}
                  </p>
                  <ul className="text-sm mt-2">
                    {Object.entries(team.results ?? {}).length === 0 ? (
                      <li className="text-sm text-gray-500">
                        成績情報がありません
                      </li>
                    ) : (
                      Object.entries(team.results)
                        .sort((a, b) => Number(b[0]) - Number(a[0]))
                        .map(([year, resultList]) => (
                          <li key={year}>
                            {year}年：
                            {resultList
                              .map(
                                (res) => `${res.tournament}（${res.result}）`,
                              )
                              .join('、')}
                          </li>
                        ))
                    )}
                  </ul>
                </Link>
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
    `data/highschool/prefectures/${prefectureId}/summary.json`,
  );

  const rawData: SummaryEntry[] = fs.existsSync(summaryPath)
    ? JSON.parse(fs.readFileSync(summaryPath, 'utf-8'))
    : [];

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

    const resultPriority = (result: string): number => {
      const order = [
        '優勝',
        '準優勝',
        'ベスト4',
        'ベスト8',
        '6回戦敗退',
        '5回戦敗退',
        '4回戦敗退',
        '3回戦敗退',
        '2回戦敗退',
        '1回戦敗退',
        '予選敗退',
        '未出場',
      ];
      return order.indexOf(result) !== -1
        ? order.indexOf(result)
        : order.length;
    };

    const label = getTournamentLabel(tournamentId);

    if (!grouped[teamId].results[year]) {
      grouped[teamId].results[year] = [];
    }

    const existing = grouped[teamId].results[year].find(
      (r) => r.tournament === label,
    );
    if (!existing) {
      grouped[teamId].results[year].push({ tournament: label, result });
    } else {
      // すでに同じ大会がある場合は、より良い結果なら上書き
      if (resultPriority(result) < resultPriority(existing.result)) {
        existing.result = result;
      }
    }
  }

  const teams: TeamSummary[] = Object.values(grouped);

  const latestYear = Math.max(...rawData.map((e) => e.year));
  const latestYearEntries = rawData.filter((e) => e.year === latestYear);

  // 最も良い順位の評価値（例：優勝 = 1）
  const bestRank = Math.min(
    ...latestYearEntries.map((e) => resultPriority(e.result)),
  );

  // その順位の大会に出場したエントリを取得
  const topRankEntries = latestYearEntries.filter(
    (e) => resultPriority(e.result) === bestRank,
  );

  // 大会の優先順位順に並べる
  topRankEntries.sort(compareTournamentPriority);

  // チームごとに最初に出てくる（＝最優先大会）のみを採用
  const seenTeams = new Set<string>();
  const topTeams = topRankEntries
    .filter((e) => {
      if (seenTeams.has(e.teamId)) return false;
      seenTeams.add(e.teamId);
      return true;
    })
    .map((e) => ({
      teamId: e.teamId,
      teamName: e.team,
      result: e.result,
      tournament: getTournamentLabel(e.tournamentId),
      year: e.year,
    }));

  return {
    props: {
      prefecture,
      teams,
      topTeams,
    },
  };
};
