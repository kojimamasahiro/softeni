import { useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  DivisionMeta,
  Gender,
  getDivisions,
  getStLeagueYears,
  LeagueMeta,
  loadLeagueMeta,
  loadMatches,
  loadParticipants,
} from '@/utils/st-league';

// Types
interface PlayerStats {
  id: number;
  name: string;
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  matches: number;
  gamesWon: number;
  gamesLost: number;
  singlesWins: number;
  singlesLosses: number;
  doublesWins: number;
  doublesLosses: number;
}

interface MatchDetail {
  type: 'D1' | 'S' | 'D2';
  winner: 'A' | 'B';
  scoreA: number;
  scoreB: number;
  playersA?: number[];
  playersB?: number[];
}

interface Match {
  id: number;
  division?: string;
  date: string;
  status: 'scheduled' | 'finished';
  teamA: string;
  teamB: string;
  matches: MatchDetail[];
}

interface Team {
  teamId: string;
  division?: string;
  name: string[];
  players?: {
    lastName: string;
    firstName: string;
    id: number;
  }[];
}

interface AnalysisPageProps {
  year: number;
  meta: LeagueMeta | null;
  divisions: DivisionMeta[];
  matches: {
    boys: Match[];
    girls: Match[];
  };
  teams: {
    boys: Team[];
    girls: Team[];
  };
}

type SortKey = 'matches' | 'wins' | 'games' | 'singles' | 'doubles';
type SortDirection = 'asc' | 'desc';
type SortConfig = { key: SortKey; direction: SortDirection };

