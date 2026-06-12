// src/components/Tournament/MatchResults.tsx
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import {
  MatchRow,
  TournamentDetailData,
  TournamentEntry,
  TournamentMatch,
} from '@/types/tournament';

type NamePart = {
  text: string;
  playerId?: number;
};

interface Props {
  detail: TournamentDetailData;
  gameCategory: string;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filter: 'all' | 'top8' | 'winners';
  setFilter: (v: 'all' | 'top8') => void;
}

function MatchGroup({
  name,
  nameParts,
  entryNo,
  matchGroup,
  extraRows,
  searchQuery,
  filter,
  isSeed,
  resultLabel,
}: {
  name: string;
  nameParts?: NamePart[];
  entryNo: number;
  matchGroup: MatchRow[];
  extraRows?: MatchRow[];
  searchQuery: string;
  filter: 'all' | 'top8' | 'winners';
  isSeed?: boolean;
  resultLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const nameLower = name.toLowerCase();
  const queryLower = searchQuery.toLowerCase();
  const matchesQuery = nameLower.includes(queryLower);
  if (typeof name !== 'string' || typeof searchQuery !== 'string') return null;
  const show = (() => {
    if (!matchesQuery) return false;
    if (filter === 'all') return true;
    const top8Set = ['優勝', '準優勝', 'ベスト4', 'ベスト8'];
    if (filter === 'top8') {
      if (!resultLabel) return false;
      return top8Set.some((tag) => resultLabel.includes(tag));
    }
    return true;
  })();

  if (!show) return null;

  return (
    <div className="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm bg-white dark:bg-gray-800">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className="w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
      >
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex justify-between items-center">
          <span className="flex flex-col">
            <span>
              {entryNo}.{' '}
              {nameParts && nameParts.length > 0
                ? nameParts.map((part, i) =>
                    part.playerId ? (
                      <Link
                        key={i}
                        href={`/players/${part.playerId}/results`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid"
                      >
                        {part.text}
                      </Link>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )
                : name}
            </span>
            <span className="text-sm">
              {resultLabel && (
                <span className="ml-2 text-gray-500 dark:text-gray-400">
                  {resultLabel}
                </span>
              )}
              {isSeed && (
                <span className="text-yellow-600 dark:text-yellow-300">
                  （シード）
                </span>
              )}
            </span>
          </span>
          <span className="ml-2 text-xs">{isOpen ? '▲' : '▼'}</span>
        </h3>
      </div>

      {isOpen && (
        <div className="w-full overflow-x-auto">
          {[
            { title: null, rows: matchGroup },
            { title: '以降の試合', rows: extraRows ?? [] },
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
                    {rows.map((m: MatchRow, i: number) => {
                      return (
                        <tr
                          key={i}
                          className="border-t border-gray-100 dark:border-gray-700"
                        >
                          <td className="px-4 py-2 break-words text-left">
                            {m.round ?? '予選'}
                          </td>
                          <td className="px-4 py-2 break-words text-left">
                            {m.opponentDisplayName ?? '不明'}
                          </td>
                          <td className="px-4 py-2 text-left">
                            {m.games.won}-{m.games.lost}
                          </td>
                        </tr>
                      );
                    })}
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
  detail,
  gameCategory,
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
}: Props) {
  const shouldUseShortOpponentName = gameCategory !== 'singles';

  const participantMap = useMemo(() => {
    const map = new Map<string, (typeof detail.participants)[0]>();
    for (const p of detail.participants ?? []) map.set(p.id, p);
    return map;
  }, [detail]);

  // build a map: matchId -> match object for following nextMatchId
  const matchById = useMemo(() => {
    const map = new Map<string, TournamentMatch>();
    for (const m of detail.matches ?? []) {
      if (m.matchId != null) map.set(String(m.matchId), m);
    }
    return map;
  }, [detail]);

  // helper: build display name for an entry (used by later logic)
  const buildNameForEntry = useCallback(
    (entry: TournamentEntry, opts?: { short?: boolean }) => {
      const short = !!opts?.short;
      const players = (entry.playerIds ?? [])
        .map((pid: string) => participantMap.get(pid))
        .filter(Boolean) as (typeof detail.participants)[0][];
      if (!players || players.length === 0) return `#${entry.entryNo ?? '?'}`;

      // Check if this is a team format (lastName and firstName are both null)
      const isTeamFormat = players.every(
        (pl) => pl?.lastName === null && pl?.firstName === null,
      );

      if (isTeamFormat) {
        // For team format: display "チーム名（都道府県）"
        const teamNames = players
          .map((pl) => {
            const teamName = pl?.team || '不明';
            const prefecture = pl?.prefecture;
            return prefecture ? `${teamName}（${prefecture}）` : teamName;
          })
          .filter((name) => name !== '不明');
        return teamNames.join('・') || `#${entry.entryNo ?? '?'}`;
      }

      // For individual format: display "名前（チーム名）"
      const teamMap: Record<string, string[]> = {};
      for (const pl of players) {
        const team = (pl && pl.team) || '\u4e0d\u660e';
        if (!teamMap[team]) teamMap[team] = [];
        const last = pl?.lastName ?? '';
        const first = pl?.firstName ?? '';
        const fullName = `${last}${first}`.trim();
        const displayName = short ? `${last}`.trim() : fullName;
        teamMap[team].push(displayName || '');
      }
      return Object.entries(teamMap)
        .map(([team, names]) => {
          const teamLabel = team;
          return `${names.join('\u30fb')}\uff08${teamLabel}\uff09`;
        })
        .join('\u30fb');
    },
    [participantMap, detail],
  );

  // build linkable name parts for an entry header (individual format only)
  const buildNamePartsForEntry = useCallback(
    (entry: TournamentEntry): NamePart[] => {
      const players = (entry.playerIds ?? [])
        .map((pid: string) => participantMap.get(pid))
        .filter(Boolean) as (typeof detail.participants)[0][];
      if (!players || players.length === 0) return [];

      const isTeamFormat = players.every(
        (pl) => pl?.lastName === null && pl?.firstName === null,
      );
      if (isTeamFormat) return [];

      // group players by team, keeping per-player link info
      const teamGroups = new Map<
        string,
        { text: string; playerId?: number }[]
      >();
      for (const pl of players) {
        const team = (pl && pl.team) || '不明';
        if (!teamGroups.has(team)) teamGroups.set(team, []);
        const fullName = `${pl?.lastName ?? ''}${pl?.firstName ?? ''}`.trim();
        teamGroups.get(team)!.push({
          text: fullName || '',
          playerId: pl?.playerId,
        });
      }

      const parts: NamePart[] = [];
      let groupIndex = 0;
      for (const [team, names] of teamGroups) {
        if (groupIndex > 0) parts.push({ text: '・' });
        names.forEach((n, i) => {
          if (i > 0) parts.push({ text: '・' });
          parts.push({ text: n.text, playerId: n.playerId });
        });
        parts.push({ text: `（${team}）` });
        groupIndex += 1;
      }
      return parts;
    },
    [participantMap, detail],
  );

  // Expand an entry's rows by following nextMatchId from the last match
  const expandMatchGroup = (entryNo: number, rows: MatchRow[]) => {
    const extra: MatchRow[] = [];
    if (!rows || rows.length === 0) return extra;
    const last = rows[rows.length - 1];
    if (!last?.matchId) return extra;

    // Start from the winner of the last match and follow their path.
    const visited = new Set<string>();
    const lastMatch = matchById.get(String(last.matchId));
    if (!lastMatch) return extra;

    let prevWinner = lastMatch.winnerEntryNo;
    if (typeof prevWinner !== 'number') return extra;

    let nextId = String(lastMatch.nextMatchId ?? '');
    let depth = 0;
    const MAX_DEPTH = 10;

    while (nextId && !visited.has(nextId) && depth < MAX_DEPTH) {
      visited.add(nextId);
      const nm = matchById.get(nextId);
      if (!nm) break;

      const [a, b] = nm.entries ?? [];

      // If the previous winner participates in this match, determine their opponent.
      let opponent: number | undefined;
      if (a === prevWinner) opponent = b;
      else if (b === prevWinner) opponent = a;
      else break; // prevWinner not in this match, stop following

      const scoreA = String(nm.scores?.[String(a)] ?? nm.scores?.[a] ?? '0');
      const scoreB = String(nm.scores?.[String(b)] ?? nm.scores?.[b] ?? '0');

      const row: MatchRow = {
        matchId: nm.matchId,
        stage: nm.stage,
        group: nm.group ?? null,
        round: nm.round ?? null,
        opponentDisplayName:
          typeof opponent === 'number'
            ? buildNameForEntry(
                (detail.entries ?? []).find((e) => e.entryNo === opponent) ?? {
                  entryNo: opponent,
                  playerIds: [],
                },
                { short: shouldUseShortOpponentName },
              )
            : undefined,
        // result from the perspective of prevWinner
        result: nm.winnerEntryNo === prevWinner ? 'win' : 'lose',
        games:
          a === prevWinner
            ? { won: scoreA, lost: scoreB }
            : { won: scoreB, lost: scoreA },
      };

      extra.push(row);

      // advance: next winner becomes the new prevWinner
      prevWinner = nm.winnerEntryNo;
      nextId = String(nm.nextMatchId ?? '');
      depth += 1;
    }

    return extra;
  };
  // buildNameForEntry moved earlier

  // build a map: entryNo -> list of MatchRow
  const matchesByEntry = useMemo(() => {
    const map = new Map<number, MatchRow[]>();
    for (const m of detail.matches ?? []) {
      const [a, b] = m.entries ?? [];
      const scoreA = String(m.scores?.[String(a)] ?? m.scores?.[a] ?? '0');
      const scoreB = String(m.scores?.[String(b)] ?? m.scores?.[b] ?? '0');

      const rowA: MatchRow = {
        matchId: m.matchId,
        stage: m.stage,
        group: m.group ?? null,
        round: m.round ?? null,
        opponentDisplayName:
          typeof b === 'number'
            ? buildNameForEntry(
                (detail.entries ?? []).find((e) => e.entryNo === b) ?? {
                  entryNo: b,
                  playerIds: [],
                },
                { short: shouldUseShortOpponentName },
              )
            : undefined,
        result:
          m.winnerEntryNo === a
            ? 'win'
            : m.winnerEntryNo === b
              ? 'lose'
              : 'draw',
        games: { won: scoreA, lost: scoreB },
      };
      const rowB: MatchRow = {
        matchId: m.matchId,
        stage: m.stage,
        group: m.group ?? null,
        round: m.round ?? null,
        opponentDisplayName:
          typeof a === 'number'
            ? buildNameForEntry(
                (detail.entries ?? []).find((e) => e.entryNo === a) ?? {
                  entryNo: a,
                  playerIds: [],
                },
                { short: shouldUseShortOpponentName },
              )
            : undefined,
        result:
          m.winnerEntryNo === b
            ? 'win'
            : m.winnerEntryNo === a
              ? 'lose'
              : 'draw',
        games: { won: scoreB, lost: scoreA },
      };

      if (typeof a === 'number') map.set(a, [...(map.get(a) ?? []), rowA]);
      if (typeof b === 'number') map.set(b, [...(map.get(b) ?? []), rowB]);
    }

    // sort each entry's match list so that roundrobin stage comes first
    for (const [entryNo, rows] of map) {
      rows.sort((x, y) => {
        const xIsRR = x.stage === 'roundrobin' ? 0 : 1;
        const yIsRR = y.stage === 'roundrobin' ? 0 : 1;
        if (xIsRR !== yIsRR) return xIsRR - yIsRR;

        const rank = (r?: string | null) => {
          if (!r) return 0;
          const s = String(r);
          // 明示的なマッピング: 決勝を最大にして最後に来るようにする
          if (/準々決勝/.test(s)) return 70;
          if (/準決勝/.test(s)) return 80;
          if (/決勝/.test(s)) return 100;
          // 回戦表記から数字を抽出して順位付け（大きい数字ほど後）
          const m = s.match(/(\d+)/);
          if (m) return parseInt(m[1], 10) * 10;
          // その他は低優先度
          return 10;
        };

        const rx = rank(x.round);
        const ry = rank(y.round);
        if (rx !== ry) return rx - ry;
        // フォールバック: 文字列で安定ソート
        if (x.round && y.round) {
          return String(x.round).localeCompare(String(y.round));
        }
        return 0;
      });
      map.set(entryNo, rows);
    }

    return map;
  }, [detail, buildNameForEntry, shouldUseShortOpponentName]);

  // build name list from entries & eliminatedEntries
  const groupedNames = [
    ...new Set([...(detail.entries ?? []).map((e) => buildNameForEntry(e))]),
  ];

  // derive seed entry numbers from detail.entries if not provided
  const derivedSeedEntryNos: Set<number> = new Set();
  for (const e of detail.entries ?? []) {
    // assume entry.type can be 'seed' or 'シード' or similar; be permissive
    if (e.type && typeof e.type === 'string') {
      if (e.type.includes('seed')) {
        derivedSeedEntryNos.add(e.entryNo);
      }
    }
  }

  // Check if there are any knockout matches
  const hasKnockoutStage = useMemo(() => {
    return (detail.matches ?? []).some((m) => m.stage === 'knockout');
  }, [detail]);

  const derivedResultByEntryNo: Record<number, string | undefined> = {};
  for (const r of detail.results ?? []) {
    const parts: string[] = [];
    if (r.tournament && r.tournament.label) {
      parts.push(r.tournament.label);
    } else if (hasKnockoutStage) {
      parts.push('予選敗退');
    }
    if (r.roundrobin) {
      const group = r.roundrobin.group ?? '';
      const rank = r.roundrobin.rank ?? '';
      parts.push(`グループ${group} ${rank}位`);
    }
    derivedResultByEntryNo[r.entryNo] =
      parts.length > 0 ? parts.join(' / ') : undefined;
  }

  // getEntryName removed; use buildNameForEntry directly where needed

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
        // try to find an entryNo by name
        const entry = (detail.entries ?? []).find(
          (e) => buildNameForEntry(e) === name,
        );
        const entryNo = entry?.entryNo ?? -1;
        const matchGroup = matchesByEntry.get(entryNo) ?? [];

        // keep original matchGroup, and separately compute expandedRows
        const expandedRows = expandMatchGroup(entryNo, matchGroup);

        const resultLabel = derivedResultByEntryNo[entryNo];

        return (
          <MatchGroup
            key={name}
            name={name}
            nameParts={entry ? buildNamePartsForEntry(entry) : undefined}
            entryNo={entryNo}
            matchGroup={matchGroup}
            extraRows={expandedRows}
            searchQuery={searchQuery}
            filter={filter}
            isSeed={derivedSeedEntryNos.has(Number(entryNo) ?? -1)}
            resultLabel={resultLabel ?? ''}
          />
        );
      })}
    </section>
  );
}
