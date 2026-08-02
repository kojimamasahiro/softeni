import type { RefObject } from 'react';

import type { MatchVideoSession } from '../../../types/database';

type VideoPlayerPanelProps = {
  selectedSession: MatchVideoSession;
  playerEmbedUrl: string | null;
  playerStartSeconds: number;
  canPreviewLocalUpload: boolean;
  localUploadUrl: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  onLocalVideoLoaded: () => void;
};

const VideoPlayerPanel = ({
  selectedSession,
  playerEmbedUrl,
  playerStartSeconds,
  canPreviewLocalUpload,
  localUploadUrl,
  videoRef,
  onLocalVideoLoaded,
}: VideoPlayerPanelProps) => (
  <div className="rounded-lg bg-white p-5 shadow-md">
    <div className="mb-4">
      <h2 className="text-lg font-semibold">{selectedSession.source_label || '無題セッション'}</h2>
      <p className="text-sm text-gray-500">{selectedSession.source_type === 'youtube' ? 'YouTube 埋め込み再生' : 'ローカル動画プレビュー'}</p>
    </div>

    <div className="mb-4 overflow-hidden rounded-lg bg-black">
      {selectedSession.source_type === 'youtube' && playerEmbedUrl ? (
        <iframe
          key={`${selectedSession.id}-${playerStartSeconds}`}
          src={playerEmbedUrl}
          title="YouTube player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="aspect-video w-full"
        />
      ) : canPreviewLocalUpload ? (
        <video
          key={localUploadUrl}
          ref={videoRef}
          src={localUploadUrl ?? undefined}
          controls
          onLoadedMetadata={onLocalVideoLoaded}
          className="aspect-video w-full"
        />
      ) : (
        <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-gray-300">
          {selectedSession.source_type === 'upload'
            ? 'このローカル動画は再アタッチが必要です。左側で同じ動画を再選択してください。'
            : 'プレビューできる動画URLがありません。'}
        </div>
      )}
    </div>
  </div>
);

export default VideoPlayerPanel;
