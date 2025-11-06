import { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import { useState } from 'react';

import { createServerClient } from '@/lib/supabase';
import {
  generateTournamentUrlFromMatch,
  getTournamentInfoSSR,
  TournamentInfo,
} from '@/lib/tournamentHelpers';

import { Game, Match, Point } from '../../../../types/database';

interface PublicMatchDetailProps {
  match: Match;
  tournamentInfo: TournamentInfo | null;
  lastUpdated: string;
}

const PublicMatchDetail = ({
  match,
  tournamentInfo,
  lastUpdated,
}: PublicMatchDetailProps) => {
  // エキスパンド状態管理（最新ゲームのみ展開）
  const [expandedGames, setExpandedGames] = useState<Set<number>>(
    new Set(
      match?.games ? [Math.max(...match.games.map((g) => g.game_number))] : [],
    ),
  );

  // エキスパンドのトグル関数
  const toggleGameExpansion = (gameNumber: number) => {
    const newExpandedGames = new Set(expandedGames);
    if (newExpandedGames.has(gameNumber)) {
      newExpandedGames.delete(gameNumber);
    } else {
      newExpandedGames.add(gameNumber);
    }
    setExpandedGames(newExpandedGames);
  };

  // マッチデータから完全なURLを生成
  const fullTournamentUrl = generateTournamentUrlFromMatch(match);
  const getMatchWinner = () => {
    if (!match?.games) return null;

    const gamesWonA = match.games.filter(
      (game: Game) => game.winner_team === 'A',
    ).length;
    const gamesWonB = match.games.filter(
      (game: Game) => game.winner_team === 'B',
    ).length;
    const requiredWins = Math.ceil(match.best_of / 2);

    if (gamesWonA >= requiredWins) return 'A';
    if (gamesWonB >= requiredWins) return 'B';
    return null;
  };

  // データベースのプレイヤー情報から苗字のみのチーム名を生成する関数
  const getShortTeamName = (team: 'A' | 'B') => {
    if (team === 'A') {
      const player1LastName = match.team_a_player1_last_name;
      const player2LastName = match.team_a_player2_last_name;

      if (player1LastName && player2LastName) {
        return `${player1LastName}・${player2LastName}`;
      } else if (player1LastName) {
        return player1LastName;
      }
      // フォールバック：元のチーム名を使用
      return match.team_a || '';
    } else {
      const player1LastName = match.team_b_player1_last_name;
      const player2LastName = match.team_b_player2_last_name;

      if (player1LastName && player2LastName) {
        return `${player1LastName}・${player2LastName}`;
      } else if (player1LastName) {
        return player1LastName;
      }
      // フォールバック：元のチーム名を使用
      return match.team_b || '';
    }
  };

  const getResultTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      // ウィナー系
      smash_winner: 'スマッシュウィナー',
      volley_winner: 'ボレーウィナー',
      passing_winner: 'パッシングウィナー',
      drop_winner: 'ドロップウィナー',
      net_in_winner: 'ネットインウィナー',
      service_ace: 'サービスエース',

      // ミス系
      net: 'ネット',
      out: 'アウト',
      smash_error: 'スマッシュミス',
      volley_error: 'ボレーミス',
      double_fault: 'ダブルフォルト',
      follow_error: 'フォローミス',
      receive_error: 'レシーブミス',

      // その他
      winner: '決定打',
      forced_error: 'ミス誘発',
      unforced_error: '凡ミス',
    };
    return labels[type] || type;
  };

  // 試合全体の統計を計算する関数
  const getMatchStats = () => {
    if (!match?.games) return null;

    const rallyCounts: number[] = [];
    let totalPoints = 0;
    let winnersTotal = 0;
    let errorsTotal = 0;
    let totalRallies = 0;

    // モメンタム分析のためのデータ
    const allPoints: Array<{ winner_team: string; game_number: number }> = [];

    match.games.forEach((game) => {
      if (!game.points) return;

      totalPoints += game.points.length;

      game.points.forEach((point) => {
        if (point.winner_team) {
          allPoints.push({
            winner_team: point.winner_team,
            game_number: game.game_number,
          });
        }

        if (point.rally_count !== null && point.rally_count > 0) {
          rallyCounts.push(point.rally_count);
          totalRallies += point.rally_count;
        }

        const resultType = point.result_type || '';
        const winnerTypes = [
          'smash_winner',
          'volley_winner',
          'passing_winner',
          'drop_winner',
          'net_in_winner',
          'service_ace',
        ];
        const errorTypes = [
          'net',
          'out',
          'smash_error',
          'volley_error',
          'double_fault',
          'follow_error',
          'receive_error',
        ];

        if (winnerTypes.includes(resultType)) {
          winnersTotal++;
        } else if (errorTypes.includes(resultType)) {
          errorsTotal++;
        }
      });
    });

    const maxRally = rallyCounts.length > 0 ? Math.max(...rallyCounts) : 0;
    const avgRally =
      rallyCounts.length > 0 ? totalRallies / rallyCounts.length : 0;

    // ラリー数分布の計算
    const rallyDistribution: { [range: string]: number } = {
      '1-3': 0,
      '4-10': 0,
      '11-20': 0,
      '21+': 0,
    };

    rallyCounts.forEach((count) => {
      if (count <= 3) rallyDistribution['1-3']++;
      else if (count <= 10) rallyDistribution['4-10']++;
      else if (count <= 20) rallyDistribution['11-20']++;
      else rallyDistribution['21+']++;
    });

    // モメンタム分析：最長連続ポイント
    let maxStreakA = 0;
    let maxStreakB = 0;
    let currentStreakA = 0;
    let currentStreakB = 0;

    allPoints.forEach((point) => {
      if (point.winner_team === 'A') {
        currentStreakA++;
        currentStreakB = 0;
        maxStreakA = Math.max(maxStreakA, currentStreakA);
      } else if (point.winner_team === 'B') {
        currentStreakB++;
        currentStreakA = 0;
        maxStreakB = Math.max(maxStreakB, currentStreakB);
      }
    });

    return {
      totalPoints,
      winnersTotal,
      errorsTotal,
      maxRally,
      avgRally,
      rallyDistribution,
      winnerErrorRatio:
        errorsTotal > 0 ? winnersTotal / errorsTotal : winnersTotal,
      totalGames: match.games.length,
      totalRallies,
      maxStreakA,
      maxStreakB,
      rallyCountsArray: rallyCounts,
    };
  };

  // 選手統計を計算する関数
  const getPlayerStats = () => {
    if (!match?.games) return {};

    const stats: {
      [playerName: string]: {
        winners: number;
        errors: number;
        points: number;
        winnerBreakdown: {
          [winnerType: string]: number;
        };
        errorBreakdown: {
          [errorType: string]: number;
        };
        serves: {
          total: number;
          aces: number;
          doubleFaults: number;
          firstServeFaults: number;
          firstServeSuccess: number;
        };
        gameStats: {
          [gameNumber: number]: {
            winners: number;
            errors: number;
            points: number;
          };
        };
      };
    } = {};

    // ウィナー系の結果タイプ
    const winnerTypes = [
      'smash_winner',
      'volley_winner',
      'passing_winner',
      'drop_winner',
      'net_in_winner',
      'service_ace',
    ];

    // ミス系の結果タイプ
    const errorTypes = [
      'net',
      'out',
      'smash_error',
      'volley_error',
      'double_fault',
      'follow_error',
      'receive_error',
    ];

    match.games.forEach((game) => {
      if (!game.points) return;

      game.points.forEach((point) => {
        const resultType = point.result_type || '';

        // ウィナー系の処理
        if (winnerTypes.includes(resultType)) {
          let playerName = point.winner_player;

          // 一意識別子から選手名を抽出
          if (playerName && playerName.includes('-')) {
            const parts = playerName.split('-');
            playerName = parts.slice(2).join('-');
          }

          if (playerName) {
            // プレイヤー統計初期化
            if (!stats[playerName]) {
              stats[playerName] = {
                winners: 0,
                errors: 0,
                points: 0,
                winnerBreakdown: {},
                errorBreakdown: {},
                serves: {
                  total: 0,
                  aces: 0,
                  doubleFaults: 0,
                  firstServeFaults: 0,
                  firstServeSuccess: 0,
                },
                gameStats: {},
              };
            }

            // ゲーム統計初期化
            if (!stats[playerName].gameStats[game.game_number]) {
              stats[playerName].gameStats[game.game_number] = {
                winners: 0,
                errors: 0,
                points: 0,
              };
            }

            stats[playerName].winners++;
            stats[playerName].gameStats[game.game_number].winners++;
            stats[playerName].points++;
            stats[playerName].gameStats[game.game_number].points++;

            // ウィナーの内訳を記録
            if (!stats[playerName].winnerBreakdown[resultType]) {
              stats[playerName].winnerBreakdown[resultType] = 0;
            }
            stats[playerName].winnerBreakdown[resultType]++;
          }
        }

        // ミス系の処理
        if (errorTypes.includes(resultType)) {
          let playerName = point.loser_player;

          // 一意識別子から選手名を抽出
          if (playerName && playerName.includes('-')) {
            const parts = playerName.split('-');
            playerName = parts.slice(2).join('-');
          }

          if (playerName) {
            // プレイヤー統計初期化
            if (!stats[playerName]) {
              stats[playerName] = {
                winners: 0,
                errors: 0,
                points: 0,
                winnerBreakdown: {},
                errorBreakdown: {},
                serves: {
                  total: 0,
                  aces: 0,
                  doubleFaults: 0,
                  firstServeFaults: 0,
                  firstServeSuccess: 0,
                },
                gameStats: {},
              };
            }

            // ゲーム統計初期化
            if (!stats[playerName].gameStats[game.game_number]) {
              stats[playerName].gameStats[game.game_number] = {
                winners: 0,
                errors: 0,
                points: 0,
              };
            }

            stats[playerName].errors++;
            stats[playerName].gameStats[game.game_number].errors++;
            stats[playerName].points++;
            stats[playerName].gameStats[game.game_number].points++;

            // ミスの内訳を記録
            if (!stats[playerName].errorBreakdown[resultType]) {
              stats[playerName].errorBreakdown[resultType] = 0;
            }
            stats[playerName].errorBreakdown[resultType]++;
          }
        }
      });

      // サーブ統計の計算
      game.points.forEach((point) => {
        const servingPlayerName = point.serving_player;

        if (!servingPlayerName) return;

        // サーブ選手の統計初期化
        if (!stats[servingPlayerName]) {
          stats[servingPlayerName] = {
            winners: 0,
            errors: 0,
            points: 0,
            winnerBreakdown: {},
            errorBreakdown: {},
            serves: {
              total: 0,
              aces: 0,
              doubleFaults: 0,
              firstServeFaults: 0,
              firstServeSuccess: 0,
            },
            gameStats: {},
          };
        }

        // サーブ統計の計算
        stats[servingPlayerName].serves.total++;

        // サービスエース
        if (point.result_type === 'service_ace') {
          stats[servingPlayerName].serves.aces++;
        }

        // ダブルフォルト
        if (point.double_fault || point.result_type === 'double_fault') {
          stats[servingPlayerName].serves.doubleFaults++;
        }

        // ダブルフォルトの場合、loser_playerも考慮（serving_playerが不正確な場合の補完）
        if (
          (point.double_fault || point.result_type === 'double_fault') &&
          point.loser_player &&
          point.loser_player !== servingPlayerName
        ) {
          const loserPlayerName = point.loser_player;
          if (!stats[loserPlayerName]) {
            stats[loserPlayerName] = {
              winners: 0,
              errors: 0,
              points: 0,
              winnerBreakdown: {},
              errorBreakdown: {},
              serves: {
                total: 0,
                aces: 0,
                doubleFaults: 0,
                firstServeFaults: 0,
                firstServeSuccess: 0,
              },
              gameStats: {},
            };
          }
          stats[loserPlayerName].serves.total++;
          stats[loserPlayerName].serves.doubleFaults++;
        }

        // 1stサーブフォルト
        if (point.first_serve_fault) {
          stats[servingPlayerName].serves.firstServeFaults++;
        } else {
          // 1stサーブ成功（フォルトしていない場合）
          stats[servingPlayerName].serves.firstServeSuccess++;
        }
      });
    });

    return stats;
  };

  if (!match) return <div className="p-6">Match not found</div>;

  const matchWinner = getMatchWinner();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <Link
          href="/beta/matches-results"
          className="text-blue-500 hover:underline"
        >
          ← 試合一覧に戻る
        </Link>
        <p className="text-sm text-gray-500">
          最終更新:{' '}
          {new Date(lastUpdated).toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Tokyo',
          })}
        </p>
      </div>

      {/* マッチ情報 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">
          {match.team_a} vs {match.team_b}
        </h1>

        {/* 大会情報 */}
        <div className="mb-4">
          {/* 大会名表示 */}
          <div className="flex items-center gap-2 mb-2">
            {tournamentInfo && fullTournamentUrl ? (
              <Link
                href={fullTournamentUrl}
                className="text-blue-600 hover:underline font-medium"
              >
                {tournamentInfo.meta.name}
              </Link>
            ) : tournamentInfo ? (
              <span className="font-medium text-gray-800">
                {tournamentInfo.meta.name}
              </span>
            ) : (
              <span className="font-medium text-gray-800">
                {match.tournament_name || '大会名不明'}
              </span>
            )}
          </div>

          {/* 回戦情報表示のみ */}
          <div className="flex flex-wrap gap-2 mb-2">
            {match.round_name && (
              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                {match.round_name}
              </span>
            )}
          </div>
        </div>

        {matchWinner && (
          <div className="bg-green-100 border border-green-400 rounded p-4">
            <p className="text-lg font-semibold text-green-800">
              🏆 {getShortTeamName(matchWinner)} の勝利！
            </p>
          </div>
        )}
      </div>

      {/* スコアボード */}
      <h2 className="text-xl font-semibold mb-4">試合結果</h2>

      {/* ゲームスコア表（野球のスコアボード風） */}
      <div className="overflow-x-auto mb-6">
        <table className="min-w-full border-collapse border border-gray-300 table-auto">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 px-3 py-2 text-left w-auto">
                チーム
              </th>
              {match.games
                ?.sort((a, b) => a.game_number - b.game_number)
                .map((game) => (
                  <th
                    key={game.game_number}
                    className="border border-gray-300 px-3 py-2 text-center min-w-12"
                  >
                    {game.game_number}
                  </th>
                ))}
              <th className="border border-gray-300 px-3 py-2 text-center font-bold bg-yellow-50">
                G
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 font-medium w-auto whitespace-nowrap">
                {getShortTeamName('A')}
              </td>
              {match.games
                ?.sort((a, b) => a.game_number - b.game_number)
                .map((game) => (
                  <td
                    key={game.game_number}
                    className={`border border-gray-300 px-3 py-2 text-center ${
                      game.winner_team === 'A'
                        ? 'bg-green-100 text-green-800 font-bold'
                        : 'font-normal'
                    }`}
                  >
                    {game.points_a}
                  </td>
                ))}
              <td
                className={`border border-gray-300 px-3 py-2 text-center bg-yellow-50 ${
                  matchWinner === 'A' ? 'font-bold' : 'font-normal'
                }`}
              >
                {match.games?.filter((game) => game.winner_team === 'A')
                  .length || 0}
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="border border-gray-300 px-3 py-2 font-medium w-auto whitespace-nowrap">
                {getShortTeamName('B')}
              </td>
              {match.games
                ?.sort((a, b) => a.game_number - b.game_number)
                .map((game) => (
                  <td
                    key={game.game_number}
                    className={`border border-gray-300 px-3 py-2 text-center ${
                      game.winner_team === 'B'
                        ? 'bg-green-100 text-green-800 font-bold'
                        : 'font-normal'
                    }`}
                  >
                    {game.points_b}
                  </td>
                ))}
              <td
                className={`border border-gray-300 px-3 py-2 text-center bg-yellow-50 ${
                  matchWinner === 'B' ? 'font-bold' : 'font-normal'
                }`}
              >
                {match.games?.filter((game) => game.winner_team === 'B')
                  .length || 0}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 試合統計サマリー */}
      {(() => {
        const matchStats = getMatchStats();

        if (!matchStats) return null;

        return (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">試合統計</h3>

            {/* ラリー数分布 */}
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-semibold mb-3">ラリー数分布</h4>
              <div className="grid grid-cols-4 gap-2">
                {Object.entries(matchStats.rallyDistribution).map(
                  ([range, count]) => (
                    <div
                      key={range}
                      className="text-center p-2 bg-gray-50 rounded"
                    >
                      <div className="font-bold text-lg text-gray-700">
                        {count}
                      </div>
                      <div className="text-xs text-gray-600">{range}ラリー</div>
                    </div>
                  ),
                )}
              </div>

              {/* ラリー詳細統計 */}
              {matchStats.rallyCountsArray.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    ラリー詳細
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <div className="font-bold text-gray-700">
                        {matchStats.maxRally}
                      </div>
                      <div className="text-gray-600">最長</div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-700">
                        {Math.min(...matchStats.rallyCountsArray)}
                      </div>
                      <div className="text-gray-600">最短</div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-700">
                        {matchStats.avgRally.toFixed(1)}
                      </div>
                      <div className="text-gray-600">平均</div>
                    </div>
                    <div>
                      <div className="font-bold text-gray-700">
                        {(() => {
                          const sorted = [...matchStats.rallyCountsArray].sort(
                            (a, b) => a - b,
                          );
                          const mid = Math.floor(sorted.length / 2);
                          return sorted.length % 2 === 0
                            ? ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1)
                            : sorted[mid];
                        })()}
                      </div>
                      <div className="text-gray-600">中央値</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* チーム別ウィナー・ミス内訳サマリー */}
      {(() => {
        const playerStats = getPlayerStats();

        // チームA、チームBの選手を整理
        const teamAPlayers = [
          match.team_a_player1_first_name && match.team_a_player1_last_name
            ? `${match.team_a_player1_last_name} ${match.team_a_player1_first_name}`
            : null,
          match.team_a_player2_first_name && match.team_a_player2_last_name
            ? `${match.team_a_player2_last_name} ${match.team_a_player2_first_name}`
            : null,
        ].filter((player): player is string => player !== null);

        const teamBPlayers = [
          match.team_b_player1_first_name && match.team_b_player1_last_name
            ? `${match.team_b_player1_last_name} ${match.team_b_player1_first_name}`
            : null,
          match.team_b_player2_first_name && match.team_b_player2_last_name
            ? `${match.team_b_player2_last_name} ${match.team_b_player2_first_name}`
            : null,
        ].filter((player): player is string => player !== null);

        // チーム別の集計
        const getTeamStats = (players: string[]) => {
          const teamWinnerBreakdown: { [type: string]: number } = {};
          const teamErrorBreakdown: { [type: string]: number } = {};
          let totalWinners = 0;
          let totalErrors = 0;

          players.forEach((playerName) => {
            const stats = playerStats[playerName];
            if (!stats) return;

            totalWinners += stats.winners;
            totalErrors += stats.errors;

            Object.entries(stats.winnerBreakdown).forEach(([type, count]) => {
              teamWinnerBreakdown[type] =
                (teamWinnerBreakdown[type] || 0) + count;
            });

            Object.entries(stats.errorBreakdown).forEach(([type, count]) => {
              teamErrorBreakdown[type] =
                (teamErrorBreakdown[type] || 0) + count;
            });
          });

          return {
            winnerBreakdown: teamWinnerBreakdown,
            errorBreakdown: teamErrorBreakdown,
            totalWinners,
            totalErrors,
          };
        };

        const teamAStats = getTeamStats(teamAPlayers);
        const teamBStats = getTeamStats(teamBPlayers);

        if (
          teamAStats.totalWinners === 0 &&
          teamAStats.totalErrors === 0 &&
          teamBStats.totalWinners === 0 &&
          teamBStats.totalErrors === 0
        ) {
          return null;
        }

        const matchStats = getMatchStats();

        return (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">チーム別統計サマリー</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* チームA統計 */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-blue-600">
                  {getShortTeamName('A')}
                </h4>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="text-lg font-bold text-green-600">
                      {teamAStats.totalWinners}
                    </div>
                    <div className="text-xs text-green-700">ウィナー</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded">
                    <div className="text-lg font-bold text-red-600">
                      {teamAStats.totalErrors}
                    </div>
                    <div className="text-xs text-red-700">ミス</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-gray-700">
                      {matchStats?.maxStreakA || 0}
                    </div>
                    <div className="text-xs text-gray-600">最長連続</div>
                  </div>
                </div>

                {/* ウィナー内訳 */}
                {Object.keys(teamAStats.winnerBreakdown).length > 0 && (
                  <div className="mb-3">
                    <h6 className="text-xs font-medium text-gray-700 mb-1">
                      ウィナー内訳
                    </h6>
                    <div className="space-y-1">
                      {Object.entries(teamAStats.winnerBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5) // 上位5つまで表示
                        .map(([type, count]) => (
                          <div
                            key={type}
                            className="flex justify-between text-xs"
                          >
                            <span className="text-gray-600">
                              {getResultTypeLabel(type)}
                            </span>
                            <span className="font-medium text-green-600">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* ミス内訳 */}
                {Object.keys(teamAStats.errorBreakdown).length > 0 && (
                  <div>
                    <h6 className="text-xs font-medium text-gray-700 mb-1">
                      ミス内訳
                    </h6>
                    <div className="space-y-1">
                      {Object.entries(teamAStats.errorBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5) // 上位5つまで表示
                        .map(([type, count]) => (
                          <div
                            key={type}
                            className="flex justify-between text-xs"
                          >
                            <span className="text-gray-600">
                              {getResultTypeLabel(type)}
                            </span>
                            <span className="font-medium text-red-600">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* チームB統計 */}
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-green-600">
                  {getShortTeamName('B')}
                </h4>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="text-lg font-bold text-green-600">
                      {teamBStats.totalWinners}
                    </div>
                    <div className="text-xs text-green-700">ウィナー</div>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded">
                    <div className="text-lg font-bold text-red-600">
                      {teamBStats.totalErrors}
                    </div>
                    <div className="text-xs text-red-700">ミス</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-gray-700">
                      {matchStats?.maxStreakB || 0}
                    </div>
                    <div className="text-xs text-gray-600">最長連続</div>
                  </div>
                </div>

                {/* ウィナー内訳 */}
                {Object.keys(teamBStats.winnerBreakdown).length > 0 && (
                  <div className="mb-3">
                    <h6 className="text-xs font-medium text-gray-700 mb-1">
                      ウィナー内訳
                    </h6>
                    <div className="space-y-1">
                      {Object.entries(teamBStats.winnerBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5) // 上位5つまで表示
                        .map(([type, count]) => (
                          <div
                            key={type}
                            className="flex justify-between text-xs"
                          >
                            <span className="text-gray-600">
                              {getResultTypeLabel(type)}
                            </span>
                            <span className="font-medium text-green-600">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* ミス内訳 */}
                {Object.keys(teamBStats.errorBreakdown).length > 0 && (
                  <div>
                    <h6 className="text-xs font-medium text-gray-700 mb-1">
                      ミス内訳
                    </h6>
                    <div className="space-y-1">
                      {Object.entries(teamBStats.errorBreakdown)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5) // 上位5つまで表示
                        .map(([type, count]) => (
                          <div
                            key={type}
                            className="flex justify-between text-xs"
                          >
                            <span className="text-gray-600">
                              {getResultTypeLabel(type)}
                            </span>
                            <span className="font-medium text-red-600">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ゲーム詳細（降順、エキスパンド対応） */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">ゲーム詳細</h3>
        {match.games
          ?.sort((a, b) => b.game_number - a.game_number) // 降順（新しいゲームを上に）
          .map((game: Game) => {
            const isExpanded = expandedGames.has(game.game_number);
            return (
              <div key={game.id} className="border border-gray-200 rounded-lg">
                {/* ゲームヘッダー（クリック可能） */}
                <button
                  onClick={() => toggleGameExpansion(game.game_number)}
                  className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50 rounded-t-lg"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">
                      第{game.game_number}ゲーム
                    </span>
                    <span className="text-sm font-medium">
                      {game.points_a} - {game.points_b}
                    </span>
                    {game.winner_team && (
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          game.winner_team === 'A'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {getShortTeamName(game.winner_team === 'A' ? 'A' : 'B')}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-400 text-xl">
                    {isExpanded ? '−' : '+'}
                  </span>
                </button>

                {/* ゲーム詳細（エキスパンド時のみ表示） */}
                {isExpanded && game.points && game.points.length > 0 && (
                  <div className="px-4 pb-4 border-t border-gray-200">
                    <div className="space-y-2 mt-3">
                      {game.points
                        .sort((a, b) => b.point_number - a.point_number)
                        .map((point: Point) => {
                          // スコア計算
                          const pointsBeforeThis =
                            game.points?.filter(
                              (p) => p.point_number < point.point_number,
                            ) || [];
                          const teamAPoints = pointsBeforeThis.filter(
                            (p) => p.winner_team === 'A',
                          ).length;
                          const teamBPoints = pointsBeforeThis.filter(
                            (p) => p.winner_team === 'B',
                          ).length;
                          const finalTeamAPoints =
                            teamAPoints + (point.winner_team === 'A' ? 1 : 0);
                          const finalTeamBPoints =
                            teamBPoints + (point.winner_team === 'B' ? 1 : 0);

                          return (
                            <div key={point.id} className="text-sm">
                              {/* ポイント情報（1行目） */}
                              <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                                <span className="font-medium">
                                  <span
                                    className={
                                      point.winner_team === 'A'
                                        ? 'font-bold'
                                        : ''
                                    }
                                  >
                                    {finalTeamAPoints}
                                  </span>
                                  {' - '}
                                  <span
                                    className={
                                      point.winner_team === 'B'
                                        ? 'font-bold'
                                        : ''
                                    }
                                  >
                                    {finalTeamBPoints}
                                  </span>
                                </span>
                                <span>{point.rally_count}ラリー</span>
                              </div>

                              {/* ポイント内容（2行目） */}
                              <div className="flex items-center gap-3 pl-4">
                                <span className="font-medium text-blue-600">
                                  {getResultTypeLabel(point.result_type || '')}
                                </span>
                                {/* 選手情報：ウィナー系はwinner_player、ミス系はloser_playerを表示 */}
                                {(() => {
                                  const errorTypes = [
                                    'net',
                                    'out',
                                    'smash_error',
                                    'volley_error',
                                    'double_fault',
                                    'receive_error',
                                    'follow_error',
                                  ];

                                  const isError =
                                    point.result_type &&
                                    errorTypes.includes(point.result_type);
                                  const playerName = isError
                                    ? point.loser_player
                                    : point.winner_player;

                                  return playerName ? (
                                    <span className="text-gray-700">
                                      {playerName}
                                    </span>
                                  ) : null;
                                })()}
                                <div className="flex gap-2">
                                  {point.first_serve_fault && (
                                    <span className="text-orange-600 text-xs bg-orange-50 px-1 rounded">
                                      1stフォルト
                                    </span>
                                  )}
                                  {point.double_fault && (
                                    <span className="text-red-600 text-xs bg-red-50 px-1 rounded">
                                      ダブルフォルト
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                      {/* ゲーム開始時の0-0表示（最後に表示） */}
                      <div className="text-sm">
                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                          <span className="font-medium">0 - 0</span>
                          <span>ゲーム開始</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* 選手別統計情報 */}
      <div className="pt-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">選手別統計情報</h2>
        <div className="space-y-6">
          {(() => {
            const playerStats = getPlayerStats();

            // チームA、チームBの選手を順番に整理
            const teamAPlayers = [
              match.team_a_player1_first_name && match.team_a_player1_last_name
                ? `${match.team_a_player1_last_name} ${match.team_a_player1_first_name}`
                : null,
              match.team_a_player2_first_name && match.team_a_player2_last_name
                ? `${match.team_a_player2_last_name} ${match.team_a_player2_first_name}`
                : null,
            ].filter((player): player is string => player !== null);

            const teamBPlayers = [
              match.team_b_player1_first_name && match.team_b_player1_last_name
                ? `${match.team_b_player1_last_name} ${match.team_b_player1_first_name}`
                : null,
              match.team_b_player2_first_name && match.team_b_player2_last_name
                ? `${match.team_b_player2_last_name} ${match.team_b_player2_first_name}`
                : null,
            ].filter((player): player is string => player !== null);

            const renderPlayerStats = (
              playerName: string,
              stats: {
                winners: number;
                errors: number;
                points: number;
                winnerBreakdown: {
                  [winnerType: string]: number;
                };
                errorBreakdown: {
                  [errorType: string]: number;
                };
                serves: {
                  total: number;
                  aces: number;
                  doubleFaults: number;
                  firstServeFaults: number;
                  firstServeSuccess: number;
                };
                gameStats: {
                  [gameNumber: number]: {
                    winners: number;
                    errors: number;
                    points: number;
                  };
                };
              },
            ) => (
              <div key={playerName} className="rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-lg mb-3">{playerName}</h4>

                {/* 全体統計 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-green-50 rounded">
                    <div className="text-2xl font-bold text-green-600">
                      {stats.winners}
                    </div>
                    <div className="text-sm text-green-700">ウィナー</div>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded">
                    <div className="text-2xl font-bold text-red-600">
                      {stats.errors}
                    </div>
                    <div className="text-sm text-red-700">ミス</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-gray-600">
                      {stats.points}
                    </div>
                    <div className="text-sm text-gray-700">関与ポイント</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded">
                    <div className="text-2xl font-bold text-gray-600">
                      {stats.points > 0
                        ? ((stats.winners / stats.points) * 100).toFixed(1)
                        : '0.0'}
                      %
                    </div>
                    <div className="text-sm text-gray-700">ウィナー率</div>
                  </div>
                </div>

                {/* ウィナーとミスの内訳 */}
                {(Object.keys(stats.winnerBreakdown).length > 0 ||
                  Object.keys(stats.errorBreakdown).length > 0) && (
                  <div className="mb-4">
                    <h5 className="font-medium text-sm mb-3">
                      ウィナーとミスの内訳
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* ウィナー内訳 */}
                      {Object.keys(stats.winnerBreakdown).length > 0 && (
                        <div className="bg-green-50 p-3 rounded">
                          <h6 className="font-medium text-green-700 text-sm mb-2">
                            ウィナー ({stats.winners}回)
                          </h6>
                          <div className="space-y-1">
                            {Object.entries(stats.winnerBreakdown)
                              .sort(([, a], [, b]) => b - a)
                              .map(([type, count]) => (
                                <div
                                  key={type}
                                  className="flex justify-between text-xs"
                                >
                                  <span className="text-gray-700">
                                    {getResultTypeLabel(type)}
                                  </span>
                                  <span className="font-medium text-green-700">
                                    {count}回
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* ミス内訳 */}
                      {Object.keys(stats.errorBreakdown).length > 0 && (
                        <div className="bg-red-50 p-3 rounded">
                          <h6 className="font-medium text-red-700 text-sm mb-2">
                            ミス ({stats.errors}回)
                          </h6>
                          <div className="space-y-1">
                            {Object.entries(stats.errorBreakdown)
                              .sort(([, a], [, b]) => b - a)
                              .map(([type, count]) => (
                                <div
                                  key={type}
                                  className="flex justify-between text-xs"
                                >
                                  <span className="text-gray-700">
                                    {getResultTypeLabel(type)}
                                  </span>
                                  <span className="font-medium text-red-700">
                                    {count}回
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* サーブ統計 */}
                {stats.serves.total > 0 && (
                  <div className="mb-4">
                    <h5 className="font-medium text-sm mb-3">サーブ統計</h5>

                    {/* サーブ横棒グラフ */}
                    {(() => {
                      const total = stats.serves.total;
                      const aces = stats.serves.aces;
                      const doubleFaults = stats.serves.doubleFaults;
                      const firstServeSuccess = stats.serves.firstServeSuccess;
                      // 2ndサーブ成功 = 総サーブ数 - 1stサーブ成功 - ダブルフォルト
                      const secondServeSuccess =
                        total - firstServeSuccess - doubleFaults;

                      const firstServePercent =
                        (firstServeSuccess / total) * 100;
                      const secondServePercent =
                        (secondServeSuccess / total) * 100;
                      const doubleFaultPercent = (doubleFaults / total) * 100;
                      const acePercent = (aces / total) * 100;

                      return (
                        <div className="rounded p-4">
                          {/* 横棒グラフ */}
                          <div className="space-y-4">
                            {/* 総サーブ数の棒グラフ */}
                            <div className="relative">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-gray-700">
                                  総サーブ数
                                </span>
                                <span className="text-xs font-bold text-gray-800">
                                  {total}本
                                </span>
                              </div>

                              {/* 積み重ね棒グラフ */}
                              <div className="relative h-4 bg-gray-200 rounded overflow-hidden">
                                {/* 1stサーブ成功 */}
                                <div
                                  className="absolute top-0 left-0 h-full bg-green-500"
                                  style={{ width: `${firstServePercent}%` }}
                                ></div>

                                {/* 2ndサーブ成功 */}
                                <div
                                  className="absolute top-0 h-full bg-blue-500"
                                  style={{
                                    left: `${firstServePercent}%`,
                                    width: `${secondServePercent}%`,
                                  }}
                                ></div>

                                {/* ダブルフォルト */}
                                <div
                                  className="absolute top-0 h-full bg-red-500"
                                  style={{
                                    left: `${firstServePercent + secondServePercent}%`,
                                    width: `${doubleFaultPercent}%`,
                                  }}
                                ></div>
                              </div>

                              {/* エースとダブルフォルトのマーカー */}
                              <div className="relative mt-1 h-1">
                                {/* エースマーカー */}
                                {aces > 0 && (
                                  <div
                                    className="absolute top-0 h-1 bg-yellow-400 rounded-sm"
                                    style={{
                                      left: '0%',
                                      width: `${acePercent}%`,
                                      minWidth: '2px',
                                    }}
                                    title={`エース: ${aces}本`}
                                  ></div>
                                )}
                              </div>
                            </div>

                            {/* 詳細数値 */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span>
                                  1stサーブ成功: {firstServeSuccess}本 (
                                  {firstServePercent.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-400 border border-yellow-600 rounded-full"></div>
                                <span>
                                  エース: {aces}本 ({acePercent.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span>
                                  2ndサーブ成功: {secondServeSuccess}本 (
                                  {secondServePercent.toFixed(1)}%)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <span>
                                  ダブルフォルト: {doubleFaults}本 (
                                  {doubleFaultPercent.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ゲーム別統計 */}
                {Object.keys(stats.gameStats).length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium text-sm mb-3">ゲーム別詳細</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs">
                          <tr className="border-b border-gray-200">
                            <th className="px-2 py-2 text-left font-medium text-gray-700">
                              ゲーム
                            </th>
                            <th className="px-2 py-2 text-center font-medium text-gray-700">
                              ウィナー
                            </th>
                            <th className="px-2 py-2 text-center font-medium text-gray-700">
                              ミス
                            </th>
                            <th className="px-2 py-2 text-center font-medium text-gray-700">
                              関与
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(stats.gameStats)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([gameNumber, gameStats]) => (
                              <tr key={gameNumber}>
                                <td className="px-2 py-1 font-medium">
                                  第{gameNumber}ゲーム
                                </td>
                                <td className="px-2 py-1 text-center font-medium">
                                  {gameStats.winners}
                                </td>
                                <td className="px-2 py-1 text-center font-medium">
                                  {gameStats.errors}
                                </td>
                                <td className="px-2 py-1 text-center font-medium">
                                  {gameStats.points}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );

            return (
              <>
                {/* チームA選手 */}
                {teamAPlayers
                  .filter((player) => playerStats[player])
                  .map((playerName) =>
                    renderPlayerStats(playerName, playerStats[playerName]),
                  )}

                {/* チームB選手 */}
                {teamBPlayers
                  .filter((player) => playerStats[player])
                  .map((playerName) =>
                    renderPlayerStats(playerName, playerStats[playerName]),
                  )}

                {/* 上記のチーム分類にない選手がいる場合 */}
                {Object.keys(playerStats).filter(
                  (player) =>
                    ![...teamAPlayers, ...teamBPlayers].includes(player),
                ).length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 text-gray-600 border-b border-gray-200 pb-2">
                      その他の選手
                    </h3>
                    <div className="space-y-4">
                      {Object.keys(playerStats)
                        .filter(
                          (player) =>
                            ![...teamAPlayers, ...teamBPlayers].includes(
                              player,
                            ),
                        )
                        .map((playerName) =>
                          renderPlayerStats(
                            playerName,
                            playerStats[playerName],
                          ),
                        )}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

// ISR実装: 静的パス生成
export const getStaticPaths: GetStaticPaths = async () => {
  try {
    const supabase = createServerClient();

    // 最新50件のマッチIDを取得してプリビルド
    const { data: matches } = await supabase
      .from('matches')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(50);

    const paths = (matches || []).map((match) => ({
      params: { matchId: match.id.toString() },
    }));

    return {
      paths,
      fallback: 'blocking', // 新しいマッチは動的生成
    };
  } catch (error) {
    console.error('getStaticPaths error:', error);
    return {
      paths: [],
      fallback: 'blocking',
    };
  }
};

// ISR実装: 静的プロパティ生成
export const getStaticProps: GetStaticProps<PublicMatchDetailProps> = async ({
  params,
}) => {
  try {
    const matchId = params?.matchId as string;

    if (!matchId) {
      return { notFound: true };
    }

    const supabase = createServerClient();

    // マッチデータを取得
    const { data: match, error } = await supabase
      .from('matches')
      .select(
        `
        *,
        games(*, points(*))
      `,
      )
      .eq('id', matchId)
      .single();

    if (error || !match) {
      console.error('Match not found:', matchId, error);
      return { notFound: true };
    }

    // 大会情報を取得（サーバーサイド用関数を使用）
    let tournamentInfo: TournamentInfo | null = null;
    if (match.tournament_name) {
      try {
        tournamentInfo = await getTournamentInfoSSR(match.tournament_name);
      } catch (error) {
        console.error('Tournament info fetch failed:', error);
        // 大会情報の取得に失敗してもマッチデータは表示する
      }
    }

    return {
      props: {
        match,
        tournamentInfo,
        lastUpdated: new Date().toISOString(),
      },
      // ISR設定: 1分ごとに再生成（詳細ページはあまり変更されないため）
      revalidate: 60,
    };
  } catch (error) {
    console.error('getStaticProps error:', error);
    return { notFound: true };
  }
};

export default PublicMatchDetail;
