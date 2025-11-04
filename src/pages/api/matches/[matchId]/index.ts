import { NextApiRequest, NextApiResponse } from 'next';

import { createServerClient } from '../../../../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { matchId } = req.query;
  const supabase = createServerClient();

  if (req.method === 'GET') {
    try {
      const { data: match, error } = await supabase
        .from('matches')
        .select('*, games(*, points(*))')
        .eq('id', matchId)
        .single();

      if (error) {
        return res.status(404).json({ error: 'Match not found' });
      }

      res.status(200).json({ match });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'DELETE') {
    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (error) {
        console.error('Match deletion error:', error);
        return res.status(400).json({ error: error.message });
      }

      res.status(200).json({ message: 'Match deleted successfully' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
