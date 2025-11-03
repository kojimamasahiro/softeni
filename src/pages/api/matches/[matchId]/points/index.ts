import type { NextApiRequest, NextApiResponse } from 'next';

import { createServerClient } from '../../../../../../lib/supabase';

const supabase = createServerClient();

interface Player {
  name: string;
  position: string;
}

interface PointData {
  game_id: number;
  winner_team: 'A' | 'B';
  serving_team: 'A' | 'B';
  rally_count?: number;
  first_serve_fault: boolean;
  double_fault: boolean;
  result_type: string;
  winner_player?: Player;
  loser_player?: Player;
}

// ゲームスコアを再計算する関数
async function recalculateGameScore(gameId: number) {
  // 該当ゲームの情報とポイントを取得
  const { data: game } = await supabase
    .from('games')
    .select('match_id')
    .eq('id', gameId)
    .single();

  if (!game) return;

  // 該当ゲームのポイントをすべて取得
  const { data: points } = await supabase
    .from('points')
    .select('winner_team')
    .eq('game_id', gameId)
    .order('created_at', { ascending: true });

  // スコアを再計算
  let pointsA = 0;
  let pointsB = 0;

  points?.forEach((point: { winner_team: 'A' | 'B' }) => {
    if (point.winner_team === 'A') {
      pointsA++;
    } else if (point.winner_team === 'B') {
      pointsB++;
    }
  });

  // ファイナルゲーム判定のため、マッチの他のゲーム結果を取得
  const { data: gameStats } = await supabase
    .from('games')
    .select('points_a, points_b')
    .eq('match_id', game.match_id);

  let gamesA = 0;
  let gamesB = 0;

  gameStats?.forEach((g) => {
    if (g.points_a > g.points_b) {
      gamesA++;
    } else if (g.points_b > g.points_a) {
      gamesB++;
    }
  });

  const isFinalGame = gamesA === 3 && gamesB === 3;
  const pointsToWin = isFinalGame ? 7 : 4;

  // 勝利条件チェック
  const gameWon =
    (pointsA >= pointsToWin && pointsA - pointsB >= 2) ||
    (pointsB >= pointsToWin && pointsB - pointsA >= 2);

  // ゲームデータを準備
  const gameUpdateData: {
    points_a: number;
    points_b: number;
    winner_team?: 'A' | 'B' | null;
  } = {
    points_a: pointsA,
    points_b: pointsB,
  };

  // ゲーム勝利時はwinner_teamも設定、そうでなければnullに
  if (gameWon) {
    gameUpdateData.winner_team = pointsA > pointsB ? 'A' : 'B';
  } else {
    gameUpdateData.winner_team = null;
  }

  // ゲームテーブルを更新
  await supabase.from('games').update(gameUpdateData).eq('id', gameId);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { matchId } = req.query;

  console.log(
    `Points API called: ${req.method} /api/matches/${matchId}/points`,
  );
  console.log('Request body:', req.body);

  if (typeof matchId !== 'string') {
    return res.status(400).json({ error: 'Invalid match ID' });
  }

  if (req.method === 'POST') {
    try {
      const {
        game_id,
        winner_team,
        serving_team,
        rally_count,
        first_serve_fault,
        double_fault,
        result_type,
        winner_player,
        loser_player,
      }: PointData = req.body;

      // ゲームの存在確認
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', game_id)
        .eq('match_id', matchId)
        .single();

      if (gameError || !game) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // ファイナルゲーム判定
      const { data: gameStats } = await supabase
        .from('games')
        .select('points_a, points_b')
        .eq('match_id', matchId);

      let gamesA = 0;
      let gamesB = 0;

      gameStats?.forEach((g) => {
        if (g.points_a > g.points_b) {
          gamesA++;
        } else if (g.points_b > g.points_a) {
          gamesB++;
        }
      });

      const isFinalGame = gamesA === 3 && gamesB === 3;
      const pointsToWin = isFinalGame ? 7 : 4;

      // 現在のポイントをカウント
      let currentPointsA = game.points_a || 0;
      let currentPointsB = game.points_b || 0;

      if (winner_team === 'A') {
        currentPointsA++;
      } else {
        currentPointsB++;
      }

      // 勝利条件チェック
      const gameWon =
        (currentPointsA >= pointsToWin &&
          currentPointsA - currentPointsB >= 2) ||
        (currentPointsB >= pointsToWin && currentPointsB - currentPointsA >= 2);

      // ポイントを作成
      const { data, error } = await supabase
        .from('points')
        .insert({
          game_id,
          winner_team,
          serving_team,
          rally_count,
          first_serve_fault,
          double_fault,
          result_type,
          winner_player,
          loser_player,
        })
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // ゲームスコア更新
      const gameUpdateData: {
        points_a: number;
        points_b: number;
        winner_team?: 'A' | 'B';
      } = {
        points_a: currentPointsA,
        points_b: currentPointsB,
      };

      // ゲーム勝利時はwinner_teamも設定
      if (gameWon) {
        gameUpdateData.winner_team =
          currentPointsA > currentPointsB ? 'A' : 'B';
      }

      await supabase.from('games').update(gameUpdateData).eq('id', game_id);

      res.status(201).json({ point: data, gameWon });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'GET') {
    try {
      // 特定マッチの全ポイントを取得
      const { data: points, error } = await supabase
        .from('points')
        .select('*, games!inner(match_id)')
        .eq('games.match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.status(200).json({ points });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'PUT') {
    try {
      const {
        point_id,
        winner_team,
        serving_team,
        rally_count,
        first_serve_fault,
        double_fault,
        result_type,
        winner_player,
        loser_player,
      } = req.body;

      // ポイントの存在確認と現在の情報取得
      const { data: existingPoint, error: fetchError } = await supabase
        .from('points')
        .select('*, games!inner(id, match_id, points_a, points_b)')
        .eq('id', point_id)
        .eq('games.match_id', matchId)
        .single();

      if (fetchError || !existingPoint) {
        return res.status(404).json({ error: 'Point not found' });
      }

      const gameId = existingPoint.game_id;

      // ポイント情報を更新
      const { data: updatedPoint, error: updateError } = await supabase
        .from('points')
        .update({
          winner_team,
          serving_team,
          rally_count,
          first_serve_fault,
          double_fault,
          result_type,
          winner_player,
          loser_player,
        })
        .eq('id', point_id)
        .select()
        .single();

      if (updateError) {
        return res.status(400).json({ error: updateError.message });
      }

      // ゲームスコアを再計算
      await recalculateGameScore(gameId);

      res.status(200).json({ point: updatedPoint });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { point_id } = req.body;

      // ポイントの存在確認
      const { data: existingPoint, error: fetchError } = await supabase
        .from('points')
        .select('*, games!inner(id, match_id)')
        .eq('id', point_id)
        .eq('games.match_id', matchId)
        .single();

      if (fetchError || !existingPoint) {
        return res.status(404).json({ error: 'Point not found' });
      }

      const gameId = existingPoint.game_id;

      // ポイントを削除
      const { error: deleteError } = await supabase
        .from('points')
        .delete()
        .eq('id', point_id);

      if (deleteError) {
        return res.status(400).json({ error: deleteError.message });
      }

      // ゲームスコアを再計算
      await recalculateGameScore(gameId);

      res.status(200).json({ message: 'Point deleted successfully' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
