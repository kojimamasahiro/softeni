import { ERROR_BUTTONS, ERROR_RESULT_TYPES, WINNER_BUTTONS } from '../../../../lib/matchLogic';
import type { MatchPointCandidate } from '../../../types/database';

export { ERROR_BUTTONS, ERROR_RESULT_TYPES, WINNER_BUTTONS };

export type CandidateEditorState = {
  status: 'pending' | 'confirmed' | 'excluded' | null;
  winner_team: 'A' | 'B' | null;
  serving_team: 'A' | 'B' | null;
  serving_player: string;
  rally_count: number;
  first_serve_fault: boolean;
  double_fault: boolean;
  result_type: string;
  winner_player: string;
  loser_player: string;
  notes: string;
};

export type SessionFormState = {
  source_type: 'youtube' | 'upload';
  source_url: string;
  source_label: string;
  upload_file_name: string;
  upload_file_size: number;
};

export type SegmentationConfigState = {
  pointIntervalMs: number;
  clipLeadMs: number;
  clipTailMs: number;
  startOffsetMs: number;
};

export const createCandidateEditorState = (candidate: MatchPointCandidate | null): CandidateEditorState => ({
  status: candidate?.status ?? 'pending',
  winner_team: candidate?.winner_team ?? null,
  serving_team: candidate?.serving_team ?? null,
  serving_player: candidate?.serving_player ?? '',
  rally_count: candidate?.rally_count ?? 0,
  first_serve_fault: candidate?.first_serve_fault ?? false,
  double_fault: candidate?.double_fault ?? false,
  result_type: candidate?.result_type ?? '',
  winner_player: candidate?.winner_player ?? '',
  loser_player: candidate?.loser_player ?? '',
  notes: candidate?.notes ?? '',
});

export const getStatusLabel = (status: MatchPointCandidate['status']) => {
  if (status === 'excluded') return '除外';
  if (status === 'confirmed') return '確定';
  return '未確認';
};
