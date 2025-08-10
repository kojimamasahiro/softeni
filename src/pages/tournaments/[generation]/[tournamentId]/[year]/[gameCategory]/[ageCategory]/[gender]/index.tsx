// pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx

import fs from 'fs';
import path from 'path';

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import MatchResults from '@/components/Tournament/MatchResults';
import TeamResults from '@/components/Tournament/TeamResults';
import { getAllPlayers } from '@/lib/players';
import { resultPriority } from '@/lib/utils';
import { EntryInfo } from '@/types/entry';
import {
  MatchOpponent,
  PlayerInfo,
  TournamentMeta,
  TournamentYearData,
} from '@/types/index';

interface TournamentYearResultPageProps {
  year: string;
  meta: TournamentMeta;
  data: TournamentYearData;
  allPlayers: PlayerInfo[];
  unknownPlayers: Record<
    string,
    { firstName: string; lastName: string; team: string }
  >;
  entries: EntryInfo[];
  teamMap: Record<string, { teamId: string; prefectureId: string }>;
  highlight: string | null;
  groupedLinks: {
    year: string;
    links: {
      year: string;
      gameCategory: string;
      ageCategory: string;
      gender: string;
      categoryLabel: string;
      isCurrent: boolean;
    }[];
  }[];
  categoryLabel: string;
  generation: string;
  tournamentId: string;
  gameCategory: string;
  ageCategory: string;
  gender: string;
}

