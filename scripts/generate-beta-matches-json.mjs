import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(projectRoot, 'public', 'data', 'beta-matches');
const matchesOutputRoot = path.join(outputRoot, 'matches');
const growthOutputRoot = path.join(outputRoot, 'growth');
const growthReportsOutputRoot = path.join(growthOutputRoot, 'reports');
const LATEST_BETA_MATCH_LIMIT = 50;
const { loadEnvConfig } = nextEnv;
const require = createRequire(import.meta.url);

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'node',
});
require('ts-node/register/transpile-only');
const {
  buildGrowthReports,
  getGrowthReportFileName,
} = require('../lib/growthAnalysis.ts');

// Align local script env loading with Next.js behavior while still allowing
// CI/CD providers to inject environment variables directly.
loadEnvConfig(projectRoot);

const isTestMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true';

const hasExistingSnapshot = () => {
  return (
    fs.existsSync(path.join(outputRoot, 'index.json')) &&
    fs.existsSync(path.join(outputRoot, 'meta.json'))
  );
};

const loadExistingSnapshotMatches = () => {
  const metaPath = path.join(outputRoot, 'meta.json');
  if (!fs.existsSync(metaPath)) return [];

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const matchIds = Array.isArray(meta.matchIds) ? meta.matchIds : [];

  return matchIds
    .map((matchId) => {
      const detailPath = path.join(matchesOutputRoot, `${matchId}.json`);
      if (!fs.existsSync(detailPath)) return null;
      const detail = JSON.parse(fs.readFileSync(detailPath, 'utf8'));
      return detail.match ?? null;
    })
    .filter(Boolean);
};

const getSupabaseConfig = () => {
  if (isTestMode) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_TEST_URL;
    const serviceKey = process.env.SUPABASE_TEST_SERVICE_KEY;

    if (!url || !serviceKey) {
      return null;
    }

    return {
      url,
      serviceKey,
    };
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? null;

  if (!url || !serviceKey) {
    return null;
  }

  return {
    url,
    serviceKey,
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

const buildGrowthAnalysisJson = (matches, generatedAt) => {
  const { targets, reports } = buildGrowthReports(matches, generatedAt);

  fs.mkdirSync(growthReportsOutputRoot, { recursive: true });

  writeJson(path.join(growthOutputRoot, 'targets.json'), {
    generatedAt,
    targets,
  });

  reports.forEach((report) => {
    writeJson(
      path.join(
        growthReportsOutputRoot,
        getGrowthReportFileName(report.target.key),
      ),
      {
        generatedAt,
        report,
      },
    );
  });

  return {
    targetCount: targets.length,
    reportCount: reports.length,
  };
};

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
  if (!config) {
    if (hasExistingSnapshot()) {
      console.warn(
        'Supabase env is missing. Reusing committed beta matches JSON snapshot.',
      );
      const generatedAt = new Date().toISOString();
      const snapshotMatches = loadExistingSnapshotMatches();
      const growthStats = buildGrowthAnalysisJson(snapshotMatches, generatedAt);
      console.log(
        `✓ Generated growth JSON from snapshot (${growthStats.reportCount}/${growthStats.targetCount} reports)`,
      );
      return;
    }

    throw new Error(
      'Supabase env is missing and no beta matches JSON snapshot exists.',
    );
  }

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
  fs.mkdirSync(growthOutputRoot, { recursive: true });

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
  const growthStats = buildGrowthAnalysisJson(safeMatches, generatedAt);

  console.log(
    `✓ Generated beta matches JSON (${safeMatches.length} matches, ${growthStats.reportCount}/${growthStats.targetCount} growth reports)`,
  );
};

buildBetaMatchesJson().catch((error) => {
  console.error('Failed to generate beta matches JSON:', error);
  process.exitCode = 1;
});
