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
      const { game_number } = req.body;

      // 新しいゲームを作成
      const { data: game, error } = await supabase
        .from('games')
        .insert([
          {
            match_id: matchId as string,
            game_number,
            points_a: 0,
            points_b: 0,
          },
        ])
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.status(201).json({ game });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
