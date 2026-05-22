/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getServerSupabase,
  sendMethodNotAllowed,
  sendSupabaseError,
} from '@/lib/matchesApi';
import { isScoreSiteMode } from '@/lib/siteConfig';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PATCH') {
    return sendMethodNotAllowed(res, ['PATCH']);
  }

  const { matchId, gameId } = req.query;
  if (typeof matchId !== 'string' || typeof gameId !== 'string') {
    return res.status(400).json({ error: 'Invalid route parameters.' });
  }

  const { initial_serve_team, initial_serve_player_index } = req.body as {
    initial_serve_team?: 'A' | 'B' | null;
    initial_serve_player_index?: number | null;
  };

  if (initial_serve_team !== 'A' && initial_serve_team !== 'B') {
    return res.status(400).json({ error: 'initial_serve_team is required.' });
  }

  const supabase = getServerSupabase();

  if (isScoreSiteMode()) {
    return res.status(404).json({ error: 'Not found.' });
  }

  try {
    const { data: game, error } = await (supabase as any)
      .from('games')
      .update({
        initial_serve_team,
        initial_serve_player_index: initial_serve_player_index ?? 0,
      })
      .eq('id', gameId)
      .eq('match_id', matchId)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({ game });
  } catch (error) {
    return sendSupabaseError(res, error as Error, 'Failed to update game.');
  }
}
