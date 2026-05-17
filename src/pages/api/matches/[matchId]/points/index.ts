/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getServerSupabase,
  recomputeGameScore,
  renumberPoints,
  sendMethodNotAllowed,
  sendSupabaseError,
} from '@/lib/matchesApi';
import type { Point } from '@/types/database';

type InsertPointBody = Omit<Point, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

type UpdatePointBody = {
  point_id: string;
} & Partial<Omit<Point, 'id' | 'created_at'>>;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { matchId } = req.query;
  if (typeof matchId !== 'string') {
    return res.status(400).json({ error: 'Invalid match id.' });
  }

  const supabase = getServerSupabase();

  if (req.method === 'POST') {
    try {
      const body = req.body as InsertPointBody;
      if (!body.game_id || typeof body.point_number !== 'number') {
        return res
          .status(400)
          .json({ error: 'game_id and point_number are required.' });
      }

      const { data: point, error } = await (supabase as any)
        .from('points')
        .insert(body)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      const { updatedGame } = await recomputeGameScore(supabase, body.game_id);
      return res.status(201).json({
        point,
        updatedGame,
        matchStats: null,
      });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to create point.');
    }
  }

  if (req.method === 'PUT') {
    try {
      const { point_id, ...updates } = req.body as UpdatePointBody;
      if (!point_id) {
        return res.status(400).json({ error: 'point_id is required.' });
      }

      const { data: existingPoint, error: existingPointError } = await (
        supabase as any
      )
        .from('points')
        .select('*')
        .eq('id', point_id)
        .single();

      if (existingPointError) {
        throw existingPointError;
      }

      const { data: point, error } = await (supabase as any)
        .from('points')
        .update(updates)
        .eq('id', point_id)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      const { updatedGame } = await recomputeGameScore(
        supabase,
        existingPoint.game_id,
      );

      return res.status(200).json({
        point,
        updatedGame,
        matchStats: null,
      });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to update point.');
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { point_id } = req.body as { point_id?: string };
      if (!point_id) {
        return res.status(400).json({ error: 'point_id is required.' });
      }

      const { data: existingPoint, error: existingPointError } = await (
        supabase as any
      )
        .from('points')
        .select('*')
        .eq('id', point_id)
        .single();

      if (existingPointError) {
        throw existingPointError;
      }

      const { error } = await (supabase as any)
        .from('points')
        .delete()
        .eq('id', point_id);
      if (error) {
        throw error;
      }

      await renumberPoints(supabase, existingPoint.game_id);
      const { updatedGame } = await recomputeGameScore(
        supabase,
        existingPoint.game_id,
      );

      return res.status(200).json({
        ok: true,
        updatedGame,
      });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to delete point.');
    }
  }

  return sendMethodNotAllowed(res, ['POST', 'PUT', 'DELETE']);
}
