/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  Game,
  Match,
  MatchPointCandidate,
  MatchVideoSession,
  Point,
} from '@/types/database';

export const VIDEO_REVIEW_RESULT_TYPES = [
  { value: '', label: '未設定' },
  { value: 'winner', label: '決定打' },
  { value: 'service_ace', label: 'サービスエース' },
  { value: 'smash_winner', label: 'スマッシュウィナー' },
  { value: 'volley_winner', label: 'ボレーウィナー' },
  { value: 'passing_winner', label: 'ストロークウィナー' },
  { value: 'drop_winner', label: 'ドロップウィナー' },
  { value: 'net_in_winner', label: 'ネットインウィナー' },
  { value: 'net', label: 'ネット' },
  { value: 'out', label: 'アウト' },
  { value: 'smash_error', label: 'スマッシュミス' },
  { value: 'volley_error', label: 'ボレーミス' },
  { value: 'double_fault', label: 'ダブルフォルト' },
  { value: 'receive_error', label: 'レシーブミス' },
  { value: 'follow_error', label: 'フォローミス' },
  { value: 'forced_error', label: 'ミス誘発' },
  { value: 'unforced_error', label: '凡ミス' },
] as const;

export const parseYouTubeVideoId = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const directIdMatch = trimmed.match(/^[a-zA-Z0-9_-]{11}$/);
  if (directIdMatch) return directIdMatch[0];

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace('/', '').slice(0, 11) || null;
    }

    if (url.hostname.includes('youtube.com')) {
      const fromQuery = url.searchParams.get('v');
      if (fromQuery) return fromQuery.slice(0, 11);

      const parts = url.pathname.split('/').filter(Boolean);
      const embedIndex = parts.findIndex((part) =>
        ['embed', 'shorts', 'live'].includes(part),
      );
      if (embedIndex >= 0 && parts[embedIndex + 1]) {
        return parts[embedIndex + 1].slice(0, 11);
      }
    }
  } catch {
    return null;
  }

  return null;
};

const toPointPlayerName = (value: string | null | undefined) => {
  if (!value) return null;
  if (value.includes('-')) {
    const parts = value.split('-');
    if (parts.length >= 3) {
      return parts.slice(2).join('-') || value;
    }
  }
  return value;
};

export const buildYouTubeWatchUrl = (input: string) => {
  const videoId = parseYouTubeVideoId(input);
  if (!videoId) return null;
  return `https://www.youtube.com/watch?v=${videoId}`;
};

export const buildYouTubeEmbedUrl = (input: string, startSeconds = 0) => {
  const videoId = parseYouTubeVideoId(input);
  if (!videoId) return null;

  const url = new URL(`https://www.youtube.com/embed/${videoId}`);
  url.searchParams.set('rel', '0');
  url.searchParams.set('playsinline', '1');
  if (startSeconds > 0) {
    url.searchParams.set(
      'start',
      String(Math.max(0, Math.floor(startSeconds))),
    );
    url.searchParams.set('autoplay', '1');
  }

  return url.toString();
};

