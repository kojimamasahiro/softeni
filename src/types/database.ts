export interface Match {
  id: string;
  tournament_name: string | null;
  tournament_generation: string | null;
  tournament_gender: string | null;
  tournament_category: string | null;
  round_name: string | null;
  team_a: string | null;
  team_b: string | null;
  best_of: number;
  created_at: string;
  games?: Game[];
}

export interface Game {
  id: string;
  match_id: string;
  game_number: number;
  winner_team: string | null;
  points_a: number;
  points_b: number;
  created_at: string;
  points?: Point[];
}

export interface Point {
  id: string;
  game_id: string;
  point_number: number;
  winner_team: string | null;
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
