import type { Game, Match, MatchPlayer, Point } from '../src/types/database';

export type TeamKey = 'A' | 'B';
export type GrowthTargetKind = 'player' | 'pair';
export type GrowthComparisonKind =
  | 'recent_period'
  | 'win_loss'
  | 'same_opponent'
  | 'same_tournament'
  | 'same_format'
  | 'same_pair'
  | 'opponent_level';
export type GrowthConfidence =
  | 'enough_sample'
  | 'small_sample'
  | 'insufficient_sample';
export type GrowthTrend = 'improved' | 'declined' | 'stable';
export type GrowthMetricUnit =
  | 'percent'
  | 'percentage_point'
  | 'count'
  | 'average';
export type GrowthMetricCategory =
  | 'serve'
  | 'receive'
  | 'key_moment'
  | 'momentum'
  | 'rally';

export type GrowthTarget = {
  key: string;
  kind: GrowthTargetKind;
  displayName: string;
  playerNames: string[];
  teamNames: string[];
  regions: string[];
  matchCount: number;
  completedMatchCount: number;
  latestMatchDate: string | null;
};

export type GrowthMetric = {
  key: string;
  label: string;
  category: GrowthMetricCategory;
  unit: GrowthMetricUnit;
  higherIsBetter: boolean;
  currentValue: number | null;
  previousValue: number | null;
  delta: number | null;
  trend: GrowthTrend;
  confidence: GrowthConfidence;
  numerator: number;
  denominator: number;
  previousNumerator: number;
  previousDenominator: number;
  matchCount: number;
  previousMatchCount: number;
  summary: string;
};

export type GrowthComparison = {
  kind: GrowthComparisonKind;
  title: string;
  description: string;
  currentLabel: string;
  previousLabel: string;
  currentMatchCount: number;
  previousMatchCount: number;
  metrics: GrowthMetric[];
  messages: string[];
};

export type PracticeTheme = {
  id: string;
  title: string;
  description: string;
  sourceMetricKey: string;
  priority: number;
};

export type GrowthReportSection = {
  id: string;
  title: string;
  messages: string[];
  metrics: GrowthMetric[];
};

export type GrowthReport = {
  target: GrowthTarget;
  generatedAt: string;
  matchCount: number;
  completedMatchCount: number;
  comparison: GrowthComparison | null;
  comparisons: GrowthComparison[];
  sections: GrowthReportSection[];
  practiceThemes: PracticeTheme[];
  emptyMessage: string | null;
};

type PlayerIdentity = {
  name: string;
  teamName: string;
  region: string;
};

type ReconstructedPoint = {
  point: Point;
  gameNumber: number;
  pointNumber: number;
  pointsToWin: number;
  scoreBefore: Record<TeamKey, number>;
  scoreAfter: Record<TeamKey, number>;
  isFinalGame: boolean;
};

type RateStat = {
  numerator: number;
  denominator: number;
};

type AverageStat = {
  total: number;
  matches: number;
};

type SingleMatchGrowthStats = {
  match: Match;
  side: TeamKey;
  targetWon: boolean;
  opponentKey: string;
  opponentName: string;
  matchDate: string;
  rates: Record<string, RateStat>;
  averages: Record<string, number>;
};

type AggregatedMetricSource = {
  rates: Record<string, RateStat>;
  averages: Record<string, AverageStat>;
  matchCount: number;
};

const NORMAL_GAME_WIN_POINTS = 4;
const FINAL_GAME_WIN_POINTS = 7;
const RATE_SAMPLE_SMALL = 5;
const RATE_SAMPLE_ENOUGH = 10;
const STABLE_DELTA = 2;

const metricDefinitions: Array<{
  key: string;
  label: string;
  category: GrowthMetricCategory;
  unit: GrowthMetricUnit;
  higherIsBetter: boolean;
  kind: 'rate' | 'average';
}> = [
  {
    key: 'servicePointWinRate',
    label: 'サーブ時得点率',
    category: 'serve',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'firstServeSuccessRate',
    label: '1stサービス成功率',
    category: 'serve',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'firstServePointWinRate',
    label: '1stサービス時得点率',
    category: 'serve',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'secondServePointWinRate',
    label: '2ndサービス時得点率',
    category: 'serve',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'doubleFaultRate',
    label: 'ダブルフォルト率',
    category: 'serve',
    unit: 'percent',
    higherIsBetter: false,
    kind: 'rate',
  },
  {
    key: 'receivePointWinRate',
    label: 'レシーブ時得点率',
    category: 'receive',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'afterTwoTwoPointWinRate',
    label: '2-2後の次ポイント取得率',
    category: 'key_moment',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'deucePointWinRate',
    label: 'デュースポイント取得率',
    category: 'key_moment',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'gamePointWinRate',
    label: 'ゲームポイント取得率',
    category: 'key_moment',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'opponentGamePointSaveRate',
    label: 'ゲームポイントを握られた後の粘り率',
    category: 'key_moment',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'finalGamePointWinRate',
    label: 'ファイナルゲーム得点率',
    category: 'key_moment',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'afterConsecutiveLostPointWinRate',
    label: '連続失点後の次ポイント取得率',
    category: 'momentum',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'twoPointLeadHoldRate',
    label: '2点差以上のリードを守れた率',
    category: 'momentum',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'shortRallyWinRate',
    label: '1-2本ラリー得点率',
    category: 'rally',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'middleRallyWinRate',
    label: '3-5本ラリー得点率',
    category: 'rally',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'longRallyWinRate',
    label: '6本以上ラリー得点率',
    category: 'rally',
    unit: 'percent',
    higherIsBetter: true,
    kind: 'rate',
  },
  {
    key: 'threePointLostStreakCount',
    label: '3連続失点以上',
    category: 'momentum',
    unit: 'average',
    higherIsBetter: false,
    kind: 'average',
  },
  {
    key: 'fourPointLostStreakCount',
    label: '4連続失点以上',
    category: 'momentum',
    unit: 'average',
    higherIsBetter: false,
    kind: 'average',
  },
  {
    key: 'maxLostStreak',
    label: '最大連続失点',
    category: 'momentum',
    unit: 'average',
    higherIsBetter: false,
    kind: 'average',
  },
];

