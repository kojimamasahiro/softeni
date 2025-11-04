// 9ゲーム制でファイナルゲーム7ポイント制のテストデータ作成
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

async function create9GameTest() {
  try {
    console.log('🚀 9ゲーム制テストマッチを作成中...');

    // マッチ作成
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert([
        {
          tournament_name: '9ゲーム制テスト大会',
          team_a: 'チーム A（テスト）',
          team_b: 'チーム B（テスト）',
          best_of: 9, // 9ゲーム制
        },
      ])
      .select()
      .single();

    if (matchError) {
      console.error('Error creating match:', matchError);
      return;
    }

    console.log('✅ Match created:', match.id);

    // ゲームを8つ作成（4-4の状況）
    const games = [
      { game_number: 1, winner_team: 'A', points_a: 4, points_b: 2 },
      { game_number: 2, winner_team: 'B', points_a: 3, points_b: 4 },
      { game_number: 3, winner_team: 'A', points_a: 4, points_b: 1 },
      { game_number: 4, winner_team: 'B', points_a: 2, points_b: 4 },
      { game_number: 5, winner_team: 'A', points_a: 4, points_b: 2 },
      { game_number: 6, winner_team: 'B', points_a: 1, points_b: 4 },
      { game_number: 7, winner_team: 'A', points_a: 4, points_b: 3 },
      { game_number: 8, winner_team: 'B', points_a: 2, points_b: 4 },
      {
        game_number: 9,
        winner_team: null,
        points_a: 0,
        points_b: 0,
        initial_serve_team: 'A',
      }, // ファイナルゲーム（進行中）
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
            initial_serve_team: gameData.initial_serve_team,
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
    console.log('- Best of 9マッチ');
    console.log('- 現在のスコア: 4-4 (A-B)');
    console.log('- 第9ゲームがファイナルゲーム（7ポイント制）');
    console.log(`- マッチID: ${match.id}`);
    console.log(`- 入力URL: /beta/matches/${match.id}/input`);
    console.log(`- 結果URL: /beta/matches-results/${match.id}`);
    console.log('\n🎯 テスト手順:');
    console.log('1. 入力URLでファイナルゲームにポイントを追加');
    console.log('2. 7ポイントで勝敗が決まることを確認');
    console.log('3. サーブ権が2ポイントごとに交代することを確認');
  } catch (error) {
    console.error('Error:', error);
  }
}

create9GameTest();