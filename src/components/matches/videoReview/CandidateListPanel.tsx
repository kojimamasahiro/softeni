import { formatDurationLabel, getConfidenceLabel } from '../../../../lib/videoReview';
import type { MatchPointCandidate } from '../../../types/database';
import { getStatusLabel } from './types';

type CandidateListPanelProps = {
  selectedCandidates: MatchPointCandidate[];
  selectedCandidateId: string | null;
  sessionLoading: boolean;
  onSelectCandidate: (candidate: MatchPointCandidate) => void;
  onQuickStatusUpdate: (candidate: MatchPointCandidate, updates: Partial<MatchPointCandidate>) => void;
};

const CandidateListPanel = ({ selectedCandidates, selectedCandidateId, sessionLoading, onSelectCandidate, onQuickStatusUpdate }: CandidateListPanelProps) => (
  <section className="rounded-lg bg-white p-5 shadow-md">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">ポイント候補一覧</h2>
      <span className="text-sm text-gray-500">{selectedCandidates.length} 件</span>
    </div>

    {sessionLoading ? (
      <div className="py-8 text-center text-gray-500">セッションを読み込み中...</div>
    ) : selectedCandidates.length === 0 ? (
      <div className="rounded border border-dashed p-8 text-center text-sm text-gray-500">
        まだ候補がありません。上の設定を調整して候補を再生成してください。
      </div>
    ) : (
      <div className="space-y-3 lg:max-h-[calc(100vh-26rem)] lg:overflow-y-auto lg:pr-2">
        {selectedCandidates.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            onClick={() => onSelectCandidate(candidate)}
            className={`w-full rounded-lg border p-4 text-left ${
              selectedCandidateId === candidate.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-medium">候補 #{candidate.candidate_order}</span>
              <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">{getStatusLabel(candidate.status)}</span>
            </div>
            <div className="text-sm text-gray-500">
              {formatDurationLabel(candidate.start_ms)} - {formatDurationLabel(candidate.end_ms)}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className={`rounded px-2 py-1 ${(candidate.confidence ?? 0) < 0.6 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                {getConfidenceLabel(candidate.confidence)}
              </span>
              {candidate.winner_team && <span className="rounded bg-white px-2 py-1 text-gray-700">得点: {candidate.winner_team}</span>}
              {candidate.result_type && <span className="rounded bg-white px-2 py-1 text-gray-700">{candidate.result_type}</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                onClick={(event) => {
                  event.stopPropagation();
                  onQuickStatusUpdate(candidate, {
                    status: 'confirmed',
                    winner_team: 'A',
                  });
                }}
                className="cursor-pointer rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
              >
                A得点
              </span>
              <span
                onClick={(event) => {
                  event.stopPropagation();
                  onQuickStatusUpdate(candidate, {
                    status: 'confirmed',
                    winner_team: 'B',
                  });
                }}
                className="cursor-pointer rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
              >
                B得点
              </span>
              <span
                onClick={(event) => {
                  event.stopPropagation();
                  onQuickStatusUpdate(candidate, {
                    status: 'excluded',
                    winner_team: null,
                  });
                }}
                className="cursor-pointer rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200"
              >
                除外
              </span>
            </div>
          </button>
        ))}
      </div>
    )}
  </section>
);

export default CandidateListPanel;