const practiceThemeMap: Record<
  string,
  Omit<PracticeTheme, 'id' | 'sourceMetricKey' | 'priority'>
> = {
  secondServePointWinRate: {
    title: '2ndサービス後の1本目を安定させる',
    description:
      '2ndサービス時のポイントを、次の試合でも続けて確認してみましょう。',
  },
  doubleFaultRate: {
    title: '2ndサービスを入れにいく形を確認する',
    description: 'ダブルフォルトが続く場面を減らせるかを見てみましょう。',
  },
  receivePointWinRate: {
    title: 'レシーブから先にミスしない',
    description:
      'レシーブ後の1本目まで含めて、落ち着いて入ることを確認します。',
  },
  longRallyWinRate: {
    title: '6本以上のラリーで無理に決めにいかない',
    description: '長いラリーで失点しにくい形を作れるかを見てみましょう。',
  },
  threePointLostStreakCount: {
    title: '連続失点後の1点を丁寧に取る',
    description: '流れが傾いた後の次のポイントを、練習テーマとして確認します。',
  },
  maxLostStreak: {
    title: '失点が続いた場面の入り方を整える',
    description: '最大連続失点を小さくできるかを次の試合で見てみましょう。',
  },
  afterTwoTwoPointWinRate: {
    title: '競った場面での配球・入り方を確認する',
    description: '2-2から先にリードできる場面を増やせるかを確認します。',
  },
  gamePointWinRate: {
    title: 'ゲームポイントの取り切り方を確認する',
    description: 'ゲームポイントで急がず、取り切る形を見直してみましょう。',
  },
};

const isTeamKey = (value: unknown): value is TeamKey =>
  value === 'A' || value === 'B';

const getOppositeTeam = (team: TeamKey): TeamKey => (team === 'A' ? 'B' : 'A');

const getRequiredWins = (bestOf: number) => Math.ceil(bestOf / 2);

const isFinalGame = (
  bestOf: number,
  gamesWonA: number = 0,
  gamesWonB: number = 0,
) => {
  const requiredWins = getRequiredWins(bestOf);
  return gamesWonA === requiredWins - 1 && gamesWonB === requiredWins - 1;
};

const getPointsToWinForGame = (
  bestOf: number,
  gamesWonA: number = 0,
  gamesWonB: number = 0,
) =>
  isFinalGame(bestOf, gamesWonA, gamesWonB)
    ? FINAL_GAME_WIN_POINTS
    : NORMAL_GAME_WIN_POINTS;

const isWinningScore = (
  scoreFor: number,
  scoreAgainst: number,
  pointsToWin: number,
) => scoreFor >= pointsToWin && scoreFor - scoreAgainst >= 2;

const normalizeText = (value: string | null | undefined) =>
  (value ?? '').trim().replace(/\s+/g, ' ');

const normalizeKeyText = (value: string | null | undefined) =>
  normalizeText(value).toLowerCase();

const formatPlayerName = (player: MatchPlayer | PlayerIdentity) => {
  const name = normalizeText(
    'last_name' in player
      ? `${player.last_name ?? ''} ${player.first_name ?? ''}`
      : player.name,
  );
  return name || '選手名不明';
};

