// 試合詳細ページ下段のグラフ用の集計。「決め球とミス」と「ラリーの長さ別」。
// 仕様: docs/wiki/score-analysis.md「試合で分かったこと」の下段。

import { ERROR_RESULT_TYPES, WINNER_RESULT_TYPES } from './helpers';
import type { RallyBucket, ReconstructedPointContext, TeamKey } from './types';

/** counts はどちらのチームが「したこと」か（決め球なら決めた側、ミスならミスをした側） */
export type PointSourceRow = { resultType: string; counts: Record<TeamKey, number> };

export type PointSources = {
  /** 自分で決めた点（決めた側に数える） */
  winners: PointSourceRow[];
  /** ミスで失った点（ミスをした側＝失点した側に数える） */
  ownErrors: PointSourceRow[];
  /** 決まり方が記録されていない・分類外の点（得点した側に数える） */
  other: Record<TeamKey, number>;
};

// 並びは固定（件数順にすると試合ごとに行の位置が変わり、見比べにくい）
const WINNER_ORDER = ['smash_winner', 'volley_winner', 'passing_winner', 'drop_winner', 'net_in_winner', 'service_ace', 'winner'];
const ERROR_ORDER = ['net', 'out', 'volley_error', 'smash_error', 'follow_error', 'receive_error', 'double_fault', 'forced_error', 'unforced_error'];

const teamOf = (context: ReconstructedPointContext): TeamKey | null =>
  context.point.winner_team === 'A' || context.point.winner_team === 'B' ? context.point.winner_team : null;

export const buildPointSources = (contexts: ReconstructedPointContext[]): PointSources => {
  const tally = new Map<string, Record<TeamKey, number>>();
  const other = { A: 0, B: 0 };
  contexts.forEach((context) => {
    const team = teamOf(context);
    if (!team) return;
    const type = context.point.result_type ?? '';
    if (!WINNER_RESULT_TYPES.has(type) && !ERROR_RESULT_TYPES.has(type)) {
      other[team] += 1;
      return;
    }
    // ミスは失点した側（相手）に数える。自分のミスが自分の側に並ぶように
    const actor: TeamKey = WINNER_RESULT_TYPES.has(type) ? team : team === 'A' ? 'B' : 'A';
    const counts = tally.get(type) ?? { A: 0, B: 0 };
    counts[actor] += 1;
    tally.set(type, counts);
  });
  const rows = (order: string[]) => order.filter((type) => tally.has(type)).map((type) => ({ resultType: type, counts: tally.get(type)! }));
  return { winners: rows(WINNER_ORDER), ownErrors: rows(ERROR_ORDER), other };
};

export type RallyLengthRow = { bucket: Exclude<RallyBucket, 'unknown'>; counts: Record<TeamKey, number>; total: number };

/** ラリーの本数が少ない区切りは「参考程度」と出す（「試合で分かったこと」の MIN_RALLY_BUCKET_POINTS と同じ 8） */
export const RALLY_ROW_MIN_RELIABLE = 8;

export const buildRallyLengthSplit = (contexts: ReconstructedPointContext[]): { rows: RallyLengthRow[]; unknown: number } => {
  const buckets: Array<Exclude<RallyBucket, 'unknown'>> = ['1-2', '3-4', '5-8', '9+'];
  let unknown = 0;
  const rows = buckets.map((bucket) => ({ bucket, counts: { A: 0, B: 0 }, total: 0 }));
  contexts.forEach((context) => {
    const team = teamOf(context);
    if (!team) return;
    const row = rows.find((candidate) => candidate.bucket === context.rallyBucket);
    if (!row) {
      unknown += 1;
      return;
    }
    row.counts[team] += 1;
    row.total += 1;
  });
  return { rows, unknown };
};
