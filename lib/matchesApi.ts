/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiResponse } from 'next';
import type { PostgrestError } from '@supabase/supabase-js';

import { getPointsToWinForGame, isWinningScore } from '@/lib/matchRules';
import { createServerClient } from '@/lib/supabase';
import type { Game, Match, Point } from '@/types/database';

type ApiResponse = NextApiResponse;
type ServerClient = ReturnType<typeof createServerClient>;

const groupPointsByGameId = (points: Point[]) => {
  const pointsByGameId = new Map<string, Point[]>();

  points.forEach((point) => {
    const gamePoints = pointsByGameId.get(point.game_id) ?? [];
    gamePoints.push(point);
    pointsByGameId.set(point.game_id, gamePoints);
  });

  pointsByGameId.forEach((gamePoints) => {
    gamePoints.sort((a, b) => a.point_number - b.point_number);
  });

  return pointsByGameId;
};

export const getServerSupabase = () => createServerClient() as ServerClient;

export const loadMatchWithRelations = async (
  supabase: ServerClient,
  matchId: string,
): Promise<Match | null> => {
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (matchError) {
    throw matchError;
  }

  if (!match) {
    return null;
  }

  const { data: games, error: gamesError } = await (supabase as any)
    .from('games')
    .select('*')
    .eq('match_id', matchId)
    .order('game_number', { ascending: true });

  if (gamesError) {
    throw gamesError;
  }

  const safeGames = (games ?? []) as Game[];
  const gameIds = safeGames.map((game) => game.id);

  let pointsByGameId = new Map<string, Point[]>();
  if (gameIds.length > 0) {
    const { data: points, error: pointsError } = await (supabase as any)
      .from('points')
      .select('*')
      .in('game_id', gameIds)
      .order('point_number', { ascending: true });

    if (pointsError) {
      throw pointsError;
    }

    pointsByGameId = groupPointsByGameId((points ?? []) as Point[]);
  }

  return {
    ...(match as Match),
    games: safeGames.map((game) => ({
      ...game,
      points: pointsByGameId.get(game.id) ?? [],
    })),
  };
};

export const loadMatchesWithRelations = async (
  supabase: ServerClient,
): Promise<Match[]> => {
  const { data: matches, error } = await (supabase as any)
    .from('matches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const safeMatches = (matches ?? []) as Match[];
  return Promise.all(
    safeMatches.map(async (match) => {
      const detailedMatch = await loadMatchWithRelations(supabase, match.id);
      return detailedMatch ?? match;
    }),
  );
};

const decideGameWinner = (
  pointsA: number,
  pointsB: number,
  pointsToWin: number,
): 'A' | 'B' | null => {
  if (!isWinningScore(pointsA, pointsB, pointsToWin)) {
    if (!isWinningScore(pointsB, pointsA, pointsToWin)) {
      return null;
    }

    return 'B';
  }

  return 'A';
};

export const recomputeGameScore = async (
  supabase: ServerClient,
  gameId: string,
) => {
  const { data: game, error: gameError } = await (supabase as any)
    .from('games')
    .select('id, match_id, game_number')
    .eq('id', gameId)
    .single();

  if (gameError) {
    throw gameError;
  }

  const { data: match, error: matchError } = await (supabase as any)
    .from('matches')
    .select('best_of')
    .eq('id', game.match_id)
    .single();

  if (matchError) {
    throw matchError;
  }

  const { data: previousGames, error: previousGamesError } = await (
    supabase as any
  )
    .from('games')
    .select('winner_team')
    .eq('match_id', game.match_id)
    .lt('game_number', game.game_number);

  if (previousGamesError) {
    throw previousGamesError;
  }

  const { data: points, error: pointsError } = await (supabase as any)
    .from('points')
    .select('*')
    .eq('game_id', gameId)
    .order('point_number', { ascending: true });

  if (pointsError) {
    throw pointsError;
  }

  const safePoints = (points ?? []) as Point[];
  const pointsA = safePoints.filter(
    (point) => point.winner_team === 'A',
  ).length;
  const pointsB = safePoints.filter(
    (point) => point.winner_team === 'B',
  ).length;
  const gamesWonA = (
    (previousGames ?? []) as Pick<Game, 'winner_team'>[]
  ).filter((previousGame) => previousGame.winner_team === 'A').length;
  const gamesWonB = (
    (previousGames ?? []) as Pick<Game, 'winner_team'>[]
  ).filter((previousGame) => previousGame.winner_team === 'B').length;
  const pointsToWin = getPointsToWinForGame(
    (match as Pick<Match, 'best_of'>).best_of,
    gamesWonA,
    gamesWonB,
  );
  const winnerTeam = decideGameWinner(pointsA, pointsB, pointsToWin);

  const { data: updatedGame, error: updateError } = await (supabase as any)
    .from('games')
    .update({
      points_a: pointsA,
      points_b: pointsB,
      winner_team: winnerTeam,
    })
    .eq('id', gameId)
    .select('*')
    .single();

  if (updateError) {
    throw updateError;
  }

  return {
    updatedGame: updatedGame as Game,
    points: safePoints,
  };
};

export const renumberPoints = async (
  supabase: ServerClient,
  gameId: string,
) => {
  const { data: points, error } = await (supabase as any)
    .from('points')
    .select('id, point_number')
    .eq('game_id', gameId)
    .order('point_number', { ascending: true });

  if (error) {
    throw error;
  }

  const safePoints = points ?? [];
  await Promise.all(
    safePoints.map((point: any, index: number) => {
      const nextPointNumber = index + 1;
      if (point.point_number === nextPointNumber) {
        return Promise.resolve();
      }

      return (supabase as any)
        .from('points')
        .update({ point_number: nextPointNumber })
        .eq('id', point.id)
        .then(({ error: updateError }: { error: PostgrestError | null }) => {
          if (updateError) throw updateError;
        });
    }),
  );
};

export const sendMethodNotAllowed = (res: ApiResponse, methods: string[]) => {
  res.setHeader('Allow', methods);
  res
    .status(405)
    .json({ error: `Method ${String(res.req?.method)} Not Allowed` });
};

export const sendSupabaseError = (
  res: ApiResponse,
  error: PostgrestError | Error,
  fallbackMessage: string,
) => {
  console.error(fallbackMessage, error);
  res.status(500).json({
    error:
      'message' in error && typeof error.message === 'string'
        ? error.message
        : fallbackMessage,
  });
};