const getTeamPlayers = (match: Match, team: TeamKey): PlayerIdentity[] => {
  const structuredPlayers = match.teams?.[team]?.players ?? [];
  if (structuredPlayers.length > 0) {
    return structuredPlayers.map((player) => ({
      name: formatPlayerName(player),
      teamName: normalizeText(player.team_name),
      region: normalizeText(player.region),
    }));
  }

  const prefix = `team_${team.toLowerCase()}`;
  const players = [1, 2]
    .map((playerIndex) => {
      const lastName = normalizeText(
        match[`${prefix}_player${playerIndex}_last_name` as keyof Match] as
          | string
          | null
          | undefined,
      );
      const firstName = normalizeText(
        match[`${prefix}_player${playerIndex}_first_name` as keyof Match] as
          | string
          | null
          | undefined,
      );
      if (!lastName && !firstName) return null;

      return {
        name: normalizeText(`${lastName} ${firstName}`),
        teamName: normalizeText(
          match[`${prefix}_player${playerIndex}_team_name` as keyof Match] as
            | string
            | null
            | undefined,
        ),
        region: normalizeText(
          match[`${prefix}_player${playerIndex}_region` as keyof Match] as
            | string
            | null
            | undefined,
        ),
      };
    })
    .filter((player): player is PlayerIdentity => Boolean(player));

  if (players.length > 0) return players;

  const fallbackName = normalizeText(
    team === 'A' ? match.team_a : match.team_b,
  );
  return fallbackName
    ? [{ name: fallbackName, teamName: '', region: '' }]
    : [{ name: `チーム${team}`, teamName: '', region: '' }];
};

const getPlayerIdentityKey = (player: PlayerIdentity) =>
  normalizeKeyText(player.name);

const getSideTargetBase = (match: Match, side: TeamKey) => {
  const players = getTeamPlayers(match, side);
  const kind: GrowthTargetKind =
    players.length > 1 || match.game_type === 'doubles' ? 'pair' : 'player';
  const playerKeys =
    kind === 'pair'
      ? players.map(getPlayerIdentityKey).sort()
      : [getPlayerIdentityKey(players[0])];
  const playerNames = players.map((player) => player.name);
  const teamNames = [
    ...new Set(players.map((player) => player.teamName).filter(Boolean)),
  ];
  const regions = [
    ...new Set(players.map((player) => player.region).filter(Boolean)),
  ];

  return {
    key: `${kind}:${playerKeys.join('&')}`,
    kind,
    displayName: playerNames.join('・'),
    playerNames,
    teamNames,
    regions,
  };
};

export const getGrowthTargetForSide = (
  match: Match,
  side: TeamKey,
): GrowthTarget => {
  const base = getSideTargetBase(match, side);
  const date = getMatchDate(match);

  return {
    ...base,
    matchCount: 1,
    completedMatchCount: isCompletedMatch(match) ? 1 : 0,
    latestMatchDate: date,
  };
};

export const getGrowthTargetsForMatch = (match: Match): GrowthTarget[] => [
  getGrowthTargetForSide(match, 'A'),
  getGrowthTargetForSide(match, 'B'),
];

export const buildGrowthTargets = (matches: Match[]): GrowthTarget[] => {
  const targetMap = new Map<string, GrowthTarget>();

  matches.forEach((match) => {
    getGrowthTargetsForMatch(match).forEach((target) => {
      const existing = targetMap.get(target.key);
      if (!existing) {
        targetMap.set(target.key, target);
        return;
      }

      const latestMatchDate =
        !existing.latestMatchDate ||
        (target.latestMatchDate &&
          target.latestMatchDate > existing.latestMatchDate)
          ? target.latestMatchDate
          : existing.latestMatchDate;

      targetMap.set(target.key, {
        ...existing,
        teamNames: [...new Set([...existing.teamNames, ...target.teamNames])],
        regions: [...new Set([...existing.regions, ...target.regions])],
        matchCount: existing.matchCount + 1,
        completedMatchCount:
          existing.completedMatchCount + target.completedMatchCount,
        latestMatchDate,
      });
    });
  });

  return [...targetMap.values()].sort((left, right) => {
    const dateOrder = (right.latestMatchDate ?? '').localeCompare(
      left.latestMatchDate ?? '',
    );
    if (dateOrder !== 0) return dateOrder;
    return right.completedMatchCount - left.completedMatchCount;
  });
};

const getMatchDate = (match: Match) =>
  match.match_date ?? match.completed_at ?? match.created_at ?? null;

const getMatchWinner = (match: Match): TeamKey | null => {
  const games = match.games ?? [];
  const gamesWonA = games.filter((game) => game.winner_team === 'A').length;
  const gamesWonB = games.filter((game) => game.winner_team === 'B').length;
  const requiredWins = getRequiredWins(match.best_of);

  if (gamesWonA >= requiredWins) return 'A';
  if (gamesWonB >= requiredWins) return 'B';
  return null;
};

export const isCompletedMatch = (match: Match) =>
  match.status === 'completed' || getMatchWinner(match) !== null;

const createRate = (points: ReconstructedPoint[], team: TeamKey): RateStat => ({
  numerator: points.filter((context) => context.point.winner_team === team)
    .length,
  denominator: points.length,
});

