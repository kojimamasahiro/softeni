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
    };
  };
}
