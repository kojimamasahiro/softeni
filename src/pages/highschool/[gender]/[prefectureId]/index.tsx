// src/pages/highschool/[gender]/[prefectureId]/index.tsx
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
      tournamentId: string;
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
  gender: 'boys' | 'girls';
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

type RecentMajorTeam = {
  teamId: string;
  teamName: string;
  appearances: {
    tournamentId: string;
    tournament: string;
    year: number;
    result: string;
  }[];
};

type Props = {
  prefecture: Prefecture;
  gender: 'boys' | 'girls';
  genderLabel: string;
  teams: TeamSummary[];
  topTeams: TopTeam[];
  recentMajorTeams: RecentMajorTeam[];
  best8SchoolCount: number;
  recentMajorSchoolCount: number;
};

type AliasReasonGroup = {
  canonical: string;
  aliases: string[];
};

type RawResultEntry = {
  team?: string;
  playerIds?: string[];
  tournamentId: string;
  year: number;
  gender?: string;
  result: string;
  category: string;
};

const tournamentPriority: Record<string, number> = {
  'highschool-kokutai': 1, // 国体
  'highschool-championship': 2, // インターハイ
  'highschool-japan-cup': 3, // J杯
  'highschool-senbatsu': 4, // 選抜
};

const getTournamentSortPriority = (tournamentId: string): number =>
  tournamentPriority[tournamentId] ?? 99;

