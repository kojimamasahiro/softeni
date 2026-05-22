/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getServerSupabase,
  loadMatchesWithRelations,
  sendMethodNotAllowed,
  sendSupabaseError,
} from '@/lib/matchesApi';
import { isScoreSiteMode } from '@/lib/siteConfig';
import type { Match } from '@/types/database';

type CreateMatchBody = Omit<Match, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const supabase = getServerSupabase();

  if (req.method === 'GET') {
    try {
      const matches = await loadMatchesWithRelations(supabase);
      return res.status(200).json({ matches });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to load matches.');
    }
  }

  if (req.method === 'POST') {
    if (isScoreSiteMode()) {
      return res.status(404).json({ error: 'Not found.' });
    }

    try {
      const body = req.body as CreateMatchBody;
      const { data: match, error } = await (supabase as any)
        .from('matches')
        .insert(body)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return res.status(201).json({ match });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to create match.');
    }
  }

  return sendMethodNotAllowed(res, ['GET', 'POST']);
}
