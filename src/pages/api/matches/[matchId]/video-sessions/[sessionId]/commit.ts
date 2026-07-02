import type { NextApiRequest, NextApiResponse } from 'next';

import { getServerSupabase, loadMatchWithRelations, recomputeGameScore, sendMethodNotAllowed, sendSupabaseError } from '@/lib/matchesApi';
import { isScoreSiteMode } from '@/lib/siteConfig';
import { commitVideoCandidatesToMatch, loadVideoSessionWithCandidates } from '@/lib/videoReview';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, ['POST']);
  }

  if (isScoreSiteMode()) {
    return res.status(404).json({ error: 'Not found.' });
  }

  const { matchId, sessionId } = req.query;
  if (typeof matchId !== 'string' || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Invalid route parameters.' });
  }

  const supabase = getServerSupabase();

  try {
    const match = await loadMatchWithRelations(supabase, matchId);
    if (!match) {
      return res.status(404).json({ error: 'Match not found.' });
    }

    const session = await loadVideoSessionWithCandidates(supabase, matchId, sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const result = await commitVideoCandidatesToMatch({
      supabase,
      match,
      session,
      candidates: session.candidates ?? [],
      recomputeGameScore,
      loadMatchWithRelations,
    });

    const updatedMatch = await loadMatchWithRelations(supabase, matchId);

    return res.status(200).json({
      ...result,
      match: updatedMatch,
    });
  } catch (error) {
    return sendSupabaseError(res, error as Error, 'Failed to commit point candidates.');
  }
}
