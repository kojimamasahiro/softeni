import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(projectRoot, 'public', 'data', 'beta-matches');
const matchesOutputRoot = path.join(outputRoot, 'matches');
const LATEST_BETA_MATCH_LIMIT = 50;

const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true';

const getSupabaseConfig = () => {
  if (isTestMode) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_TEST_URL) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_TEST_URL is required in test mode.',
      );
    }
    if (!process.env.SUPABASE_TEST_SERVICE_KEY) {
      throw new Error('SUPABASE_TEST_SERVICE_KEY is required in test mode.');
    }

    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_TEST_URL,
      serviceKey: process.env.SUPABASE_TEST_SERVICE_KEY,
    };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required.');
  }
  if (!process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_KEY is required.');
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  };
};

const ensureCleanDir = (dirPath) => {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
};

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const summarizeMatchForIndex = (match) => ({
  ...match,
  games: (match.games ?? []).map((game) => ({
    id: game.id,
    match_id: game.match_id,
    game_number: game.game_number,
    winner_team: game.winner_team,
    points_a: game.points_a,
    points_b: game.points_b,
    initial_serve_team: game.initial_serve_team,
    initial_serve_player_index: game.initial_serve_player_index ?? null,
    created_at: game.created_at,
  })),
});

const groupPointsByGameId = (points) => {
  const pointsByGameId = new Map();

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

const attachGamesToMatches = async (supabase, matches) => {
  const matchIds = matches.map((match) => match.id);
  if (matchIds.length === 0) return matches;

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .in('match_id', matchIds)
    .order('game_number', { ascending: true });

  if (gamesError) {
    throw gamesError;
  }

  const safeGames = games ?? [];
  const gameIds = safeGames.map((game) => game.id);
  let pointsByGameId = new Map();

  if (gameIds.length > 0) {
    const { data: points, error: pointsError } = await supabase
      .from('points')
      .select('*')
      .in('game_id', gameIds)
      .order('point_number', { ascending: true });

    if (pointsError) {
      throw pointsError;
    }

    pointsByGameId = groupPointsByGameId(points ?? []);
  }

  const gamesByMatchId = new Map();
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

const buildBetaMatchesJson = async () => {
  console.log('Starting beta matches JSON generation...');

  const config = getSupabaseConfig();
  const supabase = createClient(config.url, config.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(LATEST_BETA_MATCH_LIMIT);

  if (error) {
    throw error;
  }

  const safeMatches = await attachGamesToMatches(supabase, matches ?? []);
  const generatedAt = new Date().toISOString();
  const matchIds = safeMatches.map((match) => match.id);
  const summaryMatches = safeMatches.map(summarizeMatchForIndex);

  ensureCleanDir(outputRoot);
  fs.mkdirSync(matchesOutputRoot, { recursive: true });

  writeJson(path.join(outputRoot, 'meta.json'), {
    generatedAt,
    matchIds,
    totalMatches: safeMatches.length,
  });

  writeJson(path.join(outputRoot, 'index.json'), {
    generatedAt,
    matches: summaryMatches,
  });

  safeMatches.forEach((match) => {
    writeJson(path.join(matchesOutputRoot, `${match.id}.json`), {
      generatedAt,
      match,
    });
  });

  console.log(`✓ Generated beta matches JSON (${safeMatches.length} matches)`);
};

buildBetaMatchesJson().catch((error) => {
  console.error('Failed to generate beta matches JSON:', error);
  process.exitCode = 1;
});
