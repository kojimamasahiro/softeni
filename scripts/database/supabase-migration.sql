-- Supabase ダッシュボードの SQL Editor で実行してください
-- https://supabase.com/dashboard/project/peozzbabytmwgnnvmogk/sql

-- matchesテーブルに不足しているカラムを追加
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_generation TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_gender TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_category TEXT;

-- 追加されたカラムを確認
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'matches' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- テストデータを挿入して動作確認
INSERT INTO matches (
  tournament_name, 
  tournament_generation, 
  tournament_gender, 
  tournament_category, 
  team_a, 
  team_b, 
  best_of
) VALUES (
  'テスト大会',
  'highschool',
  'male',
  'singles',
  'チームA',
  'チームB',
  5
);

-- テストデータを確認
SELECT * FROM matches ORDER BY created_at DESC LIMIT 1;

-- テストデータを削除（必要に応じて）
-- DELETE FROM matches WHERE tournament_name = 'テスト大会';