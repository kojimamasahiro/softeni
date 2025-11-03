import { useRouter } from 'next/router';
import { useCallback as reactUseCallback, useEffect, useState } from 'react';

import { isDebugMode } from '../../../../../lib/env';
import { Game, Match, Point } from '../../../../types/database';

// 構造化データから選手名を取得するヘルパー関数
const getPlayerNamesFromMatch = (match: Match, team: 'A' | 'B'): string[] => {
  // 構造化データから取得を試行
  if (match.teams && match.teams[team]) {
    return match.teams[team].players.map(
      (player) => `${player.last_name} ${player.first_name}`,
    );
  }

  // 個別フィールドから取得
  const players: string[] = [];
  const prefix = `team_${team.toLowerCase()}`;

  // プレイヤー1
  const player1LastName = match[
    `${prefix}_player1_last_name` as keyof Match
  ] as string;
  const player1FirstName = match[
    `${prefix}_player1_first_name` as keyof Match
  ] as string;

  if (player1LastName && player1FirstName) {
    players.push(`${player1LastName} ${player1FirstName}`);
  }

  // プレイヤー2（ダブルスの場合）
  const player2LastName = match[
    `${prefix}_player2_last_name` as keyof Match
  ] as string;
  const player2FirstName = match[
    `${prefix}_player2_first_name` as keyof Match
  ] as string;

  if (player2LastName && player2FirstName) {
    players.push(`${player2LastName} ${player2FirstName}`);
  }

  // フォールバック: 文字列から抽出
  if (players.length === 0) {
    const teamString = team === 'A' ? match.team_a : match.team_b;
    if (teamString) {
      try {
        const withoutEntryNumber = teamString.replace(/^[A-Za-z0-9]+\s+/, '');
        const playerParts = withoutEntryNumber.split(' / ');

        return playerParts
          .map((part) => {
            const playerMatch = part.trim().match(/^([^\(]+)/);
            return playerMatch ? playerMatch[1].trim() : part.trim();
          })
          .filter(Boolean);
      } catch (error) {
        console.warn('Failed to parse team string:', teamString, error);
        return [];
      }
    }
  }

  return players;
};

const MatchInput = () => {
  const router = useRouter();
  const { matchId } = router.query;

  const [match, setMatch] = useState<Match | null>(null);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // ポイント入力フォームの状態
  const [pointData, setPointData] = useState({
    winner_team: '',
    rally_count: 0,
    first_serve_fault: false,
    double_fault: false,
    result_type: '',
    winner_player: '',
    loser_player: '',
  });

  const fetchMatch = useCallback(async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}`);
      const data = await response.json();

      if (response.ok) {
        setMatch(data.match);
        // 現在進行中のゲームを見つける
        const activeGame = data.match.games?.find(
          (game: Game) => !game.winner_team,
        );
        setCurrentGame(
          activeGame || data.match.games?.[data.match.games.length - 1],
        );
      }
    } catch (error) {
      console.error('Failed to fetch match:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  // マッチデータの取得
  useEffect(() => {
    if (matchId && isDebugMode()) {
      fetchMatch();
    }
  }, [matchId, fetchMatch]);

  const submitPoint = async () => {
    if (!currentGame || !pointData.winner_team) return;

    setSubmitting(true);
    try {
      const nextPointNumber = (currentGame.points?.length || 0) + 1;

      const response = await fetch(`/api/matches/${matchId}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: currentGame.id,
          point_number: nextPointNumber,
          ...pointData,
        }),
      });

      if (response.ok) {
        // フォームリセット
        setPointData({
          winner_team: '',
          rally_count: 0,
          first_serve_fault: false,
          double_fault: false,
          result_type: '',
          winner_player: '',
          loser_player: '',
        });

        // マッチデータを再取得
        await fetchMatch();
      }
    } catch (error) {
      console.error('Failed to submit point:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // 試合終了判定
  const isMatchFinished = (match: Match): boolean => {
    if (!match.games || match.games.length === 0) return false;

    const gamesWonA = match.games.filter(
      (game: Game) => game.winner_team === 'A',
    ).length;
    const gamesWonB = match.games.filter(
      (game: Game) => game.winner_team === 'B',
    ).length;
    const requiredWins = Math.ceil(match.best_of / 2);

    return gamesWonA >= requiredWins || gamesWonB >= requiredWins;
  };

  // 試合の勝者を取得
  const getMatchWinner = (match: Match): 'A' | 'B' | null => {
    if (!isMatchFinished(match)) return null;

    const gamesWonA =
      match.games?.filter((game: Game) => game.winner_team === 'A').length || 0;
    const gamesWonB =
      match.games?.filter((game: Game) => game.winner_team === 'B').length || 0;
    const requiredWins = Math.ceil(match.best_of / 2);

    if (gamesWonA >= requiredWins) return 'A';
    if (gamesWonB >= requiredWins) return 'B';
    return null;
  };

  const startNewGame = async () => {
    if (!match) return;

    // 試合が終了している場合は新しいゲームを開始しない
    if (isMatchFinished(match)) {
      console.log('Match is already finished');
      return;
    }

    const nextGameNumber = (match.games?.length || 0) + 1;

    try {
      const response = await fetch(`/api/matches/${matchId}/games`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_number: nextGameNumber,
        }),
      });

      if (response.ok) {
        await fetchMatch();
      }
    } catch (error) {
      console.error('Failed to start new game:', error);
    }
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

  if (loading) return <div>Loading...</div>;
  if (!match) return <div>Match not found</div>;

  const currentScore = currentGame
    ? `${currentGame.points_a} - ${currentGame.points_b}`
    : '';
  const gameWon = currentGame?.winner_team;
  const matchFinished = isMatchFinished(match);
  const matchWinner = getMatchWinner(match);

  // ゲームスコア表示用
  const getGameScores = () => {
    if (!match.games) return '';

    const gamesWonA = match.games.filter(
      (game: Game) => game.winner_team === 'A',
    ).length;
    const gamesWonB = match.games.filter(
      (game: Game) => game.winner_team === 'B',
    ).length;

    return `${gamesWonA} - ${gamesWonB}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* マッチ情報 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">
          {match.team_a} vs {match.team_b}
        </h1>
        <p className="text-gray-600 mb-2">大会: {match.tournament_name}</p>
        <p className="text-gray-600">形式: {match.best_of} ゲームマッチ</p>

        {/* チーム詳細情報 */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded">
            <h3 className="font-semibold text-blue-800 mb-2">チーム A</h3>
            <div className="text-sm break-all">{match.team_a}</div>
          </div>
          <div className="p-3 bg-red-50 rounded">
            <h3 className="font-semibold text-red-800 mb-2">チーム B</h3>
            <div className="text-sm break-all">{match.team_b}</div>
          </div>
        </div>

        {/* ゲームスコア */}
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h3 className="font-semibold mb-2">ゲームスコア</h3>
          <div className="text-2xl font-bold text-center">
            {getGameScores()}
          </div>
        </div>
      </div>

      {/* 試合終了表示 */}
      {matchFinished && matchWinner && (
        <div className="bg-green-100 border border-green-400 rounded-lg p-6 mb-6 text-center">
          <h2 className="text-2xl font-bold text-green-800 mb-2">
            🏆 試合終了！
          </h2>
          <p className="text-xl text-green-700">
            {matchWinner === 'A' ? match.team_a : match.team_b} の勝利！
          </p>
          <p className="text-green-600 mt-2">ゲームスコア: {getGameScores()}</p>
        </div>
      )}

      {/* 現在のゲーム状況 */}
      {!matchFinished && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            第{currentGame?.game_number}ゲーム
          </h2>
          <div className="text-3xl font-bold text-center mb-4">
            {currentScore}
          </div>
          {gameWon && (
            <div className="text-center">
              <p className="text-lg text-green-600 font-semibold">
                チーム{gameWon}の勝利！
              </p>
              {!matchFinished && (
                <button
                  onClick={startNewGame}
                  className="mt-4 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
                >
                  次のゲームを開始
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ポイント入力フォーム */}
      {!gameWon && !matchFinished && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-6 text-center">
            ポイント記録
          </h3>

          {/* 勝者チーム選択 */}
          <div className="mb-6">
            <h4 className="text-md font-medium mb-3 text-center">勝者チーム</h4>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setPointData({ ...pointData, winner_team: 'A' })}
                className={`p-4 border-2 rounded-lg font-semibold transition-all ${
                  pointData.winner_team === 'A'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                <div className="text-lg">チーム A</div>
                <div className="text-sm text-gray-600 mt-1">
                  {match.team_a?.split(' ')[0] || 'チームA'}
                </div>
              </button>
              <button
                onClick={() => setPointData({ ...pointData, winner_team: 'B' })}
                className={`p-4 border-2 rounded-lg font-semibold transition-all ${
                  pointData.winner_team === 'B'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-300 hover:border-red-300 hover:bg-red-50'
                }`}
              >
                <div className="text-lg">チーム B</div>
                <div className="text-sm text-gray-600 mt-1">
                  {match.team_b?.split(' ')[0] || 'チームB'}
                </div>
              </button>
            </div>
          </div>

          {/* 結果タイプ */}
          <div className="mb-6">
            <h4 className="text-md font-medium mb-3 text-center">結果</h4>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'winner', label: '決定打', color: 'green' },
                { value: 'forced_error', label: 'ミス誘発', color: 'blue' },
                { value: 'unforced_error', label: '凡ミス', color: 'orange' },
                { value: 'net', label: 'ネット', color: 'red' },
                { value: 'out', label: 'アウト', color: 'red' },
                {
                  value: 'double_fault',
                  label: 'ダブルフォルト',
                  color: 'purple',
                },
              ].map(({ value, label, color }) => (
                <button
                  key={value}
                  onClick={() =>
                    setPointData({ ...pointData, result_type: value })
                  }
                  className={`p-3 border-2 rounded-lg font-medium transition-all ${
                    pointData.result_type === value
                      ? `border-${color}-500 bg-${color}-50 text-${color}-700`
                      : `border-gray-300 hover:border-${color}-300 hover:bg-${color}-50`
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 勝者選手名 */}
          <div className="mb-6">
            <h4 className="text-md font-medium mb-3 text-center">勝者選手</h4>
            {pointData.winner_team ? (
              <div className="grid grid-cols-2 gap-3">
                {getPlayerNamesFromMatch(
                  match,
                  pointData.winner_team as 'A' | 'B',
                ).map((playerName: string, index: number) => (
                  <button
                    key={index}
                    onClick={() =>
                      setPointData({
                        ...pointData,
                        winner_player: playerName,
                      })
                    }
                    className={`p-3 border-2 rounded-lg font-medium transition-all ${
                      pointData.winner_player === playerName
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-300 hover:border-purple-300 hover:bg-purple-50'
                    }`}
                  >
                    {playerName}
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-gray-100 text-gray-500 text-center rounded-lg">
                まず勝者チームを選択してください
              </div>
            )}
          </div>

          {/* ラリー数 */}
          <div className="mb-6">
            <h4 className="text-md font-medium mb-3 text-center">ラリー数</h4>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  onClick={() =>
                    setPointData({ ...pointData, rally_count: count })
                  }
                  className={`p-3 border-2 rounded-lg font-medium transition-all ${
                    pointData.rally_count === count
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm">その他:</span>
              <input
                type="number"
                value={pointData.rally_count > 5 ? pointData.rally_count : ''}
                onChange={(e) =>
                  setPointData({
                    ...pointData,
                    rally_count: parseInt(e.target.value) || 1,
                  })
                }
                className="flex-1 border rounded p-2"
                min="6"
                placeholder="6以上の場合"
              />
            </div>
          </div>

          {/* サーブ関連 */}
          <div className="mt-4 flex gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={pointData.first_serve_fault}
                onChange={(e) =>
                  setPointData({
                    ...pointData,
                    first_serve_fault: e.target.checked,
                  })
                }
                className="mr-2"
              />
              1stサーブフォルト
            </label>
          </div>

          {/* 送信ボタン */}
          <button
            onClick={submitPoint}
            disabled={!pointData.winner_team || submitting}
            className="mt-6 bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            {submitting ? '記録中...' : 'ポイント記録'}
          </button>
        </div>
      )}

      {/* ゲーム履歴 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">ゲーム履歴</h3>
        <div className="space-y-4">
          {match.games?.map((game: Game) => (
            <div key={game.id} className="border rounded p-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold">第{game.game_number}ゲーム</h4>
                <div className="text-lg font-bold">
                  {game.points_a} - {game.points_b}
                  {game.winner_team && (
                    <span className="ml-2 text-green-600">
                      (チーム{game.winner_team}勝利)
                    </span>
                  )}
                </div>
              </div>

              {/* ポイント履歴 */}
              {game.points && game.points.length > 0 && (
                <div className="mt-2">
                  <h5 className="text-sm font-medium mb-2">ポイント詳細:</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                    {game.points.map((point: Point) => (
                      <div key={point.id} className="bg-gray-50 rounded p-2">
                        <div className="flex justify-between">
                          <span>#{point.point_number}</span>
                          <span className="font-medium">
                            チーム{point.winner_team}
                          </span>
                        </div>
                        <div className="text-xs text-gray-600">
                          {point.result_type} ({point.rally_count}ラリー)
                          {point.winner_player && (
                            <span> - {point.winner_player}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {(!match.games || match.games.length === 0) && (
            <div className="text-center text-gray-500 py-4">
              まだゲームが開始されていません
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchInput;
function useCallback(
  callback: () => Promise<void>,
  dependencies: (string | string[] | undefined)[],
) {
  return reactUseCallback(callback, dependencies);
}
