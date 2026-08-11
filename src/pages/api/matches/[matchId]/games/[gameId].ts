/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';

import { getServerSupabase, sendMethodNotAllowed, sendSupabaseError } from '@/lib/matchesApi';
import { isScoreSiteMode } from '@/lib/siteConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    return sendMethodNotAllowed(res, ['PATCH']);
  }

  const { matchId, gameId } = req.query;
  if (typeof matchId !== 'string' || typeof gameId !== 'string') {
    return res.status(400).json({ error: 'Invalid route parameters.' });
  }

  const { initial_serve_team, initial_serve_player_index, initial_receive_player_index } = req.body as {
    initial_serve_team?: 'A' | 'B' | null;
    initial_serve_player_index?: number | null;
    initial_receive_player_index?: number | null;
  };

  if (initial_serve_team !== 'A' && initial_serve_team !== 'B') {
    return res.status(400).json({ error: 'initial_serve_team is required.' });
  }

  const supabase = getServerSupabase();

  if (isScoreSiteMode()) {
    return res.status(404).json({ error: 'Not found.' });
  }

  const updateGame = (payload: Record<string, unknown>) =>
    (supabase as any).from('games').update(payload).eq('id', gameId).eq('match_id', matchId).select('*').single();

  /** `initial_receive_player_index` 未追加（docs/sql/receive-order.sql 未適用）のスキーマか判定する。 */
  const isMissingReceiveColumn = (error: { code?: string; message?: string } | null) =>
    Boolean(error && (error.code === 'PGRST204' || error.code === '42703') && error.message?.includes('initial_receive_player_index'));

  try {
    const basePayload = {
      initial_serve_team,
      initial_serve_player_index: initial_serve_player_index ?? 0,
    };

    let { data: game, error } = await updateGame({
      ...basePayload,
      initial_receive_player_index: initial_receive_player_index ?? 0,
    });

    // migration 未適用でもゲーム開始自体は止めない。
    // ただしレシーブ順が保存されないため、レシーブ失敗の自動推定は 0 番目の選手固定になる。
    if (isMissingReceiveColumn(error)) {
      console.warn(
        '[games] initial_receive_player_index 列がありません。docs/sql/receive-order.sql を Supabase に適用してください。今回はレシーブ順を保存せずに続行します。',
      );
      ({ data: game, error } = await updateGame(basePayload));
    }

    if (error) {
      throw error;
    }

    return res.status(200).json({ game });
  } catch (error) {
    return sendSupabaseError(res, error as Error, 'Failed to update game.');
  }
}
