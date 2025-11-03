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

async function addRoundColumn() {
  try {
    console.log('Testing round_name field...');

    // テストデータで回戦情報を更新
    const { data, error } = await supabase
      .from('matches')
      .update({ round_name: '準決勝' })
      .eq('tournament_name', 'highschool-championship')
      .select();

    if (error) {
      console.error('Error updating match with round_name:', error);
      console.log('round_nameカラムが存在しない可能性があります。');
      console.log('Supabaseダッシュボードで以下のSQLを実行してください:');
      console.log(
        'ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_name TEXT;',
      );
    } else {
      console.log('✅ round_name field updated successfully:', data);
    }
  } catch (error) {
    console.error('Connection error:', error);
  }
}

addRoundColumn();