const reconstructPoints = (match: Match): ReconstructedPoint[] => {
  const points: ReconstructedPoint[] = [];
  let gamesWonA = 0;
  let gamesWonB = 0;

  const games = [...(match.games ?? [])].sort(
    (left, right) => left.game_number - right.game_number,
  );

  games.forEach((game) => {
    const pointsToWin = getPointsToWinForGame(
      match.best_of,
      gamesWonA,
      gamesWonB,
    );
    const sortedPoints = [...(game.points ?? [])].sort(
      (left, right) => left.point_number - right.point_number,
    );
    let scoreA = 0;
    let scoreB = 0;

    sortedPoints.forEach((point) => {
      const scoreBefore = { A: scoreA, B: scoreB };

      if (point.winner_team === 'A') scoreA += 1;
      if (point.winner_team === 'B') scoreB += 1;

      points.push({
        point,
        gameNumber: game.game_number,
        pointNumber: point.point_number,
        pointsToWin,
        scoreBefore,
        scoreAfter: { A: scoreA, B: scoreB },
        isFinalGame: pointsToWin === FINAL_GAME_WIN_POINTS,
      });
    });

    if (game.winner_team === 'A') gamesWonA += 1;
    if (game.winner_team === 'B') gamesWonB += 1;
  });

  return points;
};

const isGamePointOpportunity = (context: ReconstructedPoint, team: TeamKey) => {
  const opponent = getOppositeTeam(team);
  return isWinningScore(
    context.scoreBefore[team] + 1,
    context.scoreBefore[opponent],
    context.pointsToWin,
  );
};

const getRallyBucket = (point: Point) => {
  if (point.double_fault) return 'unknown';
  const rallyCount = point.rally_count ?? 0;
  if (rallyCount <= 0) return 'unknown';
  if (rallyCount <= 2) return 'short';
  if (rallyCount <= 5) return 'middle';
  return 'long';
};

const getLostStreakStats = (
  reconstructedPoints: ReconstructedPoint[],
  team: TeamKey,
) => {
  let currentLostStreak = 0;
  let maxLostStreak = 0;
  let threePointLostStreakCount = 0;
  let fourPointLostStreakCount = 0;
  let afterLostStreakNumerator = 0;
  let afterLostStreakDenominator = 0;

  reconstructedPoints.forEach((context) => {
    if (currentLostStreak >= 2) {
      afterLostStreakDenominator += 1;
      if (context.point.winner_team === team) {
        afterLostStreakNumerator += 1;
      }
    }

    if (context.point.winner_team === team) {
      currentLostStreak = 0;
      return;
    }

    if (isTeamKey(context.point.winner_team)) {
      currentLostStreak += 1;
      maxLostStreak = Math.max(maxLostStreak, currentLostStreak);
      if (currentLostStreak === 3) threePointLostStreakCount += 1;
      if (currentLostStreak === 4) fourPointLostStreakCount += 1;
    }
  });

  return {
    maxLostStreak,
    threePointLostStreakCount,
    fourPointLostStreakCount,
    afterConsecutiveLostPointWinRate: {
      numerator: afterLostStreakNumerator,
      denominator: afterLostStreakDenominator,
    },
  };
};

const getTwoPointLeadHoldRate = (match: Match, team: TeamKey): RateStat => {
  let numerator = 0;
  let denominator = 0;

  (match.games ?? []).forEach((game: Game) => {
    let ledByTwo = false;
    let scoreA = 0;
    let scoreB = 0;

    [...(game.points ?? [])]
      .sort((left, right) => left.point_number - right.point_number)
      .forEach((point) => {
        if (point.winner_team === 'A') scoreA += 1;
        if (point.winner_team === 'B') scoreB += 1;
        const scoreFor = team === 'A' ? scoreA : scoreB;
        const scoreAgainst = team === 'A' ? scoreB : scoreA;
        if (scoreFor - scoreAgainst >= 2) ledByTwo = true;
      });

    if (ledByTwo) {
      denominator += 1;
      if (game.winner_team === team) numerator += 1;
    }
  });

  return { numerator, denominator };
};

