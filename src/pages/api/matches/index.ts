import { NextApiRequest, NextApiResponse } from 'next';

import { createServerClient } from '../../../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const supabase = createServerClient();

  if (req.method === 'POST') {
    try {
      const {
        tournament_name,
        tournament_generation,
        tournament_gender,
        tournament_category,
        round_name,
        team_a,
        team_b,
        best_of = 5,
      } = req.body;

      console.log('Creating match with data:', {
        tournament_name,
        tournament_generation,
        tournament_gender,
        tournament_category,
        round_name,
        team_a,
        team_b,
        best_of,
      });

      // マッチを作成
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert([
          {
            tournament_name,
            tournament_generation,
            tournament_gender,
            tournament_category,
            round_name,
            team_a,
            team_b,
            best_of,
          },
        ])
        .select()
        .single();

      if (matchError) {
        console.error('Match creation error:', matchError);
        return res
          .status(400)
          .json({ error: matchError.message, details: matchError });
      }

      // 初期ゲームを作成（第1ゲーム）
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert([
          {
            match_id: match.id,
            game_number: 1,
            points_a: 0,
            points_b: 0,
          },
        ])
        .select()
        .single();

      if (gameError) {
        console.error('Game creation error:', gameError);
        return res
          .status(400)
          .json({ error: gameError.message, details: gameError });
      }

      res.status(201).json({ match, game });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'GET') {
    try {
      const { data: matches, error } = await supabase
        .from('matches')
        .select('*, games(*, points(*))')
        .order('created_at', { ascending: false });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.status(200).json({ matches });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
