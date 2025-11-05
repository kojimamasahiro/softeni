-- ソフトテニスのポイント記録システム用テーブル

-- マッチテーブル
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_name TEXT,
  tournament_id TEXT,
  tournament_generation TEXT,
  tournament_gender TEXT,
  tournament_category TEXT,
  team_a TEXT,
  team_b TEXT,
  best_of INT DEFAULT 5,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ゲームテーブル
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  game_number INT,
  winner_team TEXT, -- 'A' or 'B' (ゲーム終了時に設定)
  points_a INT DEFAULT 0,
  points_b INT DEFAULT 0,
  initial_serve_team TEXT, -- 'A' or 'B' (ゲーム開始時のサーブ権)
  created_at TIMESTAMP DEFAULT NOW()
);

-- ポイントテーブル
CREATE TABLE points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  point_number INT,
  winner_team TEXT, -- 'A' or 'B'
  serving_team TEXT, -- 'A' or 'B' (このポイントでのサーブ権)
  rally_count INT,
  first_serve_fault BOOLEAN,
  double_fault BOOLEAN,
  result_type TEXT, -- 'winner', 'forced_error', 'unforced_error', 'net', 'out'
  winner_player TEXT,
  loser_player TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_games_match_id ON games(match_id);
CREATE INDEX idx_points_game_id ON points(game_id);
CREATE INDEX idx_matches_created_at ON matches(created_at);
CREATE INDEX idx_matches_tournament_id ON matches(tournament_id);

-- サンプルデータ（テスト用）
/*
INSERT INTO matches (tournament_name, team_a, team_b, best_of) 
VALUES ('全国高等学校ソフトテニス選手権大会', '東京都立高校', '大阪府立高校', 5);

INSERT INTO games (match_id, game_number, points_a, points_b)
SELECT id, 1, 0, 0 FROM matches WHERE tournament_name = '全国高等学校ソフトテニス選手権大会';
*/