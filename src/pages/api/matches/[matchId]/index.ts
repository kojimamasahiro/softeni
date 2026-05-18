/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getServerSupabase,
  loadMatchWithRelations,
  sendMethodNotAllowed,
  sendSupabaseError,
} from '@/lib/matchesApi';
import type { Match } from '@/types/database';

type UpdateMatchBody = Partial<
  Pick<
    Match,
    | 'match_date'
    | 'court_name'
    | 'status'
    | 'completed_at'
    | 'opponent_level'
    | 'source_site_match_id'
    | 'source_site_tournament_id'
  >
>;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { matchId } = req.query;
  if (typeof matchId !== 'string') {
    return res.status(400).json({ error: 'Invalid match id.' });
  }

  const supabase = getServerSupabase();

  if (req.method === 'GET') {
    try {
      const match = await loadMatchWithRelations(supabase, matchId);
      if (!match) {
        return res.status(404).json({ error: 'Match not found.' });
      }

      return res.status(200).json({ match });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to load match.');
    }
  }

  if (req.method === 'PATCH') {
    try {
      const body = req.body as UpdateMatchBody;
      const allowedUpdates: Record<string, unknown> = {};

      (
        [
          'match_date',
          'court_name',
          'status',
          'completed_at',
          'opponent_level',
          'source_site_match_id',
          'source_site_tournament_id',
        ] as const
      ).forEach((key) => {
        if (key in body) {
          allowedUpdates[key] = body[key] ?? null;
        }
      });

      const { data: match, error } = await (supabase as any)
        .from('matches')
        .update(allowedUpdates)
        .eq('id', matchId)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json({ match });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to update match.');
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { data: games, error: gamesError } = await (supabase as any)
        .from('games')
        .select('id')
        .eq('match_id', matchId);

      if (gamesError) {
        throw gamesError;
      }

      const gameIds = (games ?? []).map((game: { id: string }) => game.id);
      if (gameIds.length > 0) {
        const { error: pointsError } = await (supabase as any)
          .from('points')
          .delete()
          .in('game_id', gameIds);

        if (pointsError) {
          throw pointsError;
        }
      }

      const { error: deleteGamesError } = await (supabase as any)
        .from('games')
        .delete()
        .eq('match_id', matchId);

      if (deleteGamesError) {
        throw deleteGamesError;
      }

      const { error: deleteMatchError } = await (supabase as any)
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (deleteMatchError) {
        throw deleteMatchError;
      }

      return res.status(200).json({ ok: true });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to delete match.');
    }
  }

  return sendMethodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
}
