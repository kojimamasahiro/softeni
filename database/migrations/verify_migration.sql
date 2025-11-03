-- マイグレーション後の確認クエリ

-- 1. テーブル構造の確認
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'matches' 
ORDER BY ordinal_position;

-- 2. 新しいフィールドにデータが入っているか確認
SELECT 
  id,
  team_a,
  team_a_player1_last_name,
  team_b,
  team_b_player1_last_name,
  created_at
FROM matches 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. データ移行の成功率確認
SELECT 
  COUNT(*) as total_matches,
  COUNT(team_a_player1_last_name) as team_a_migrated,
  COUNT(team_b_player1_last_name) as team_b_migrated,
  ROUND(COUNT(team_a_player1_last_name) * 100.0 / COUNT(*), 2) as migration_success_rate_a,
  ROUND(COUNT(team_b_player1_last_name) * 100.0 / COUNT(*), 2) as migration_success_rate_b
FROM matches;