const getSingleMatchGrowthStats = (
  match: Match,
  side: TeamKey,
): SingleMatchGrowthStats | null => {
  const targetKey = getGrowthTargetForSide(match, side).key;
  if (!targetKey) return null;

  const opponent = getOppositeTeam(side);
  const reconstructedPoints = reconstructPoints(match);
  const servedPoints = reconstructedPoints.filter(
    (context) => context.point.serving_team === side,
  );
  const firstServePoints = servedPoints.filter(
    (context) => !context.point.first_serve_fault,
  );
  const secondServePoints = servedPoints.filter(
    (context) => context.point.first_serve_fault,
  );
  const receivePoints = reconstructedPoints.filter(
    (context) => context.point.serving_team === opponent,
  );
  const twoTwoPoints = reconstructedPoints.filter(
    (context) => context.scoreBefore.A === 2 && context.scoreBefore.B === 2,
  );
  const deucePoints = reconstructedPoints.filter(
    (context) =>
      context.scoreBefore.A === context.scoreBefore.B &&
      context.scoreBefore.A >= context.pointsToWin - 1,
  );
  const gamePointPoints = reconstructedPoints.filter((context) =>
    isGamePointOpportunity(context, side),
  );
  const opponentGamePointPoints = reconstructedPoints.filter((context) =>
    isGamePointOpportunity(context, opponent),
  );
  const finalGamePoints = reconstructedPoints.filter(
    (context) => context.isFinalGame,
  );
  const rallyPoints = reconstructedPoints.filter(
    (context) => getRallyBucket(context.point) !== 'unknown',
  );
  const shortRallyPoints = rallyPoints.filter(
    (context) => getRallyBucket(context.point) === 'short',
  );
  const middleRallyPoints = rallyPoints.filter(
    (context) => getRallyBucket(context.point) === 'middle',
  );
  const longRallyPoints = rallyPoints.filter(
    (context) => getRallyBucket(context.point) === 'long',
  );
  const lostStreakStats = getLostStreakStats(reconstructedPoints, side);
  const matchWinner = getMatchWinner(match);
  const opponentTarget = getGrowthTargetForSide(match, opponent);

  return {
    match,
    side,
    targetWon: matchWinner === side,
    opponentKey: opponentTarget.key,
    opponentName: opponentTarget.displayName,
    matchDate: getMatchDate(match) ?? '',
    rates: {
      servicePointWinRate: createRate(servedPoints, side),
      firstServeSuccessRate: {
        numerator: firstServePoints.length,
        denominator: servedPoints.length,
      },
      firstServePointWinRate: createRate(firstServePoints, side),
      secondServePointWinRate: createRate(secondServePoints, side),
      doubleFaultRate: {
        numerator: servedPoints.filter((context) => context.point.double_fault)
          .length,
        denominator: servedPoints.length,
      },
      receivePointWinRate: createRate(receivePoints, side),
      afterTwoTwoPointWinRate: createRate(twoTwoPoints, side),
      deucePointWinRate: createRate(deucePoints, side),
      gamePointWinRate: createRate(gamePointPoints, side),
      opponentGamePointSaveRate: createRate(opponentGamePointPoints, side),
      finalGamePointWinRate: createRate(finalGamePoints, side),
      afterConsecutiveLostPointWinRate:
        lostStreakStats.afterConsecutiveLostPointWinRate,
      twoPointLeadHoldRate: getTwoPointLeadHoldRate(match, side),
      shortRallyWinRate: createRate(shortRallyPoints, side),
      middleRallyWinRate: createRate(middleRallyPoints, side),
      longRallyWinRate: createRate(longRallyPoints, side),
    },
    averages: {
      threePointLostStreakCount: lostStreakStats.threePointLostStreakCount,
      fourPointLostStreakCount: lostStreakStats.fourPointLostStreakCount,
      maxLostStreak: lostStreakStats.maxLostStreak,
    },
  };
};

const getStatsForTarget = (matches: Match[], targetKey: string) =>
  matches
    .filter(isCompletedMatch)
    .flatMap((match) =>
      (['A', 'B'] as TeamKey[])
        .filter((side) => getGrowthTargetForSide(match, side).key === targetKey)
        .map((side) => getSingleMatchGrowthStats(match, side))
        .filter((stats): stats is SingleMatchGrowthStats => Boolean(stats)),
    )
    .sort((left, right) => left.matchDate.localeCompare(right.matchDate));

const aggregateStats = (
  statsList: SingleMatchGrowthStats[],
): AggregatedMetricSource => {
  const aggregated: AggregatedMetricSource = {
    rates: {},
    averages: {},
    matchCount: statsList.length,
  };

  statsList.forEach((stats) => {
    Object.entries(stats.rates).forEach(([key, value]) => {
      const current = aggregated.rates[key] ?? { numerator: 0, denominator: 0 };
      aggregated.rates[key] = {
        numerator: current.numerator + value.numerator,
        denominator: current.denominator + value.denominator,
      };
    });

    Object.entries(stats.averages).forEach(([key, value]) => {
      const current = aggregated.averages[key] ?? { total: 0, matches: 0 };
      aggregated.averages[key] = {
        total: current.total + value,
        matches: current.matches + 1,
      };
    });
  });

  return aggregated;
};

const getRateValue = (rate: RateStat | undefined) => {
  if (!rate || rate.denominator === 0) return null;
  return (rate.numerator / rate.denominator) * 100;
};

const getAverageValue = (average: AverageStat | undefined) => {
  if (!average || average.matches === 0) return null;
  return average.total / average.matches;
};

const getConfidence = (
  currentSample: number,
  previousSample: number,
  currentMatches: number,
  previousMatches: number,
): GrowthConfidence => {
  if (currentMatches === 0 || previousMatches === 0) {
    return 'insufficient_sample';
  }
  if (currentSample === 0 || previousSample === 0) {
    return 'insufficient_sample';
  }
  if (
    currentSample < RATE_SAMPLE_SMALL ||
    previousSample < RATE_SAMPLE_SMALL ||
    currentMatches < 2 ||
    previousMatches < 2
  ) {
    return 'small_sample';
  }
  if (
    currentSample < RATE_SAMPLE_ENOUGH ||
    previousSample < RATE_SAMPLE_ENOUGH
  ) {
    return 'small_sample';
  }
  return 'enough_sample';
};

