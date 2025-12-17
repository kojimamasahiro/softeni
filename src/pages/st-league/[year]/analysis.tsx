import fs from 'fs';
import path from 'path';

import { useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

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
  date: string;
  status: 'scheduled' | 'finished';
  teamA: string;
  teamB: string;
  matches: MatchDetail[];
}

interface Team {
  teamId: string;
  name: string[];
  players?: {
    lastName: string;
    firstName: string;
    id: number;
  }[];
}

interface AnalysisPageProps {
  year: number;
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

export default function AnalysisPage({
  year,
  matches,
  teams,
}: AnalysisPageProps) {
  const [activeGender, setActiveGender] = useState<'boys' | 'girls'>('boys');
  const [sortConfig, setSortConfig] = useState<{
    key: SortKey;
    direction: SortDirection;
  }>({
    key: 'wins',
    direction: 'desc',
  });

  const stats = useMemo(() => {
    const currentMatches = matches[activeGender] || [];
    const currentTeams = teams[activeGender] || [];

    // Initialize stats map
    const statsMap = new Map<number, PlayerStats>();

    // Helper to get or create stats entry
    const getStats = (id: number) => {
      if (!statsMap.has(id)) {
        // Find player info
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
        // Team A Players
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

        // Team B Players
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

    // Convert to array and sort
    return Array.from(statsMap.values()).sort((a, b) => {
      const { key, direction } = sortConfig;
      const multiplier = direction === 'asc' ? 1 : -1;

      switch (key) {
        case 'matches':
          return (a.matches - b.matches) * multiplier;
        case 'wins':
          // Sort by Wins
          if (a.wins !== b.wins) return (a.wins - b.wins) * multiplier;
          // Then by Losses (fewer is better if wins are same? or just sort by winrate?)
          // Usually if wins are same, fewer losses (higher win rate) is better.
          // If desc (better first): More wins -> Fewer losses
          // If asc (worse first): Fewer wins -> More losses
          return (b.losses - a.losses) * multiplier;
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
  }, [matches, teams, activeGender, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key)
      return <span className="text-gray-300 text-xs ml-1">⇅</span>;
    return sortConfig.direction === 'asc' ? (
      <span className="text-blue-500 text-xs ml-1">▲</span>
    ) : (
      <span className="text-blue-500 text-xs ml-1">▼</span>
    );
  };

  const pageTitle = `STリーグ ${year} データ・分析 | ソフトテニス情報`;
  const pageUrl = `https://softeni-pick.com/st-league/${year}/analysis`;

  return (
    <>
      <MetaHead
        title={pageTitle}
        description={`STリーグ${year}シーズンの選手別成績、勝率などのデータ分析。`}
        url={pageUrl}
      />
      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-5xl mx-auto space-y-8">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: 'STリーグ', href: '/st-league' },
              {
                label: `${year} データ・分析`,
                href: `/st-league/${year}/analysis`,
              },
            ]}
          />

          <h1 className="text-2xl font-bold">STリーグ {year} データ・分析</h1>
          <p>選手ごとの勝敗数、勝率、ゲーム得失などを集計しています。</p>

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

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 overflow-x-auto">
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
                    勝-敗(勝率) {getSortIcon('wins')}
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
                    player.matches > 0
                      ? (player.wins / player.matches) * 100
                      : 0;
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
                          {player.wins}-{player.losses}
                        </span>
                        <span className="text-gray-400 text-xs">
                          ({winRate.toFixed(0)}%)
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
        </div>
      </main>
    </>
  );
}

export const getStaticPaths = async () => {
  return {
    paths: [{ params: { year: '2025' } }],
    fallback: false,
  };
};

export const getStaticProps = async ({
  params,
}: {
  params: { year: string };
}) => {
  const year = params.year;
  const dataDir = path.join(process.cwd(), 'data/st-league', year);

  try {
    const matchesPath = path.join(dataDir, 'matches.json');
    const participantsPath = path.join(dataDir, 'participants.json');

    const matchesData = JSON.parse(fs.readFileSync(matchesPath, 'utf8'));
    const participantsData = JSON.parse(
      fs.readFileSync(participantsPath, 'utf8'),
    );

    return {
      props: {
        year: parseInt(year, 10),
        matches: matchesData,
        teams: participantsData,
      },
    };
  } catch (error) {
    console.error('Data load error:', error);
    return {
      notFound: true,
    };
  }
};
