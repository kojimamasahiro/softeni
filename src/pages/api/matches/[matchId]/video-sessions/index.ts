/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getServerSupabase,
  sendMethodNotAllowed,
  sendSupabaseError,
} from '@/lib/matchesApi';
import { isScoreSiteMode } from '@/lib/siteConfig';
import {
  buildYouTubeWatchUrl,
  loadVideoSessionsForMatch,
  parseYouTubeVideoId,
} from '@/lib/videoReview';

type CreateVideoSessionBody = {
  source_type?: 'youtube' | 'upload';
  source_url?: string | null;
  source_label?: string | null;
  duration_ms?: number | null;
  upload_file_name?: string | null;
  upload_file_size?: number | null;
};

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
      const sessions = await loadVideoSessionsForMatch(supabase, matchId);
      return res.status(200).json({ sessions });
    } catch (error) {
      return sendSupabaseError(
        res,
        error as Error,
        'Failed to load video sessions.',
      );
    }
  }

  if (req.method === 'POST') {
    if (isScoreSiteMode()) {
      return res.status(404).json({ error: 'Not found.' });
    }

    try {
      const body = req.body as CreateVideoSessionBody;
      if (body.source_type !== 'youtube' && body.source_type !== 'upload') {
        return res.status(400).json({ error: 'source_type is required.' });
      }

      const youtubeVideoId =
        body.source_type === 'youtube' && body.source_url
          ? parseYouTubeVideoId(body.source_url)
          : null;

      if (body.source_type === 'youtube' && !youtubeVideoId) {
        return res.status(400).json({ error: 'Invalid YouTube URL.' });
      }

      const { data: session, error } = await (supabase as any)
        .from('match_video_sessions')
        .insert({
          match_id: matchId,
          source_type: body.source_type,
          source_url:
            body.source_type === 'youtube'
              ? (buildYouTubeWatchUrl(body.source_url ?? '') ?? body.source_url)
              : null,
          source_label: body.source_label ?? null,
          youtube_video_id: youtubeVideoId,
          upload_file_name: body.upload_file_name ?? null,
          upload_file_size: body.upload_file_size ?? null,
          duration_ms: body.duration_ms ?? null,
          processing_status: 'draft',
        })
        .select('*')
        .single();

      if (error) throw error;

      return res.status(201).json({ session });
    } catch (error) {
      return sendSupabaseError(
        res,
        error as Error,
        'Failed to create video session.',
      );
    }
  }

  return sendMethodNotAllowed(res, ['GET', 'POST']);
}
