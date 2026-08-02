import type { Game, Match } from '../../../types/database';

type GameScoreSummaryPanelProps = {
  match: Match;
  currentGame: Game;
  isPointInputActive: boolean;
  currentScore: string;
  gameScores: string;
  gameWon: string | null;
  matchFinished: boolean;
  getCurrentServe: () => 'A' | 'B' | null;
  onStartNewGame: () => void;
};

/**
 * 非デスクトップ動画レイアウト時に表示する「ゲームスコア」「現在のゲーム状況」の並び。
 */
const GameScoreSummaryPanel = ({
  match,
  currentGame,
  isPointInputActive,
  currentScore,
  gameScores,
  gameWon,
  matchFinished,
  getCurrentServe,
  onStartNewGame,
}: GameScoreSummaryPanelProps) => (
  <div className={`mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 ${isPointInputActive ? 'xl:hidden' : ''}`}>
    {/* ゲームスコア */}
    <div className="flex h-40 flex-col rounded-lg bg-white p-4 shadow-md">
      <h3 className="mb-3 text-lg font-semibold">ゲームスコア</h3>
      <div className="mb-3 text-center text-2xl font-bold">{gameScores}</div>
      {match.games && match.games.length > 0 && (
        <div className="flex-1 space-y-2 overflow-y-auto pr-2">
          {match.games.map((game: Game) => (
            <div key={game.id} className="flex items-center justify-between rounded bg-gray-50 p-2">
              <span className="text-sm font-medium">第{game.game_number}ゲーム</span>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-bold ${game.winner_team === 'A' ? 'text-blue-600' : ''}`}>{game.points_a}</span>
                <span className="text-sm">-</span>
                <span className={`text-sm font-bold ${game.winner_team === 'B' ? 'text-red-600' : ''}`}>{game.points_b}</span>
                {game.winner_team && <span className="ml-2 text-xs text-green-600">✓</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* 現在のゲーム状況 */}
    <div className="h-40 rounded-lg bg-white p-4 shadow-md">
      <h2 className="mb-3 text-lg font-semibold">第{currentGame?.game_number}ゲーム</h2>

      {currentGame?.initial_serve_team && (
        <div
          className={`mb-3 rounded-lg p-3 ${
            getCurrentServe() === 'A' ? 'border border-blue-200 bg-blue-50 text-blue-700' : 'border border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <div className="text-center">
            <div className="mt-1 text-sm">チーム{getCurrentServe()}のサーブ</div>
          </div>
        </div>
      )}

      <div className="mb-3 text-center text-2xl font-bold">{currentScore}</div>
      {gameWon && (
        <div className="text-center">
          <p className="text-lg font-semibold text-green-600">チーム{gameWon}の勝利！</p>
          {!matchFinished && (
            <button onClick={onStartNewGame} className="mt-4 rounded bg-blue-500 px-6 py-2 text-white hover:bg-blue-600">
              次のゲームを開始
            </button>
          )}
        </div>
      )}
    </div>
  </div>
);

export default GameScoreSummaryPanel;
