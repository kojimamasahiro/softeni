import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback as reactUseCallback, useEffect, useState } from 'react';

import { isDebugMode } from '../../../../../lib/env';
import { Game, Match, Point } from '../../../../types/database';

const MatchDetail = () => {
  const router = useRouter();
  const { matchId } = router.query;

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMatch = useCallback(async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}`);
      const data = await response.json();

      if (response.ok) {
        setMatch(data.match);
      }
    } catch (error) {
      console.error('Failed to fetch match:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (matchId && isDebugMode()) {
      fetchMatch();
    }
  }, [matchId, fetchMatch]);
  const getMatchWinner = () => {
    if (!match?.games) return null;

    const gamesWonA = match.games.filter(
      (game) => game.winner_team === 'A',
    ).length;
    const gamesWonB = match.games.filter(
      (game) => game.winner_team === 'B',
    ).length;
    const requiredWins = Math.ceil(match.best_of / 2);

    if (gamesWonA >= requiredWins) return 'A';
    if (gamesWonB >= requiredWins) return 'B';
    return null;
  };

  const getResultTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      winner: '決定打',
      forced_error: 'ミス誘発',
      unforced_error: '凡ミス',
      net: 'ネット',
      out: 'アウト',
    };
    return labels[type] || type;
  };

  // 開発環境でない場合はアクセス拒否
  if (!isDebugMode()) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">アクセス拒否</strong>
          <span className="block sm:inline ml-2">
            この機能は開発環境でのみ利用可能です。
          </span>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (!match) return <div className="p-6">Match not found</div>;

  const matchWinner = getMatchWinner();

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center mb-6">
        <Link href="/beta/matches" className="text-blue-500 hover:underline">
          ← マッチ一覧に戻る
        </Link>
        <Link
          href={`/beta/matches/${matchId}/input`}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          記録入力
        </Link>
      </div>

      {/* マッチ情報 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">
          {match.team_a} vs {match.team_b}
        </h1>
        <p className="text-gray-600 mb-2">大会: {match.tournament_name}</p>
        <p className="text-gray-600 mb-4">形式: {match.best_of} ゲームマッチ</p>

        {matchWinner && (
          <div className="bg-green-100 border border-green-400 rounded p-4">
            <p className="text-lg font-semibold text-green-800">
              🏆 チーム{matchWinner} (
              {matchWinner === 'A' ? match.team_a : match.team_b}) の勝利！
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
                    チーム{game.winner_team}勝利
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
                  <h4 className="font-medium mb-2">ポイント履歴</h4>
                  <div className="space-y-1">
                    {game.points.map((point: Point) => (
                      <div
                        key={point.id}
                        className="flex items-center gap-4 text-sm p-2 bg-gray-50 rounded"
                      >
                        <span className="font-medium">
                          #{point.point_number}
                        </span>
                        <span className="bg-blue-100 px-2 py-1 rounded">
                          チーム{point.winner_team}
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">統計情報</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded">
            <div className="text-2xl font-bold">
              {match.games?.reduce(
                (sum, game) => sum + (game.points?.length || 0),
                0,
              )}
            </div>
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
            <div className="text-2xl font-bold">
              {match.games?.reduce(
                (sum, game) =>
                  sum +
                  (game.points?.reduce(
                    (pSum, point) => pSum + (point.rally_count || 0),
                    0,
                  ) || 0),
                0,
              )}
            </div>
            <div className="text-sm text-gray-600">総ラリー数</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchDetail;
function useCallback(
  callback: () => Promise<void>,
  dependencies: (string | string[] | undefined)[],
) {
  return reactUseCallback(callback, dependencies);
}
