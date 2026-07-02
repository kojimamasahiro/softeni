/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';

import { getServerSupabase, loadMatchWithRelations, sendMethodNotAllowed, sendSupabaseError } from '@/lib/matchesApi';
import { isScoreSiteMode } from '@/lib/siteConfig';
import type { Match } from '@/types/database';

type TeamKey = 'A' | 'B';

type EditableTeamPlayer = {
  last_name?: string | null;
  first_name?: string | null;
  team_name?: string | null;
  region?: string | null;
};

type EditableTeam = {
  entry_number?: string | null;
  players?: EditableTeamPlayer[];
};

type UpdateMatchBody = Partial<
  Pick<
    Match,
    | 'match_date'
    | 'court_name'
    | 'status'
    | 'completed_at'
    | 'opponent_level'
    | 'source_site_match_id'
    | 'source_site_tournament_id'
    | 'youtube_video_id'
    | 'youtube_url'
    | 'youtube_embed_allowed'
    | 'team_a'
    | 'team_b'
    | 'team_a_entry_number'
    | 'team_a_player1_last_name'
    | 'team_a_player1_first_name'
    | 'team_a_player1_team_name'
    | 'team_a_player1_region'
    | 'team_a_player2_last_name'
    | 'team_a_player2_first_name'
    | 'team_a_player2_team_name'
    | 'team_a_player2_region'
    | 'team_b_entry_number'
    | 'team_b_player1_last_name'
    | 'team_b_player1_first_name'
    | 'team_b_player1_team_name'
    | 'team_b_player1_region'
    | 'team_b_player2_last_name'
    | 'team_b_player2_first_name'
    | 'team_b_player2_team_name'
    | 'team_b_player2_region'
    | 'teams'
  >
> & {
  teams?: {
    A?: EditableTeam;
    B?: EditableTeam;
  } | null;
};

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildTeamDisplay = (team: EditableTeam) => {
  const entryNumber = normalizeString(team.entry_number);
  const players = (team.players ?? [])
    .map((player) => {
      const lastName = normalizeString(player.last_name);
      const firstName = normalizeString(player.first_name);
      const teamName = normalizeString(player.team_name);
      const region = normalizeString(player.region);

      const name = [lastName, firstName].filter(Boolean).join(' ').trim();
      const details = [name || null, teamName ? `(${teamName})` : null, region ? `[${region}]` : null].filter(Boolean).join(' ').trim();

      return details || null;
    })
    .filter(Boolean);

  const display = [entryNumber, players.join(' / ')].filter(Boolean).join(' ');
  return display || null;
};

const buildStructuredTeam = (body: UpdateMatchBody, teamKey: TeamKey): EditableTeam => {
  const prefix = `team_${teamKey.toLowerCase()}` as 'team_a' | 'team_b';

  const player1: EditableTeamPlayer = {
    last_name: normalizeString(body[`${prefix}_player1_last_name`]),
    first_name: normalizeString(body[`${prefix}_player1_first_name`]),
    team_name: normalizeString(body[`${prefix}_player1_team_name`]),
    region: normalizeString(body[`${prefix}_player1_region`]),
  };

  const player2: EditableTeamPlayer = {
    last_name: normalizeString(body[`${prefix}_player2_last_name`]),
    first_name: normalizeString(body[`${prefix}_player2_first_name`]),
    team_name: normalizeString(body[`${prefix}_player2_team_name`]),
    region: normalizeString(body[`${prefix}_player2_region`]),
  };

  const players = [player1, player2].filter((player) => Object.values(player).some(Boolean));

  return {
    entry_number: normalizeString(body[`${prefix}_entry_number`]),
    players,
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { matchId } = req.query;
  if (typeof matchId !== 'string') {
    return res.status(400).json({ error: 'Invalid match id.' });
  }

  const supabase = getServerSupabase();

  if (req.method === 'GET') {
    try {
      const match = await loadMatchWithRelations(supabase, matchId);
      if (!match) {
        return res.status(404).json({ error: 'Match not found.' });
      }

      return res.status(200).json({ match });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to load match.');
    }
  }

  if (req.method === 'PATCH') {
    if (isScoreSiteMode()) {
      return res.status(404).json({ error: 'Not found.' });
    }

    try {
      const body = req.body as UpdateMatchBody;
      const allowedUpdates: Record<string, unknown> = {};
      const teamFieldKeys = [
        'team_a_entry_number',
        'team_a_player1_last_name',
        'team_a_player1_first_name',
        'team_a_player1_team_name',
        'team_a_player1_region',
        'team_a_player2_last_name',
        'team_a_player2_first_name',
        'team_a_player2_team_name',
        'team_a_player2_region',
        'team_b_entry_number',
        'team_b_player1_last_name',
        'team_b_player1_first_name',
        'team_b_player1_team_name',
        'team_b_player1_region',
        'team_b_player2_last_name',
        'team_b_player2_first_name',
        'team_b_player2_team_name',
        'team_b_player2_region',
      ] as const;

      (
        [
          'match_date',
          'court_name',
          'status',
          'completed_at',
          'opponent_level',
          'source_site_match_id',
          'source_site_tournament_id',
          'youtube_video_id',
          'youtube_url',
          'youtube_embed_allowed',
        ] as const
      ).forEach((key) => {
        if (key in body) {
          allowedUpdates[key] = body[key] ?? null;
        }
      });

      teamFieldKeys.forEach((key) => {
        if (key in body) {
          allowedUpdates[key] = normalizeString(body[key]);
        }
      });

      const shouldRebuildTeams = 'teams' in body || teamFieldKeys.some((key) => key in body);

      if (shouldRebuildTeams) {
        const nextTeams = {
          A: buildStructuredTeam(body, 'A'),
          B: buildStructuredTeam(body, 'B'),
        };

        allowedUpdates.teams = nextTeams;
        allowedUpdates.team_a = buildTeamDisplay(nextTeams.A);
        allowedUpdates.team_b = buildTeamDisplay(nextTeams.B);
      }

      const { data: match, error } = await (supabase as any).from('matches').update(allowedUpdates).eq('id', matchId).select('*').single();

      if (error) {
        throw error;
      }

      return res.status(200).json({ match });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to update match.');
    }
  }

  if (req.method === 'DELETE') {
    if (isScoreSiteMode()) {
      return res.status(404).json({ error: 'Not found.' });
    }

    try {
      const { data: games, error: gamesError } = await (supabase as any).from('games').select('id').eq('match_id', matchId);

      if (gamesError) {
        throw gamesError;
      }

      const gameIds = (games ?? []).map((game: { id: string }) => game.id);
      if (gameIds.length > 0) {
        const { error: pointsError } = await (supabase as any).from('points').delete().in('game_id', gameIds);

        if (pointsError) {
          throw pointsError;
        }
      }

      const { error: deleteGamesError } = await (supabase as any).from('games').delete().eq('match_id', matchId);

      if (deleteGamesError) {
        throw deleteGamesError;
      }

      const { error: deleteMatchError } = await (supabase as any).from('matches').delete().eq('id', matchId);

      if (deleteMatchError) {
        throw deleteMatchError;
      }

      return res.status(200).json({ ok: true });
    } catch (error) {
      return sendSupabaseError(res, error as Error, 'Failed to delete match.');
    }
  }

  return sendMethodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
}
