// Add tournament_year column to matches table
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addTournamentYearColumn() {
  try {
    console.log('Adding tournament_year column to matches table...');

    // Add tournament_year column
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE matches 
        ADD COLUMN IF NOT EXISTS tournament_year INTEGER;
        
        COMMENT ON COLUMN matches.tournament_year IS 'Tournament year (e.g., 2024)';
      `,
    });

    if (error) {
      console.error('Error adding column:', error);
      return;
    }

    console.log('✅ Successfully added tournament_year column');

    // Optionally update existing records
    console.log('Updating existing records with default year...');
    const { error: updateError } = await supabase
      .from('matches')
      .update({ tournament_year: 2024 })
      .is('tournament_year', null);

    if (updateError) {
      console.error('Error updating existing records:', updateError);
    } else {
      console.log('✅ Successfully updated existing records');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

addTournamentYearColumn();
