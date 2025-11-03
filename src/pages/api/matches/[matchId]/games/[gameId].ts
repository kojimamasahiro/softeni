import { NextApiRequest, NextApiResponse } from 'next';

import { createServerClient } from '../../../../../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { matchId, gameId } = req.query;
  const supabase = createServerClient();

  if (req.method === 'PATCH') {
    try {
      const { initial_serve_team } = req.body;

      // ゲーム情報を更新
      const { data: game, error } = await supabase
        .from('games')
        .update({
          initial_serve_team,
        })
        .eq('id', gameId as string)
        .eq('match_id', matchId as string)
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.status(200).json({ game });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['PATCH']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
