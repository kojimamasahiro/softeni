import { NextApiRequest, NextApiResponse } from 'next';

import { createServerClient } from '../../../../../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { matchId } = req.query;
  const supabase = createServerClient();

  if (req.method === 'POST') {
    try {
      const {
        game_id,
        point_number,
        winner_team,
        rally_count,
        first_serve_fault,
        double_fault,
        result_type,
        winner_player,
        loser_player,
      } = req.body;

      // ポイントを登録
      const { data: point, error: pointError } = await supabase
        .from('points')
        .insert([
          {
            game_id,
            point_number,
            winner_team,
            rally_count,
            first_serve_fault,
            double_fault,
            result_type,
            winner_player,
            loser_player,
          },
        ])
        .select()
        .single();

      if (pointError) {
        return res.status(400).json({ error: pointError.message });
      }

      // ゲームのスコアを更新
      if (winner_team) {
        const { data: game } = await supabase
          .from('games')
          .select('points_a, points_b')
          .eq('id', game_id)
          .single();

        if (game) {
          const newPointsA =
            winner_team === 'A' ? game.points_a + 1 : game.points_a;
          const newPointsB =
            winner_team === 'B' ? game.points_b + 1 : game.points_b;

          await supabase
            .from('games')
            .update({
              points_a: newPointsA,
              points_b: newPointsB,
            })
            .eq('id', game_id);

          // ゲーム終了判定（先に4ポイント取得で勝利、ジュースも考慮）
          const gameWon =
            (newPointsA >= 4 && newPointsA - newPointsB >= 2) ||
            (newPointsB >= 4 && newPointsB - newPointsA >= 2);

          if (gameWon) {
            const gameWinner = newPointsA > newPointsB ? 'A' : 'B';
            await supabase
              .from('games')
              .update({ winner_team: gameWinner })
              .eq('id', game_id);
          }
        }
      }

      res.status(201).json({ point });
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
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
