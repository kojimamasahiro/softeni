import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

import { resolveMatchSiteLink } from '../lib/siteLink.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(projectRoot, 'public', 'data', 'beta-matches');
const matchesOutputRoot = path.join(outputRoot, 'matches');
const growthOutputRoot = path.join(outputRoot, 'growth');
const growthReportsOutputRoot = path.join(growthOutputRoot, 'reports');
// 撤回（オプトアウト）リスト。ここに載せた subject_key は成長レポートを生成しない（ADR-004 Decision 5）。
const growthExclusionsPath = path.join(
  projectRoot,
  'data',
  'growth-exclusions.json',
);
// ショーケース（featured）リスト。ここに載せた subject_key は visibility=public に引き上げる（ADR-004）。
const growthFeaturedPath = path.join(
  projectRoot,
  'data',
  'growth-featured.json',
);
const detailsRoot = path.join(projectRoot, 'data', 'tournaments', 'details');
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

// 掲載大会に紐づく試合へ siteLink をベイクする（野良試合は null）。
// 仕様: docs/wiki/score-site-link.md
const enrichWithSiteLink = (match) => ({
  ...match,
  siteLink: resolveMatchSiteLink(match, { detailsRoot }) ?? null,
});

const readJsonIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

// subject_key リストを読み込む汎用ヘルパー。
// 形式は ["player:やまだたろう", ...] か [{ "subjectKey": "..." }, ...] の両対応。
const loadSubjectKeys = (raw, listKey) => {
  const list = Array.isArray(raw) ? raw : (raw?.[listKey] ?? []);
  return list
    .map((entry) => (typeof entry === 'string' ? entry : entry?.subjectKey))
    .filter((key) => typeof key === 'string' && key.length > 0);
};

// 撤回リスト（生成から除外する subject_key）。
const loadGrowthExcludedKeys = () =>
  loadSubjectKeys(readJsonIfExists(growthExclusionsPath), 'exclusions');

// ショーケース（featured）リスト（visibility=public に引き上げる subject_key）。
const loadGrowthFeaturedKeys = () =>
  loadSubjectKeys(readJsonIfExists(growthFeaturedPath), 'featured');

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const stripGeneratedAtFields = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripGeneratedAtFields);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'generatedAt')
      .map(([key, nestedValue]) => [key, stripGeneratedAtFields(nestedValue)]),
  );
};

const hasSameContentIgnoringGeneratedAt = (nextValue, existingValue) => {
  if (!existingValue) return false;

  return (
    JSON.stringify(stripGeneratedAtFields(nextValue)) ===
    JSON.stringify(stripGeneratedAtFields(existingValue))
  );
};

const preserveExistingValueIfUnchanged = (nextValue, existingValue) => {
  if (!hasSameContentIgnoringGeneratedAt(nextValue, existingValue)) {
    return nextValue;
  }

  return existingValue;
};

const INTERNAL_FIELD_NAMES = new Set([
  'edit_token_hash',
  'edit_token',
  'source_site_match_id',
  'source_site_tournament_id',
  'recorder_side',
  'created_by',
  'updated_by',
  'internal_note',
  'import_source',
]);

const shouldStripInternalField = (key) => {
  if (INTERNAL_FIELD_NAMES.has(key)) return true;
  if (key.startsWith('debug_')) return true;
  if (key.startsWith('_debug')) return true;
  if (key.startsWith('_supabase')) return true;
  return false;
};

const stripInternalFields = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripInternalFields);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !shouldStripInternalField(key))
      .map(([key, nestedValue]) => [key, stripInternalFields(nestedValue)]),
  );
};

const toPublicMatchSnapshot = (match) => stripInternalFields(match);

