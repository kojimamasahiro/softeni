/**
 * 同姓同名選手一覧ページ
 *
 * 機能:
 * - 全ての大会結果データから同じ名前の選手を抽出
 * - 2回以上出現する選手のみを表示
 * - 異なるチームや都道府県に所属する同名選手を識別
 * - 大会結果の成績順で並び替え
 * - 出現回数による絞り込み機能
 *
 * データ収集範囲:
 * - data/tournaments 配下の全ての results/*.json ファイル
 * - results 内の選手データと matches 内の対戦相手データ
 * - 重複する大会・年度・カテゴリでの出場記録は統合
 */

// pages/players/same-name.tsx

import fs from 'fs';
import path from 'path';

import type { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';

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
  tempId?: string | null;
}

interface SameNameGroup {
  fullName: string;
  players: PlayerResult[];
  count: number;
  differentTeams: string[];
}

interface SameNamePlayerPageProps {
  sameNameGroups: SameNameGroup[];
  totalResults: number;
}

interface TournamentMeta {
  name: string;
  id: string;
  sortId: number;
}

interface Category {
  id: string;
  category: string;
  age: string;
  gender: string;
  label: string;
}

export default function SameNamePlayerPage({
  sameNameGroups,
  totalResults,
}: SameNamePlayerPageProps) {
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count');
  const [filterMinCount, setFilterMinCount] = useState(2);
  const [searchQuery, setSearchQuery] = useState('');

  // 検索クエリに一致する部分をハイライトする関数
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
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
    return sameNameGroups
      .filter((group) => {
        // 出現回数フィルター
        if (group.count < filterMinCount) return false;

        // 検索クエリフィルター
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          // 選手名での検索
          if (group.fullName.toLowerCase().includes(query)) return true;
          // チーム名での検索
          if (
            group.differentTeams.some((team) =>
              team.toLowerCase().includes(query),
            )
          )
            return true;
          // 大会名での検索
          if (
            group.players.some((player) =>
              player.tournamentName.toLowerCase().includes(query),
            )
          )
            return true;
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'count') {
          return b.count - a.count;
        } else {
          return a.fullName.localeCompare(b.fullName, 'ja');
        }
      });
  }, [sameNameGroups, sortBy, filterMinCount, searchQuery]);

  return (
    <>
      <MetaHead
        title="同姓同名選手一覧（ベータ版） | ソフトテニス情報"
        description="ソフトテニス大会での同姓同名選手の結果を一覧表示。選手名、チーム名、大会名で検索可能。同じ名前の選手の成績と所属チームを確認できます。"
        url="https://softeni-pick.com/beta/same-name-players"
        type="article"
      />

      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              headline: '同姓同名選手一覧（ベータ版）',
              author: { '@type': 'Person', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': 'https://softeni-pick.com/beta/same-name-players',
              },
              description:
                'ソフトテニス大会での同姓同名選手の結果を一覧表示（ベータ版）',
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: 'ベータ機能', href: '/beta' },
              { label: '同姓同名選手一覧', href: '/beta/same-name-players' },
            ]}
          />

          <h1 className="text-2xl font-bold mb-6 flex items-center gap-3">
            同姓同名選手一覧
            <span className="text-sm font-normal text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded">
              🧪 ベータ版
            </span>
          </h1>

          <section className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-600 dark:text-amber-400">⚠️</span>
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                ベータ機能について
              </h2>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              この機能は開発中のため、データの正確性や完全性は保証されません。予告なく変更・削除される可能性があります。
            </p>
            <div className="border-t border-amber-200 dark:border-amber-700 pt-3">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                大会結果データから抽出した同姓同名の選手の一覧です。
                <br />
                同じ名前でも異なる選手の可能性があります。所属チームを参考にしてください。
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                <strong>検索機能:</strong>{' '}
                選手名、チーム名、大会名で検索できます。部分一致で絞り込み可能です。
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                対象データ: {totalResults.toLocaleString()}件の大会結果
              </p>
            </div>
          </section>

          {/* 検索ボックス */}
          <div className="mb-6">
            <label
              htmlFor="searchQuery"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              検索（選手名、チーム名、大会名）
            </label>
            <input
              id="searchQuery"
              type="text"
              placeholder="例: 田中、全日本、明大..."
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

          {/* フィルターとソート */}
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
                <option value="count">出現回数順</option>
                <option value="name">名前順</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="filterMinCount"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                最小出現回数:
              </label>
              <select
                id="filterMinCount"
                value={filterMinCount}
                onChange={(e) => setFilterMinCount(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value={2}>2回以上</option>
                <option value={3}>3回以上</option>
                <option value={5}>5回以上</option>
                <option value={10}>10回以上</option>
              </select>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {searchQuery ? (
                <>
                  <span className="font-medium">「{searchQuery}」</span>
                  {sortedAndFilteredGroups.length}組 の検索結果:
                  {filterMinCount > 2 && ` (${filterMinCount}回以上出現)`}
                </>
              ) : (
                <>
                  {sortedAndFilteredGroups.length}組の同姓同名選手を表示中
                  {filterMinCount > 2 && ` (${filterMinCount}回以上出現のみ)`}
                </>
              )}
            </div>
            {sameNameGroups.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                全 {sameNameGroups.length}組
              </div>
            )}
          </div>

          <div className="space-y-6">
            {sortedAndFilteredGroups.map((group) => (
              <div
                key={group.fullName}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
              >
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {searchQuery
                      ? highlightMatch(group.fullName, searchQuery)
                      : group.fullName}
                  </h2>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {group.count}回出現
                  </div>
                </div>

                {group.differentTeams.length > 1 && (
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
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    大会結果:
                  </h3>
                  <div className="grid gap-2 text-sm">
                    {group.players
                      .sort((a, b) => {
                        // 年度の新しい順、結果の良い順
                        if (a.year !== b.year) {
                          return Number(b.year) - Number(a.year);
                        }
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
                    別のキーワードで検索するか、検索条件を緩めてお試しください。
                  </p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 px-4 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    検索をクリアして全件表示
                  </button>
                </div>
              ) : (
                <p>条件に該当する同姓同名選手が見つかりませんでした。</p>
              )}
            </div>
          )}

          <div className="mt-12 text-center space-x-4">
            <Link
              href="/beta"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              ← ベータ機能一覧に戻る
            </Link>
            <span className="text-gray-400">|</span>
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
  const baseDir = path.join(process.cwd(), 'data/tournaments');
  const playerMap = new Map<string, PlayerResult[]>();
  let totalResults = 0;

  // すべての tournament meta を読み込み
  const tournamentMetaMap = new Map<string, TournamentMeta>();

  function loadTournamentMetas(dir: string, generation: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const tournamentPath = path.join(dir, entry.name);
        const metaPath = path.join(tournamentPath, 'meta.json');
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
          tournamentMetaMap.set(`${generation}/${entry.name}`, meta);
        }
      }
    }
  }

  // 各世代のトーナメントメタを読み込み
  const generations = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const gen of generations) {
    if (gen.isDirectory()) {
      loadTournamentMetas(path.join(baseDir, gen.name), gen.name);
    }
  }

  function processResultsFiles(dir: string, generation: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const tournamentPath = path.join(dir, entry.name);
        const tournamentId = entry.name;
        const tournamentMeta = tournamentMetaMap.get(
          `${generation}/${tournamentId}`,
        );

        if (!tournamentMeta) continue;

        // 年度フォルダを探索
        const yearEntries = fs.readdirSync(tournamentPath, {
          withFileTypes: true,
        });
        for (const yearEntry of yearEntries) {
          if (yearEntry.isDirectory() && /^\d{4}$/.test(yearEntry.name)) {
            const year = yearEntry.name;
            const yearPath = path.join(tournamentPath, year);

            // categories.json を読み込み
            const categoriesPath = path.join(yearPath, 'categories.json');
            if (!fs.existsSync(categoriesPath)) continue;

            const categories = JSON.parse(
              fs.readFileSync(categoriesPath, 'utf-8'),
            );

            // results フォルダを探索
            const resultsPath = path.join(yearPath, 'results');
            if (!fs.existsSync(resultsPath)) continue;

            const resultFiles = fs.readdirSync(resultsPath);
            for (const resultFile of resultFiles) {
              if (!resultFile.endsWith('.json')) continue;

              const categoryId = resultFile.replace('.json', '');
              const category = categories.find(
                (c: Category) => c.id === categoryId,
              );
              if (!category) continue;

              const resultFilePath = path.join(resultsPath, resultFile);
              const resultData = JSON.parse(
                fs.readFileSync(resultFilePath, 'utf-8'),
              );

              // results から選手データを抽出
              if (resultData.results && Array.isArray(resultData.results)) {
                for (const result of resultData.results) {
                  totalResults++;

                  if (result.playerIds && Array.isArray(result.playerIds)) {
                    // 個人戦の場合
                    for (const playerId of result.playerIds) {
                      const [lastName = '', firstName = '', team = '所属不明'] =
                        playerId.split('_');
                      const fullName = `${lastName}${firstName}`;

                      if (lastName && firstName) {
                        const playerResult: PlayerResult = {
                          firstName,
                          lastName,
                          fullName,
                          team,
                          result: result.result,
                          tournamentName: tournamentMeta.name,
                          tournamentId,
                          generation,
                          year,
                          gameCategory: category.category,
                          ageCategory: category.age,
                          gender: category.gender,
                          categoryLabel: category.label,
                          tempId: playerId,
                        };

                        if (!playerMap.has(fullName)) {
                          playerMap.set(fullName, []);
                        }
                        playerMap.get(fullName)!.push(playerResult);
                      }
                    }
                  }
                }
              }

              // matches から選手データを抽出
              const allMatches = [
                ...(resultData.matches || []),
                ...(resultData.roundRobinMatches || []),
              ];

              for (const match of allMatches) {
                if (match.opponents && Array.isArray(match.opponents)) {
                  for (const opponent of match.opponents) {
                    const fullName = `${opponent.lastName}${opponent.firstName}`;

                    if (opponent.lastName && opponent.firstName) {
                      const playerResult: PlayerResult = {
                        firstName: opponent.firstName,
                        lastName: opponent.lastName,
                        fullName,
                        team: opponent.team || '所属不明',
                        prefecture: opponent.prefecture || null,
                        result: '出場', // 試合出場の記録として
                        tournamentName: tournamentMeta.name,
                        tournamentId,
                        generation,
                        year,
                        gameCategory: category.category,
                        ageCategory: category.age,
                        gender: category.gender,
                        categoryLabel: category.label,
                        playerId: opponent.playerId || null,
                        tempId: opponent.tempId,
                      };

                      if (!playerMap.has(fullName)) {
                        playerMap.set(fullName, []);
                      }
                      playerMap.get(fullName)!.push(playerResult);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // 各世代を処理
  for (const gen of generations) {
    if (gen.isDirectory()) {
      processResultsFiles(path.join(baseDir, gen.name), gen.name);
    }
  }

  // 同姓同名のグループを作成（2回以上出現する選手のみ）
  const sameNameGroups: SameNameGroup[] = [];

  for (const [fullName, players] of playerMap.entries()) {
    if (players.length >= 2) {
      // 重複を除去（同じ大会・年度・カテゴリでの重複出場記録を統合）
      const uniquePlayers = players.reduce((acc, player) => {
        const key = `${player.tournamentId}-${player.year}-${player.gameCategory}-${player.ageCategory}-${player.gender}-${player.team}`;
        if (!acc.has(key)) {
          acc.set(key, player);
        } else {
          // 既存のエントリがある場合、より良い結果を優先
          const existing = acc.get(key)!;
          const resultPriority: Record<string, number> = {
            優勝: 1,
            準優勝: 2,
            ベスト4: 3,
            ベスト8: 4,
            出場: 999,
          };
          const playerPriority = resultPriority[player.result] || 999;
          const existingPriority = resultPriority[existing.result] || 999;

          if (playerPriority < existingPriority) {
            acc.set(key, player);
          }
        }
        return acc;
      }, new Map<string, PlayerResult>());

      const uniquePlayersArray = Array.from(uniquePlayers.values());

      if (uniquePlayersArray.length >= 2) {
        const differentTeams = [
          ...new Set(uniquePlayersArray.map((p) => p.team)),
        ];

        sameNameGroups.push({
          fullName,
          players: uniquePlayersArray,
          count: uniquePlayersArray.length,
          differentTeams,
        });
      }
    }
  }

  return {
    props: {
      sameNameGroups,
      totalResults,
    },
  };
};
