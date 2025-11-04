import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// .env.localファイルを読み込み
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
  try {
    console.log('Testing database connection and table structure...');

    // テストデータを挿入してカラムの存在を確認
    const testMatch = {
      tournament_name: 'テスト大会',
      tournament_generation: 'highschool',
      tournament_gender: 'male',
      tournament_category: 'singles',
      team_a: 'チームA',
      team_b: 'チームB',
      best_of: 5,
    };

    console.log('Attempting to insert test match...');
    const { data, error } = await supabase
      .from('matches')
      .insert([testMatch])
      .select()
      .single();

    if (error) {
      console.error('Error inserting test match:', error);
      console.log('Error code:', error.code);
      console.log('Error message:', error.message);

      if (
        error.message.includes('column') &&
        error.message.includes('does not exist')
      ) {
        console.log(
          '\n❌ カラムが存在しません。データベースの migration が必要です。',
        );
      }
    } else {
      console.log('✅ Test match inserted successfully:', data);

      // テストデータを削除
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('id', data.id);

      if (deleteError) {
        console.error('Error deleting test match:', deleteError);
      } else {
        console.log('✅ Test match deleted successfully');
      }
    }
  } catch (error) {
    console.error('Connection error:', error);
  }
}

checkDatabase();
