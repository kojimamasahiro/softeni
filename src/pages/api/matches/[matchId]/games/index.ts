/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';

import { getServerSupabase, loadMatchWithRelations, sendMethodNotAllowed, sendSupabaseError } from '@/lib/matchesApi';
import { isScoreSiteMode } from '@/lib/siteConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  const { matchId } = req.query;
  if (typeof matchId !== 'string') {
    return res.status(400).json({ error: 'Invalid match id.' });
  }

  const { game_number } = req.body as { game_number?: number };
  if (typeof game_number !== 'number') {
    return res.status(400).json({ error: 'game_number is required.' });
  }

  const supabase = getServerSupabase();

  if (isScoreSiteMode()) {
    return res.status(404).json({ error: 'Not found.' });
  }

  try {
    const match = await loadMatchWithRelations(supabase, matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found.' });
    }

    const activeGame = match.games?.find((game) => !game.winner_team);
    if (activeGame) {
      return res.status(409).json({ error: 'An active game already exists.' });
    }

    const { data: game, error } = await (supabase as any)
      .from('games')
      .insert({
        match_id: matchId,
        game_number,
        winner_team: null,
        points_a: 0,
        points_b: 0,
        initial_serve_team: null,
        initial_serve_player_index: null,
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ game });
  } catch (error) {
    return sendSupabaseError(res, error as Error, 'Failed to create game.');
  }
}
