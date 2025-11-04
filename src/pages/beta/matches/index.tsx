import Link from 'next/link';
import { useEffect, useState } from 'react';

import { isDebugMode } from '../../../../lib/env';
import { Game, Match } from '../../../types/database';

const MatchList = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // 開発環境でない場合はアクセス拒否
  useEffect(() => {
    if (isDebugMode()) {
      fetchMatches();
    }
  }, []);

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

  const fetchMatches = async () => {
    try {
      const response = await fetch('/api/matches');
      const data = await response.json();

      if (response.ok) {
        setMatches(data.matches);
      }
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteMatch = async (matchId: string) => {
    if (
      !confirm(
        '本当にこのマッチを削除しますか？\n関連するゲームやポイントデータもすべて削除されます。',
      )
    ) {
      return;
    }

    setDeleting(matchId);
    try {
      const response = await fetch(`/api/matches/${matchId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 一覧から削除
        setMatches(matches.filter((match) => match.id !== matchId));
      } else {
        const data = await response.json();
        alert(`削除に失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to delete match:', error);
      alert('削除に失敗しました');
    } finally {
      setDeleting(null);
    }
  };

  const getMatchStatus = (match: Match) => {
    if (!match.games || match.games.length === 0) return '未開始';

    const gamesWonA = match.games.filter(
      (game: Game) => game.winner_team === 'A',
    ).length;
    const gamesWonB = match.games.filter(
      (game: Game) => game.winner_team === 'B',
    ).length;
    const requiredWins = Math.ceil(match.best_of / 2);

    if (gamesWonA >= requiredWins || gamesWonB >= requiredWins) {
      return `終了 (${gamesWonA}-${gamesWonB})`;
    }

    const currentGame = match.games.find((game: Game) => !game.winner_team);
    if (currentGame) {
      return `進行中 第${currentGame.game_number}ゲーム (${currentGame.points_a}-${currentGame.points_b})`;
    }

    return `${gamesWonA}-${gamesWonB}`;
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">マッチ一覧</h1>
        <Link
          href="/beta/matches/create"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          新しいマッチを作成
        </Link>
      </div>

      <div className="grid gap-4">
        {matches.map((match) => (
          <div key={match.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  {match.team_a} vs {match.team_b}
                </h3>
                <p className="text-gray-600 mb-2">{match.tournament_name}</p>
                <p className="text-sm text-gray-500">
                  {match.best_of}ゲームマッチ | {getMatchStatus(match)}
                </p>
              </div>

              <div className="flex gap-2">
                <Link
                  href={`/beta/matches/${match.id}/input`}
                  className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                >
                  記録入力
                </Link>
                <Link
                  href={`/beta/matches/${match.id}`}
                  className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                >
                  詳細表示
                </Link>
                <button
                  onClick={() => deleteMatch(match.id)}
                  disabled={deleting === match.id}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 disabled:bg-gray-300"
                >
                  {deleting === match.id ? '削除中...' : '削除'}
                </button>
              </div>
            </div>

            {/* ゲームスコア表示 */}
            {match.games && match.games.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex gap-2">
                  {match.games.map((game: Game) => (
                    <div key={game.id} className="text-sm">
                      <span className="font-medium">G{game.game_number}:</span>
                      <span
                        className={game.winner_team === 'A' ? 'font-bold' : ''}
                      >
                        {game.points_a}
                      </span>
                      -
                      <span
                        className={game.winner_team === 'B' ? 'font-bold' : ''}
                      >
                        {game.points_b}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {matches.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">まだマッチがありません</p>
            <Link
              href="/beta/matches/create"
              className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
            >
              最初のマッチを作成
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchList;
