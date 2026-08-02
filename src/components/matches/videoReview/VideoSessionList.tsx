import { formatDurationLabel } from '../../../../lib/videoReview';
import type { MatchVideoSession } from '../../../types/database';

type VideoSessionListProps = {
  sessions: MatchVideoSession[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
};

const VideoSessionList = ({ sessions, selectedSessionId, onSelectSession }: VideoSessionListProps) => (
  <div className="rounded-lg bg-white p-5 shadow-md">
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold">既存セッション</h2>
      <span className="text-xs text-gray-500">{sessions.length} 件</span>
    </div>
    <div className="space-y-3">
      {sessions.map((session) => (
        <button
          key={session.id}
          type="button"
          onClick={() => onSelectSession(session.id)}
          className={`w-full rounded border p-3 text-left ${
            selectedSessionId === session.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{session.source_label || '無題セッション'}</span>
            <span className="text-xs text-gray-500">{session.source_type === 'youtube' ? 'YouTube' : 'ローカル動画'}</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {session.duration_ms ? formatDurationLabel(session.duration_ms) : '動画長未設定'}
            {' · '}
            {session.processing_status || 'draft'}
          </div>
        </button>
      ))}
      {sessions.length === 0 && <p className="text-sm text-gray-500">まだ動画セッションがありません。</p>}
    </div>
  </div>
);

export default VideoSessionList;
