import type { NextApiRequest, NextApiResponse } from 'next';

import { getServerSupabase, sendMethodNotAllowed, sendSupabaseError } from '@/lib/matchesApi';
import { loadVideoSessionWithCandidates } from '@/lib/videoReview';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const { matchId, sessionId } = req.query;
  if (typeof matchId !== 'string' || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Invalid route parameters.' });
  }

  const supabase = getServerSupabase();

  try {
    const session = await loadVideoSessionWithCandidates(supabase, matchId, sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    return res.status(200).json({ session });
  } catch (error) {
    return sendSupabaseError(res, error as Error, 'Failed to load video session.');
  }
}