// 指定 gender×division の選手スタッツを集計・ソートして返す（純関数）。
// SSR 時に全タブ分を計算してHTMLに含めるため useMemo の外に切り出している。
function computePlayerStats(
  allMatches: Match[],
  allTeams: Team[],
  divisionId: string,
  sortConfig: SortConfig,
): PlayerStats[] {
  const currentMatches = allMatches.filter(
    (m) => (m.division ?? '1') === divisionId,
  );
  const currentTeams = allTeams.filter(
    (t) => (t.division ?? '1') === divisionId,
  );

  const statsMap = new Map<number, PlayerStats>();

  const getStats = (id: number) => {
    if (!statsMap.has(id)) {
      let playerName = `ID:${id}`;
      let teamId = '';
      let teamName = '-';

      for (const team of currentTeams) {
        const found = team.players?.find((p) => p.id === id);
        if (found) {
          playerName = `${found.lastName} ${found.firstName}`;
          teamId = team.teamId;
          teamName = team.name[0];
          break;
        }
      }

      statsMap.set(id, {
        id,
        name: playerName,
        teamId,
        teamName,
        wins: 0,
        losses: 0,
        matches: 0,
        gamesWon: 0,
        gamesLost: 0,
        singlesWins: 0,
        singlesLosses: 0,
        doublesWins: 0,
        doublesLosses: 0,
      });
    }
    return statsMap.get(id)!;
  };

  // Initialize all players (even those who haven't played)
  currentTeams.forEach((team) => {
    team.players?.forEach((player) => {
      getStats(player.id);
    });
  });

  // Process matches
  currentMatches.forEach((match) => {
    if (match.status !== 'finished') return;

    match.matches.forEach((detail) => {
      detail.playersA?.forEach((playerId) => {
        const pStats = getStats(playerId);
        pStats.matches++;
        pStats.gamesWon += detail.scoreA;
        pStats.gamesLost += detail.scoreB;
        if (detail.winner === 'A') {
          pStats.wins++;
          if (detail.type === 'S') {
            pStats.singlesWins++;
          } else {
            pStats.doublesWins++;
          }
        } else {
          pStats.losses++;
          if (detail.type === 'S') {
            pStats.singlesLosses++;
          } else {
            pStats.doublesLosses++;
          }
        }
      });

      detail.playersB?.forEach((playerId) => {
        const pStats = getStats(playerId);
        pStats.matches++;
        pStats.gamesWon += detail.scoreB;
        pStats.gamesLost += detail.scoreA;
        if (detail.winner === 'B') {
          pStats.wins++;
          if (detail.type === 'S') {
            pStats.singlesWins++;
          } else {
            pStats.doublesWins++;
          }
        } else {
          pStats.losses++;
          if (detail.type === 'S') {
            pStats.singlesLosses++;
          } else {
            pStats.doublesLosses++;
          }
        }
      });
    });
  });

  return Array.from(statsMap.values()).sort((a, b) => {
    const { key, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;

    switch (key) {
      case 'matches':
        return (a.matches - b.matches) * multiplier;
      case 'wins':
        const rateA = a.matches > 0 ? a.wins / a.matches : 0;
        const rateB = b.matches > 0 ? b.wins / b.matches : 0;
        if (rateA !== rateB) return (rateA - rateB) * multiplier;
        return (a.wins - b.wins) * multiplier;
      case 'games':
        const diffA = a.gamesWon - a.gamesLost;
        const diffB = b.gamesWon - b.gamesLost;
        return (diffA - diffB) * multiplier;
      case 'singles':
        if (a.singlesWins !== b.singlesWins)
          return (a.singlesWins - b.singlesWins) * multiplier;
        return (b.singlesLosses - a.singlesLosses) * multiplier;
      case 'doubles':
        if (a.doublesWins !== b.doublesWins)
          return (a.doublesWins - b.doublesWins) * multiplier;
        return (b.doublesLosses - a.doublesLosses) * multiplier;
      default:
        return 0;
    }
  });
}

// 1つの gender×division 分の選手成績（表＋カード）を描画する。
// 全タブをHTMLに出力するため、非アクティブなパネルは親側で `hidden` 切替する。
function StatsPanel({
  stats,
  divName,
  sortConfig,
  requestSort,
}: {
  stats: PlayerStats[];
  divName: string;
  sortConfig: SortConfig;
  requestSort: (key: SortKey) => void;
}) {
  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key)
      return <span className="text-gray-300 text-xs ml-1">⇅</span>;
    return sortConfig.direction === 'asc' ? (
      <span className="text-blue-500 text-xs ml-1">▲</span>
    ) : (
      <span className="text-blue-500 text-xs ml-1">▼</span>
    );
  };

  if (stats.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
        {divName || 'このリーグ'}のデータは準備中です。
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Mobile Sort Controls */}
      <div className="md:hidden flex items-center justify-end mb-4 space-x-2">
        <span className="text-sm text-gray-500">並び替え:</span>
        <select
          value={sortConfig.key}
          onChange={(e) => requestSort(e.target.value as SortKey)}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="wins">勝率</option>
          <option value="matches">試合数</option>
          <option value="singles">シングルス</option>
          <option value="doubles">ダブルス</option>
          <option value="games">得失ゲーム</option>
        </select>
        <button
          onClick={() => requestSort(sortConfig.key)}
          className="p-1.5 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500"
        >
          {sortConfig.direction === 'asc' ? '▲' : '▼'}
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="py-3 px-4 text-left font-medium w-16">順位</th>
              <th className="py-3 px-4 text-left font-medium">選手名</th>
              <th className="py-3 px-4 text-left font-medium">チーム</th>
              <th
                className="py-3 px-4 text-center font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none group"
                onClick={() => requestSort('matches')}
              >
                試合数 {getSortIcon('matches')}
              </th>
              <th
                className="py-3 px-4 text-center font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none group"
                onClick={() => requestSort('wins')}
              >
                勝率(勝-敗) {getSortIcon('wins')}
              </th>
              <th
                className="py-3 px-4 text-center font-medium text-xs text-gray-500 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none group"
                onClick={() => requestSort('singles')}
              >
                シングルス {getSortIcon('singles')}
              </th>
              <th
                className="py-3 px-4 text-center font-medium text-xs text-gray-500 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none group"
                onClick={() => requestSort('doubles')}
              >
                ダブルス {getSortIcon('doubles')}
              </th>
              <th
                className="py-3 px-4 text-center font-medium cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none group"
                onClick={() => requestSort('games')}
              >
                得失G {getSortIcon('games')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {stats.map((player, index) => {
              const winRate =
                player.matches > 0 ? (player.wins / player.matches) * 100 : 0;
              return (
                <tr
                  key={player.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <td className="py-3 px-4 text-center text-gray-500">
                    {index + 1}
                  </td>
                  <td className="py-3 px-4 font-bold">{player.name}</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                    {player.teamName}
                  </td>
                  <td className="py-3 px-4 text-center font-bold">
                    {player.matches}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-bold mr-1">
                      {winRate.toFixed(0)}%
                    </span>
                    <span className="text-gray-400 text-xs">
                      ({player.wins}-{player.losses})
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-gray-600 dark:text-gray-400">
                    {player.singlesWins}-{player.singlesLosses}
                  </td>
                  <td className="py-3 px-4 text-center text-sm text-gray-600 dark:text-gray-400">
                    {player.doublesWins}-{player.doublesLosses}
                  </td>
                  <td className="py-3 px-4 text-center font-mono font-medium">
                    {player.gamesWon}-{player.gamesLost}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {stats.map((player, index) => {
          const winRate =
            player.matches > 0 ? (player.wins / player.matches) * 100 : 0;
          return (
            <div
              key={player.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center">
                  <div
                    className={`
                       flex items-center justify-center w-8 h-8 rounded-full font-bold mr-3 text-sm
                       ${
                         index === 0
                           ? 'bg-yellow-100 text-yellow-700'
                           : index === 1
                             ? 'bg-gray-100 text-gray-700'
                             : index === 2
                               ? 'bg-orange-100 text-orange-800'
                               : 'bg-gray-50 text-gray-500'
                       }
                     `}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-bold text-lg leading-tight">
                      {player.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {player.teamName}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tracking-tight">
                    {winRate.toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-400 font-medium">
                    {player.wins}-{player.losses}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-gray-500 mb-0.5 uppercase tracking-wide">
                    シングルス
                  </div>
                  <div className="font-semibold text-sm">
                    {player.singlesWins}-{player.singlesLosses}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-gray-500 mb-0.5 uppercase tracking-wide">
                    ダブルス
                  </div>
                  <div className="font-semibold text-sm">
                    {player.doublesWins}-{player.doublesLosses}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-2 text-center">
                  <div className="text-[10px] text-gray-500 mb-0.5 uppercase tracking-wide">
                    得失ゲーム
                  </div>
                  <div className="font-semibold text-sm">
                    {player.gamesWon}-{player.gamesLost}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalysisPage({
  year,
  meta,
  divisions,
  matches,
  teams,
}: AnalysisPageProps) {
  const [activeGender, setActiveGender] = useState<Gender>('boys');
  const [divisionId, setDivisionId] = useState<string>(divisions[0]?.id ?? '1');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'wins',
    direction: 'desc',
  });

  // 全 gender×division 分のスタッツを事前計算し、全タブをHTMLに出力する（SEO）。
  const statsByPanel = useMemo(() => {
    const map: Record<string, PlayerStats[]> = {};
    (['boys', 'girls'] as Gender[]).forEach((g) => {
      divisions.forEach((d) => {
        map[`${g}|${d.id}`] = computePlayerStats(
          matches[g] || [],
          teams[g] || [],
          d.id,
          sortConfig,
        );
      });
    });
    return map;
  }, [matches, teams, divisions, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const editionLabel = meta?.title ?? `STリーグ ${year}`;
  const pageTitle = `${editionLabel} データ・分析（選手成績） | ソフトテニス情報`;
  const pageUrl = `https://softeni-pick.com/st-league/${year}/analysis/`;

  return (
    <>
      <MetaHead
        title={pageTitle}
        description={`STリーグ${year}シーズンの選手別成績、勝率などのデータ分析。`}
        url={pageUrl}
      />
      <PageLayout maxWidth="5xl" className="space-y-8">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'STリーグ', href: '/st-league' },
            { label: `${year}`, href: `/st-league/${year}` },
            {
              label: 'データ・分析',
              href: `/st-league/${year}/analysis`,
            },
          ]}
        />

        <h1 className="text-2xl font-bold">{editionLabel} データ・分析</h1>
        <p>
          STリーグⅠ・Ⅱ、男女別に選手ごとの勝敗数・勝率・ゲーム得失を集計しています。
        </p>

        {/* Gender Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveGender('boys')}
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${
              activeGender === 'boys'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            男子
          </button>
          <button
            onClick={() => setActiveGender('girls')}
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${
              activeGender === 'girls'
                ? 'border-b-2 border-pink-500 text-pink-600 dark:text-pink-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            女子
          </button>
        </div>

        {/* リーグ（division）切替 */}
        <div className="flex flex-wrap gap-2">
          {divisions.map((d) => {
            const active = d.id === divisionId;
            return (
              <button
                key={d.id}
                onClick={() => setDivisionId(d.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-400'
                }`}
              >
                {d.name}
              </button>
            );
          })}
        </div>

        {/* 全 gender×division パネルをHTMLに出力し、非アクティブは hidden で隠す（SEO） */}
        {(['boys', 'girls'] as Gender[]).map((g) =>
          divisions.map((d) => {
            const active = g === activeGender && d.id === divisionId;
            return (
              <div
                key={`${g}-${d.id}`}
                className={active ? '' : 'hidden'}
                aria-hidden={!active}
              >
                <StatsPanel
                  stats={statsByPanel[`${g}|${d.id}`] ?? []}
                  divName={d.name}
                  sortConfig={sortConfig}
                  requestSort={requestSort}
                />
              </div>
            );
          }),
        )}
      </PageLayout>
    </>
  );
}

export const getStaticPaths = async () => ({
  paths: getStLeagueYears().map((y) => ({ params: { year: String(y) } })),
  fallback: false,
});

export const getStaticProps = async ({
  params,
}: {
  params: { year: string };
}) => {
  const year = params.year;
  const matches = loadMatches(year);
  const participants = loadParticipants(year);
  if (!matches || !participants) return { notFound: true };

  const meta = loadLeagueMeta(year);
  const divisions = getDivisions(meta);

  return {
    props: {
      year: parseInt(year, 10),
      meta,
      divisions,
      matches,
      teams: participants,
    },
  };
};
