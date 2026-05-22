/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getServerSupabase,
  sendMethodNotAllowed,
  sendSupabaseError,
} from '@/lib/matchesApi';
import { isScoreSiteMode } from '@/lib/siteConfig';

type UpdateCandidateBody = {
  status?: 'pending' | 'confirmed' | 'excluded' | null;
  winner_team?: 'A' | 'B' | null;
  serving_team?: 'A' | 'B' | null;
  serving_player?: string | null;
  rally_count?: number | null;
  first_serve_fault?: boolean | null;
  double_fault?: boolean | null;
  result_type?: string | null;
  winner_player?: string | null;
  loser_player?: string | null;
  notes?: string | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'PATCH') {
    return sendMethodNotAllowed(res, ['PATCH']);
  }

  if (isScoreSiteMode()) {
    return res.status(404).json({ error: 'Not found.' });
  }

  const { sessionId, candidateId } = req.query;
  if (typeof sessionId !== 'string' || typeof candidateId !== 'string') {
    return res.status(400).json({ error: 'Invalid route parameters.' });
  }

  const body = req.body as UpdateCandidateBody;
  const supabase = getServerSupabase();

  try {
    const updates = {
      status: body.status ?? undefined,
      winner_team: body.winner_team ?? null,
      serving_team: body.serving_team ?? null,
      serving_player: body.serving_player ?? null,
      rally_count:
        typeof body.rally_count === 'number' ? body.rally_count : null,
      first_serve_fault:
        typeof body.first_serve_fault === 'boolean'
          ? body.first_serve_fault
          : null,
      double_fault:
        typeof body.double_fault === 'boolean' ? body.double_fault : null,
      result_type: body.result_type ?? null,
      winner_player: body.winner_player ?? null,
      loser_player: body.loser_player ?? null,
      notes: body.notes ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data: candidate, error } = await (supabase as any)
      .from('match_point_candidates')
      .update(updates)
      .eq('id', candidateId)
      .eq('session_id', sessionId)
      .select('*')
      .single();

    if (error) throw error;

    return res.status(200).json({ candidate });
  } catch (error) {
    return sendSupabaseError(
      res,
      error as Error,
      'Failed to update point candidate.',
    );
  }
}