const getTrend = (
  delta: number | null,
  higherIsBetter: boolean,
): GrowthTrend => {
  if (delta === null || Math.abs(delta) < STABLE_DELTA) return 'stable';
  const movedUp = delta > 0;
  return movedUp === higherIsBetter ? 'improved' : 'declined';
};

const formatMetricValue = (metric: GrowthMetric, value: number | null) => {
  if (value === null) return 'データなし';
  if (metric.unit === 'average') return `${value.toFixed(1)}回`;
  return `${Math.round(value)}%`;
};

const formatDelta = (metric: GrowthMetric) => {
  if (metric.delta === null) return '';
  const sign = metric.delta > 0 ? '+' : '';
  if (metric.unit === 'average') return `${sign}${metric.delta.toFixed(1)}回`;
  return `${sign}${Math.round(metric.delta)}pt`;
};

const buildMetricSummary = (metric: GrowthMetric) => {
  if (metric.currentValue === null || metric.previousValue === null) {
    return `${metric.label}は、まだ比較できる記録が足りません。`;
  }

  const current = formatMetricValue(metric, metric.currentValue);
  const previous = formatMetricValue(metric, metric.previousValue);
  const delta = formatDelta(metric);

  if (metric.trend === 'improved') {
    return `${metric.label}は ${previous} から ${current} に改善傾向です（${delta}）。`;
  }
  if (metric.trend === 'declined') {
    return `${metric.label}は ${previous} から ${current} です。次はここを見てみましょう（${delta}）。`;
  }
  return `${metric.label}は ${previous} から ${current} で、大きな変化はありません。`;
};

const buildGrowthMetrics = (
  current: AggregatedMetricSource,
  previous: AggregatedMetricSource,
) =>
  metricDefinitions.map((definition): GrowthMetric => {
    const currentRate = current.rates[definition.key];
    const previousRate = previous.rates[definition.key];
    const currentAverage = current.averages[definition.key];
    const previousAverage = previous.averages[definition.key];
    const currentValue =
      definition.kind === 'rate'
        ? getRateValue(currentRate)
        : getAverageValue(currentAverage);
    const previousValue =
      definition.kind === 'rate'
        ? getRateValue(previousRate)
        : getAverageValue(previousAverage);
    const currentSample =
      definition.kind === 'rate'
        ? (currentRate?.denominator ?? 0)
        : (currentAverage?.matches ?? 0);
    const previousSample =
      definition.kind === 'rate'
        ? (previousRate?.denominator ?? 0)
        : (previousAverage?.matches ?? 0);
    const delta =
      currentValue !== null && previousValue !== null
        ? currentValue - previousValue
        : null;
    const metric: GrowthMetric = {
      key: definition.key,
      label: definition.label,
      category: definition.category,
      unit: definition.unit,
      higherIsBetter: definition.higherIsBetter,
      currentValue,
      previousValue,
      delta,
      trend: getTrend(delta, definition.higherIsBetter),
      confidence: getConfidence(
        currentSample,
        previousSample,
        current.matchCount,
        previous.matchCount,
      ),
      numerator:
        definition.kind === 'rate'
          ? (currentRate?.numerator ?? 0)
          : (currentAverage?.total ?? 0),
      denominator:
        definition.kind === 'rate'
          ? (currentRate?.denominator ?? 0)
          : (currentAverage?.matches ?? 0),
      previousNumerator:
        definition.kind === 'rate'
          ? (previousRate?.numerator ?? 0)
          : (previousAverage?.total ?? 0),
      previousDenominator:
        definition.kind === 'rate'
          ? (previousRate?.denominator ?? 0)
          : (previousAverage?.matches ?? 0),
      matchCount: current.matchCount,
      previousMatchCount: previous.matchCount,
      summary: '',
    };

    return {
      ...metric,
      summary: buildMetricSummary(metric),
    };
  });

const getComparableMetrics = (metrics: GrowthMetric[]) =>
  metrics.filter(
    (metric) =>
      metric.currentValue !== null &&
      metric.previousValue !== null &&
      metric.confidence !== 'insufficient_sample',
  );

const getImprovedMetrics = (metrics: GrowthMetric[]) =>
  getComparableMetrics(metrics)
    .filter((metric) => metric.trend === 'improved')
    .sort(
      (left, right) => Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0),
    );

const getDeclinedMetrics = (metrics: GrowthMetric[]) =>
  getComparableMetrics(metrics)
    .filter((metric) => metric.trend === 'declined')
    .sort(
      (left, right) => Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0),
    );

