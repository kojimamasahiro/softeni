-- Add tournament_year column to matches table
ALTER TABLE matches 
ADD COLUMN tournament_year INTEGER;

-- Add comment for the new column
COMMENT ON COLUMN matches.tournament_year IS 'Tournament year (e.g., 2024)';

-- Update existing records to have current year as default (optional)
-- UPDATE matches SET tournament_year = 2024 WHERE tournament_year IS NULL;