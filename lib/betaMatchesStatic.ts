import { createServerClient } from '@/lib/supabase';
import type { Game, Match, Point } from '@/types/database';

const LATEST_BETA_MATCH_LIMIT = 50;

type SupabaseServerClient = ReturnType<typeof createServerClient>;
type TeamSide = 'A' | 'B';
type RawPlayer = {
  last_name?: unknown;
  first_name?: unknown;
  name?: unknown;
};
type RawTeam = {
  name?: unknown;
  players?: RawPlayer[];
};

const isMissingTableError = (error: { code?: string } | null) => {
  return error?.code === 'PGRST205' || error?.code === '42P01';
};

const stringifyNamePart = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : '';
};

const formatPlayers = (players: RawPlayer[]) => {
  return players
    .map((player) => {
      const lastName = stringifyNamePart(player.last_name);
      const firstName = stringifyNamePart(player.first_name);
      const name = stringifyNamePart(player.name);

      if (lastName && firstName) return `${lastName} ${firstName}`;
      return lastName || name || firstName;
    })
    .filter(Boolean)
    .join('・');
};

const formatRawTeamName = (teamName: unknown): string => {
  if (!teamName) return '';
  if (typeof teamName === 'string') return teamName.trim();
  if (Array.isArray(teamName)) {
    return teamName
      .map((value) => formatRawTeamName(value))
      .filter(Boolean)
      .join('・');
  }

  if (typeof teamName === 'object') {
    const team = teamName as RawTeam;
    const players = Array.isArray(team.players)
      ? formatPlayers(team.players)
      : '';
    const name = stringifyNamePart(team.name);
    return players || name || '';
  }

  return String(teamName);
};

export const getBetaTeamDisplayName = (match: Match, team: TeamSide) => {
  const player1LastName =
    team === 'A'
      ? match.team_a_player1_last_name
      : match.team_b_player1_last_name;
  const player2LastName =
    team === 'A'
      ? match.team_a_player2_last_name
      : match.team_b_player2_last_name;

  if (player1LastName) {
    return [player1LastName, player2LastName].filter(Boolean).join('・');
  }

  const structuredTeam = match.teams?.[team];
  if (structuredTeam?.players?.length) {
    const structuredName = formatPlayers(structuredTeam.players);
    if (structuredName) return structuredName;
  }

  return formatRawTeamName(team === 'A' ? match.team_a : match.team_b);
};

const groupPointsByGameId = (points: Point[]) => {
  const pointsByGameId = new Map<string, Point[]>();

  points.forEach((point) => {
    const existing = pointsByGameId.get(point.game_id) ?? [];
    existing.push(point);
    pointsByGameId.set(point.game_id, existing);
  });

  pointsByGameId.forEach((gamePoints) => {
    gamePoints.sort((a, b) => a.point_number - b.point_number);
  });

  return pointsByGameId;
};

const attachGamesToMatches = async (
  supabase: SupabaseServerClient,
  matches: Match[],
) => {
  const matchIds = matches.map((match) => match.id);
  if (matchIds.length === 0) return matches;

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .in('match_id', matchIds)
    .order('game_number', { ascending: true });

  if (gamesError) {
    if (isMissingTableError(gamesError)) {
      return matches.map((match) => ({
        ...match,
        games: [],
      }));
    }

    throw gamesError;
  }

  const safeGames = (games ?? []) as Game[];
  const gameIds = safeGames.map((game) => game.id);
  let pointsByGameId = new Map<string, Point[]>();

  if (gameIds.length > 0) {
    const { data: points, error: pointsError } = await supabase
      .from('points')
      .select('*')
      .in('game_id', gameIds)
      .order('point_number', { ascending: true });

    if (pointsError) {
      if (!isMissingTableError(pointsError)) {
        throw pointsError;
      }
    } else {
      pointsByGameId = groupPointsByGameId((points ?? []) as Point[]);
    }
  }

  const gamesByMatchId = new Map<string, Game[]>();
  safeGames.forEach((game) => {
    const matchGames = gamesByMatchId.get(game.match_id) ?? [];
    matchGames.push({
      ...game,
      points: pointsByGameId.get(game.id) ?? [],
    });
    gamesByMatchId.set(game.match_id, matchGames);
  });

  gamesByMatchId.forEach((matchGames) => {
    matchGames.sort((a, b) => a.game_number - b.game_number);
  });

  return matches.map((match) => ({
    ...match,
    games: gamesByMatchId.get(match.id) ?? [],
  }));
};

export const getLatestBetaMatches = async (limit = LATEST_BETA_MATCH_LIMIT) => {
  const supabase = createServerClient();

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return attachGamesToMatches(supabase, (matches ?? []) as Match[]);
};

export const getLatestBetaMatchIds = async (
  limit = LATEST_BETA_MATCH_LIMIT,
) => {
  const matches = await getLatestBetaMatches(limit);
  return matches.map((match) => match.id);
};

export const getBetaMatchById = async (matchId: string) => {
  const supabase = createServerClient();

  const { data: match, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (error || !match) {
    return null;
  }

  const [matchWithGames] = await attachGamesToMatches(supabase, [
    match as Match,
  ]);

  return matchWithGames;
};
