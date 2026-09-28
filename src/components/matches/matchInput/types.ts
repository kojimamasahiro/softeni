export type PointDataState = {
  winner_team: string;
  serving_team: string;
  rally_count: number;
  first_serve_fault: boolean;
  double_fault: boolean;
  result_type: string;
  winner_player: string;
  loser_player: string;
  video_start_ms: number | null;
  video_end_ms: number | null;
  is_pick: boolean;
  pick_note: string;
};

export type MatchMetadataState = {
  match_date: string;
  court_name: string;
  opponent_level: string;
  youtube_url: string;
  youtube_video_id: string;
  youtube_embed_allowed: boolean;
};

export type ManualServingPlayer = {
  team: 'A' | 'B';
  playerIndex: number;
} | null;

export type ServingPlayerInfo = {
  team: 'A' | 'B';
  playerName: string;
  playerIndex: number;
} | null;

export const EMPTY_POINT_DATA: PointDataState = {
  winner_team: '',
  serving_team: '',
  rally_count: 0,
  first_serve_fault: false,
  double_fault: false,
  result_type: '',
  winner_player: '',
  loser_player: '',
  video_start_ms: null,
  video_end_ms: null,
  is_pick: false,
  pick_note: '',
};

/**
 * ピックの保存用フィールド。ピックしていない新規ポイントでは送らない
 * （points.is_pick 列を追加する前の DB でも記録を止めないため。docs/sql/point-pick.sql）。
 * 感想は任意。ピックを外したら感想も消す。
 */
export const buildPickPayload = (data: PointDataState, hadPick: boolean) => {
  if (!data.is_pick && !hadPick) return {};
  const note = data.pick_note.trim();
  return {
    is_pick: data.is_pick,
    pick_note: data.is_pick && note ? note : null,
  };
};
