/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getServerSupabase,
  sendMethodNotAllowed,
  sendSupabaseError,
} from '@/lib/matchesApi';
import { isScoreSiteMode } from '@/lib/siteConfig';
import {
  buildHeuristicCandidates,
  loadVideoSessionById,
  loadVideoSessionWithCandidates,
} from '@/lib/videoReview';

type SegmentBody = {
  duration_ms?: number | null;
  point_interval_ms?: number | null;
  clip_lead_ms?: number | null;
  clip_tail_ms?: number | null;
  start_offset_ms?: number | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
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

  const {
    duration_ms,
    point_interval_ms,
    clip_lead_ms,
    clip_tail_ms,
    start_offset_ms,
  } = req.body as SegmentBody;
  const supabase = getServerSupabase();

  try {
    const session = await loadVideoSessionById(supabase, matchId, sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const durationMs = Number(duration_ms ?? session.duration_ms ?? 0);
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return res.status(400).json({ error: 'duration_ms is required.' });
    }

    const { error: deleteError } = await (supabase as any)
      .from('match_point_candidates')
      .delete()
      .eq('session_id', sessionId);

    if (deleteError) throw deleteError;

    const candidates = buildHeuristicCandidates({
      sessionId,
      durationMs,
      pointIntervalMs:
        typeof point_interval_ms === 'number' ? point_interval_ms : undefined,
      clipLeadMs: typeof clip_lead_ms === 'number' ? clip_lead_ms : undefined,
      clipTailMs: typeof clip_tail_ms === 'number' ? clip_tail_ms : undefined,
      startOffsetMs:
        typeof start_offset_ms === 'number' ? start_offset_ms : undefined,
    });

    const { error: insertError } = await (supabase as any)
      .from('match_point_candidates')
      .insert(candidates);

    if (insertError) throw insertError;

    const { error: sessionUpdateError } = await (supabase as any)
      .from('match_video_sessions')
      .update({
        duration_ms: durationMs,
        processing_status: 'reviewing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (sessionUpdateError) throw sessionUpdateError;

    const updatedSession = await loadVideoSessionWithCandidates(
      supabase,
      matchId,
      sessionId,
    );

    return res.status(200).json({
      session: updatedSession,
      candidateCount: updatedSession?.candidates?.length ?? 0,
    });
  } catch (error) {
    return sendSupabaseError(
      res,
      error as Error,
      'Failed to generate point candidates.',
    );
  }
}
