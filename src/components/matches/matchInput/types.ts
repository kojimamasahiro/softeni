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
};
