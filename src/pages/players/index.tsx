// pages/players/index.tsx
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

interface PlayerResult {
  firstName: string;
  lastName: string;
  fullName: string;
  team: string;
  prefecture?: string | null;
  result: string;
  tournamentName: string;
  tournamentId: string;
  generation: string;
  year: string;
  gameCategory: string;
  ageCategory: string;
  gender: string;
  categoryLabel: string;
  playerId?: string | null;
}

interface SameNameGroup {
  fullName: string;
  players: PlayerResult[];
  count: number;
  differentTeams: string[];
  playerId?: string | null;
}

interface SameNamePlayerPageProps {
  sameNameGroups: SameNameGroup[];
  totalResults: number;
}

export default function PlayersPage({
  sameNameGroups,
}: SameNamePlayerPageProps) {
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count');
  const [filterMinCount, setFilterMinCount] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [dynamicData, setDynamicData] = useState<SameNameGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch data dynamically when filterMinCount changes to less than 20
  useEffect(() => {
    if (filterMinCount < 20) {
      setIsLoading(true);
      // Use static JSON files instead of API route
      const jsonFile =
        filterMinCount === 2
          ? '/data/players-min2.json'
          : '/data/players-min10.json';
      fetch(jsonFile)
        .then((res) => res.json())
        .then((data) => {
          setDynamicData(data.sameNameGroups || []);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('Error fetching player data:', error);
          setIsLoading(false);
        });
    } else {
      setDynamicData([]);
    }
  }, [filterMinCount]);

  // Use dynamic data if available, otherwise use static props data
  const activeData = dynamicData.length > 0 ? dynamicData : sameNameGroups;

  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    const queries = searchQuery.toLowerCase().trim().split(/\s+/);
    const query = queries[0];
    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`,
      'gi',
    );
    const parts = text.split(regex);
    return parts.map((part, index) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return (
          <mark
            key={index}
            className="bg-yellow-200 dark:bg-yellow-800 rounded px-1"
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const sortedAndFilteredGroups = useMemo(() => {
    return activeData
      .filter((group) => {
        if (group.count < filterMinCount) return false;
        if (searchQuery.trim()) {
          const queries = searchQuery.toLowerCase().trim().split(/\s+/);
          return group.players.some((player) => {
            return queries.every((query) => {
              return (
                group.fullName.toLowerCase().includes(query) ||
                player.team.toLowerCase().includes(query) ||
                player.tournamentName.toLowerCase().includes(query) ||
                player.categoryLabel.toLowerCase().includes(query) ||
                player.year.includes(query) ||
                `${player.year}年`.includes(query) ||
                (player.prefecture &&
                  player.prefecture.toLowerCase().includes(query))
              );
            });
          });
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'count') return b.count - a.count;
        return a.fullName.localeCompare(b.fullName, 'ja');
      });
  }, [activeData, sortBy, filterMinCount, searchQuery]);

  return (
    <>
      <MetaHead
        title="選手一覧 | ソフトテニス情報"
        description="ソフトテニス大会データから抽出した同姓同名選手一覧。名前・所属・大会で検索できます。"
        url="https://softeni-pick.com/players"
        type="article"
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              headline: '選手一覧',
              author: { '@type': 'Person', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': 'https://softeni-pick.com/players',
              },
              description: 'ソフトテニス大会での同姓同名選手の結果を一覧表示',
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: '選手一覧', href: '/players' },
            ]}
          />

          <h1 className="text-2xl font-bold mb-6">選手一覧</h1>

          <section className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                同姓同名選手の一覧
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              大会結果データから抽出した同姓同名の選手の一覧です。同じ名前でも異なる選手の可能性があります。所属チームや大会記録を確認してください。
            </p>
          </section>

          <div className="mb-6">
            <label
              htmlFor="searchQuery"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              大会記録検索（スペース区切りでAND検索）
            </label>
            <input
              id="searchQuery"
              type="text"
              placeholder="例: 田中 全日本 2024、佐藤 明大 優勝..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                検索をクリア ✕
              </button>
            )}
          </div>

          <div className="mb-6 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label
                htmlFor="sortBy"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                並び順:
              </label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'count' | 'name')}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="count">出場回数順</option>
                <option value="name">名前順</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="filterMinCount"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                最小出場回数:
              </label>
              <select
                id="filterMinCount"
                value={filterMinCount}
                onChange={(e) => setFilterMinCount(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value={2}>2回以上</option>
                <option value={10}>10回以上</option>
                <option value={20}>20回以上</option>
              </select>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {searchQuery ? (
                <>
                  <span className="font-medium">「{searchQuery}」</span>
                  {sortedAndFilteredGroups.length}組 の検索結果
                  {filterMinCount > 2 && ` (${filterMinCount}回以上出場)`}
                </>
              ) : (
                <>
                  {sortedAndFilteredGroups.length}組の同姓同名選手を表示中
                  {filterMinCount > 2 && ` (${filterMinCount}回以上出場のみ)`}
                </>
              )}
            </div>
            {isLoading && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                読み込み中...
              </div>
            )}
            {!isLoading && activeData.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                全 {activeData.length}組
              </div>
            )}
          </div>

          <div className="space-y-6">
            {sortedAndFilteredGroups.map((group, groupIndex) => (
              <div
                key={group.playerId || `${group.fullName}-${groupIndex}`}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {group.playerId && group.count >= 5 ? (
                      <Link
                        href={`/players/${group.playerId}/results`}
                        className="underline decoration-wavy decoration-gray-300 dark:decoration-gray-600 hover:decoration-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {searchQuery
                          ? highlightMatch(group.fullName, searchQuery)
                          : group.fullName}
                      </Link>
                    ) : searchQuery ? (
                      highlightMatch(group.fullName, searchQuery)
                    ) : (
                      group.fullName
                    )}
                  </h2>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {group.count}回出場
                  </div>
                </div>

                {group.differentTeams.length > 0 && (
                  <div className="mb-3 text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      所属チーム:
                    </span>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">
                      {searchQuery
                        ? group.differentTeams.map((team, i) => (
                            <span key={team}>
                              {i > 0 && ', '}
                              {highlightMatch(team, searchQuery)}
                            </span>
                          ))
                        : group.differentTeams.join(', ')}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="grid gap-2 text-sm">
                    {group.players
                      .sort((a, b) => {
                        if (a.year !== b.year)
                          return Number(b.year) - Number(a.year);
                        const resultOrder: Record<string, number> = {
                          優勝: 1,
                          準優勝: 2,
                          ベスト4: 3,
                          ベスト8: 4,
                        };
                        const aOrder = resultOrder[a.result] || 999;
                        const bOrder = resultOrder[b.result] || 999;
                        return aOrder - bOrder;
                      })
                      .map((player, index) => (
                        <div
                          key={`${player.tournamentId}-${player.year}-${player.gameCategory}-${player.ageCategory}-${player.gender}-${index}`}
                          className="flex flex-wrap items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                        >
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/tournaments/${player.generation}/${player.tournamentId}/${player.year}/${player.gameCategory}/${player.ageCategory}/${player.gender}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                            >
                              {searchQuery
                                ? highlightMatch(
                                    `${player.tournamentName} ${player.year}年 ${player.categoryLabel}`,
                                    searchQuery,
                                  )
                                : `${player.tournamentName} ${player.year}年 ${player.categoryLabel}`}
                            </Link>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">{player.result}</span>
                            <span>|</span>
                            <span>
                              {searchQuery
                                ? highlightMatch(player.team, searchQuery)
                                : player.team}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {sortedAndFilteredGroups.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {searchQuery ? (
                <div>
                  <p className="mb-2">
                    「<span className="font-medium">{searchQuery}</span>
                    」に該当する同姓同名選手が見つかりませんでした。
                  </p>
                  <p className="text-sm">
                    選手名、チーム名、大会名、年度で検索できます。1つの大会記録でスペース区切りの全条件が満たされる必要があります。別のキーワードで検索するか、検索条件を緩めてお試しください。
                  </p>
                  <button
                    onClick={() => {
                      if (filterMinCount === 20 || filterMinCount === 10) {
                        setFilterMinCount(2);
                      } else {
                        setSearchQuery('');
                      }
                    }}
                    className="mt-3 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {filterMinCount === 20 || filterMinCount === 10
                      ? '条件を緩めて再検索 (最小出場回数を2回に設定)'
                      : '検索をクリアして全件表示'}
                  </button>
                </div>
              ) : (
                <p>条件に該当する同姓同名選手が見つかりませんでした。</p>
              )}
            </div>
          )}

          <div className="mt-12 text-center space-x-4">
            <Link
              href="/tournaments"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              大会結果一覧
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const fs = await import('fs');
  const path = await import('path');

  const jsonPath = path.join(
    process.cwd(),
    'public',
    'data',
    'players-min20.json',
  );
  let sameNameGroups = [];

  try {
    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(fileContent);
    sameNameGroups = data.sameNameGroups || [];
  } catch (error) {
    console.error('Error reading players-min20.json:', error);
    sameNameGroups = [];
  }

  return { props: { sameNameGroups } };
};
