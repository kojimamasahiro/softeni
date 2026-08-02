import { getPlayerNameFromId } from '../../../../lib/matchLogic';
import { formatVideoTimestamp } from '../../../../lib/youtubePlayback';
import type { Game, Point } from '../../../types/database';
import type { ServingPlayerInfo } from './types';

type GameHistorySectionProps = {
  sortedGames: Game[];
  currentGame: Game | null;
  canEditMatches: boolean;
  isPointInputActive: boolean;
  activeYouTubeVideoId: string | null;
  youtubeEmbedBlocked: boolean;
  onEditPoint: (game: Game, point: Point) => void;
  onJumpToPointVideo: (point: Point) => void;
  getServingPlayerForPoint: (game: Game, pointNumber: number) => ServingPlayerInfo;
};

const GameHistorySection = ({
  sortedGames,
  currentGame,
  canEditMatches,
  isPointInputActive,
  activeYouTubeVideoId,
  youtubeEmbedBlocked,
  onEditPoint,
  onJumpToPointVideo,
  getServingPlayerForPoint,
}: GameHistorySectionProps) => (
  <div className={`rounded-lg bg-white p-6 shadow-md ${isPointInputActive ? 'mt-4 xl:col-start-2 xl:mt-0' : ''}`}>
    <h3 className="mb-4 text-lg font-semibold">ゲーム履歴</h3>
    <div className="space-y-4">
      {sortedGames.map((game: Game) => (
        <div key={game.id} className="rounded border p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">第{game.game_number}ゲーム</h4>
              {currentGame?.id === game.id && <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">現在のゲーム</span>}
            </div>
            <div className="text-lg font-bold">
              {game.points_a} - {game.points_b}
              {game.winner_team && <span className="ml-2 text-green-600">(チーム{game.winner_team}勝利)</span>}
            </div>
          </div>

          {game.points && game.points.length > 0 ? (
            <div className="mt-2">
              <h5 className="mb-2 text-sm font-medium">ポイント詳細:</h5>
              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 lg:grid-cols-3">
                {game.points
                  .sort((a, b) => a.point_number - b.point_number)
                  .map((point: Point) => (
                    <div key={point.id} className="rounded bg-gray-50 p-2">
                      <div className="flex items-center justify-between">
                        <span>#{point.point_number}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">チーム{point.winner_team}</span>
                          {canEditMatches && (
                            <button
                              onClick={() => onEditPoint(game, point)}
                              className="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
                              title="このポイントを編集"
                            >
                              編集
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">
                        {(() => {
                          const servingPlayer = getServingPlayerForPoint(game, point.point_number);
                          return servingPlayer ? `${servingPlayer.playerName} (チーム${point.serving_team})` : `チーム${point.serving_team}のサーブ`;
                        })()}
                      </div>
                      <div className="text-xs text-gray-600">
                        {point.result_type} ({point.rally_count}ラリー)
                        {point.winner_player && (
                          <span> - {point.winner_player.includes('-') ? getPlayerNameFromId(point.winner_player) : point.winner_player}</span>
                        )}
                      </div>
                      {(point.video_start_ms !== null || point.video_end_ms !== null) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-gray-500">
                            動画:
                            {point.video_start_ms !== null ? ` ${formatVideoTimestamp(point.video_start_ms, true)}` : ' -'}
                            {point.video_end_ms !== null && ` - ${formatVideoTimestamp(point.video_end_ms, true)}`}
                          </span>
                          {activeYouTubeVideoId && !youtubeEmbedBlocked && (
                            <button
                              type="button"
                              onClick={() => onJumpToPointVideo(point)}
                              className="rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-600"
                            >
                              {point.video_end_ms !== null ? 'この範囲を再生' : 'この時刻へ移動'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ) : currentGame?.id === game.id ? (
            <div className="mt-2 rounded bg-blue-50 px-3 py-4 text-center text-sm text-blue-700">現在のゲームはまだポイントがありません</div>
          ) : null}
        </div>
      ))}

      {sortedGames.length === 0 && <div className="py-4 text-center text-gray-500">まだゲームが開始されていません</div>}
    </div>
  </div>
);

export default GameHistorySection;
