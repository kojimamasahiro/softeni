// テスト用のマッチ作成スクリプト
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

async function createTestMatch() {
  try {
    console.log('Creating test match with round_name...');

    const testMatch = {
      tournament_name: 'highschool-championship',
      tournament_generation: 'highschool',
      tournament_gender: 'boys',
      tournament_category: 'doubles',
      round_name: '決勝',
      team_a: '神奈川県立高校',
      team_b: '愛知県立高校',
      best_of: 5,
    };

    const { data, error } = await supabase
      .from('matches')
      .insert([testMatch])
      .select()
      .single();

    if (error) {
      console.error('Error creating test match:', error);
    } else {
      console.log('✅ Test match created:', data);
      console.log('Match ID:', data.id);

      // 初期ゲームも作成
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert([
          {
            match_id: data.id,
            game_number: 1,
            points_a: 0,
            points_b: 0,
          },
        ])
        .select()
        .single();

      if (gameError) {
        console.error('Error creating game:', gameError);
      } else {
        console.log('✅ Initial game created:', game);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

createTestMatch();