export default function PrefectureHighschoolPage({
  prefecture,
  gender,
  genderLabel,
  teams,
  topTeams,
  recentMajorTeams,
  best8SchoolCount,
  recentMajorSchoolCount,
}: Props) {
  const pageUrl = `https://softeni-pick.com/highschool/${gender}/${prefecture.id}`;
  const prefectureName = prefecture.name;
  const faqItems = [
    {
      question: `${prefectureName}の高校${genderLabel}で全国大会成績を調べるには？`,
      answer: `${prefectureName}の高校${genderLabel}の学校別一覧から、気になる学校を選ぶと年度別・大会別の全国大会成績を確認できます。`,
    },
    {
      question: '主要大会に出場した学校をまとめて見られますか？',
      answer:
        'data/tournaments/index.json に載る主要大会の掲載対象になっている学校を、このページ上部で確認できます。',
    },
    {
      question: '最近注目したい学校はどこですか？',
      answer:
        recentMajorTeams.length > 0
          ? '直近1年の主要大会結果ページに掲載された学校を、このページ上部で先に確認できます。1回戦敗退や予選敗退も含めて主要大会出場校として扱います。'
          : '直近1年の主要大会掲載校が無い場合でも、学校一覧から全国大会成績を確認できます。',
    },
  ];
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
        title={`${prefectureName} 高校${genderLabel} 全国大会成績 | ソフトテニス情報`}
        description={`${prefectureName}の高校${genderLabel}の全国大会成績を一覧掲載。ソフトテニスの全国高等学校総合体育大会や高校総体を含む主要大会の学校別実績を確認できます。`}
        url={pageUrl}
        type="article"
      />

      <Head>
        <script
          title={`${prefectureName} 高校${genderLabel} 全国大会成績 | ソフトテニス情報`}
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
              '@type': 'CollectionPage',
              name: `${prefectureName} 高校${genderLabel} 全国大会成績`,
              description: `${prefectureName}の高校${genderLabel}の全国大会成績を一覧掲載し、学校別の主要大会実績を確認できるページです。`,
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
                href: `/highschool/${gender}/${prefecture.id}`,
              },
            ]}
          />

          <h1 className="text-2xl font-bold mb-2">
            {prefecture.name} 高校{genderLabel} 全国大会成績
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            {prefecture.name}
            の高校{genderLabel}
            が全国大会で残した成績をまとめています。全国高等学校総合体育大会、
            高校総体、ハイスクールジャパンカップなどソフトテニス主要大会での学校別実績を確認できます。
            詳しい内容は、各高校のページからご覧いただけます。
          </p>

          <section className="grid gap-4 sm:grid-cols-3 mb-8">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                収録学校数
              </p>
              <p className="text-2xl font-bold">{teams.length}校</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                ベスト8以上経験校
              </p>
              <p className="text-2xl font-bold">{best8SchoolCount}校</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                直近1年の主要大会掲載校
              </p>
              <p className="text-2xl font-bold">{recentMajorSchoolCount}校</p>
            </div>
          </section>

          <div className="mb-6">
            <p className="text-sm">
              出場校数：{teams.length}校（ベスト8以上：{best8SchoolCount}校）
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              学校一覧は、より良い成績を残した学校が見つけやすい順に表示しています。
              気になる学校を選ぶと、年度別・大会別の詳細成績を確認できます。
            </p>

            {topTeams.length > 0 &&
              getPerformanceLabel(topTeams[0].result) !== null && (
                <div className="mb-4 text-sm text-gray-800 dark:text-gray-300">
                  {topTeams[0].year}年の最新大会（{topTeams[0].tournament}
                  ）では、
                  {topTeams.map((team, index) => (
                    <span key={team.teamId}>
                      {index > 0 ? '、' : ''}
                      <Link
                        href={`/highschool/${gender}/${prefecture.id}/${team.teamId}`}
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
          </div>

          {recentMajorTeams.length > 0 && (
            <section className="mb-8 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-5">
              <h2 className="text-xl font-semibold mb-3">
                直近1年の主要大会掲載校
              </h2>
              <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">
                主要大会結果ページに掲載された学校を先にまとめています。高校カテゴリの大会は除外し、1回戦敗退や予選敗退も、主要大会に出場した実績として掲載しています。
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {recentMajorTeams.map((team) => (
                  <Link
                    key={team.teamId}
                    href={`/highschool/${gender}/${prefecture.id}/${team.teamId}`}
                    className="rounded-xl border border-blue-200 dark:border-blue-900 bg-white/80 dark:bg-gray-900/40 p-4 hover:bg-white dark:hover:bg-gray-900 transition"
                  >
                    <p className="font-semibold">{team.teamName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      主要大会掲載 {team.appearances.length}件
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                      {team.appearances.slice(0, 3).map((appearance) => (
                        <li
                          key={`${appearance.tournamentId}-${appearance.year}-${appearance.result}`}
                        >
                          {appearance.year}年 {appearance.tournament}（
                          {appearance.result}）
                        </li>
                      ))}
                    </ul>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <ul className="space-y-4">
            {teams.map((team) => (
              <li key={team.teamId}>
                <Link
                  href={`/highschool/${gender}/${prefecture.id}/${team.teamId}`}
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
                              .slice()
                              .sort((a, b) => {
                                const tournamentOrder =
                                  getTournamentSortPriority(a.tournamentId) -
                                  getTournamentSortPriority(b.tournamentId);
                                if (tournamentOrder !== 0) {
                                  return tournamentOrder;
                                }
                                return (
                                  resultPriority(a.result) -
                                  resultPriority(b.result)
                                );
                              })
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
  const file = path.join(process.cwd(), 'data/prefectures.json');
  const prefectures: Prefecture[] = JSON.parse(fs.readFileSync(file, 'utf-8'));

  const paths: { params: { gender: string; prefectureId: string } }[] = [];

  for (const gender of ['boys', 'girls']) {
    for (const pref of prefectures) {
      paths.push({
        params: { gender, prefectureId: pref.id },
      });
    }
  }

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { prefectureId, gender } = context.params as {
    prefectureId: string;
    gender: 'boys' | 'girls';
  };

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

  // Filter by gender
  const filteredData = rawData.filter((entry) => entry.gender === gender);

  const grouped: Record<string, TeamSummary> = {};

  for (const entry of filteredData) {
    const { teamId, team, year, tournamentId, result } = entry;
    if (!grouped[teamId]) {
      grouped[teamId] = {
        teamId,
        teamName: team,
        results: {},
      };
    }

    const label = getTournamentLabel(tournamentId);

    if (!grouped[teamId].results[year]) {
      grouped[teamId].results[year] = [];
    }

    const existing = grouped[teamId].results[year].find(
      (r) => r.tournamentId === tournamentId,
    );
    if (!existing) {
      grouped[teamId].results[year].push({
        tournamentId,
        tournament: label,
        result,
      });
    } else {
      // すでに同じ大会がある場合は、より良い結果なら上書き
      if (resultPriority(result) < resultPriority(existing.result)) {
        existing.result = result;
      }
    }
  }

  const teams: TeamSummary[] = Object.values(grouped).sort((a, b) => {
    const getBestRank = (team: TeamSummary) =>
      Math.min(
        ...Object.values(team.results).flatMap((resultList) =>
          resultList.map((resultEntry) => resultPriority(resultEntry.result)),
        ),
      );
    const getLatestYear = (team: TeamSummary) =>
      Math.max(...Object.keys(team.results).map(Number));

    const bestRankDiff = getBestRank(a) - getBestRank(b);
    if (bestRankDiff !== 0) return bestRankDiff;

    const latestYearDiff = getLatestYear(b) - getLatestYear(a);
    if (latestYearDiff !== 0) return latestYearDiff;

    return a.teamName.localeCompare(b.teamName, 'ja');
  });

  const latestYear =
    filteredData.length > 0
      ? Math.max(...filteredData.map((entry) => entry.year))
      : null;
  const latestYearEntries =
    latestYear === null
      ? []
      : filteredData.filter((entry) => entry.year === latestYear);

  const sortedTournamentIds = Object.entries(tournamentPriority)
    .sort((a, b) => a[1] - b[1])
    .map(([id]) => id);

  let topTeams: TopTeam[] = [];

  for (const tournamentId of sortedTournamentIds) {
    const entries = latestYearEntries.filter(
      (e) => e.tournamentId === tournamentId,
    );
    if (entries.length === 0) continue;

    const bestRank = Math.min(...entries.map((e) => resultPriority(e.result)));

    // 最高成績のエントリのみ
    const bestEntries = entries.filter(
      (e) => resultPriority(e.result) === bestRank,
    );

    // チームIDごとに一意にする（重複排除）
    const seen = new Set<string>();
    topTeams = bestEntries
      .filter((e) => {
        if (seen.has(e.teamId)) return false;
        seen.add(e.teamId);
        return true;
      })
      .map((e) => ({
        teamId: e.teamId,
        teamName: e.team,
        result: e.result,
        tournament: getTournamentLabel(e.tournamentId),
        year: e.year,
      }));

    if (topTeams.length > 0) break; // 最初に見つかった大会だけ採用
  }

  const best8SchoolCount = new Set(
    filteredData
      .filter((entry) =>
        ['優勝', '準優勝', 'ベスト4', 'ベスト8'].includes(entry.result),
      )
      .map((entry) => entry.teamId),
  ).size;

  const tournamentsIndexPath = path.join(
    process.cwd(),
    'data/tournaments/index.json',
  );
  const majorTournamentIds: string[] = fs.existsSync(tournamentsIndexPath)
    ? JSON.parse(fs.readFileSync(tournamentsIndexPath, 'utf-8'))
        .filter(
          (item: { tournamentId?: string; generationId?: string }) =>
            item.generationId === 'all',
        )
        .map((item: { tournamentId?: string }) => item.tournamentId)
        .filter((tournamentId: string | undefined): tournamentId is string =>
          Boolean(tournamentId),
        )
    : [];
  const majorInfoDir = path.join(process.cwd(), 'data/tournaments/information');
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const recentMajorYearMap = new Map<string, Set<number>>();

  for (const tournamentId of majorTournamentIds) {
    const informationPath = path.join(majorInfoDir, `${tournamentId}.json`);
    if (!fs.existsSync(informationPath)) continue;
    const informationList: { year: number; startDate: string }[] = JSON.parse(
      fs.readFileSync(informationPath, 'utf-8'),
    );
    for (const information of informationList) {
      const startDate = new Date(information.startDate);
      if (startDate >= oneYearAgo && startDate <= now) {
        if (!recentMajorYearMap.has(tournamentId)) {
          recentMajorYearMap.set(tournamentId, new Set<number>());
        }
        recentMajorYearMap.get(tournamentId)?.add(information.year);
      }
    }
  }

  const highschoolTeamsPath = path.join(
    process.cwd(),
    'scripts/highschool/01team/teams.json',
  );
  const aliasPath = path.join(
    process.cwd(),
    'scripts/highschool/03list/inferred-team-aliases.json',
  );
  const resultsPath = path.join(
    process.cwd(),
    'scripts/highschool/02result/results.json',
  );

  const prefectureTeams: { id: string; name: string }[] = fs.existsSync(
    highschoolTeamsPath,
  )
    ? JSON.parse(fs.readFileSync(highschoolTeamsPath, 'utf-8'))
        .filter(
          (team: {
            id: string;
            name: string;
            prefectureId?: string;
            prefecture?: string;
          }) =>
            team.prefectureId === prefectureId ||
            team.prefecture === prefecture.name,
        )
        .map((team: { id: string; name: string }) => ({
          id: team.id,
          name: team.name,
        }))
    : [];

  const teamIdByName = new Map(
    prefectureTeams.map((team) => [team.name, team.id] as const),
  );

  const inferredAliases: AliasReasonGroup[] = fs.existsSync(aliasPath)
    ? JSON.parse(fs.readFileSync(aliasPath, 'utf-8'))
    : [];
  const canonicalNameByAlias = new Map<string, string>();
  for (const group of inferredAliases) {
    for (const alias of group.aliases) {
      canonicalNameByAlias.set(alias, group.canonical);
    }
  }

  const normalizeSchoolName = (name: string) =>
    canonicalNameByAlias.get(name) ?? name;

  const rawResults: { results: RawResultEntry[] } = fs.existsSync(resultsPath)
    ? JSON.parse(fs.readFileSync(resultsPath, 'utf-8'))
    : { results: [] };

  const recentMajorTeamMap = new Map<string, RecentMajorTeam>();
  rawResults.results
    .filter(
      (entry) =>
        entry.gender === gender &&
        recentMajorYearMap.get(entry.tournamentId)?.has(entry.year),
    )
    .forEach((entry) => {
      const rawTeamNames =
        entry.category === 'team'
          ? entry.team
            ? [entry.team]
            : []
          : Array.from(
              new Set(
                (entry.playerIds ?? [])
                  .map((playerId) => playerId.split('_'))
                  .filter((parts) => parts.length > 2)
                  .map((parts) => parts[2]),
              ),
            );

      for (const rawTeamName of rawTeamNames) {
        const teamName = normalizeSchoolName(rawTeamName);
        const teamId = teamIdByName.get(teamName);
        if (!teamId) continue;

        const existing = recentMajorTeamMap.get(teamId);
        const appearance = {
          tournamentId: entry.tournamentId,
          tournament: getTournamentLabel(entry.tournamentId),
          year: entry.year,
          result: entry.result,
        };

        if (!existing) {
          recentMajorTeamMap.set(teamId, {
            teamId,
            teamName,
            appearances: [appearance],
          });
          continue;
        }

        if (
          !existing.appearances.some(
            (item) =>
              item.tournamentId === appearance.tournamentId &&
              item.year === appearance.year &&
              item.result === appearance.result,
          )
        ) {
          existing.appearances.push(appearance);
        }
      }
    });

  const recentMajorTeams = Array.from(recentMajorTeamMap.values())
    .map((team) => ({
      ...team,
      appearances: team.appearances.slice().sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const tournamentOrder =
          getTournamentSortPriority(a.tournamentId) -
          getTournamentSortPriority(b.tournamentId);
        if (tournamentOrder !== 0) return tournamentOrder;
        return resultPriority(a.result) - resultPriority(b.result);
      }),
    }))
    .sort((a, b) => {
      const latestA = Math.max(...a.appearances.map((item) => item.year));
      const latestB = Math.max(...b.appearances.map((item) => item.year));
      if (latestB !== latestA) return latestB - latestA;
      if (b.appearances.length !== a.appearances.length) {
        return b.appearances.length - a.appearances.length;
      }
      const bestA = Math.min(
        ...a.appearances.map((item) => resultPriority(item.result)),
      );
      const bestB = Math.min(
        ...b.appearances.map((item) => resultPriority(item.result)),
      );
      if (bestA !== bestB) return bestA - bestB;
      return a.teamName.localeCompare(b.teamName, 'ja');
    })
    .slice(0, 8);

  const recentMajorSchoolCount = recentMajorTeamMap.size;

  const genderLabel = gender === 'boys' ? '男子' : '女子';

  return {
    props: {
      prefecture,
      gender,
      genderLabel,
      teams,
      topTeams,
      recentMajorTeams,
      best8SchoolCount,
      recentMajorSchoolCount,
    },
  };
};
