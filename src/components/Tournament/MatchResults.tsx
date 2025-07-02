// src/components/Tournament/MatchResults.tsx
import { useState } from 'react';

import { sortMatchesByEntryNo } from '@/lib/utils';
import { TournamentYearData } from '@/types/tournament';

// 予選敗退の名前一覧を含む構造を受け取るようにする
interface Props {
  matches: NonNullable<TournamentYearData['matches']>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  suggestions: string[];
  filter: 'all' | 'top8' | 'winners';
  setFilter: (v: 'all' | 'top8' | 'winners') => void;
  eliminatedEntries: { name: string; result: string }[];
}

function MatchGroup({
  name,
  matches,
  searchQuery,
  filter,
  eliminatedLabel,
}: {
  name: string;
  matches: NonNullable<TournamentYearData['matches']>;
  searchQuery: string;
  filter: 'all' | 'top8' | 'winners';
  eliminatedLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const matchGroup = sortMatchesByEntryNo(matches);

  let finalLabel = '';
  if (eliminatedLabel) {
    finalLabel = eliminatedLabel;
  } else {
    const lastMatch = matchGroup[matchGroup.length - 1];
    if (lastMatch) {
      const { round, result } = lastMatch;
      if (round === '決勝' && result === 'win') finalLabel = '優勝';
      else if (round === '決勝' && result === 'lose') finalLabel = '準優勝';
      else if (round === '準決勝' && result === 'lose') finalLabel = 'ベスト4';
      else if (round === '準々決勝' && result === 'lose')
        finalLabel = 'ベスト8';
      else if (result === 'lose') finalLabel = `${round}敗退`;
    }
  }

  const nameLower = name.toLowerCase();
  const queryLower = searchQuery.toLowerCase();
  const matchesQuery = nameLower.includes(queryLower);
  const show = (() => {
    if (!matchesQuery) return false;
    if (filter === 'all') return true;
    if (filter === 'winners') return ['優勝', '準優勝'].includes(finalLabel);
    if (filter === 'top8')
      return ['優勝', '準優勝', 'ベスト4', 'ベスト8'].includes(finalLabel);
    return true;
  })();

  if (!show) return null;

  return (
    <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm bg-white dark:bg-gray-800">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex justify-between items-center">
          <span>
            {name}
            {finalLabel && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                {finalLabel}
              </span>
            )}
          </span>
          <span className="ml-2 text-xs">{isOpen ? '▲' : '▼'}</span>
        </h3>
      </button>

      {isOpen && (
        <div className="overflow-x-auto">
          {matches.length > 0 ? (
            <table className="w-full text-sm table-fixed border-collapse">
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
                <tr>
                  <th className="w-1/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">
                    ラウンド
                  </th>
                  <th className="w-2/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">
                    対戦相手
                  </th>
                  <th className="w-1/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">
                    勝敗
                  </th>
                  <th className="w-1/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">
                    スコア
                  </th>
                </tr>
              </thead>
              <tbody>
                {matchGroup.map((m, i) => (
                  <tr
                    key={i}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="px-4 py-2 break-words">{m.round}</td>
                    <td className="px-4 py-2 break-words">
                      {(() => {
                        if (!m.opponents || m.opponents.length === 0) {
                          // 団体戦（opponent フィールド使用）
                          return m.opponent ?? '不明';
                        }

                        // 個人戦（opponents フィールド使用）
                        const teamMap = m.opponents.reduce<
                          Record<string, string[]>
                        >((acc, op) => {
                          if (!acc[op.team]) acc[op.team] = [];
                          acc[op.team].push(op.lastName);
                          return acc;
                        }, {});

                        const grouped = Object.entries(teamMap).map(
                          ([team, names]) => `${names.join('・')}（${team}）`,
                        );

                        return grouped.join('・');
                      })()}
                    </td>
                    <td className="px-4 py-2">
                      {m.result === 'win' ? '勝ち' : '負け'}
                    </td>
                    <td className="px-4 py-2">
                      {m.games.won}-{m.games.lost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
              ラウンドロビン敗退のため、トーナメント進出はありませんでした。
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MatchResults({
  matches,
  searchQuery,
  setSearchQuery,
  suggestions,
  filter,
  setFilter,
  eliminatedEntries,
}: Props) {
  const groupedNames = [
    ...new Set([
      ...sortMatchesByEntryNo(matches).map((m) => m.name),
      ...(eliminatedEntries?.map((e) => e.name) ?? []),
    ]),
  ];

  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold mb-3">対戦詳細</h2>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="選手名や所属で検索"
          className="h-9 px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded shadow-sm dark:bg-gray-900 dark:text-white"
        />
        {suggestions.length > 0 && (
          <ul className="mt-1 bg-white dark:bg-gray-800 border rounded shadow text-sm">
            {suggestions.map((name, i) => (
              <li
                key={i}
                onClick={() => setSearchQuery(name)}
                className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                {name}
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => setFilter('all')}
          className={`h-9 px-3 text-sm rounded border ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'
          }`}
        >
          全て
        </button>
        <button
          onClick={() => setFilter('top8')}
          className={`h-9 px-3 text-sm rounded border ${
            filter === 'top8'
              ? 'bg-blue-600 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'
          }`}
        >
          ベスト8以上
        </button>
      </div>

      {groupedNames.map((name) => {
        const matchGroup = matches.filter((m) => m.name === name);
        const eliminatedResult = Array.isArray(eliminatedEntries)
          ? eliminatedEntries.find((e) => e.name === name)?.result || ''
          : '';

        return (
          <MatchGroup
            key={name}
            name={name}
            matches={matchGroup}
            searchQuery={searchQuery}
            filter={filter}
            eliminatedLabel={eliminatedResult}
          />
        );
      })}
    </section>
  );
}
