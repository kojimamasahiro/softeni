import type { Dispatch, SetStateAction } from 'react';

import { formatDurationLabel } from '../../../../lib/videoReview';
import type { MatchVideoSession } from '../../../types/database';
import type { SegmentationConfigState } from './types';

type CandidateGenerationPanelProps = {
  selectedSession: MatchVideoSession;
  confirmedCount: number;
  excludedCount: number;
  selectedCandidatesLength: number;
  segmentationConfig: SegmentationConfigState;
  onSegmentationConfigChange: Dispatch<SetStateAction<SegmentationConfigState>>;
  submitting: boolean;
  sessionLoading: boolean;
  onGenerateCandidates: () => void;
  onCommit: () => void;
};

const CandidateGenerationPanel = ({
  selectedSession,
  confirmedCount,
  excludedCount,
  selectedCandidatesLength,
  segmentationConfig,
  onSegmentationConfigChange,
  submitting,
  sessionLoading,
  onGenerateCandidates,
  onCommit,
}: CandidateGenerationPanelProps) => (
  <div className="rounded-lg bg-white p-5 shadow-md">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">候補生成設定</h2>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded bg-green-50 px-3 py-1 text-green-700">確定 {confirmedCount}</span>
        <span className="rounded bg-gray-100 px-3 py-1 text-gray-700">除外 {excludedCount}</span>
      </div>
    </div>

    <div className="grid gap-3">
      <div>
        <label className="mb-1 block text-xs text-gray-600">予測ポイント間隔 (ms)</label>
        <input
          type="number"
          min="6000"
          step="1000"
          value={segmentationConfig.pointIntervalMs}
          onChange={(event) =>
            onSegmentationConfigChange((current) => ({
              ...current,
              pointIntervalMs: Number(event.target.value) || 12000,
            }))
          }
          className="w-full rounded border p-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-600">前余白 (ms)</label>
        <input
          type="number"
          min="1500"
          step="500"
          value={segmentationConfig.clipLeadMs}
          onChange={(event) =>
            onSegmentationConfigChange((current) => ({
              ...current,
              clipLeadMs: Number(event.target.value) || 4000,
            }))
          }
          className="w-full rounded border p-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-600">後余白 (ms)</label>
        <input
          type="number"
          min="4000"
          step="500"
          value={segmentationConfig.clipTailMs}
          onChange={(event) =>
            onSegmentationConfigChange((current) => ({
              ...current,
              clipTailMs: Number(event.target.value) || 9000,
            }))
          }
          className="w-full rounded border p-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-gray-600">開始オフセット (ms)</label>
        <input
          type="number"
          min="0"
          step="1000"
          value={segmentationConfig.startOffsetMs}
          onChange={(event) =>
            onSegmentationConfigChange((current) => ({
              ...current,
              startOffsetMs: Number(event.target.value) || 0,
            }))
          }
          className="w-full rounded border p-2 text-sm"
        />
      </div>
    </div>

    <div className="mt-4 space-y-3">
      <button
        type="button"
        onClick={onGenerateCandidates}
        disabled={submitting || sessionLoading}
        className="w-full rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300"
      >
        {submitting ? '処理中...' : '候補を再生成'}
      </button>
      <button
        type="button"
        onClick={onCommit}
        disabled={submitting || selectedCandidatesLength === 0}
        className="w-full rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:bg-gray-300"
      >
        確定候補を既存スコアへ反映
      </button>
      <p className="text-xs text-gray-500">{selectedSession.duration_ms ? `動画長 ${formatDurationLabel(selectedSession.duration_ms)}` : '動画長未設定'}</p>
    </div>
  </div>
);

export default CandidateGenerationPanel;