const summarizeMatchForIndex = (match) =>
  stripInternalFields({
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

const buildGrowthAnalysisJson = (
  matches,
  generatedAt,
  existingTargetsJson = null,
  existingGrowthReportsByFileName = new Map(),
  excludedKeys = [],
  featuredKeys = [],
) => {
  const { targets, reports } = buildGrowthReports(matches, generatedAt, {
    excludedKeys,
    featuredKeys,
  });

  fs.mkdirSync(growthReportsOutputRoot, { recursive: true });

  writeJson(
    path.join(growthOutputRoot, 'targets.json'),
    preserveExistingValueIfUnchanged(
      {
        generatedAt,
        targets,
      },
      existingTargetsJson,
    ),
  );

  reports.forEach((report) => {
    const reportPath = path.join(
      growthReportsOutputRoot,
      getGrowthReportFileName(report.target.key),
    );

    writeJson(
      reportPath,
      preserveExistingValueIfUnchanged(
        {
          generatedAt,
          report,
        },
        existingGrowthReportsByFileName.get(
          getGrowthReportFileName(report.target.key),
        ),
      ),
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

// 追記型の出力本体。Supabase パス・スナップショット再利用パスの両方から使う。
// 出力ディレクトリは全削除せず、既存ファイルを更新する（公開 URL 消失を防ぐ）。
const writeBetaMatchesOutput = (publicMatches, generatedAt) => {
  const matchIds = publicMatches.map((match) => match.id);
  const summaryMatches = publicMatches.map(summarizeMatchForIndex);
  const existingMeta = readJsonIfExists(path.join(outputRoot, 'meta.json'));
  const existingIndex = readJsonIfExists(path.join(outputRoot, 'index.json'));
  const existingMatchDetailsById = new Map(
    matchIds.map((matchId) => [
      matchId,
      readJsonIfExists(path.join(matchesOutputRoot, `${matchId}.json`)),
    ]),
  );
  const excludedKeys = loadGrowthExcludedKeys();
  const featuredKeys = loadGrowthFeaturedKeys();
  const existingGrowthTargets = readJsonIfExists(
    path.join(growthOutputRoot, 'targets.json'),
  );
  const existingGrowthReportsByFileName = new Map(
    buildGrowthReports(publicMatches, generatedAt, {
      excludedKeys,
      featuredKeys,
    }).reports.map((report) => {
      const fileName = getGrowthReportFileName(report.target.key);
      return [
        fileName,
        readJsonIfExists(path.join(growthReportsOutputRoot, fileName)),
      ];
    }),
  );

  fs.mkdirSync(outputRoot, { recursive: true });
  fs.mkdirSync(matchesOutputRoot, { recursive: true });
  fs.mkdirSync(growthOutputRoot, { recursive: true });

  writeJson(
    path.join(outputRoot, 'meta.json'),
    preserveExistingValueIfUnchanged(
      {
        generatedAt,
        matchIds,
        totalMatches: publicMatches.length,
      },
      existingMeta,
    ),
  );

  writeJson(
    path.join(outputRoot, 'index.json'),
    preserveExistingValueIfUnchanged(
      {
        generatedAt,
        matches: summaryMatches,
      },
      existingIndex,
    ),
  );

  publicMatches.forEach((match) => {
    writeJson(
      path.join(matchesOutputRoot, `${match.id}.json`),
      preserveExistingValueIfUnchanged(
        {
          generatedAt,
          match,
        },
        existingMatchDetailsById.get(match.id),
      ),
    );
  });

  const growthStats = buildGrowthAnalysisJson(
    publicMatches,
    generatedAt,
    existingGrowthTargets,
    existingGrowthReportsByFileName,
    excludedKeys,
    featuredKeys,
  );

  const siteLinkCount = publicMatches.filter((match) => match.siteLink).length;
  return { growthStats, siteLinkCount };
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
      const publicMatches =
        loadExistingSnapshotMatches().map(enrichWithSiteLink);
      const { growthStats, siteLinkCount } = writeBetaMatchesOutput(
        publicMatches,
        generatedAt,
      );
      console.log(
        `✓ Regenerated beta matches JSON from snapshot (${publicMatches.length} matches, ${siteLinkCount} linked, ${growthStats.reportCount}/${growthStats.targetCount} growth reports)`,
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
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const safeMatches = await attachGamesToMatches(supabase, matches ?? []);
  const publicMatches = safeMatches
    .map(toPublicMatchSnapshot)
    .map(enrichWithSiteLink);
  const generatedAt = new Date().toISOString();

  const { growthStats, siteLinkCount } = writeBetaMatchesOutput(
    publicMatches,
    generatedAt,
  );

  console.log(
    `✓ Generated beta matches JSON (${publicMatches.length} matches, ${siteLinkCount} linked, ${growthStats.reportCount}/${growthStats.targetCount} growth reports)`,
  );
};

buildBetaMatchesJson().catch((error) => {
  console.error('Failed to generate beta matches JSON:', error);
  process.exitCode = 1;
});
