import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// .env.localファイルを読み込み
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('環境変数が設定されていません:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
  console.error('SUPABASE_SERVICE_KEY:', supabaseKey ? 'SET' : 'NOT SET');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addMissingColumns() {
  try {
    console.log('Adding missing columns to matches table...');

    // カラムを追加するSQL文
    const alterQueries = [
      'ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_generation TEXT;',
      'ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_gender TEXT;',
      'ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_category TEXT;',
      'ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_name TEXT;',
    ];

    for (const query of alterQueries) {
      console.log(`Executing: ${query}`);
      const { error } = await supabase.rpc('exec_sql', { sql: query });

      if (error) {
        console.error('Error executing SQL:', error);
      } else {
        console.log('✅ SQL executed successfully');
      }
    }

    // テーブル構造の確認
    console.log('\nTesting with sample data...');
    const testMatch = {
      tournament_name: 'テスト大会',
      tournament_generation: 'highschool',
      tournament_gender: 'male',
      tournament_category: 'singles',
      team_a: 'チームA',
      team_b: 'チームB',
      best_of: 5,
    };

    const { data, error } = await supabase
      .from('matches')
      .insert([testMatch])
      .select()
      .single();

    if (error) {
      console.error('Error inserting test data:', error);
    } else {
      console.log('✅ Test match inserted successfully:', data);

      // テストデータを削除
      await supabase.from('matches').delete().eq('id', data.id);
      console.log('✅ Test data cleaned up');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

addMissingColumns();
