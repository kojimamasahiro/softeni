// 試合詳細ページ上段の「この試合で分かったこと」。事実だけを最大3行の文にする。
// 条件と優先は docs/wiki/score-analysis.md「試合で分かったこと」が正。

import { FINAL_GAME_WIN_POINTS } from '../matchRules';
import { ERROR_RESULT_TYPES, WINNER_RESULT_TYPES } from './helpers';
import type { RallyBucket, ReconstructedPointContext, TeamKey } from './types';

export type MatchFindingKind = 'comeback' | 'final_game' | 'deuce_sweep' | 'streak' | 'winner_gap' | 'error_gap' | 'rally_bias';

export type MatchFinding = {
  kind: MatchFindingKind;
  text: string;
  /** 「その場面を見る」の移動先。場面を持たない集計の文は null */
  target: { gameNumber: number; pointId: string } | null;
};

export const MATCH_FINDING_THRESHOLDS = {
  COMEBACK_GAME_DEFICIT: 2,
  MIN_DEUCE_GAMES: 2,
  MIN_STREAK: 6,
  MIN_COUNT_GAP: 5,
  MIN_RALLY_BUCKET_POINTS: 8,
  RALLY_BIAS_SHARE: 0.75,
  MAX_ITEMS: 3,
} as const;

const PRIORITY: Record<MatchFindingKind, number> = {
  comeback: 1,
  final_game: 1,
  deuce_sweep: 2,
  streak: 3,
  winner_gap: 4,
  error_gap: 4,
  rally_bias: 5,
};

const RALLY_BUCKET_LABELS: Record<Exclude<RallyBucket, 'unknown'>, string> = {
  '1-2': '1〜2本のラリー',
  '3-4': '3〜4本のラリー',
  '5-8': '5〜8本のラリー',
  '9+': '9本以上のラリー',
};

const other = (team: TeamKey): TeamKey => (team === 'A' ? 'B' : 'A');

const winnerOf = (context: ReconstructedPointContext): TeamKey | null =>
  context.point.winner_team === 'A' || context.point.winner_team === 'B' ? context.point.winner_team : null;

type GameSummary = { gameNumber: number; winner: TeamKey | null; contexts: ReconstructedPointContext[] };

const summarizeGames = (contexts: ReconstructedPointContext[]): GameSummary[] => {
  const byGame = new Map<number, ReconstructedPointContext[]>();
  contexts.forEach((context) => {
    const list = byGame.get(context.gameNumber) ?? [];
    list.push(context);
    byGame.set(context.gameNumber, list);
  });
  return [...byGame.entries()]
    .sort(([left], [right]) => left - right)
    .map(([gameNumber, list]) => {
      const last = list[list.length - 1];
      const winner = last.scoreAfter.A > last.scoreAfter.B ? 'A' : last.scoreAfter.B > last.scoreAfter.A ? 'B' : null;
      return { gameNumber, winner, contexts: list };
    });
};

const toTarget = (context: ReconstructedPointContext | undefined) => (context ? { gameNumber: context.gameNumber, pointId: context.point.id } : null);

