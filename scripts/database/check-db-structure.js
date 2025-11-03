import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function checkTableStructure() {
  try {
    // matchesテーブルの構造を確認
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable')
      .eq('table_name', 'matches')
      .eq('table_schema', 'public');

    if (error) {
      console.error('Error fetching table structure:', error);
      return;
    }

    console.log('Matches table structure:');
    console.log(data);

    // 実際のmatchesテーブルの内容も確認
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .limit(1);

    if (matchError) {
      console.error('Error fetching matches:', matchError);
    } else {
      console.log('\nFirst match record (if exists):');
      console.log(matches[0] || 'No matches found');
    }
  } catch (error) {
    console.error('Connection error:', error);
  }
}

checkTableStructure();
