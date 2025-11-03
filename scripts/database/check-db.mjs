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

async function checkTableStructure() {
  try {
    console.log('Checking matches table structure...');

    // matchesテーブルの構造を確認
    const { data, error } = await supabase.rpc('get_table_columns', {
      table_name: 'matches',
    });

    if (error) {
      console.error('Error with RPC call:', error);

      // 直接テーブルから取得を試してみる
      const { data: testData, error: testError } = await supabase
        .from('matches')
        .select('*')
        .limit(1);

      if (testError) {
        console.error('Error accessing matches table:', testError);
      } else {
        console.log('Matches table exists. Sample record:');
        console.log(testData[0] || 'No records found');
      }
    } else {
      console.log('Table columns:', data);
    }
  } catch (error) {
    console.error('Connection error:', error);
  }
}

checkTableStructure();
