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
      service_ace: 'サービスエース',

      // ミス系
      net: 'ネット',
      out: 'アウト',
      smash_error: 'スマッシュミス',
      volley_error: 'ボレーミス',
      double_fault: 'ダブルフォルト',
      follow_error: 'フォローミス',

      // その他
      winner: '決定打',
      forced_error: 'ミス誘発',
      unforced_error: '凡ミス',
    };
    return labels[type] || type;
  };

  // 選手統計を計算する関数
  const getPlayerStats = () => {
    if (!match?.games) return {};

    const stats: {
      [playerName: string]: {
        winners: number;
        errors: number;
        points: number;
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
    ];

    match.games.forEach((game) => {
      if (!game.points) return;

      game.points.forEach((point) => {
        const playerName = point.winner_player;
        if (!playerName) return;

        // プレイヤー統計初期化
        if (!stats[playerName]) {
          stats[playerName] = {
            winners: 0,
            errors: 0,
            points: 0,
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

        const resultType = point.result_type || '';

        // ウィナーかミスかを判定
        if (winnerTypes.includes(resultType)) {
          stats[playerName].winners++;
          stats[playerName].gameStats[game.game_number].winners++;
        } else if (errorTypes.includes(resultType)) {
          stats[playerName].errors++;
          stats[playerName].gameStats[game.game_number].errors++;
        }

        // 総ポイント数
        stats[playerName].points++;
        stats[playerName].gameStats[game.game_number].points++;
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
                                {point.winner_player && (
                                  <span className="text-gray-700">
                                    {point.winner_player}
                                  </span>
                                )}
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
        <div className="space-y-4">
          {Object.entries(getPlayerStats()).map(([playerName, stats]) => (
            <div
              key={playerName}
              className="border border-gray-200 rounded-lg p-4"
            >
              <h3 className="font-semibold text-lg mb-3">{playerName}</h3>

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
                <div className="text-center p-3 bg-blue-50 rounded">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.points}
                  </div>
                  <div className="text-sm text-blue-700">関与ポイント</div>
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

              {/* サーブ統計 */}
              {stats.serves.total > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-sm mb-3">サーブ統計</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="text-center p-3 bg-purple-50 rounded">
                      <div className="text-xl font-bold text-purple-600">
                        {stats.serves.total}
                      </div>
                      <div className="text-xs text-purple-700">総サーブ数</div>
                    </div>
                    <div className="text-center p-3 bg-yellow-50 rounded">
                      <div className="text-xl font-bold text-yellow-600">
                        {stats.serves.aces}
                      </div>
                      <div className="text-xs text-yellow-700">エース</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded">
                      <div className="text-xl font-bold text-red-600">
                        {stats.serves.doubleFaults}
                      </div>
                      <div className="text-xs text-red-700">ダブルフォルト</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded">
                      <div className="text-xl font-bold text-green-600">
                        {(
                          (stats.serves.firstServeSuccess /
                            Math.max(stats.serves.total, 1)) *
                          100
                        ).toFixed(1)}
                        %
                      </div>
                      <div className="text-xs text-green-700">
                        1stサーブ成功率
                      </div>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded">
                      <div className="text-xl font-bold text-orange-600">
                        {(
                          (stats.serves.doubleFaults /
                            Math.max(stats.serves.total, 1)) *
                          100
                        ).toFixed(1)}
                        %
                      </div>
                      <div className="text-xs text-orange-700">
                        ダブルフォルト率
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ゲーム別統計 */}
              <div className="mt-4">
                <h4 className="font-medium text-sm mb-2">ゲーム別詳細</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Object.entries(stats.gameStats).map(
                    ([gameNumber, gameStats]) => (
                      <div
                        key={gameNumber}
                        className="text-xs p-2 bg-gray-50 rounded"
                      >
                        <div className="font-medium mb-1">
                          第{gameNumber}ゲーム
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span>ウィナー:</span>
                            <span className="text-green-600 font-medium">
                              {gameStats.winners}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>ミス:</span>
                            <span className="text-red-600 font-medium">
                              {gameStats.errors}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>関与:</span>
                            <span className="font-medium">
                              {gameStats.points}
                            </span>
                          </div>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          ))}
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
