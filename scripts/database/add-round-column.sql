-- 試合テーブルに何回戦かの情報を追加
-- Supabase SQL Editor で実行してください

-- 回戦情報のカラムを追加
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_name TEXT;

-- 確認用クエリ
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'matches' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 既存のテストデータに回戦情報を追加
UPDATE matches 
SET round_name = '準決勝' 
WHERE tournament_name = 'highschool-championship';

-- 確認
SELECT id, tournament_name, team_a, team_b, round_name FROM matches;