export default function TournamentYearResultPage({
  year,
  meta,
  data,
  allPlayers,
  unknownPlayers,
  entries,
  teamMap,
  highlight,
  groupedLinks,
  categoryLabel,
  generation,
  gameCategory,
  ageCategory,
  gender,
}: TournamentYearResultPageProps) {
  const pageUrl = `https://softeni-pick.com/tournaments/${generation}/${meta.id}/${year}/${gameCategory}/${ageCategory}${gender}`;

  const teamGroups: Record<
    string,
    {
      team: string;
      teamId: string;
      prefectureId: string;
      members: {
        result: string;
        resultOrder: number;
        displayParts: { text: string; id?: string; noLink?: boolean }[];
      }[];
      bestRank: number;
    }
  > = {};

  for (const entry of data.results ?? []) {
    if ('playerIds' in entry) {
      const players = (entry.playerIds ?? []).map((id) => {
        const player = allPlayers.find((p) => p.id === id);
        if (player) {
          return {
            id,
            name: `${player.lastName}${player.firstName}`,
            team: player.team ?? '所属不明',
            noLink: false,
          };
        } else {
          const [lastName = '', firstName = '', team = '所属不明'] =
            id.split('_');
          const unknown = unknownPlayers[id];
          return {
            id,
            name: unknown
              ? `${unknown.lastName}${unknown.firstName}`
              : `${lastName}${firstName}`,
            team: unknown?.team ?? team,
            noLink: true,
          };
        }
      });

      const resultOrder = resultPriority(entry.result);

      if (players.length === 1 || players[0].team === players[1].team) {
        const team = players[0].team;
        const displayParts = players.flatMap((p, i) => [
          { text: p.name, id: p.noLink ? undefined : p.id, noLink: p.noLink },
          ...(i < players.length - 1 ? [{ text: '・' }] : []),
        ]);

        const extra = teamMap[team] ?? { teamId: '', prefectureId: '' };

        if (!teamGroups[team]) {
          teamGroups[team] = {
            team,
            teamId: extra.teamId,
            prefectureId: extra.prefectureId,
            members: [],
            bestRank: resultOrder,
          };
        }
        teamGroups[team].members.push({
          result: entry.result,
          resultOrder,
          displayParts,
        });
        teamGroups[team].bestRank = Math.min(
          teamGroups[team].bestRank,
          resultOrder,
        );
      } else {
        for (const p of players) {
          const displayParts = [
            { text: p.name, id: p.noLink ? undefined : p.id, noLink: p.noLink },
          ];
          const extra = teamMap[p.team] ?? { teamId: '', prefectureId: '' };

          if (!teamGroups[p.team]) {
            teamGroups[p.team] = {
              team: p.team,
              teamId: extra.teamId,
              prefectureId: extra.prefectureId,
              members: [],
              bestRank: resultOrder,
            };
          }
          teamGroups[p.team].members.push({
            result: entry.result,
            resultOrder,
            displayParts,
          });
          teamGroups[p.team].bestRank = Math.min(
            teamGroups[p.team].bestRank,
            resultOrder,
          );
        }
      }
    } else if ('team' in entry && typeof entry.team === 'string') {
      const team = entry.team;
      const resultOrder = resultPriority(entry.result);
      const displayParts = [{ text: team, noLink: true }];
      const extra = teamMap[team] ?? { teamId: '', prefectureId: '' };

      if (!teamGroups[team]) {
        teamGroups[team] = {
          team,
          teamId: extra.teamId,
          prefectureId: extra.prefectureId,
          members: [],
          bestRank: resultOrder,
        };
      }

      teamGroups[team].members.push({
        result: entry.result,
        resultOrder,
        displayParts,
      });
      teamGroups[team].bestRank = Math.min(
        teamGroups[team].bestRank,
        resultOrder,
      );
    }
  }

  const sortedTeams = Object.values(teamGroups).sort((a, b) => {
    if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank;
    return a.team.localeCompare(b.team, 'ja');
  });

  const tournamentMatches = useMemo(() => data.matches ?? [], [data.matches]);
  const roundRobinMatches = useMemo(
    () => data.roundRobinMatches ?? [],
    [data.roundRobinMatches],
  );

  const matches = useMemo(
    () => [...roundRobinMatches, ...tournamentMatches],
    [roundRobinMatches, tournamentMatches],
  );

  const allNames = useMemo(
    () => [...new Set(matches.map((m) => m.name))],
    [matches],
  );

  const [filter, setFilter] = useState<'all' | 'top8' | 'winners'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    if (q.length > 0) {
      setSuggestions(
        allNames.filter((name) => name.toLowerCase().includes(q)).slice(0, 5),
      );
    } else {
      setSuggestions([]);
    }
  }, [searchQuery, allNames]);

  const seenPlayers = new Set<string>();
  const teamCounter: Record<string, number> = {};

  function findOpponentById(id: string): MatchOpponent | null {
    for (const match of matches) {
      for (const op of match.opponents ?? []) {
        if (op.playerId === id || op.tempId === id) return op;
      }
    }
    return null;
  }

  for (const match of matches) {
    for (const id of match.pair ?? []) {
      if (!seenPlayers.has(id)) {
        const player = findOpponentById(id);
        if (player?.team) {
          teamCounter[player.team] = (teamCounter[player.team] || 0) + 1;
          seenPlayers.add(id);
        }
      }
    }
  }

  const sorted = Object.entries(teamCounter).sort((a, b) => b[1] - a[1]);
  const rankedTeams: { rank: number; team: string; count: number }[] = [];
  let currentRank = 1;
  let prevCount: number | null = null;
  let offset = 0;

  for (let i = 0; i < sorted.length; i++) {
    const [team, count] = sorted[i];
    if (count === prevCount) {
      offset++;
    } else {
      currentRank = i + 1 + offset;
      offset = 0;
    }
    rankedTeams.push({ rank: currentRank, team, count });
    prevCount = count;
  }

  const seedEntryNos = new Set<number>();

  for (const entry of entries ?? []) {
    if (entry.type === 'seed') {
      seedEntryNos.add(entry.entryNo);
    }
  }

  const tournamentMatchSet = new Set(
    tournamentMatches.map((m) => `${m.name}|${m.category ?? 'default'}`),
  );

  const roundRobinMatchSet = new Set(
    roundRobinMatches.map((m) => `${m.name}|${m.category ?? 'default'}`),
  );

  const eliminatedEntries = [...roundRobinMatchSet]
    .filter((key) => !tournamentMatchSet.has(key))
    .map((key) => {
      const [name, category] = key.split('|');
      return { name, result: '予選敗退', category };
    });

  return (
    <>
      <MetaHead
        title={`${meta.name} ${year}年 ${categoryLabel ? `${categoryLabel} ` : ''}大会結果 | ソフトテニス情報`}
        description={`${meta.name} ${year}年 ${categoryLabel ? `${categoryLabel} ` : ''}の大会結果・試合成績を掲載。開催地や日程、選手ごとの成績も確認できます。`}
        url={pageUrl}
        image={`https://softeni-pick.com/api/og/tournaments/${generation}/${meta.id}/${year}/${gameCategory}/${ageCategory}/${gender}`}
        twitterCardType="summary_large_image"
        type="article"
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: `${meta.name} ${year}年  ${categoryLabel ? `${categoryLabel} ` : ''}大会結果`,
              author: { '@type': 'Person', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
              description: `${meta.name} ${year}年  ${categoryLabel ? `${categoryLabel} ` : ''}のソフトテニス大会結果を確認できます。過去の大会結果も掲載`,
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
                  name: '大会結果一覧',
                  item: 'https://softeni-pick.com/tournaments',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: `${meta.name} ${year}年 ${categoryLabel ? `${categoryLabel}` : ''}`,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: '大会結果一覧', href: '/tournaments' },
              {
                label: `${meta.name} ${year}年 ${categoryLabel ? `${categoryLabel}` : ''}`,
                href: `/tournaments/${generation}/${meta.id}/${year}/${gameCategory}/${ageCategory}${gender}`,
              },
            ]}
          />

          {/* ✅ h1 + 大会紹介文 */}
          <h1 className="text-2xl font-bold mb-4">
            {meta.name} {year}年 {categoryLabel ? `${categoryLabel} ` : ''}
            大会結果
          </h1>
          <section className="mb-6 px-1">
            {data.location && data.startDate && data.endDate && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                開催地：{data.location} ／ 日程：{data.startDate}〜
                {data.endDate}
              </p>
            )}
            {entries && entries.length > 0 && (
              <p className="mt-2 text-sm">
                <Link
                  href={`/tournaments/${generation}/${meta.id}/${year}/${gameCategory}/${ageCategory}/${gender}/data`}
                  className="text-blue-600 hover:underline"
                >
                  ▶ 大会データ
                </Link>
              </p>
            )}
            {highlight && (
              <section className="mt-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold mb-1">大会ハイライト</h2>
                {highlight.split('\n').map((line, i) => (
                  <p key={i} className="mb-1 inline-block">
                    {line}
                  </p>
                ))}
              </section>
            )}
          </section>

          {/* ✅ チーム別成績 */}
          <TeamResults sortedTeams={sortedTeams} />

          {groupedLinks && groupedLinks.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-bold mb-3">その他の大会結果</h2>
              {groupedLinks.map(({ year: yearValue, links }) => (
                <div
                  className="mb-4"
                  key={`${yearValue}-${links
                    .map(
                      (link) =>
                        `${link.year}-${link.gameCategory}-${link.ageCategory}-${link.gender}`,
                    )
                    .join('-')}`}
                >
                  <h4 className="text-md mb-2">{yearValue}年</h4>
                  <ul className="flex flex-wrap gap-2">
                    {links.map((link) =>
                      link.isCurrent ? (
                        <li
                          key={`${link.year}-${link.gameCategory}-${link.ageCategory}-${link.gender}`}
                        >
                          <span className="inline-block bg-gray-300 text-gray-600 px-3 py-1 rounded-full text-sm cursor-default">
                            {link.categoryLabel}
                          </span>
                        </li>
                      ) : (
                        <li
                          key={`${link.year}-${link.gameCategory}-${link.ageCategory}-${link.gender}`}
                        >
                          <Link
                            href={`/tournaments/${generation}/${meta.id}/${link.year}/${link.gameCategory}/${link.ageCategory}/${link.gender}`}
                          >
                            <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm hover:opacity-80 transition">
                              {link.categoryLabel}
                            </span>
                          </Link>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ))}
            </section>
          )}

          <div className="text-right mt-10 mb-2">
            <Link
              href="/tournaments"
              className="text-sm text-blue-500 hover:underline"
            >
              大会結果一覧
            </Link>
          </div>

          {matches.length > 0 && (
            <>
              <MatchResults
                matches={matches}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                suggestions={suggestions}
                filter={filter}
                setFilter={setFilter}
                eliminatedEntries={eliminatedEntries}
                seedEntryNos={seedEntryNos}
              />
            </>
          )}

          {meta.source && (
            <section className="mt-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 text-sm text-gray-700 dark:text-gray-300 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">
                出典・参考情報
              </h2>
              <p className="mb-3">
                本ページの試合結果データは、以下の情報をもとに作成しています。
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  {meta.sourceUrl ? (
                    <a
                      href={meta.sourceUrl}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {meta.source}
                    </a>
                  ) : (
                    <span className="font-medium">{meta.source}</span>
                  )}
                </li>
                <li>
                  一部の情報は現地観戦や報道発表、X（旧Twitter）などから収集しています。
                </li>
              </ul>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                内容に誤りがある場合は、ページ下部のお問い合わせからご連絡ください。
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const baseDir = path.join(process.cwd(), 'data/tournaments');
  const generations = fs.readdirSync(baseDir); // 例: ["junior", "highschool"]

  const paths: {
    params: {
      generation: string;
      tournamentId: string;
      year: string;
      gameCategory: string;
      ageCategory: string;
      gender: string;
    };
  }[] = [];

  for (const generation of generations) {
    const generationDir = path.join(baseDir, generation);
    const tournamentIds = fs.readdirSync(generationDir);

    for (const tid of tournamentIds) {
      const yearDir = path.join(generationDir, tid);
      if (!fs.statSync(yearDir).isDirectory()) continue;

      const years = fs.readdirSync(yearDir);
      for (const y of years) {
        const categoriesPath = path.join(yearDir, y, 'categories.json');
        if (!fs.existsSync(categoriesPath)) continue;

        const raw = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
        if (!Array.isArray(raw)) continue;

        for (const c of raw) {
          if (!c || typeof c !== 'object') continue;

          // JSONのキーから直接取得
          const gameCategory = c.category;
          const ageCategory = c.age;
          const gender = c.gender;

          if (!gameCategory || !gender) continue;

          paths.push({
            params: {
              generation, // これは外側のループや固定値から取得
              tournamentId: tid,
              year: y,
              gameCategory,
              ageCategory,
              gender,
            },
          });
        }
      }
    }
  }

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { generation, tournamentId, year, gameCategory, ageCategory, gender } =
    context.params as {
      generation: string;
      tournamentId: string;
      year: string;
      gameCategory: string;
      ageCategory: string;
      gender: string;
    };

  const basePath = path.join(
    process.cwd(),
    'data/tournaments',
    generation,
    tournamentId,
  );

  // 大会ごとの meta.json
  const tournamentMetaPath = path.join(basePath, 'meta.json');
  const tournamentMeta: TournamentMeta = fs.existsSync(tournamentMetaPath)
    ? JSON.parse(fs.readFileSync(tournamentMetaPath, 'utf-8'))
    : null;

  // 年度ごとの meta.json（上書き優先）
  const yearMetaPath = path.join(basePath, year, 'meta.json');
  const yearMeta = fs.existsSync(yearMetaPath)
    ? JSON.parse(fs.readFileSync(yearMetaPath, 'utf-8'))
    : {};

  const meta: TournamentMeta = {
    ...tournamentMeta,
    ...yearMeta,
  };

  // categoryId とファイル名
  const categoryId = `${gameCategory}-${ageCategory}-${gender}`;
  const categoryFileName = `${categoryId}.json`;

  // categories.json から label を取得
  const categoriesPath = path.join(basePath, year, 'categories.json');
  const categories: { id: string; label: string }[] = fs.existsSync(
    categoriesPath,
  )
    ? JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'))
    : [];
  const categoryLabel =
    categories.find((c) => c.id === categoryId)?.label ?? '';

  // entries
  const entryPath = path.join(basePath, year, 'entries', categoryFileName);
  const entries: EntryInfo[] = fs.existsSync(entryPath)
    ? JSON.parse(fs.readFileSync(entryPath, 'utf-8'))
    : [];

  // results
  const resultsPath = path.join(basePath, year, 'results', categoryFileName);
  const resultsData = fs.existsSync(resultsPath)
    ? JSON.parse(fs.readFileSync(resultsPath, 'utf-8'))
    : {
        results: [],
        matches: [],
        roundRobinMatches: [],
        location: null,
        startDate: null,
        endDate: null,
        highlight: null,
      };

  const allPlayers = getAllPlayers();
  const playersPath = path.join(process.cwd(), 'data/players');
  const unknownPlayers = JSON.parse(
    fs.readFileSync(path.join(playersPath, 'unknown.json'), 'utf-8'),
  );

  // 他年度・他カテゴリのリンク一覧（現在のものも含む）
  const siblings: {
    year: string;
    gameCategory: string;
    ageCategory: string;
    gender: string;
    categoryLabel: string;
  }[] = [];

  const years = fs.readdirSync(basePath).filter((y) => /^\d{4}$/.test(y));

  for (const y of years) {
    const catsPath = path.join(basePath, y, 'categories.json');
    if (!fs.existsSync(catsPath)) continue;
    const cats = JSON.parse(fs.readFileSync(catsPath, 'utf-8'));
    for (const c of cats) {
      siblings.push({
        year: y,
        gameCategory: c.category,
        ageCategory: c.age,
        gender: c.gender,
        categoryLabel: c.label,
      });
    }
  }

  // 現在表示している年度・カテゴリをフラグ付きで残す
  const siblingsWithCurrentFlag = siblings.map((s) => ({
    ...s,
    isCurrent:
      s.year === year &&
      s.gameCategory === gameCategory &&
      s.ageCategory === ageCategory &&
      s.gender === gender,
  }));

  type LinkItem = (typeof siblingsWithCurrentFlag)[number];
  type GroupedLink = { year: string; links: LinkItem[] };

  // ソート＆グループ化
  const groupedLinks: GroupedLink[] = siblingsWithCurrentFlag
    .sort((a, b) => Number(b.year) - Number(a.year)) // 新しい順
    .reduce((acc: GroupedLink[], link) => {
      const group = acc.find((g) => g.year === link.year);
      if (group) {
        group.links.push(link);
      } else {
        acc.push({ year: link.year, links: [link] });
      }
      return acc;
    }, []);

  return {
    props: {
      year,
      meta,
      data: resultsData,
      allPlayers,
      unknownPlayers,
      entries,
      teamMap: {},
      highlight: resultsData.highlight ?? null,
      groupedLinks,
      categoryLabel,
      generation,
      tournamentId,
      gameCategory,
      ageCategory,
      gender,
    },
  };
};
