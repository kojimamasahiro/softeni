// ファイナルゲーム7ポイント制のテストデータ作成
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

async function createFinalGameTest() {
  try {
    console.log('Creating match with final game scenario...');

    // Best of 5のマッチ作成
    const testMatch = {
      tournament_name: 'zennihon-championship-2025',
      tournament_generation: 'all',
      tournament_gender: 'boys',
      tournament_category: 'doubles',
      round_name: '決勝',
      team_a: 'チームA',
      team_b: 'チームB',
      best_of: 5,
    };

    const { data: match, error } = await supabase
      .from('matches')
      .insert([testMatch])
      .select()
      .single();

    if (error) {
      console.error('Error creating match:', error);
      return;
    }

    console.log('✅ Match created:', match.id);

    // 2-2の状況を作成（次がファイナルゲーム）
    const games = [
      { game_number: 1, winner_team: 'A', points_a: 4, points_b: 2 },
      { game_number: 2, winner_team: 'B', points_a: 3, points_b: 4 },
      { game_number: 3, winner_team: 'A', points_a: 4, points_b: 1 },
      { game_number: 4, winner_team: 'B', points_a: 2, points_b: 4 },
      { game_number: 5, winner_team: null, points_a: 0, points_b: 0 }, // ファイナルゲーム（進行中）
    ];

    for (const gameData of games) {
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert([
          {
            match_id: match.id,
            game_number: gameData.game_number,
            winner_team: gameData.winner_team,
            points_a: gameData.points_a,
            points_b: gameData.points_b,
          },
        ])
        .select()
        .single();

      if (gameError) {
        console.error(
          `Error creating game ${gameData.game_number}:`,
          gameError,
        );
      } else {
        console.log(`✅ Game ${gameData.game_number} created:`, game.id);
      }
    }

    console.log('\n📋 テスト状況:');
    console.log('- Best of 5マッチ');
    console.log('- 現在のスコア: 2-2 (A-B)');
    console.log('- 第5ゲームがファイナルゲーム（7ポイント制）');
    console.log(`- マッチID: ${match.id}`);
    console.log(`- URL: /beta/matches-results/${match.id}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

createFinalGameTest();