export const buildMatchFindings = (contexts: ReconstructedPointContext[], teamNames: Record<TeamKey, string>): MatchFinding[] => {
  const T = MATCH_FINDING_THRESHOLDS;
  const games = summarizeGames(contexts);
  const gamesWon = { A: 0, B: 0 };
  games.forEach((game) => {
    if (game.winner) gamesWon[game.winner] += 1;
  });
  if (gamesWon.A === gamesWon.B) return [];
  const matchWinner: TeamKey = gamesWon.A > gamesWon.B ? 'A' : 'B';

  const findings: MatchFinding[] = [];

  // 逆転 / もつれた試合
  let running = { A: 0, B: 0 };
  let maxDeficit = 0;
  let comebackStartIndex = -1;
  games.forEach((game, index) => {
    if (game.winner) running = { ...running, [game.winner]: running[game.winner] + 1 };
    const deficit = running[other(matchWinner)] - running[matchWinner];
    if (deficit > maxDeficit) {
      maxDeficit = deficit;
      comebackStartIndex = index + 1;
    }
  });
  const finalGame = games.find((game) => game.contexts[0]?.pointsToWin === FINAL_GAME_WIN_POINTS);
  if (maxDeficit >= T.COMEBACK_GAME_DEFICIT) {
    findings.push({
      kind: 'comeback',
      text: `${teamNames[matchWinner]}がゲームカウントで${maxDeficit}ゲーム差をつけられてから逆転した`,
      target: toTarget(games[comebackStartIndex]?.contexts[0]),
    });
  } else if (finalGame) {
    findings.push({
      kind: 'final_game',
      text: 'ファイナルゲームまでもつれた',
      target: toTarget(finalGame.contexts[0]),
    });
  }

  // デュースのゲームを片方が全部取った
  const deuceGames = games.filter((game) => game.winner && game.contexts.some((context) => context.isDeucePoint));
  if (deuceGames.length >= T.MIN_DEUCE_GAMES) {
    const sweeper = deuceGames[0].winner;
    if (sweeper && deuceGames.every((game) => game.winner === sweeper)) {
      findings.push({
        kind: 'deuce_sweep',
        text: `デュースになった${deuceGames.length}ゲームは、すべて${teamNames[sweeper]}が取った`,
        target: toTarget(deuceGames[0].contexts.find((context) => context.isDeucePoint)),
      });
    }
  }

  // ゲームをまたいだ最長の連続得点
  type Streak = { team: TeamKey; length: number; start: ReconstructedPointContext; end: ReconstructedPointContext };
  let streak: Streak | null = null;
  let currentStreak: Streak | null = null;
  for (const context of contexts) {
    const team = winnerOf(context);
    if (!team) {
      currentStreak = null;
      continue;
    }
    const previous: Streak | null = currentStreak;
    const next: Streak =
      previous && previous.team === team
        ? { team, length: previous.length + 1, start: previous.start, end: context }
        : { team, length: 1, start: context, end: context };
    currentStreak = next;
    if (!streak || next.length > streak.length) streak = next;
  }
  if (streak && streak.length >= T.MIN_STREAK) {
    const range =
      streak.start.gameNumber === streak.end.gameNumber
        ? `第${streak.start.gameNumber}ゲームで`
        : `第${streak.start.gameNumber}〜${streak.end.gameNumber}ゲームにかけて`;
    findings.push({
      kind: 'streak',
      text: `${teamNames[streak.team]}が${range}${streak.length}連続得点`,
      target: toTarget(streak.start),
    });
  }

  // 決め球の差・ミスの差
  const count = (team: TeamKey, predicate: (context: ReconstructedPointContext) => boolean) =>
    contexts.filter((context) => predicate(context) && context.point.winner_team === team).length;
  const winners = {
    A: count('A', (context) => WINNER_RESULT_TYPES.has(context.point.result_type ?? '')),
    B: count('B', (context) => WINNER_RESULT_TYPES.has(context.point.result_type ?? '')),
  };
  // ミスで失った点 = 相手の得点のうち、自分のミスで終わったもの
  const errors = {
    A: count('B', (context) => ERROR_RESULT_TYPES.has(context.point.result_type ?? '')),
    B: count('A', (context) => ERROR_RESULT_TYPES.has(context.point.result_type ?? '')),
  };
  if (Math.abs(winners.A - winners.B) >= T.MIN_COUNT_GAP) {
    findings.push({
      kind: 'winner_gap',
      text: `自分で決めた点は ${teamNames.A} ${winners.A}点、${teamNames.B} ${winners.B}点`,
      target: null,
    });
  }
  if (Math.abs(errors.A - errors.B) >= T.MIN_COUNT_GAP) {
    findings.push({
      kind: 'error_gap',
      text: `ミスで失った点は ${teamNames.A} ${errors.A}点、${teamNames.B} ${errors.B}点`,
      target: null,
    });
  }

  // ラリーの長さによる偏り（最も偏った区切りを1つ）
  type RallyBias = { bucket: Exclude<RallyBucket, 'unknown'>; a: number; b: number; bias: number };
  let rally: RallyBias | null = null;
  for (const bucket of Object.keys(RALLY_BUCKET_LABELS) as Array<Exclude<RallyBucket, 'unknown'>>) {
    const inBucket = contexts.filter((context) => context.rallyBucket === bucket && winnerOf(context));
    if (inBucket.length < T.MIN_RALLY_BUCKET_POINTS) continue;
    const a = inBucket.filter((context) => winnerOf(context) === 'A').length;
    const b = inBucket.length - a;
    const bias = Math.max(a, b) / inBucket.length;
    if (bias < T.RALLY_BIAS_SHARE) continue;
    if (!rally || bias > rally.bias || (bias === rally.bias && a + b > rally.a + rally.b)) rally = { bucket, a, b, bias };
  }
  if (rally) {
    findings.push({
      kind: 'rally_bias',
      text: `${RALLY_BUCKET_LABELS[rally.bucket]}で取った点は ${teamNames.A} ${rally.a}点、${teamNames.B} ${rally.b}点`,
      target: null,
    });
  }

  // 安定ソート: 同じ優先の中は上の順（表の順）を保つ
  return findings
    .map((finding, index) => ({ finding, index }))
    .sort((left, right) => PRIORITY[left.finding.kind] - PRIORITY[right.finding.kind] || left.index - right.index)
    .slice(0, T.MAX_ITEMS)
    .map(({ finding }) => finding);
};
