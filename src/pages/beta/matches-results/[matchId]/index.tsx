import { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';

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

  const getTotalPoints = () => {
    if (!match?.games) return 0;
    return match.games.reduce(
      (sum, game) => sum + (game.points?.length || 0),
      0,
    );
  };

  const getTotalRallies = () => {
    if (!match?.games) return 0;
    return match.games.reduce(
      (sum, game) =>
        sum +
        (game.points?.reduce(
          (pSum, point) => pSum + (point.rally_count || 0),
          0,
        ) || 0),
      0,
    );
  };

  // 選手統計を計算する関数
  const getPlayerStats = () => {
    if (!match?.games) return {};

    const stats: {
      [playerName: string]: {
        winners: number;
        errors: number;
        points: number;
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
    });

    return stats;
  };

  // ゲーム統計を計算する関数
  const getGameStats = () => {
    if (!match?.games) return {};

    const stats: {
      [gameNumber: number]: {
        totalPoints: number;
        totalRallies: number;
        avgRallyLength: number;
        winners: number;
        errors: number;
      };
    } = {};

    match.games.forEach((game) => {
      if (!game.points) return;

      const totalPoints = game.points.length;
      const totalRallies = game.points.reduce(
        (sum, point) => sum + (point.rally_count || 0),
        0,
      );
      const avgRallyLength = totalPoints > 0 ? totalRallies / totalPoints : 0;

      const winnerTypes = [
        'smash_winner',
        'volley_winner',
        'passing_winner',
        'drop_winner',
        'service_ace',
      ];
      const errorTypes = [
        'net',
        'out',
        'smash_error',
        'volley_error',
        'double_fault',
        'follow_error',
      ];

      const winners = game.points.filter((point) =>
        winnerTypes.includes(point.result_type || ''),
      ).length;
      const errors = game.points.filter((point) =>
        errorTypes.includes(point.result_type || ''),
      ).length;

      stats[game.game_number] = {
        totalPoints,
        totalRallies,
        avgRallyLength,
        winners,
        errors,
      };
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
              🏆 {matchWinner === 'A' ? match.team_a : match.team_b} の勝利！
            </p>
          </div>
        )}
      </div>

      {/* ゲーム結果サマリー */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">ゲーム結果</h2>
        <div className="grid gap-4">
          {match.games?.map((game: Game) => (
            <div key={game.id} className="border rounded p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">第{game.game_number}ゲーム</h3>
                {game.winner_team && (
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                    {game.winner_team === 'A' ? match.team_a : match.team_b}{' '}
                    勝利
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold mb-4">
                <span
                  className={game.winner_team === 'A' ? 'text-green-600' : ''}
                >
                  {game.points_a}
                </span>
                {' - '}
                <span
                  className={game.winner_team === 'B' ? 'text-green-600' : ''}
                >
                  {game.points_b}
                </span>
              </div>

              {/* ポイント詳細 */}
              {game.points && game.points.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">ポイント詳細</h4>
                  <div className="space-y-1">
                    {game.points
                      .sort((a, b) => a.point_number - b.point_number)
                      .map((point: Point) => (
                        <div
                          key={point.id}
                          className="flex items-center gap-4 text-sm p-2 bg-gray-50 rounded"
                        >
                          <span className="bg-blue-100 px-2 py-1 rounded">
                            {(() => {
                              // このポイント時点での両チームのスコアを計算
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

                              // このポイントで勝ったチームのポイントを+1
                              const finalTeamAPoints =
                                teamAPoints +
                                (point.winner_team === 'A' ? 1 : 0);
                              const finalTeamBPoints =
                                teamBPoints +
                                (point.winner_team === 'B' ? 1 : 0);

                              return `${finalTeamAPoints} - ${finalTeamBPoints}`;
                            })()}
                          </span>
                          <span>
                            {getResultTypeLabel(point.result_type || '')}
                          </span>
                          <span>{point.rally_count}ラリー</span>
                          {point.winner_player && (
                            <span className="text-blue-600">
                              {point.winner_player}
                            </span>
                          )}
                          {point.first_serve_fault && (
                            <span className="text-orange-600 text-xs">
                              1stフォルト
                            </span>
                          )}
                          {point.double_fault && (
                            <span className="text-red-600 text-xs">
                              ダブルフォルト
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 統計情報 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">基本統計情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{getTotalPoints()}</div>
            <div className="text-sm text-gray-600">総ポイント数</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded">
            <div className="text-2xl font-bold">
              {match.games?.filter((game) => game.winner_team === 'A').length} -{' '}
              {match.games?.filter((game) => game.winner_team === 'B').length}
            </div>
            <div className="text-sm text-gray-600">ゲーム数</div>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{getTotalRallies()}</div>
            <div className="text-sm text-gray-600">総ラリー数</div>
          </div>
        </div>
      </div>

      {/* 選手別統計情報 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">選手別統計情報</h2>
        <div className="space-y-4">
          {Object.entries(getPlayerStats()).map(([playerName, stats]) => (
            <div key={playerName} className="border rounded p-4">
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

      {/* ゲーム別統計情報 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">ゲーム別統計情報</h2>
        <div className="grid gap-4">
          {Object.entries(getGameStats()).map(([gameNumber, stats]) => (
            <div key={gameNumber} className="border rounded p-4">
              <h3 className="font-semibold text-lg mb-3">
                第{gameNumber}ゲーム
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded">
                  <div className="text-xl font-bold text-blue-600">
                    {stats.totalPoints}
                  </div>
                  <div className="text-sm text-blue-700">総ポイント</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded">
                  <div className="text-xl font-bold text-purple-600">
                    {stats.totalRallies}
                  </div>
                  <div className="text-sm text-purple-700">総ラリー数</div>
                </div>
                <div className="text-center p-3 bg-indigo-50 rounded">
                  <div className="text-xl font-bold text-indigo-600">
                    {stats.avgRallyLength.toFixed(1)}
                  </div>
                  <div className="text-sm text-indigo-700">平均ラリー</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded">
                  <div className="text-xl font-bold text-green-600">
                    {stats.winners}
                  </div>
                  <div className="text-sm text-green-700">ウィナー数</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded">
                  <div className="text-xl font-bold text-red-600">
                    {stats.errors}
                  </div>
                  <div className="text-sm text-red-700">ミス数</div>
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
