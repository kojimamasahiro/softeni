import type { ChangeEvent, Dispatch, FormEvent, SetStateAction } from 'react';

import { parseYouTubeVideoId } from '../../../../lib/videoReview';
import type { SessionFormState } from './types';

type VideoSessionFormProps = {
  sessionForm: SessionFormState;
  onSessionFormChange: Dispatch<SetStateAction<SessionFormState>>;
  durationMsInput: string;
  onDurationMsInputChange: (value: string) => void;
  submitting: boolean;
  onUploadFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const VideoSessionForm = ({
  sessionForm,
  onSessionFormChange,
  durationMsInput,
  onDurationMsInputChange,
  submitting,
  onUploadFileChange,
  onSubmit,
}: VideoSessionFormProps) => (
  <div className="rounded-lg bg-white p-5 shadow-md">
    <h2 className="mb-4 text-lg font-semibold">動画セッション作成</h2>
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-1 block text-sm text-gray-700">入力元</label>
        <select
          value={sessionForm.source_type}
          onChange={(event) =>
            onSessionFormChange((current) => ({
              ...current,
              source_type: event.target.value as 'youtube' | 'upload',
            }))
          }
          className="w-full rounded border p-2 text-sm"
        >
          <option value="youtube">YouTube</option>
          <option value="upload">ローカル動画</option>
        </select>
      </div>

      {sessionForm.source_type === 'youtube' ? (
        <div>
          <label className="mb-1 block text-sm text-gray-700">YouTube URL</label>
          <input
            type="url"
            value={sessionForm.source_url}
            onChange={(event) =>
              onSessionFormChange((current) => ({
                ...current,
                source_url: event.target.value,
              }))
            }
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full rounded border p-2 text-sm"
            required
          />
          {sessionForm.source_url && !parseYouTubeVideoId(sessionForm.source_url) && <p className="mt-1 text-xs text-red-500">動画IDを読み取れないURLです。</p>}
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm text-gray-700">ローカル動画</label>
          <input type="file" accept="video/*" onChange={onUploadFileChange} className="w-full rounded border p-2 text-sm" />
          <p className="mt-1 text-xs text-gray-500">MVPではローカル再生用です。再訪時は再選択が必要です。</p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm text-gray-700">ラベル</label>
        <input
          type="text"
          value={sessionForm.source_label}
          onChange={(event) =>
            onSessionFormChange((current) => ({
              ...current,
              source_label: event.target.value,
            }))
          }
          placeholder="例: 2026春 関東予選 1回戦"
          className="w-full rounded border p-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-gray-700">動画長さ (ms)</label>
        <input
          type="number"
          min="1"
          value={durationMsInput}
          onChange={(event) => onDurationMsInputChange(event.target.value)}
          placeholder="例: 1800000"
          className="w-full rounded border p-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
      >
        {submitting ? '作成中...' : 'セッションを作成'}
      </button>
    </form>
  </div>
);

export default VideoSessionForm;