const buildComparisonMessages = (metrics: GrowthMetric[]) => {
  const improved = getImprovedMetrics(metrics)[0];
  const declined = getDeclinedMetrics(metrics)[0];
  const messages: string[] = [];

  if (improved) {
    messages.push(improved.summary);
  }
  if (declined) {
    messages.push(declined.summary);
  }
  if (messages.length === 0) {
    messages.push(
      '大きな変化はまだ見えにくい状態です。次の数試合も続けて確認してみましょう。',
    );
  }

  return messages;
};

const buildComparison = ({
  kind,
  title,
  description,
  currentLabel,
  previousLabel,
  currentStats,
  previousStats,
}: {
  kind: GrowthComparisonKind;
  title: string;
  description: string;
  currentLabel: string;
  previousLabel: string;
  currentStats: SingleMatchGrowthStats[];
  previousStats: SingleMatchGrowthStats[];
}): GrowthComparison | null => {
  if (currentStats.length === 0 || previousStats.length === 0) return null;

  const metrics = buildGrowthMetrics(
    aggregateStats(currentStats),
    aggregateStats(previousStats),
  );

  return {
    kind,
    title,
    description,
    currentLabel,
    previousLabel,
    currentMatchCount: currentStats.length,
    previousMatchCount: previousStats.length,
    metrics,
    messages: buildComparisonMessages(metrics),
  };
};

const getRecentPeriodComparison = (
  stats: SingleMatchGrowthStats[],
): GrowthComparison | null => {
  if (stats.length < 2) return null;
  const windowSize = stats.length >= 10 ? 5 : stats.length >= 6 ? 3 : 1;
  const currentStats = stats.slice(-windowSize);
  const previousStats = stats.slice(-(windowSize * 2), -windowSize);

  return buildComparison({
    kind: 'recent_period',
    title: '最近の成長',
    description: `${currentStats.length}試合と、その前の${previousStats.length}試合を比べています。`,
    currentLabel: windowSize === 1 ? '今回' : `直近${currentStats.length}試合`,
    previousLabel: windowSize === 1 ? '前回' : `前${previousStats.length}試合`,
    currentStats,
    previousStats,
  });
};

const getWinLossComparison = (
  stats: SingleMatchGrowthStats[],
): GrowthComparison | null => {
  const wonStats = stats.filter((entry) => entry.targetWon);
  const lostStats = stats.filter((entry) => !entry.targetWon);

  return buildComparison({
    kind: 'win_loss',
    title: '勝ち試合と負け試合の差',
    description: '勝敗だけでなく、どの場面で差が出ているかを比べています。',
    currentLabel: '勝ち試合',
    previousLabel: '負け試合',
    currentStats: wonStats,
    previousStats: lostStats,
  });
};

const getSameOpponentComparison = (
  stats: SingleMatchGrowthStats[],
): GrowthComparison | null => {
  const latest = stats[stats.length - 1];
  if (!latest) return null;
  const sameOpponentStats = stats.filter(
    (entry) => entry.opponentKey === latest.opponentKey,
  );
  return getRecentPeriodComparisonForKind(
    sameOpponentStats,
    'same_opponent',
    `同じ相手との比較`,
    `${latest.opponentName} との試合だけで比べています。`,
  );
};

const getRecentPeriodComparisonForKind = (
  stats: SingleMatchGrowthStats[],
  kind: GrowthComparisonKind,
  title: string,
  description: string,
) => {
  if (stats.length < 2) return null;
  const currentStats = stats.slice(-1);
  const previousStats = stats.slice(0, -1);
  return buildComparison({
    kind,
    title,
    description,
    currentLabel: '最新試合',
    previousLabel: '過去平均',
    currentStats,
    previousStats,
  });
};

const getSameFieldComparison = (
  stats: SingleMatchGrowthStats[],
  kind: GrowthComparisonKind,
  title: string,
  description: string,
  getField: (match: Match) => string | null | undefined,
) => {
  const latest = stats[stats.length - 1];
  const fieldValue = latest ? getField(latest.match) : null;
  if (!fieldValue) return null;
  return getRecentPeriodComparisonForKind(
    stats.filter((entry) => getField(entry.match) === fieldValue),
    kind,
    title,
    description,
  );
};

const getOpponentLevelComparison = (
  stats: SingleMatchGrowthStats[],
): GrowthComparison | null => {
  const latest = stats[stats.length - 1];
  const level = latest?.match.opponent_level ?? 'unknown';
  if (!latest || level === 'unknown') return null;
  return getRecentPeriodComparisonForKind(
    stats.filter(
      (entry) => (entry.match.opponent_level ?? 'unknown') === level,
    ),
    'opponent_level',
    '相手レベル別比較',
    `相手レベル「${getOpponentLevelLabel(level)}」の試合だけで比べています。`,
  );
};

const getOpponentLevelLabel = (level: string) => {
  if (level === 'stronger') return '格上';
  if (level === 'same') return '同格';
  if (level === 'weaker') return '格下';
  return '不明';
};