export const formatDurationLabel = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
    2,
    '0',
  )}`;
};

export const getConfidenceLabel = (confidence: number | null) => {
  if (confidence === null || Number.isNaN(confidence)) return '未評価';
  if (confidence < 0.6) return '確認必要';
  if (confidence < 0.8) return '要確認';
  return '高め';
};

export const buildHeuristicCandidates = ({
  sessionId,
  durationMs,
  pointIntervalMs = 12_000,
  clipLeadMs = 4_000,
  clipTailMs = 9_000,
  startOffsetMs = 5_000,
}: {
  sessionId: string;
  durationMs: number;
  pointIntervalMs?: number;
  clipLeadMs?: number;
  clipTailMs?: number;
  startOffsetMs?: number;
}) => {
  const safeIntervalMs = Math.min(30_000, Math.max(6_000, pointIntervalMs));
  const safeLeadMs = Math.min(12_000, Math.max(1_500, clipLeadMs));
  const safeTailMs = Math.min(18_000, Math.max(4_000, clipTailMs));
  const safeOffsetMs = Math.max(0, startOffsetMs);
  const minWindowMs = 8_000;
  const totalDurationMs = Math.max(durationMs, minWindowMs);
  const boundaries: number[] = [];

  for (
    let boundaryMs = safeOffsetMs;
    boundaryMs < totalDurationMs;
    boundaryMs += safeIntervalMs
  ) {
    boundaries.push(boundaryMs);
  }

  if (boundaries.length === 0) {
    boundaries.push(Math.min(totalDurationMs / 2, safeOffsetMs));
  }

  return boundaries.map((boundaryMs, index) => {
    const startMs = Math.max(0, boundaryMs - safeLeadMs);
    const endMs = Math.min(totalDurationMs, boundaryMs + safeTailMs);
    const actualWindowMs = Math.max(endMs - startMs, minWindowMs);
    const centerPenalty =
      Math.abs(actualWindowMs - (safeLeadMs + safeTailMs)) /
      Math.max(safeLeadMs + safeTailMs, 1) /
      2;
    const edgePenalty =
      index === 0 || index === boundaries.length - 1 ? 0.09 : 0;
    const cadencePenalty =
      safeIntervalMs > 18_000 ? (safeIntervalMs - 18_000) / 35_000 : 0;
    const offsetPenalty = safeOffsetMs > 10_000 ? 0.05 : 0;
    const confidence = Math.max(
      0.45,
      Math.min(
        0.95,
        0.9 - centerPenalty - edgePenalty - cadencePenalty - offsetPenalty,
      ),
    );

    return {
      session_id: sessionId,
      candidate_order: index + 1,
      start_ms: startMs,
      end_ms: startMs + actualWindowMs,
      confidence: Number(confidence.toFixed(2)),
      status: confidence < 0.6 ? 'pending' : 'confirmed',
      winner_team: null,
      serving_team: null,
      serving_player: null,
      rally_count: null,
      first_serve_fault: false,
      double_fault: false,
      result_type: null,
      winner_player: null,
      loser_player: null,
      notes: null,
    } satisfies Omit<MatchPointCandidate, 'id' | 'created_at' | 'updated_at'>;
  });
};

export const getGamesWon = (match: Match) => {
  const games = match.games ?? [];

  return {
    gamesWonA: games.filter((game: Game) => game.winner_team === 'A').length,
    gamesWonB: games.filter((game: Game) => game.winner_team === 'B').length,
  };
};

export const isMatchFinishedByGames = (
  bestOf: number,
  gamesWonA: number,
  gamesWonB: number,
) => {
  const requiredWins = Math.ceil(bestOf / 2);
  return gamesWonA >= requiredWins || gamesWonB >= requiredWins;
};

export const loadVideoSessionsForMatch = async (
  supabase: any,
  matchId: string,
): Promise<MatchVideoSession[]> => {
  const { data, error } = await supabase
    .from('match_video_sessions')
    .select('*')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as MatchVideoSession[];
};

export const loadVideoSessionById = async (
  supabase: any,
  matchId: string,
  sessionId: string,
): Promise<MatchVideoSession | null> => {
  const { data, error } = await supabase
    .from('match_video_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('match_id', matchId)
    .maybeSingle();

  if (error) throw error;
  return (data as MatchVideoSession | null) ?? null;
};

export const loadVideoSessionWithCandidates = async (
  supabase: any,
  matchId: string,
  sessionId: string,
): Promise<MatchVideoSession | null> => {
  const session = await loadVideoSessionById(supabase, matchId, sessionId);
  if (!session) return null;

  const { data, error } = await supabase
    .from('match_point_candidates')
    .select('*')
    .eq('session_id', sessionId)
    .order('candidate_order', { ascending: true });

  if (error) throw error;

  return {
    ...session,
    candidates: (data ?? []) as MatchPointCandidate[],
  };
};

export const commitVideoCandidatesToMatch = async ({
  supabase,
  match,
  session,
  candidates,
  recomputeGameScore,
  loadMatchWithRelations,
}: {
  supabase: any;
  match: Match;
  session: MatchVideoSession;
  candidates: MatchPointCandidate[];
  recomputeGameScore: (
    supabaseClient: any,
    gameId: string,
  ) => Promise<{ updatedGame: Game; points: Point[] }>;
  loadMatchWithRelations: (
    supabaseClient: any,
    matchId: string,
  ) => Promise<Match | null>;
}) => {
  const commitCandidates = candidates.filter(
    (candidate) =>
      candidate.status !== 'excluded' &&
      (candidate.winner_team === 'A' || candidate.winner_team === 'B'),
  );

  if (commitCandidates.length === 0) {
    await supabase
      .from('match_video_sessions')
      .update({
        processing_status: 'reviewing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    return { pointsCommitted: 0 };
  }

  let workingMatch: Match = match;
  let pointsCommitted = 0;

  for (const candidate of commitCandidates) {
    let activeGame =
      workingMatch.games?.find((game) => !game.winner_team) ?? null;
    const { gamesWonA, gamesWonB } = getGamesWon(workingMatch);

    if (
      !activeGame &&
      !isMatchFinishedByGames(workingMatch.best_of, gamesWonA, gamesWonB)
    ) {
      const { data: createdGame, error: createGameError } = await supabase
        .from('games')
        .insert({
          match_id: workingMatch.id,
          game_number: (workingMatch.games?.length ?? 0) + 1,
          winner_team: null,
          points_a: 0,
          points_b: 0,
          initial_serve_team: candidate.serving_team ?? 'A',
          initial_serve_player_index: 0,
        })
        .select('*')
        .single();

      if (createGameError) throw createGameError;

      activeGame = {
        ...(createdGame as Game),
        points: [],
      };

      workingMatch = {
        ...workingMatch,
        games: [...(workingMatch.games ?? []), activeGame],
      };
    }

    if (!activeGame) {
      break;
    }

    if (!activeGame.initial_serve_team) {
      const { data: updatedGame, error: updateGameError } = await supabase
        .from('games')
        .update({
          initial_serve_team: candidate.serving_team ?? 'A',
          initial_serve_player_index: 0,
        })
        .eq('id', activeGame.id)
        .select('*')
        .single();

      if (updateGameError) throw updateGameError;

      activeGame = {
        ...(updatedGame as Game),
        points: activeGame.points ?? [],
      };
    }

    const pointNumber = (activeGame.points?.length ?? 0) + 1;

    const { error: insertPointError } = await supabase
      .from('points')
      .insert({
        game_id: activeGame.id,
        point_number: pointNumber,
        winner_team: candidate.winner_team,
        serving_team: candidate.serving_team ?? activeGame.initial_serve_team,
        serving_player: toPointPlayerName(candidate.serving_player),
        rally_count: candidate.rally_count,
        first_serve_fault: candidate.first_serve_fault ?? false,
        double_fault:
          candidate.double_fault ?? candidate.result_type === 'double_fault',
        result_type: candidate.result_type,
        winner_player: toPointPlayerName(candidate.winner_player),
        loser_player: toPointPlayerName(candidate.loser_player),
        point_note: candidate.notes ?? null,
      })
      .select('*')
      .single();

    if (insertPointError) throw insertPointError;

    await recomputeGameScore(supabase, activeGame.id);
    pointsCommitted += 1;

    const reloadedMatch = await loadMatchWithRelations(
      supabase,
      workingMatch.id,
    );
    if (reloadedMatch) {
      workingMatch = reloadedMatch;
    }
  }

  const { gamesWonA, gamesWonB } = getGamesWon(workingMatch);
  const finished = isMatchFinishedByGames(
    workingMatch.best_of,
    gamesWonA,
    gamesWonB,
  );

  if (finished) {
    await supabase
      .from('matches')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', workingMatch.id);
  }

  await supabase
    .from('match_video_sessions')
    .update({
      processing_status: finished ? 'committed' : 'reviewing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  return {
    pointsCommitted,
    matchCompleted: finished,
  };
};
