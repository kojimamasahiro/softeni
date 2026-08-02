import type { RefObject } from 'react';

import { getPlayerUniqueId } from '../../../../lib/matchLogic';
import { formatDurationLabel, VIDEO_REVIEW_RESULT_TYPES } from '../../../../lib/videoReview';
import type { MatchPointCandidate } from '../../../types/database';
import { ERROR_BUTTONS, ERROR_RESULT_TYPES, WINNER_BUTTONS, type CandidateEditorState } from './types';

type CandidateEditorPanelProps = {
  selectedCandidate: MatchPointCandidate | null;
  candidateEditor: CandidateEditorState;
  updateEditor: (updates: Partial<CandidateEditorState>) => void;
  handleResultTypeSelect: (resultType: string) => void;
  handlePlayerSelect: (uniqueId: string, team: 'A' | 'B', kind: 'winner' | 'loser') => void;
  handleServingTeamChange: (team: 'A' | 'B' | null) => void;
  teamAPlayers: string[];
  teamBPlayers: string[];
  savingCandidate: boolean;
  onSaveCandidate: () => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  setPlayerStartSeconds: (seconds: number) => void;
};

const CandidateEditorPanel = ({
  selectedCandidate,
  candidateEditor,
  updateEditor,
  handleResultTypeSelect,
  handlePlayerSelect,
  handleServingTeamChange,
  teamAPlayers,
  teamBPlayers,
  savingCandidate,
  onSaveCandidate,
  videoRef,
  setPlayerStartSeconds,
}: CandidateEditorPanelProps) => {
  if (!selectedCandidate) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-500">左の候補一覧から編集したい候補を選んでください。</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">候補 #{selectedCandidate.candidate_order} を編集</h2>
          <p className="text-sm text-gray-500">
            {formatDurationLabel(selectedCandidate.start_ms)} - {formatDurationLabel(selectedCandidate.end_ms)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPlayerStartSeconds(Math.max(0, Math.floor(selectedCandidate.start_ms / 1000)));
            if (videoRef.current) {
              videoRef.current.currentTime = selectedCandidate.start_ms / 1000;
              void videoRef.current.play().catch(() => undefined);
            }
          }}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          この位置から再生
        </button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">候補状態</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { value: 'confirmed', label: '確定' },
            { value: 'pending', label: '未確認' },
            { value: 'excluded', label: '除外' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                updateEditor({
                  status: option.value as CandidateEditorState['status'],
                })
              }
              className={`rounded border-2 px-3 py-2 text-sm ${
                candidateEditor.status === option.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">サーブ情報</h3>
        <div className="grid gap-2 md:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              const servingTeam = candidateEditor.serving_team ?? 'A';
              const servingPlayer = candidateEditor.serving_player;
              updateEditor({
                result_type: 'service_ace',
                serving_team: servingTeam,
                winner_team: servingTeam,
                winner_player: servingPlayer,
                loser_player: '',
                rally_count: 1,
                double_fault: false,
              });
            }}
            className={`rounded border-2 p-2 text-xs font-medium ${
              candidateEditor.result_type === 'service_ace' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 hover:border-green-300'
            }`}
          >
            サービスエース
          </button>
          <button
            type="button"
            onClick={() =>
              updateEditor({
                first_serve_fault: !candidateEditor.first_serve_fault,
              })
            }
            className={`rounded border-2 p-2 text-xs font-medium ${
              candidateEditor.first_serve_fault ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-300 hover:border-orange-300'
            }`}
          >
            1stフォルト
          </button>
          <button
            type="button"
            onClick={() => {
              const servingTeam = candidateEditor.serving_team ?? 'A';
              const servingPlayer = candidateEditor.serving_player;
              updateEditor({
                result_type: 'double_fault',
                double_fault: true,
                first_serve_fault: true,
                winner_team: servingTeam === 'A' ? 'B' : 'A',
                loser_player: servingPlayer,
                winner_player: '',
                rally_count: 1,
              });
            }}
            className={`rounded border-2 p-2 text-xs font-medium ${
              candidateEditor.result_type === 'double_fault' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-300 hover:border-purple-300'
            }`}
          >
            ダブルフォルト
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium">ラリー数</h3>
        <div className="overflow-x-auto">
          <div className="flex gap-1 pb-2" style={{ minWidth: 'max-content' }}>
            {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => updateEditor({ rally_count: count })}
                className={`h-8 w-8 flex-shrink-0 rounded border-2 text-xs font-medium ${
                  candidateEditor.rally_count === count ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 hover:border-indigo-300'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-green-600">ウィナー</h3>
          <div className="grid grid-cols-2 gap-2">
            {WINNER_BUTTONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleResultTypeSelect(option.value)}
                className={`rounded border-2 p-2 text-xs font-medium ${
                  candidateEditor.result_type === option.value ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-300 hover:border-green-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-red-600">ミス</h3>
          <div className="grid grid-cols-2 gap-2">
            {ERROR_BUTTONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleResultTypeSelect(option.value)}
                className={`rounded border-2 p-2 text-xs font-medium ${
                  candidateEditor.result_type === option.value ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 hover:border-red-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-gray-600">サーブ側</label>
          <select
            value={candidateEditor.serving_team ?? ''}
            onChange={(event) => handleServingTeamChange(event.target.value ? (event.target.value as 'A' | 'B') : null)}
            className="w-full rounded border p-2 text-sm"
          >
            <option value="">未設定</option>
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">結果種別</label>
          <select
            value={candidateEditor.result_type}
            onChange={(event) => handleResultTypeSelect(event.target.value)}
            className="w-full rounded border p-2 text-sm"
          >
            {VIDEO_REVIEW_RESULT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-600">勝者チーム</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => updateEditor({ winner_team: 'A' })}
              className={`rounded border-2 p-2 text-sm ${
                candidateEditor.winner_team === 'A' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 hover:border-blue-300'
              }`}
            >
              チーム A
            </button>
            <button
              type="button"
              onClick={() => updateEditor({ winner_team: 'B' })}
              className={`rounded border-2 p-2 text-sm ${
                candidateEditor.winner_team === 'B' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 hover:border-red-300'
              }`}
            >
              チーム B
            </button>
          </div>
        </div>
      </div>

      {candidateEditor.serving_team && (
        <div>
          <h3 className="mb-2 text-sm font-medium">サーブ選手</h3>
          <div className="grid gap-2 md:grid-cols-2">
            {(candidateEditor.serving_team === 'A' ? teamAPlayers : teamBPlayers).map((playerName, index) => {
              const uniqueId = getPlayerUniqueId(candidateEditor.serving_team as 'A' | 'B', index, playerName);
              return (
                <button
                  key={uniqueId}
                  type="button"
                  onClick={() => updateEditor({ serving_player: uniqueId })}
                  className={`rounded border-2 p-2 text-sm ${
                    candidateEditor.serving_player === uniqueId ? 'border-yellow-500 bg-yellow-50 text-yellow-800' : 'border-gray-300 hover:border-yellow-300'
                  }`}
                >
                  {playerName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-medium">関与選手</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-xs font-medium text-blue-600">チーム A</h4>
            <div className="grid grid-cols-2 gap-2">
              {teamAPlayers.map((playerName, index) => {
                const uniqueId = getPlayerUniqueId('A', index, playerName);
                return (
                  <button
                    key={uniqueId}
                    type="button"
                    onClick={() => handlePlayerSelect(uniqueId, 'A', ERROR_RESULT_TYPES.has(candidateEditor.result_type) ? 'loser' : 'winner')}
                    className={`rounded border-2 p-2 text-xs ${
                      candidateEditor.winner_player === uniqueId
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : candidateEditor.loser_player === uniqueId
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    {playerName}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium text-red-600">チーム B</h4>
            <div className="grid grid-cols-2 gap-2">
              {teamBPlayers.map((playerName, index) => {
                const uniqueId = getPlayerUniqueId('B', index, playerName);
                return (
                  <button
                    key={uniqueId}
                    type="button"
                    onClick={() => handlePlayerSelect(uniqueId, 'B', ERROR_RESULT_TYPES.has(candidateEditor.result_type) ? 'loser' : 'winner')}
                    className={`rounded border-2 p-2 text-xs ${
                      candidateEditor.winner_player === uniqueId
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : candidateEditor.loser_player === uniqueId
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-300 hover:border-red-300'
                    }`}
                  >
                    {playerName}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-600">メモ</label>
        <textarea
          value={candidateEditor.notes}
          onChange={(event) => updateEditor({ notes: event.target.value })}
          rows={3}
          className="w-full rounded border p-2 text-sm"
          placeholder="この候補に関する補足"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSaveCandidate}
          disabled={savingCandidate}
          className="rounded bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          {savingCandidate ? '保存中...' : '候補内容を保存'}
        </button>
        <div className="text-sm text-gray-500">得点者、サーブ、ラリー数、結果種別、関与選手を通常入力に近い形で調整できます。</div>
      </div>
    </div>
  );
};

export default CandidateEditorPanel;