const buildSections = (
  comparison: GrowthComparison | null,
): GrowthReportSection[] => {
  if (!comparison) return [];
  const byCategory = (category: GrowthMetricCategory) =>
    comparison.metrics.filter((metric) => metric.category === category);

  const sections: GrowthReportSection[] = [
    {
      id: 'summary',
      title: '最近の成長',
      messages: comparison.messages,
      metrics: getComparableMetrics(comparison.metrics).slice(0, 4),
    },
    {
      id: 'tracking',
      title: '改善トラッキング',
      messages: buildTrackingMessages(comparison.metrics),
      metrics: [
        ...getImprovedMetrics(comparison.metrics),
        ...getDeclinedMetrics(comparison.metrics),
      ].slice(0, 3),
    },
    {
      id: 'serve',
      title: 'サーブ成長',
      messages: buildComparisonMessages(byCategory('serve')),
      metrics: byCategory('serve'),
    },
    {
      id: 'key_moment',
      title: '重要局面',
      messages: buildComparisonMessages(byCategory('key_moment')),
      metrics: byCategory('key_moment'),
    },
    {
      id: 'momentum',
      title: '連続失点の変化',
      messages: buildComparisonMessages(byCategory('momentum')),
      metrics: byCategory('momentum'),
    },
    {
      id: 'rally',
      title: 'ラリー傾向',
      messages: buildComparisonMessages(byCategory('rally')),
      metrics: byCategory('rally'),
    },
  ];

  return sections.map((section) => ({
    ...section,
    metrics: section.metrics.filter((metric) => metric.denominator > 0),
  }));
};

const buildTrackingMessages = (metrics: GrowthMetric[]) => {
  const improved = getImprovedMetrics(metrics)[0];
  const declined = getDeclinedMetrics(metrics)[0];
  const messages: string[] = [];

  if (improved) {
    messages.push(`前回まで確認していた「${improved.label}」は改善傾向です。`);
  }
  if (declined) {
    messages.push(
      `一方で「${declined.label}」は次の試合で確認してみましょう。`,
    );
  }
  if (messages.length === 0) {
    messages.push(
      '改善トラッキングは、あと数試合記録すると見えやすくなります。',
    );
  }
  return messages;
};

const buildPracticeThemes = (
  comparison: GrowthComparison | null,
): PracticeTheme[] => {
  if (!comparison) return [];

  return getDeclinedMetrics(comparison.metrics)
    .filter((metric) => practiceThemeMap[metric.key])
    .slice(0, 3)
    .map((metric, index) => ({
      id: `practice-${metric.key}`,
      sourceMetricKey: metric.key,
      priority: index + 1,
      ...practiceThemeMap[metric.key],
    }));
};

export const buildGrowthReport = (
  matches: Match[],
  targetKey: string,
  generatedAt: string = new Date().toISOString(),
): GrowthReport | null => {
  const target = buildGrowthTargets(matches).find(
    (candidate) => candidate.key === targetKey,
  );
  if (!target) return null;

  const stats = getStatsForTarget(matches, targetKey);
  const recentComparison = getRecentPeriodComparison(stats);
  const comparisons = [
    recentComparison,
    getWinLossComparison(stats),
    getSameOpponentComparison(stats),
    getSameFieldComparison(
      stats,
      'same_tournament',
      '同じ大会での比較',
      '同じ大会の試合だけで比べています。',
      (match) => match.tournament_id ?? match.tournament_name,
    ),
    getSameFieldComparison(
      stats,
      'same_format',
      '同じ形式での比較',
      'シングルス/ダブルスなど同じ形式の試合だけで比べています。',
      (match) => match.game_type,
    ),
    getSameFieldComparison(
      stats,
      'same_pair',
      '同じペアでの比較',
      '同じペア構成の試合だけで比べています。',
      (match) => (match.game_type === 'doubles' ? targetKey : null),
    ),
    getOpponentLevelComparison(stats),
  ].filter((comparison): comparison is GrowthComparison => Boolean(comparison));

  return {
    target,
    generatedAt,
    matchCount: target.matchCount,
    completedMatchCount: stats.length,
    comparison: recentComparison,
    comparisons,
    sections: buildSections(recentComparison),
    practiceThemes: buildPracticeThemes(recentComparison),
    emptyMessage:
      stats.length < 2
        ? 'もう少し記録すると、前回との変化や最近の傾向が見えます。'
        : null,
  };
};

export const buildGrowthReports = (
  matches: Match[],
  generatedAt: string = new Date().toISOString(),
) => {
  const targets = buildGrowthTargets(matches);
  const reports = targets
    .map((target) => buildGrowthReport(matches, target.key, generatedAt))
    .filter((report): report is GrowthReport => Boolean(report));

  return { targets, reports };
};

const getStableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

export const getGrowthReportFileName = (targetKey: string) =>
  `${getStableHash(targetKey)}.json`;

export const formatGrowthMetricValue = formatMetricValue;
export const formatGrowthMetricDelta = formatDelta;
