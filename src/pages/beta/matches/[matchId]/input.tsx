import { useRouter } from 'next/router';
import { useCallback as reactUseCallback, useEffect, useState } from 'react';

import { isDebugMode } from '../../../../../lib/env';
import {
  determineInitialServeTeam,
  getCurrentServingTeam,
  getServeDisplayText,
} from '../../../../../lib/serveHelpers';
import ServeSelection from '../../../../components/ServeSelection';
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
  const [needsServeSelection, setNeedsServeSelection] = useState(false);
  const [initialServeTeam, setInitialServeTeam] = useState<'A' | 'B' | null>(
    null,
  );

  // ポイント入力フォームの状態
  // 関与選手
  const [pointData, setPointData] = useState({
    winner_team: '',
    serving_team: '',
    rally_count: 0,
    first_serve_fault: false,
    double_fault: false,
    result_type: '',
    winner_player: '',
    loser_player: '',
  });

  // 関与選手とプレイタイプから勝者チームを自動決定する関数
  const determineWinnerTeam = (
    playerName: string,
    resultType: string,
  ): 'A' | 'B' | null => {
    if (!playerName || !resultType || !match) return null;

    // 選手がどのチームに所属しているかを判定
    const teamAPlayers = getPlayerNamesFromMatch(match, 'A');
    const teamBPlayers = getPlayerNamesFromMatch(match, 'B');

    let playerTeam: 'A' | 'B' | null = null;
    if (teamAPlayers.includes(playerName)) {
      playerTeam = 'A';
    } else if (teamBPlayers.includes(playerName)) {
      playerTeam = 'B';
    }

    if (!playerTeam) return null;

    // ウィナー系の結果タイプ
    const winnerTypes = [
      'smash_winner',
      'volley_winner',
      'passing_winner',
      'drop_winner',
    ];

    // ミス系の結果タイプ
    const errorTypes = [
      'net',
      'out',
      'smash_error',
      'volley_error',
      'double_fault',
    ];

    if (winnerTypes.includes(resultType)) {
      // ウィナーの場合、その選手のチームが勝者
      return playerTeam;
    } else if (errorTypes.includes(resultType)) {
      // ミスの場合、相手チームが勝者
      return playerTeam === 'A' ? 'B' : 'A';
    }

    return null;
  };

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
        const currentGameData =
          activeGame || data.match.games?.[data.match.games.length - 1];
        setCurrentGame(currentGameData);

        // サーブ権が設定されていない場合は選択が必要
        if (currentGameData && !currentGameData.initial_serve_team) {
          setNeedsServeSelection(true);
        } else {
          setNeedsServeSelection(false);
        }

        // 第1ゲームの初期サーブ権を保存
        const firstGame = data.match.games?.find(
          (game: Game) => game.game_number === 1,
        );
        if (firstGame?.initial_serve_team) {
          setInitialServeTeam(firstGame.initial_serve_team as 'A' | 'B');
        }
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
    if (!currentGame || !pointData.winner_team || !match) return;

    setSubmitting(true);
    try {
      const nextPointNumber = (currentGame.points?.length || 0) + 1;

      // ゲームスコアを計算
      const gamesWonA =
        match.games?.filter((game: Game) => game.winner_team === 'A').length ||
        0;
      const gamesWonB =
        match.games?.filter((game: Game) => game.winner_team === 'B').length ||
        0;

      // 現在のサーブ権を計算
      const currentServingTeam = getCurrentServingTeam(
        currentGame,
        nextPointNumber,
        match.best_of,
        gamesWonA,
        gamesWonB,
      );

      const response = await fetch(`/api/matches/${matchId}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: currentGame.id,
          point_number: nextPointNumber,
          serving_team: currentServingTeam,
          winner_team: pointData.winner_team,
          rally_count: pointData.rally_count,
          first_serve_fault: pointData.first_serve_fault,
          double_fault: pointData.double_fault,
          result_type: pointData.result_type,
          winner_player: pointData.winner_player,
          loser_player: pointData.loser_player,
        }),
      });

      if (response.ok) {
        // フォームリセット
        setPointData({
          winner_team: '',
          serving_team: '',
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

  // サーブ権を決定してゲームを開始
  const handleServeTeamSelected = async (selectedTeam: 'A' | 'B') => {
    if (!match) return;

    const gameToUpdate = currentGame;
    if (!gameToUpdate) return;

    try {
      // 第1ゲームの場合は選択されたチーム、それ以外は自動計算
      let initialServe: 'A' | 'B';
      if (gameToUpdate.game_number === 1) {
        initialServe = selectedTeam;
        setInitialServeTeam(selectedTeam);
      } else {
        // 前のゲームの初期サーブ権から計算
        if (!initialServeTeam) {
          console.error('Initial serve team not set');
          return;
        }
        initialServe = determineInitialServeTeam(
          gameToUpdate.game_number,
          initialServeTeam,
        );
      }

      // ゲームのサーブ権を更新
      const response = await fetch(
        `/api/matches/${matchId}/games/${gameToUpdate.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initial_serve_team: initialServe,
          }),
        },
      );

      if (response.ok) {
        await fetchMatch();
        setNeedsServeSelection(false);
      }
    } catch (error) {
      console.error('Failed to set serve team:', error);
    }
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

  // 現在のサーブ権を取得
  const getCurrentServe = (): 'A' | 'B' | null => {
    if (!currentGame || !currentGame.initial_serve_team || !match) return null;

    const nextPointNumber = (currentGame.points?.length || 0) + 1;
    const gamesWonA =
      match.games?.filter((game: Game) => game.winner_team === 'A').length || 0;
    const gamesWonB =
      match.games?.filter((game: Game) => game.winner_team === 'B').length || 0;

    return getCurrentServingTeam(
      currentGame,
      nextPointNumber,
      match.best_of,
      gamesWonA,
      gamesWonB,
    );
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

      {/* サーブ権選択 */}
      {needsServeSelection && match && currentGame && (
        <ServeSelection
          teamA={match.team_a || 'チーム A'}
          teamB={match.team_b || 'チーム B'}
          gameNumber={currentGame.game_number}
          onServeTeamSelected={handleServeTeamSelected}
        />
      )}

      {/* ゲームスコアと現在のゲーム状況を横並びで表示 */}
      {!matchFinished && !needsServeSelection && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* ゲームスコア */}
          <div className="bg-white rounded-lg shadow-md p-4 h-40 flex flex-col">
            <h3 className="text-lg font-semibold mb-3">ゲームスコア</h3>
            <div className="text-2xl font-bold text-center mb-3">
              {getGameScores()}
            </div>
            {/* 各ゲームの詳細スコア */}
            {match.games && match.games.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {match.games.map((game: Game) => (
                  <div
                    key={game.id}
                    className="flex justify-between items-center p-2 bg-gray-50 rounded"
                  >
                    <span className="text-sm font-medium">
                      第{game.game_number}ゲーム
                    </span>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-sm font-bold ${
                          game.winner_team === 'A' ? 'text-blue-600' : ''
                        }`}
                      >
                        {game.points_a}
                      </span>
                      <span className="text-sm">-</span>
                      <span
                        className={`text-sm font-bold ${
                          game.winner_team === 'B' ? 'text-red-600' : ''
                        }`}
                      >
                        {game.points_b}
                      </span>
                      {game.winner_team && (
                        <span className="text-xs text-green-600 ml-2">✓</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 現在のゲーム状況 */}
          <div className="bg-white rounded-lg shadow-md p-4 h-40">
            <h2 className="text-lg font-semibold mb-3">
              第{currentGame?.game_number}ゲーム
            </h2>

            {/* サーブ権表示 */}
            {currentGame?.initial_serve_team && match && (
              <div
                className={`rounded-lg p-3 mb-3 ${
                  getCurrentServe() === 'A'
                    ? 'bg-blue-50 border border-blue-200 text-blue-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                <div className="text-center">
                  {getServeDisplayText(getCurrentServe() || 'A')}
                </div>
              </div>
            )}

            <div className="text-2xl font-bold text-center mb-3">
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
        </div>
      )}

      {/* ポイント入力フォーム */}
      {!gameWon && !matchFinished && !needsServeSelection && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h3 className="text-lg font-semibold mb-4 text-center">
            ポイント記録
          </h3>

          {/* サーブ情報 */}
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2 text-center">サーブ情報</h4>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() =>
                  setPointData({
                    ...pointData,
                    first_serve_fault: !pointData.first_serve_fault,
                  })
                }
                className={`p-2 border-2 rounded font-medium transition-all text-xs ${
                  pointData.first_serve_fault
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-300 hover:border-orange-300'
                }`}
              >
                1stフォルト
              </button>
              <button
                onClick={() => {
                  const currentServe = getCurrentServe();
                  const oppositeTeam = currentServe === 'A' ? 'B' : 'A';
                  setPointData({
                    ...pointData,
                    result_type: 'double_fault',
                    winner_team: oppositeTeam,
                    rally_count: 1,
                  });
                }}
                className={`p-2 border-2 rounded font-medium transition-all text-xs ${
                  pointData.result_type === 'double_fault'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-300 hover:border-purple-300'
                }`}
              >
                ダブルフォルト
              </button>
            </div>
          </div>

          {/* 勝者チーム */}
          <div className="mb-4">
            <div className="text-center mb-2">
              <h4 className="text-sm font-medium">勝者チーム</h4>
              {pointData.winner_player && pointData.result_type && (
                <p className="text-xs text-gray-500 mt-1">
                  💡 関与選手と結果から自動判定されます
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={() => setPointData({ ...pointData, winner_team: 'A' })}
                className={`p-3 border-2 rounded font-medium transition-all ${
                  pointData.winner_team === 'A'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-blue-300'
                }`}
              >
                チーム A
              </button>
              <button
                onClick={() => setPointData({ ...pointData, winner_team: 'B' })}
                className={`p-3 border-2 rounded font-medium transition-all ${
                  pointData.winner_team === 'B'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-300 hover:border-red-300'
                }`}
              >
                チーム B
              </button>
            </div>
          </div>

          {/* ラリー数 */}
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2 text-center">ラリー数</h4>
            <div className="overflow-x-auto">
              <div
                className="flex gap-1 pb-2"
                style={{ minWidth: 'max-content' }}
              >
                {Array.from({ length: 100 }, (_, i) => i + 1).map((count) => (
                  <button
                    key={count}
                    onClick={() =>
                      setPointData({ ...pointData, rally_count: count })
                    }
                    className={`flex-shrink-0 w-8 h-8 border-2 rounded font-medium transition-all text-xs ${
                      pointData.rally_count === count
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-300 hover:border-indigo-300'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ウィナー & ミス */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            {/* ウィナー */}
            <div>
              <h4 className="text-sm font-medium mb-2 text-center text-green-600">
                ウィナー
              </h4>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { value: 'smash_winner', label: 'スマッシュ' },
                  { value: 'volley_winner', label: 'ボレー' },
                  { value: 'passing_winner', label: 'パッシング' },
                  { value: 'drop_winner', label: 'ドロップ' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      const newData = { ...pointData, result_type: value };
                      // 関与選手が設定されていれば勝者チームを自動決定
                      if (pointData.winner_player) {
                        const autoWinner = determineWinnerTeam(
                          pointData.winner_player,
                          value,
                        );
                        if (autoWinner) {
                          newData.winner_team = autoWinner;
                        }
                      }
                      setPointData(newData);
                    }}
                    className={`p-2 border-2 rounded font-medium transition-all text-xs ${
                      pointData.result_type === value
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 hover:border-green-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* ミス */}
            <div>
              <h4 className="text-sm font-medium mb-2 text-center text-red-600">
                ミス
              </h4>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { value: 'net', label: 'ネット' },
                  { value: 'out', label: 'アウト' },
                  { value: 'smash_error', label: 'スマ失敗' },
                  { value: 'volley_error', label: 'ボレ失敗' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      const newData = { ...pointData, result_type: value };
                      // 関与選手が設定されていれば勝者チームを自動決定
                      if (pointData.winner_player) {
                        const autoWinner = determineWinnerTeam(
                          pointData.winner_player,
                          value,
                        );
                        if (autoWinner) {
                          newData.winner_team = autoWinner;
                        }
                      }
                      setPointData(newData);
                    }}
                    className={`p-2 border-2 rounded font-medium transition-all text-xs ${
                      pointData.result_type === value
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 関与選手 */}
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2 text-center">関与選手</h4>
            <div className="grid grid-cols-2 gap-2">
              {/* チームA選手 */}
              <div>
                <h5 className="text-xs font-medium mb-1 text-center text-blue-600">
                  チーム A
                </h5>
                <div className="grid grid-cols-2 gap-1">
                  {getPlayerNamesFromMatch(match, 'A').map(
                    (playerName: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => {
                          const newData = {
                            ...pointData,
                            winner_player: playerName,
                          };
                          // 結果タイプが設定されていれば勝者チームを自動決定
                          if (pointData.result_type) {
                            const autoWinner = determineWinnerTeam(
                              playerName,
                              pointData.result_type,
                            );
                            if (autoWinner) {
                              newData.winner_team = autoWinner;
                            }
                          }
                          setPointData(newData);
                        }}
                        className={`p-1 border-2 rounded font-medium transition-all text-xs ${
                          pointData.winner_player === playerName
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-300 hover:border-blue-300'
                        }`}
                      >
                        {playerName}
                      </button>
                    ),
                  )}
                </div>
              </div>
              {/* チームB選手 */}
              <div>
                <h5 className="text-xs font-medium mb-1 text-center text-red-600">
                  チーム B
                </h5>
                <div className="grid grid-cols-2 gap-1">
                  {getPlayerNamesFromMatch(match, 'B').map(
                    (playerName: string, index: number) => (
                      <button
                        key={index}
                        onClick={() => {
                          const newData = {
                            ...pointData,
                            winner_player: playerName,
                          };
                          // 結果タイプが設定されていれば勝者チームを自動決定
                          if (pointData.result_type) {
                            const autoWinner = determineWinnerTeam(
                              playerName,
                              pointData.result_type,
                            );
                            if (autoWinner) {
                              newData.winner_team = autoWinner;
                            }
                          }
                          setPointData(newData);
                        }}
                        className={`p-1 border-2 rounded font-medium transition-all text-xs ${
                          pointData.winner_player === playerName
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-300 hover:border-red-300'
                        }`}
                      >
                        {playerName}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
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
                          🏓 {point.serving_team}のサーブ
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
