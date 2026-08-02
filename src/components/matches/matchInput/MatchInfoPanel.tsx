import type { Dispatch, RefObject, SetStateAction } from 'react';

import { normalizeYouTubeInput } from '../../../../lib/youtubePlayback';
import type { YouTubeRangePlayerHandle } from '../../YouTubeRangePlayer';
import type { Match } from '../../../types/database';
import type { MatchMetadataState } from './types';
import YoutubeHelperPanel from './YoutubeHelperPanel';

type MatchInfoPanelProps = {
  match: Match;
  matchMetadata: MatchMetadataState;
  setMatchMetadata: Dispatch<SetStateAction<MatchMetadataState>>;
  metadataSaving: boolean;
  onSaveMetadata: () => void;
  youtubeEmbedBlocked: boolean;
  setYoutubeEmbedBlocked: Dispatch<SetStateAction<boolean>>;
  activeYouTubeVideoId: string | null;
  showDesktopVideoLayout: boolean;
  mobileYoutubePlayerRef: RefObject<YouTubeRangePlayerHandle | null>;
  onReady: () => void;
  onResume: () => void;
  onPause: () => void;
};

const MatchInfoPanel = ({
  match,
  matchMetadata,
  setMatchMetadata,
  metadataSaving,
  onSaveMetadata,
  youtubeEmbedBlocked,
  setYoutubeEmbedBlocked,
  activeYouTubeVideoId,
  showDesktopVideoLayout,
  mobileYoutubePlayerRef,
  onReady,
  onResume,
  onPause,
}: MatchInfoPanelProps) => (
  <div className="bg-white rounded-lg shadow-md p-6 mb-6">
    <h1 className="text-2xl font-bold mb-4">
      {match.team_a} vs {match.team_b}
    </h1>
    <p className="text-gray-600 mb-2">大会: {match.tournament_name}</p>
    <p className="text-gray-600">形式: {match.best_of} ゲームマッチ</p>

    <div className="mt-4 grid gap-3 rounded border border-gray-200 bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-5">
      <div>
        <label className="block text-xs text-gray-600 mb-1">試合日</label>
        <input
          type="date"
          value={matchMetadata.match_date}
          onChange={(e) =>
            setMatchMetadata({
              ...matchMetadata,
              match_date: e.target.value,
            })
          }
          className="w-full rounded border p-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">コート</label>
        <input
          type="text"
          value={matchMetadata.court_name}
          onChange={(e) =>
            setMatchMetadata({
              ...matchMetadata,
              court_name: e.target.value,
            })
          }
          className="w-full rounded border p-2 text-sm"
          placeholder="例: 第1コート"
        />
      </div>
      <div className="xl:col-span-2">
        <label className="block text-xs text-gray-600 mb-1">YouTube URL</label>
        <input
          type="url"
          value={matchMetadata.youtube_url}
          onChange={(e) => {
            const normalized = normalizeYouTubeInput(e.target.value);
            setYoutubeEmbedBlocked(false);
            setMatchMetadata({
              ...matchMetadata,
              youtube_url: e.target.value,
              youtube_video_id: normalized.videoId || '',
              youtube_embed_allowed: true,
            });
          }}
          className="w-full rounded border p-2 text-sm"
          placeholder="https://www.youtube.com/watch?v=..."
        />
        {matchMetadata.youtube_video_id && <p className="mt-1 text-xs text-gray-500">動画ID: {matchMetadata.youtube_video_id}</p>}
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">相手レベル</label>
        <select
          value={matchMetadata.opponent_level}
          onChange={(e) =>
            setMatchMetadata({
              ...matchMetadata,
              opponent_level: e.target.value,
            })
          }
          className="w-full rounded border p-2 text-sm"
        >
          <option value="unknown">不明</option>
          <option value="stronger">格上</option>
          <option value="same">同格</option>
          <option value="weaker">格下</option>
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="button"
          onClick={onSaveMetadata}
          disabled={metadataSaving}
          className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:bg-gray-300"
        >
          {metadataSaving ? '保存中...' : '試合情報を保存'}
        </button>
      </div>
    </div>

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

    {activeYouTubeVideoId && (
      <YoutubeHelperPanel
        wrapperClassName={`mt-4 rounded border border-gray-200 bg-gray-50 p-4 ${showDesktopVideoLayout ? 'xl:hidden' : ''}`}
        videoId={activeYouTubeVideoId}
        playerRef={mobileYoutubePlayerRef}
        onReady={onReady}
        youtubeEmbedBlocked={youtubeEmbedBlocked}
        youtubeUrl={matchMetadata.youtube_url}
        onEmbedBlocked={() => {
          setYoutubeEmbedBlocked(true);
          setMatchMetadata((current) => ({
            ...current,
            youtube_embed_allowed: false,
          }));
        }}
        onResume={onResume}
        onPause={onPause}
      />
    )}
  </div>
);

export default MatchInfoPanel;
