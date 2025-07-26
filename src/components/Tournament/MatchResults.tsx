// src/components/Tournament/MatchResults.tsx
import { useState } from 'react';

import { sortMatchesByEntryNo } from '@/lib/utils';
import { TournamentYearData } from '@/types/tournament';

interface Props {
  matches: NonNullable<TournamentYearData['matches']>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  suggestions: string[];
  filter: 'all' | 'top8' | 'winners';
  setFilter: (v: 'all' | 'top8' | 'winners') => void;
  eliminatedEntries: { name: string; result: string }[];
  seedEntryNos?: Set<number>;
}

type Match = NonNullable<TournamentYearData['matches']>[number];

function getPairId(pair: string[]): string {
  return [...pair].sort().join('+');
}

function roundOrderIndex(round: string): number {
  const order = [
    '1回戦',
    '2回戦',
    '3回戦',
    '4回戦',
    '5回戦',
    '6回戦',
    '準々決勝',
    '準決勝',
    '決勝',
  ];
  return order.indexOf(round) !== -1 ? order.indexOf(round) : 99;
}

function groupMatchesByPair(matches: Match[]): Map<string, Match[]> {
  const map = new Map<string, Match[]>();
  for (const match of matches) {
    const id =
      match.category === 'team'
        ? match.name // チーム名をIDとする
        : getPairId(match.pair ?? []);
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(match);
  }
  return map;
}

function traceOpponentChain(
  pairId: string,
  currentRoundIndex: number,
  grouped: Map<string, Match[]>,
  visited = new Set<string>(),
): Match[] {
  const result: Match[] = [];
  if (visited.has(pairId)) return result;
  visited.add(pairId);

  const matches = grouped.get(pairId) ?? [];

  for (const match of matches) {
    const roundIdx = roundOrderIndex(match.round);
    if (roundIdx > currentRoundIndex) {
      result.push(match);

      const winnerId =
        match.result === 'win'
          ? match.category === 'team'
            ? match.team
            : getPairId(match.pair ?? [])
          : match.category === 'team'
            ? (match.opponent ?? '')
            : getPairId(match.opponents?.map((op) => op.tempId) ?? []);

      if (winnerId) {
        result.push(
          ...traceOpponentChain(winnerId, roundIdx, grouped, visited),
        );
      }
    }
  }

  return result;
}

function traceFromLoser(matches: Match[], myMatches: Match[]): Match[] {
  const tournamentMatches = matches.filter((m) => m.round !== undefined);
  const myTournamentMatches = myMatches.filter((m) => m.round !== undefined);
  if (myTournamentMatches.length === 0) return [];

  const lastMatch = myTournamentMatches[myTournamentMatches.length - 1];
  if (!lastMatch || lastMatch.result !== 'lose') return [];

  const grouped = groupMatchesByPair(tournamentMatches);
  const startRoundIdx = roundOrderIndex(lastMatch.round);

  const opponentId =
    lastMatch.category === 'team'
      ? (lastMatch.opponent ?? '')
      : getPairId(
          lastMatch.opponents?.map((op: { tempId: string }) => op.tempId) ?? [],
        );

  return traceOpponentChain(opponentId, startRoundIdx, grouped);
}

function MatchGroup({
  name,
  entryNo,
  matches,
  searchQuery,
  filter,
  eliminatedLabel,
  isSeed,
  tracedMatches,
}: {
  name: string;
  entryNo: string;
  matches: Match[];
  searchQuery: string;
  filter: 'all' | 'top8' | 'winners';
  eliminatedLabel?: string;
  isSeed?: boolean;
  tracedMatches?: Match[];
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
          <span className="flex flex-col">
            <span>
              {entryNo}. {name}
            </span>
            <span className="text-sm">
              {isSeed && (
                <span className="text-yellow-600 dark:text-yellow-300">
                  （シード）
                </span>
              )}
              {finalLabel && (
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  {finalLabel}
                </span>
              )}
            </span>
          </span>
          <span className="ml-2 text-xs">{isOpen ? '▲' : '▼'}</span>
        </h3>
      </button>

      {isOpen && (
        <div className="w-full overflow-x-auto">
          {[
            { title: null, rows: matchGroup },
            { title: '以降の試合', rows: tracedMatches ?? [] },
          ].map(({ title, rows }, index) =>
            rows.length > 0 ? (
              <div key={title ?? 'main'} className="mb-2 w-full">
                {title && (
                  <div className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 text-left">
                    {title}
                  </div>
                )}
                <table className="w-full text-sm table-fixed border-collapse text-left">
                  {index === 0 && (
                    <thead className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
                      <tr>
                        <th className="w-1/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">
                          ラウンド
                        </th>
                        <th className="w-3/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">
                          対戦相手
                        </th>
                        <th className="w-1/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left">
                          スコア
                        </th>
                      </tr>
                    </thead>
                  )}
                  {index !== 0 && (
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
                      <tr>
                        <th className="w-1/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left"></th>
                        <th className="w-3/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left"></th>
                        <th className="w-1/5 px-4 py-2 border-b border-gray-200 dark:border-gray-600 text-left"></th>
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {rows.map((m, i) => (
                      <tr
                        key={i}
                        className="border-t border-gray-100 dark:border-gray-700"
                      >
                        <td className="px-4 py-2 break-words text-left">
                          {m.round}
                        </td>
                        <td className="px-4 py-2 break-words text-left">
                          {(() => {
                            if (
                              !m.opponents ||
                              (m.category && m.category === 'team')
                            ) {
                              if (m.opponents) {
                                return m.opponents
                                  .map(
                                    (op) =>
                                      `${op.team}（${op.prefecture ?? '不明'}）`,
                                  )
                                  .join('・');
                              } else {
                                return m.opponent ?? '不明';
                              }
                            }

                            const teamMap = m.opponents.reduce<
                              Record<string, string[]>
                            >((acc, op: { team: string; lastName: string }) => {
                              if (!acc[op.team]) acc[op.team] = [];
                              acc[op.team].push(op.lastName);
                              return acc;
                            }, {});

                            const grouped = (
                              Object.entries(teamMap) as [string, string[]][]
                            ).map(
                              ([team, names]) =>
                                `${names.join('・')}（${team}）`,
                            );
                            return grouped.join('・');
                          })()}
                        </td>
                        <td className="px-4 py-2 text-left">
                          {m.games.won}-{m.games.lost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null,
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
  seedEntryNos,
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
          className={`h-9 px-3 text-sm rounded border ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'}`}
        >
          全て
        </button>
        <button
          onClick={() => setFilter('top8')}
          className={`h-9 px-3 text-sm rounded border ${filter === 'top8' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'}`}
        >
          ベスト8以上
        </button>
      </div>

      {groupedNames.map((name) => {
        const matchGroup = matches.filter((m) => m.name === name);
        const eliminatedResult = Array.isArray(eliminatedEntries)
          ? eliminatedEntries.find((e) => e.name === name)?.result || ''
          : '';
        const tournamentMatches = matches.filter((m) => m.round !== undefined);
        const tracedMatches = traceFromLoser(tournamentMatches, matchGroup);

        return (
          <MatchGroup
            key={name}
            name={name}
            entryNo={matchGroup[0]?.entryNo ?? ''}
            matches={matchGroup}
            searchQuery={searchQuery}
            filter={filter}
            eliminatedLabel={eliminatedResult}
            isSeed={seedEntryNos?.has(Number(matchGroup[0]?.entryNo) ?? -1)}
            tracedMatches={tracedMatches}
          />
        );
      })}
    </section>
  );
}
