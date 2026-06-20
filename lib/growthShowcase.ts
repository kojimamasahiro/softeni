// 成長記録ショーケース（/growth）のサーバー専用ヘルパー。
// featured 設定・成長ターゲット・レポートJSONを読み、ショーケース用に整形する。
// getStaticPaths / getStaticProps からのみ使う（fs 依存のためクライアントへ import しない）。
import fs from 'fs';
import path from 'path';

import {
  getGrowthReportFileName,
  getGrowthTargetForSide,
  GrowthReport,
  GrowthTarget,
} from './growthAnalysis';
import { getPublicMatchDetailPath } from './siteConfig';

import type { Match } from '../src/types/database';

export type FeaturedEntry = {
  subjectKey: string;
  slug: string;
  playerId?: string | number;
  // 起点とする個人名（targets.json の playerNames と一致する表記。例: "丸山 海斗"）。
  // シングルス記録が無くダブルスだけの選手を起点にしたいときに指定。
  // 省略時は subjectKey が個人ターゲットならその選手名を起点にする。
  playerName?: string;
  title?: string;
  intro?: string;
};

// 成長記録のもとにした試合（出所）。
export type SourceMatch = {
  id: string;
  date: string | null;
  opponentName: string;
  tournamentName: string | null;
  roundName: string | null;
  detailPath: string;
  videoUrl: string | null;
};

// 1選手のショーケースに載せる各記録（シングルス/各ペア）。
export type ShowcaseRecord = {
  key: string;
  label: string;
  report: GrowthReport;
  sourceMatches: SourceMatch[];
};

const readJson = <T>(filePath: string): T | null => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
};

export const loadFeaturedEntries = (): FeaturedEntry[] => {
  const payload = readJson<{ featured?: FeaturedEntry[] }>(
    path.join(process.cwd(), 'data', 'growth-featured.json'),
  );
  return (payload?.featured ?? []).filter(
    (entry) => entry?.subjectKey && entry?.slug,
  );
};

export const loadGrowthTargets = (): GrowthTarget[] => {
  const payload = readJson<{ targets?: GrowthTarget[] }>(
    path.join(
      process.cwd(),
      'public',
      'data',
      'beta-matches',
      'growth',
      'targets.json',
    ),
  );
  return payload?.targets ?? [];
};

// 大会ID→表示名（label）の対応。出所の大会名をスラッグでなく読める名前にするため。
export const loadTournamentLabels = (): Map<string, string> => {
  const labels = new Map<string, string>();
  for (const file of ['index.json', 'local_index.json']) {
    const rows = readJson<Array<{ tournamentId?: string; label?: string }>>(
      path.join(process.cwd(), 'data', 'tournaments', file),
    );
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (row?.tournamentId && row.label && !labels.has(row.tournamentId)) {
        labels.set(row.tournamentId, row.label);
      }
    }
  }
  return labels;
};

// 公開試合の一覧（軽量版・ポイントは含まない）。出所表示に使う。
export const loadPublicMatches = (): Match[] => {
  const payload = readJson<{ matches?: Match[] }>(
    path.join(
      process.cwd(),
      'public',
      'data',
      'beta-matches',
      'index.json',
    ),
  );
  return payload?.matches ?? [];
};

// ある成長ターゲット（subjectKey）のもとになった試合を、出所として集める（新しい順）。
export const gatherSourceMatches = (
  targetKey: string,
  matches: Match[],
  tournamentLabels: Map<string, string> = new Map(),
): SourceMatch[] => {
  const result: SourceMatch[] = [];
  for (const match of matches) {
    let side: 'A' | 'B' | null = null;
    if (getGrowthTargetForSide(match, 'A').key === targetKey) side = 'A';
    else if (getGrowthTargetForSide(match, 'B').key === targetKey) side = 'B';
    if (!side) continue;

    const opponentSide = side === 'A' ? 'B' : 'A';
    const youtubeId = (match as { youtube_video_id?: string }).youtube_video_id;
    const youtubeUrl = (match as { youtube_url?: string }).youtube_url;
    const tournamentId = (match as { tournament_id?: string }).tournament_id;
    const tournamentName =
      (tournamentId ? tournamentLabels.get(tournamentId) : undefined) ??
      match.tournament_name ??
      null;
    result.push({
      id: match.id,
      date: match.match_date ?? null,
      opponentName: getGrowthTargetForSide(match, opponentSide).displayName,
      tournamentName,
      roundName: (match as { round_name?: string }).round_name ?? null,
      detailPath: getPublicMatchDetailPath(match),
      videoUrl:
        youtubeUrl ??
        (youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null),
    });
  }
  result.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return result;
};

const readReport = (subjectKey: string): GrowthReport | null => {
  const payload = readJson<{ report?: GrowthReport }>(
    path.join(
      process.cwd(),
      'public',
      'data',
      'beta-matches',
      'growth',
      'reports',
      getGrowthReportFileName(subjectKey),
    ),
  );
  return payload?.report ?? null;
};

// 起点となる個人名を解決する。
export const resolveFocusName = (
  entry: FeaturedEntry,
  targets: GrowthTarget[],
): string | null => {
  const explicit = entry.playerName?.trim();
  if (explicit) return explicit;
  const primary = targets.find((t) => t.key === entry.subjectKey);
  return primary?.kind === 'player' ? primary.playerNames[0] ?? null : null;
};

// その選手のシングルス記録＋その選手を含むペア記録を集める（シングルス→ペア、試合数の多い順）。
export const gatherShowcaseTargets = (
  entry: FeaturedEntry,
  targets: GrowthTarget[],
): GrowthTarget[] => {
  const focusName = resolveFocusName(entry, targets);
  const primary = targets.find((t) => t.key === entry.subjectKey);
  const relevant = focusName
    ? targets.filter((t) => t.playerNames?.includes(focusName))
    : primary
      ? [primary]
      : [];
  return relevant.slice().sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'player' ? -1 : 1;
    return b.completedMatchCount - a.completedMatchCount;
  });
};

// 記録ラベル: シングルス or ダブルス（相手の名前付き）。
export const buildRecordLabel = (
  target: GrowthTarget,
  focusName: string | null,
): string => {
  if (target.kind === 'player') return 'シングルス';
  const partner = target.playerNames.find((name) => name !== focusName);
  return partner ? `ダブルス（${partner}）` : 'ダブルス';
};

export const gatherShowcaseRecords = (
  entry: FeaturedEntry,
  targets: GrowthTarget[],
): ShowcaseRecord[] => {
  const focusName = resolveFocusName(entry, targets);
  const matches = loadPublicMatches();
  const tournamentLabels = loadTournamentLabels();
  const records: ShowcaseRecord[] = [];
  for (const target of gatherShowcaseTargets(entry, targets)) {
    const report = readReport(target.key);
    if (report) {
      records.push({
        key: target.key,
        label: buildRecordLabel(target, focusName),
        report,
        sourceMatches: gatherSourceMatches(target.key, matches, tournamentLabels),
      });
    }
  }
  return records;
};

export const showcaseDisplayName = (
  entry: FeaturedEntry,
  targets: GrowthTarget[],
): string => {
  const focusName = resolveFocusName(entry, targets);
  if (focusName) return focusName;
  const primary = targets.find((t) => t.key === entry.subjectKey);
  return primary?.displayName ?? '';
};
