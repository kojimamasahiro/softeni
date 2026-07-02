export interface MatchPlayer {
  last_name: string;
  first_name: string;
  team_name: string;
  region: string;
}

export interface MatchTeam {
  entry_number: string;
  players: MatchPlayer[];
}

// 掲載大会への相互リンク用（公開 JSON にのみ存在する派生フィールド）
// 生成は lib/siteLink.mjs / scripts/generate-beta-matches-json.mjs
// 仕様は docs/wiki/score-site-link.md
export interface MatchSiteLink {
  tournamentPath: string;
  entryNos: number[];
}

export interface Match {
  id: string;
  tournament_name: string | null;
  tournament_id: string | null;
  tournament_generation: string | null;
  tournament_gender: string | null;
  tournament_category: string | null;
  tournament_year?: number | null;
  round_name: string | null;
  best_of: number;
  game_type?: string | null;
  created_at: string;
  match_date?: string | null;
  court_name?: string | null;
  youtube_video_id?: string | null;
  youtube_url?: string | null;
  youtube_embed_allowed?: boolean | null;
  status?: 'draft' | 'in_progress' | 'completed' | 'archived' | null;
  completed_at?: string | null;
  opponent_level?: 'stronger' | 'same' | 'weaker' | 'unknown' | null;
  source_site_match_id?: string | null;
  source_site_tournament_id?: string | null;

  // 掲載大会への相互リンク（公開 JSON 生成時にベイクされる派生フィールド）
  siteLink?: MatchSiteLink | null;

  // 個別フィールド（新形式）
  team_a_entry_number?: string | null;
  team_a_player1_last_name?: string | null;
  team_a_player1_first_name?: string | null;
  team_a_player1_team_name?: string | null;
  team_a_player1_region?: string | null;
  team_a_player2_last_name?: string | null;
  team_a_player2_first_name?: string | null;
  team_a_player2_team_name?: string | null;
  team_a_player2_region?: string | null;

  team_b_entry_number?: string | null;
  team_b_player1_last_name?: string | null;
  team_b_player1_first_name?: string | null;
  team_b_player1_team_name?: string | null;
  team_b_player1_region?: string | null;
  team_b_player2_last_name?: string | null;
  team_b_player2_first_name?: string | null;
  team_b_player2_team_name?: string | null;
  team_b_player2_region?: string | null;

  // 構造化データ（JSONフィールド）
  teams?: {
    A: MatchTeam;
    B: MatchTeam;
  } | null;

  // 表示用文字列（後方互換性）
  team_a: string | null;
  team_b: string | null;

  games?: Game[];
}

export interface Game {
  id: string;
  match_id: string;
  game_number: number;
  winner_team: string | null;
  points_a: number;
  points_b: number;
  initial_serve_team: string | null; // 'A' or 'B' (ゲーム開始時のサーブ権)
  initial_serve_player_index?: number | null; // 0 or 1 (ゲーム開始時のサーブ選手インデックス)
  created_at: string;
  points?: Point[];
}

export interface Point {
  id: string;
  game_id: string;
  point_number: number;
  winner_team: string | null;
  serving_team: string | null; // 'A' or 'B' (このポイントでのサーブ権)
  serving_player: string | null; // サーブした選手名
  rally_count: number | null;
  first_serve_fault: boolean | null;
  double_fault: boolean | null;
  result_type: string | null; // 'winner', 'forced_error', 'unforced_error', 'net', 'out'
  winner_player: string | null;
  loser_player: string | null;
  created_at: string;
  point_note?: string | null;
  shot_type?: string | null;
  shot_course?: string | null;
  recording_level?: string | null;
  edited_at?: string | null;
  point_detail?: string | null;
  video_start_ms?: number | null;
  video_end_ms?: number | null;
}

export interface MatchVideoSession {
  id: string;
  match_id: string;
  source_type: 'youtube' | 'upload';
  source_url: string | null;
  source_label: string | null;
  youtube_video_id?: string | null;
  upload_file_name?: string | null;
  upload_file_size?: number | null;
  duration_ms?: number | null;
  processing_status?: 'draft' | 'ready' | 'processing' | 'reviewing' | 'committed' | null;
  created_at: string;
  updated_at?: string | null;
  candidates?: MatchPointCandidate[];
}

export interface MatchPointCandidate {
  id: string;
  session_id: string;
  candidate_order: number;
  start_ms: number;
  end_ms: number;
  confidence: number | null;
  status: 'pending' | 'confirmed' | 'excluded' | null;
  winner_team: 'A' | 'B' | null;
  serving_team: 'A' | 'B' | null;
  serving_player?: string | null;
  rally_count: number | null;
  first_serve_fault?: boolean | null;
  double_fault?: boolean | null;
  result_type: string | null;
  winner_player?: string | null;
  loser_player?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface Database {
  public: {
    Tables: {
      matches: {
        Row: Match;
        Insert: Omit<Match, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Match, 'id' | 'created_at'>>;
      };
      games: {
        Row: Game;
        Insert: Omit<Game, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Game, 'id' | 'created_at'>>;
      };
      points: {
        Row: Point;
        Insert: Omit<Point, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Point, 'id' | 'created_at'>>;
      };
      match_video_sessions: {
        Row: MatchVideoSession;
        Insert: Omit<MatchVideoSession, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<MatchVideoSession, 'id' | 'created_at'>>;
      };
      match_point_candidates: {
        Row: MatchPointCandidate;
        Insert: Omit<MatchPointCandidate, 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<MatchPointCandidate, 'id' | 'created_at'>>;
      };
    };
  };
}
