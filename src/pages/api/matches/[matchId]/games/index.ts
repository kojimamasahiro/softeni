/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';

import { getServerSupabase, loadMatchWithRelations, sendMethodNotAllowed, sendSupabaseError } from '@/lib/matchesApi';
import { isScoreSiteMode } from '@/lib/siteConfig';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return sendMethodNotAllowed(res, ['POST', 'DELETE']);
  }

  const { matchId } = req.query;
  if (typeof matchId !== 'string') {
    return res.status(400).json({ error: 'Invalid match id.' });
  }

  const supabase = getServerSupabase();

  if (isScoreSiteMode()) {
    return res.status(404).json({ error: 'Not found.' });
  }

  // 指定ゲーム以降をまとめて削除して、そのゲームからやり直せるようにする。
  // 途中のゲームだけを差し替えると以降のゲームの前提（勝ちゲーム数・ファイナル判定・サーブ交代）が
  // 崩れるため、対象ゲーム番号以上をすべて消す方式にしている。
  if (req.method === 'DELETE') {
    const { from_game_number } = req.body as { from_game_number?: number };
    if (typeof from_game_number !== 'number' || from_game_number < 1) {
      return res.status(400).json({ error: 'from_game_number is required.' });
    }

    try {
      const match = await loadMatchWithRelations(supabase, matchId);
      if (!match) {
        return res.status(404).json({ error: 'Match not found.' });
      }

      const targetGames = (match.games ?? []).filter((game) => game.game_number >= from_game_number);
      if (targetGames.length === 0) {
        return res.status(404).json({ error: 'No games to delete.' });
      }

      const targetGameIds = targetGames.map((game) => game.id);

      // 外部キーの ON DELETE 設定に依存しないよう、ポイントを先に明示的に削除する
      const { error: pointsError } = await (supabase as any).from('points').delete().in('game_id', targetGameIds);
      if (pointsError) {
        throw pointsError;
      }

      const { error: gamesError } = await (supabase as any).from('games').delete().in('id', targetGameIds);
      if (gamesError) {
        throw gamesError;
      }

      // 削除で試合終了の条件が崩れるため、完了状態を解除する
      if (match.status === 'completed') {
        const { error: matchError } = await (supabase as any).from('matches').update({ status: 'in_progress', completed_at: null }).eq('id', matchId);

        if (matchError) {
          throw matchError;
        }
      }

      const deletedPointCount = targetGames.reduce((total, game) => total + (game.points?.length ?? 0), 0);

      return res.status(200).json({
        ok: true,
        deletedGameCount: targetGames.length,
        deletedPointCount,
      });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to delete games.');
    }
  }

  const { game_number } = req.body as { game_number?: number };
  if (typeof game_number !== 'number') {
    return res.status(400).json({ error: 'game_number is required.' });
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
        // initial_receive_player_index は既定 null。migration 未適用の環境でも insert が通るよう明示しない。
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
