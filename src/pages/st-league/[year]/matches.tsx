import fs from 'fs';
import path from 'path';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

// 型定義
interface MatchDetail {
  type: 'D1' | 'S' | 'D2';
  winner: 'A' | 'B';
  scoreA: number;
  scoreB: number;
  playersA?: number[]; // IDの配列に変更
  playersB?: number[]; // IDの配列に変更
}

interface Match {
  id: number;
  date: string;
  status: 'scheduled' | 'finished';
  teamA: string;
  teamB: string;
  winner?: string; // teamId
  scoreA: number;
  scoreB: number;
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

interface Ranking {
  teamId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  pointsWon: number;
  pointsLost: number;
}

interface PlayerMap {
  [key: number]: string;
}

interface MatchesPageProps {
  year: number;
  matches: {
    boys: Match[];
    girls: Match[];
  };
  teams: {
    boys: Team[];
    girls: Team[];
  };
  playerMaps: {
    boys: PlayerMap;
    girls: PlayerMap;
  };
}

export default function MatchesPage({
  year,
  matches,
  teams,
  playerMaps,
}: MatchesPageProps) {
  const [activeGender, setActiveGender] = useState<'boys' | 'girls'>('boys');
  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(
    new Set(),
  );

  // 現在の性別のデータ
  const currentMatches = useMemo(
    () => matches[activeGender] || [],
    [matches, activeGender],
  );
  const currentTeams = useMemo(
    () => teams[activeGender] || [],
    [teams, activeGender],
  );
  const currentPlayerMap = playerMaps[activeGender] || {};

  // チーム名の取得ヘルパー
  const getTeamName = (teamId: string) => {
    const team = currentTeams.find((t) => t.teamId === teamId);
    return team ? team.name[0] : teamId;
  };

  // プレイヤー名の取得ヘルパー
  const getPlayerNames = (playerIds?: number[]) => {
    if (!playerIds) return '-';
    return playerIds.map((id) => currentPlayerMap[id] || `ID:${id}`).join('・');
  };

  // 順位表の計算
  const ranking = useMemo(() => {
    const rankMap = new Map<string, Ranking>();

    // チームリストで初期化
    currentTeams.forEach((team) => {
      rankMap.set(team.teamId, {
        teamId: team.teamId,
        name: team.name[0],
        played: 0,
        won: 0,
        lost: 0,
        pointsWon: 0,
        pointsLost: 0,
      });
    });

    // 試合結果を集計
    currentMatches.forEach((match) => {
      if (match.status !== 'finished') return;

      const teamA = rankMap.get(match.teamA);
      const teamB = rankMap.get(match.teamB);

      if (teamA && teamB) {
        teamA.played++;
        teamB.played++;

        teamA.pointsWon += match.scoreA;
        teamA.pointsLost += match.scoreB; // 失点＝相手の得点
        teamB.pointsWon += match.scoreB;
        teamB.pointsLost += match.scoreA; // 失点＝相手の得点

        if (match.winner === match.teamA) {
          teamA.won++;
          teamB.lost++;
        } else if (match.winner === match.teamB) {
          teamB.won++;
          teamA.lost++;
        }
      }
    });

    // グループ内での直接対決勝ち数を計算
    const getGroupHeadToHeadWins = (groupTeamIds: string[]) => {
      // { teamId: 勝ち数 }
      const winMap: Record<string, number> = {};
      groupTeamIds.forEach((id) => (winMap[id] = 0));
      currentMatches.forEach((match) => {
        if (
          match.status === 'finished' &&
          groupTeamIds.includes(match.teamA) &&
          groupTeamIds.includes(match.teamB) &&
          match.winner
        ) {
          winMap[match.winner]++;
        }
      });
      return winMap;
    };

    // まず勝数でグループ化
    const allTeams = Array.from(rankMap.values());
    const groups: Record<number, Ranking[]> = {};
    allTeams.forEach((team) => {
      if (!groups[team.won]) groups[team.won] = [];
      groups[team.won].push(team);
    });

    // 各グループ内で直接対決勝ち数を計算し、順位付け
    let sorted: Ranking[] = [];
    Object.keys(groups)
      .map(Number)
      .sort((a, b) => b - a) // 勝数降順
      .forEach((won) => {
        const group = groups[won];
        if (group.length === 1) {
          sorted.push(group[0]);
        } else {
          const groupIds = group.map((t) => t.teamId);
          const winMap = getGroupHeadToHeadWins(groupIds);
          group.sort((a, b) => {
            // 1. グループ内直接対決勝ち数
            if (winMap[b.teamId] !== winMap[a.teamId])
              return winMap[b.teamId] - winMap[a.teamId];
            // 2. 得失点差
            const diffA = a.pointsWon - a.pointsLost;
            const diffB = b.pointsWon - b.pointsLost;
            if (diffB !== diffA) return diffB - diffA;
            // 3. 得点
            return b.pointsWon - a.pointsWon;
          });
          sorted = sorted.concat(group);
        }
      });
    return sorted;
  }, [currentMatches, currentTeams]);

  // マッチ詳細の開閉切り替え
  const toggleMatch = (id: number) => {
    const newExpanded = new Set(expandedMatches);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMatches(newExpanded);
  };

  const pageTitle = `STリーグ ${year} 試合結果・日程 | ソフトテニス情報`;
  const pageUrl = `https://softeni-pick.com/st-league/${year}/matches`;

  return (
    <>
      <MetaHead
        title={pageTitle}
        description={`STリーグ${year}シーズンの試合結果と日程、順位表。`}
        url={pageUrl}
      />
      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: 'STリーグ', href: '/st-league' },
              { label: `${year} 試合結果`, href: `/st-league/${year}/matches` },
            ]}
          />

          <h1 className="text-2xl font-bold">STリーグ {year} 結果・日程</h1>
          <p>本年度の対戦成績と日程を掲載しています。</p>

          {/* Tabs */}
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

          <div className="space-y-12">
            {/* 順位サマリー */}
            <section className="mb-8">
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                Ranking
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                順位は「勝数」→「同勝数内での直接対決勝ち数」→「得失点差」の順で決定されます。
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 px-4 text-left font-medium w-16">
                        順位
                      </th>
                      <th className="py-3 px-2 text-left font-medium">
                        チーム
                      </th>
                      <th className="py-3 px-2 text-center font-medium w-20">
                        勝敗
                      </th>
                      <th className="py-3 px-4 text-center font-medium w-16">
                        得失
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {ranking.map((team, index) => (
                      <tr
                        key={team.teamId}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="py-3 text-center font-bold text-gray-700 dark:text-gray-300">
                          {index + 1}
                        </td>
                        <td className="py-3 px-2 font-medium">{team.name}</td>
                        <td className="py-3 px-2 text-center">
                          {team.played > 0 ? (
                            <span className="inline-flex gap-1">
                              <span className="font-bold">{team.won}</span>
                              <span className="text-gray-400 mx-0.5">-</span>
                              <span className="text-gray-500">{team.lost}</span>
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400 text-xs">
                          {team.played > 0
                            ? `${team.pointsWon}-${team.pointsLost}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 対戦結果一覧 */}
            <section className="mb-12">
              <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                Matches
              </h2>
              <div className="space-y-3">
                {currentMatches.map((match) => (
                  <div
                    key={match.id}
                    className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border transition-all ${
                      expandedMatches.has(match.id)
                        ? 'border-blue-500 dark:border-blue-500 ring-1 ring-blue-100 dark:ring-blue-900'
                        : 'border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    {/* ヘッダー行（常に表示） */}
                    <div
                      className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700/80 transition-colors select-none"
                      onClick={() => toggleMatch(match.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {match.status === 'finished' ? '試合終了' : '予定'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {match.date.replace(/-/g, '/')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center justify-end">
                          <span className="ml-2 text-xs"> </span>
                        </div>
                        <div className="flex-1 text-right">
                          <span
                            className={`block font-bold truncate ${match.winner === match.teamA ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
                          >
                            {getTeamName(match.teamA)}
                          </span>
                        </div>

                        <div className="px-4 flex flex-col items-center min-w-[80px]">
                          {match.status === 'finished' ? (
                            <>
                              <div className="flex items-center space-x-2 text-xl font-bold font-mono">
                                <span
                                  className={
                                    match.winner === match.teamA
                                      ? 'text-blue-600 dark:text-blue-400'
                                      : 'text-gray-400'
                                  }
                                >
                                  {match.scoreA}
                                </span>
                                <span className="text-gray-300">-</span>
                                <span
                                  className={
                                    match.winner === match.teamB
                                      ? 'text-blue-600 dark:text-blue-400'
                                      : 'text-gray-400'
                                  }
                                >
                                  {match.scoreB}
                                </span>
                              </div>
                            </>
                          ) : (
                            <span className="text-xl font-bold text-gray-300">
                              VS
                            </span>
                          )}
                        </div>

                        <div className="flex-1 text-left">
                          <span
                            className={`block font-bold truncate ${match.winner === match.teamB ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}
                          >
                            {getTeamName(match.teamB)}
                          </span>
                        </div>

                        <div className="flex items-center justify-end">
                          {expandedMatches.has(match.id) ? (
                            <span className="ml-2 text-xs">{'▲'}</span>
                          ) : (
                            <span className="ml-2 text-xs">{'▼'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 詳細（展開時のみ表示） */}
                    {expandedMatches.has(match.id) &&
                      match.status === 'finished' && (
                        <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 animate-fadeIn">
                          <div className="space-y-3">
                            {match.matches.map((detail, idx) => (
                              <div
                                key={idx}
                                className="flex items-center text-sm"
                              >
                                <div className="w-8 font-bold text-gray-400 text-xs uppercase text-center">
                                  {detail.type}
                                </div>

                                {/* Team A Players */}
                                <div
                                  className={`flex-1 text-right ${detail.winner === 'A' ? 'font-bold text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}
                                >
                                  {getPlayerNames(detail.playersA)}
                                </div>

                                {/* Score */}
                                <div className="px-3">
                                  <span className="inline-block px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs font-mono font-medium">
                                    {detail.scoreA}-{detail.scoreB}
                                  </span>
                                </div>

                                {/* Team B Players */}
                                <div
                                  className={`flex-1 text-left ${detail.winner === 'B' ? 'font-bold text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}
                                >
                                  {getPlayerNames(detail.playersB)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    {expandedMatches.has(match.id) &&
                      match.status !== 'finished' && (
                        <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 text-center text-sm text-gray-500">
                          試合データはまだありません
                        </div>
                      )}
                  </div>
                ))}

                {currentMatches.length === 0 && (
                  <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
                    まだ試合情報がありません
                  </div>
                )}
              </div>
            </section>

            {/* 別ページへの導線 */}
            <div className="text-center">
              <Link
                href={`/st-league/${year}/teams`}
                className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-sm font-bold shadow-lg shadow-blue-500/30 transition-transform transform hover:-translate-y-0.5"
              >
                <span>チーム・選手別詳細データを見る</span>
                <svg
                  className="w-4 h-4 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export const getStaticPaths = async () => {
  // 現時点では2025のみ
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

    // プレイヤーIDマップの生成 (明示的なIDプロパティを使用)
    const generatePlayerMap = (teams: Team[]) => {
      const map: PlayerMap = {};
      teams.forEach((team) => {
        if (team.players) {
          team.players.forEach((player) => {
            if (player.id) {
              map[player.id] = player.lastName;
            }
          });
        }
      });
      return map;
    };

    const playerMaps = {
      boys: generatePlayerMap(participantsData.boys),
      girls: generatePlayerMap(participantsData.girls),
    };

    return {
      props: {
        year: parseInt(year, 10),
        matches: matchesData,
        teams: participantsData,
        playerMaps,
      },
    };
  } catch (error) {
    console.error('Data load error:', error);
    return {
      notFound: true,
    };
  }
};
