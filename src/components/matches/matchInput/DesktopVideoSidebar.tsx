import type { Dispatch, RefObject, SetStateAction } from 'react';

import type { YouTubeRangePlayerHandle } from '../../YouTubeRangePlayer';
import type { Game } from '../../../types/database';
import type { PointDataState, ServingPlayerInfo } from './types';
import VideoTimeRangeInputs from './VideoTimeRangeInputs';
import YoutubeHelperPanel from './YoutubeHelperPanel';

type DesktopVideoSidebarProps = {
  activeYouTubeVideoId: string | null;
  playerRef: RefObject<YouTubeRangePlayerHandle | null>;
  onReady: () => void;
  youtubeEmbedBlocked: boolean;
  youtubeUrl: string;
  onEmbedBlocked: () => void;
  onResume: () => void;
  onPause: () => void;
  pointData: PointDataState;
  setPointData: Dispatch<SetStateAction<PointDataState>>;
  getVideoStartInput: () => string;
  getVideoEndInput: () => string;
  currentGame: Game | null;
  gameScores: string;
  currentScore: string;
  getCurrentServe: () => 'A' | 'B' | null;
  getCurrentServingPlayer: () => ServingPlayerInfo;
  gameWon: string | null;
  matchFinished: boolean;
  onStartNewGame: () => void;
};

/**
 * xl 以上の画面幅で、YouTube再生・動画時刻入力・簡易ゲーム状況を左カラムに固定表示するサイドバー。
 */
const DesktopVideoSidebar = ({
  activeYouTubeVideoId,
  playerRef,
  onReady,
  youtubeEmbedBlocked,
  youtubeUrl,
  onEmbedBlocked,
  onResume,
  onPause,
  pointData,
  setPointData,
  getVideoStartInput,
  getVideoEndInput,
  currentGame,
  gameScores,
  currentScore,
  getCurrentServe,
  getCurrentServingPlayer,
  gameWon,
  matchFinished,
  onStartNewGame,
}: DesktopVideoSidebarProps) => (
  <div className="hidden xl:flex xl:h-[calc(100vh-2rem)] xl:min-h-0 xl:flex-col xl:gap-4">
    {activeYouTubeVideoId && (
      <YoutubeHelperPanel
        wrapperClassName="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-md"
        videoId={activeYouTubeVideoId}
        playerRef={playerRef}
        playerHeight={590}
        onReady={onReady}
        youtubeEmbedBlocked={youtubeEmbedBlocked}
        youtubeUrl={youtubeUrl}
        onEmbedBlocked={onEmbedBlocked}
        onResume={onResume}
        onPause={onPause}
      />
    )}

    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-md">
      <VideoTimeRangeInputs
        pointData={pointData}
        onChange={(updates) => setPointData({ ...pointData, ...updates })}
        startInputValue={getVideoStartInput()}
        endInputValue={getVideoEndInput()}
      />
    </div>

    <div className="rounded-lg bg-white p-4 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">第{currentGame?.game_number}ゲーム</h3>
          <p className="mt-1 text-2xl font-bold">{gameScores}</p>
          <p className="text-xs text-gray-500">ゲームスコア</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{currentScore}</p>
          <p className="text-xs text-gray-500">現在ポイント</p>
        </div>
      </div>

      {currentGame?.initial_serve_team && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className={`rounded-lg px-3 py-2 text-sm font-medium ${getCurrentServe() === 'A' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
            サーブ側: チーム{getCurrentServe()}
          </div>
          <div className="rounded-lg bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-800">サーバー: {getCurrentServingPlayer()?.playerName || '-'}</div>
        </div>
      )}

      {gameWon && (
        <div className="mt-3 text-center">
          <p className="text-sm font-semibold text-green-600">チーム{gameWon}の勝利</p>
          {!matchFinished && (
            <button onClick={onStartNewGame} className="mt-3 rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600">
              次のゲームを開始
            </button>
          )}
        </div>
      )}
    </div>
  </div>
);

export default DesktopVideoSidebar;
