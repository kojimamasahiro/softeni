-- マイグレーション: 個別選手フィールドを追加
-- 実行日: 2025-01-04

-- matchesテーブルに個別選手フィールドを追加
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_year INT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS game_type TEXT;

-- Team A の選手情報
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_entry_number TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_player1_last_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_player1_first_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_player1_team_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_player1_region TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_player2_last_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_player2_first_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_player2_team_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_a_player2_region TEXT;

-- Team B の選手情報
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_entry_number TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_player1_last_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_player1_first_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_player1_team_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_player1_region TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_player2_last_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_player2_first_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_player2_team_name TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_b_player2_region TEXT;

-- 構造化データ用のJSONBカラム（オプション - 将来の拡張用）
ALTER TABLE matches ADD COLUMN IF NOT EXISTS teams JSONB;

-- インデックスを追加（検索性能向上のため）
CREATE INDEX IF NOT EXISTS idx_matches_tournament_year ON matches(tournament_year);
CREATE INDEX IF NOT EXISTS idx_matches_round_name ON matches(round_name);
CREATE INDEX IF NOT EXISTS idx_matches_player1_last_names ON matches(team_a_player1_last_name, team_b_player1_last_name);

-- 既存データの移行（team_a, team_bからlast_nameを抽出）
-- 注意: これは簡易的な移行です。実際のデータに応じて調整が必要
UPDATE matches 
SET 
  team_a_player1_last_name = CASE 
    WHEN team_a IS NOT NULL AND team_a != '' THEN 
      split_part(trim(team_a), ' ', 1)
    ELSE NULL 
  END,
  team_b_player1_last_name = CASE 
    WHEN team_b IS NOT NULL AND team_b != '' THEN 
      split_part(trim(team_b), ' ', 1)
    ELSE NULL 
  END
WHERE team_a_player1_last_name IS NULL OR team_b_player1_last_name IS NULL;

-- マイグレーション完了確認用
SELECT 
  COUNT(*) as total_matches,
  COUNT(team_a_player1_last_name) as matches_with_team_a_player1,
  COUNT(team_b_player1_last_name) as matches_with_team_b_player1
FROM matches;