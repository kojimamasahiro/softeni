// lib/pointShare.ts
//
// 試合詳細ページの「1本のラリー」を共有するリンクと文面を組み立てる。
// 仕様は docs/wiki/beta-matches-results.md の「ラリー共有リンク」節が正。
//
// - URL は `<試合詳細の canonical>?pointId=<point.id>`。名場面の SNS 投稿テンプレ（lib/rareEvents.mjs）と同じ形式。
// - point_number はゲームごとの番号なので、`?point=N` だけでは第何ゲームかを決められない。
//   `?game=G&point=N` を受け付け、game なしは1ゲームだけの試合でしか解決しない。

type TeamSide = 'A' | 'B';

/** 共有に必要な最小限のポイント情報（types/database の Point と構造互換）。 */
export interface SharePoint {
  id: string;
  point_number: number;
  winner_team: string | null;
  rally_count?: number | null;
}

/** 共有に必要な最小限のゲーム情報（types/database の Game と構造互換）。 */
export interface ShareGame {
  game_number: number;
  points?: SharePoint[] | null;
}

export interface SharedPointQuery {
  pointId?: string | string[];
  game?: string | string[];
  point?: string | string[];
}

export interface LocatedPoint<P extends SharePoint = SharePoint> {
  gameNumber: number;
  point: P;
}

const single = (value: string | string[] | undefined): string | undefined => (typeof value === 'string' ? value : undefined);

const toPositiveInt = (value: string | undefined): number | null => {
  if (value === undefined || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
};

/** URL クエリから共有されたポイントを探す。見つからない・曖昧なときは null。 */
export function locateSharedPoint<P extends SharePoint>(
  games: Array<{ game_number: number; points?: P[] | null }>,
  query: SharedPointQuery,
): LocatedPoint<P> | null {
  const pointId = single(query.pointId);
  if (pointId) {
    for (const game of games) {
      const point = (game.points ?? []).find((candidate) => candidate.id === pointId);
      if (point) return { gameNumber: game.game_number, point };
    }
    return null;
  }

  const pointNumber = toPositiveInt(single(query.point));
  if (pointNumber === null) return null;

  const gameNumber = toPositiveInt(single(query.game));
  const candidateGames = gameNumber !== null ? games.filter((game) => game.game_number === gameNumber) : games.length === 1 ? games : [];
  for (const game of candidateGames) {
    const point = (game.points ?? []).find((candidate) => candidate.point_number === pointNumber);
    if (point) return { gameNumber: game.game_number, point };
  }
  return null;
}

/** そのポイントが始まる前のゲーム内スコア。 */
export function scoreBeforePoint(game: ShareGame, point: SharePoint): Record<TeamSide, number> {
  const before = (game.points ?? []).filter((candidate) => candidate.point_number < point.point_number);
  return {
    A: before.filter((candidate) => candidate.winner_team === 'A').length,
    B: before.filter((candidate) => candidate.winner_team === 'B').length,
  };
}

/** 共有 URL。canonical は末尾スラッシュ付き（trailingSlash: true）。 */
export function buildPointShareUrl(canonicalUrl: string, pointId: string): string {
  const url = new URL(canonicalUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('pointId', pointId);
  return url.toString();
}

export interface PointShareTextInput {
  tournamentLabel: string;
  roundName?: string | null;
  teamA: string;
  teamB: string;
  gameNumber: number;
  scoreBefore: Record<TeamSide, number>;
  rallyCount?: number | null;
  winnerName?: string | null;
}

/** 「第3ゲーム 2-2 から（ラリー9本、Aのポイント）」の1行。案内バナーでも使う。 */
export function describeSharedPoint(input: Pick<PointShareTextInput, 'gameNumber' | 'scoreBefore' | 'rallyCount' | 'winnerName'>): string {
  const details = [
    typeof input.rallyCount === 'number' && input.rallyCount > 0 ? `ラリー${input.rallyCount}本` : null,
    input.winnerName ? `${input.winnerName}のポイント` : null,
  ].filter(Boolean);
  const head = `第${input.gameNumber}ゲーム ${input.scoreBefore.A}-${input.scoreBefore.B} から`;
  return details.length > 0 ? `${head}（${details.join('、')}）` : head;
}

/** 共有する文面（URL は含めない。共有シートには url を別に渡すため）。 */
export function buildPointShareText(input: PointShareTextInput): string {
  const heading = [input.tournamentLabel, input.roundName].filter(Boolean).join(' ');
  return [heading, `${input.teamA} vs ${input.teamB}`, describeSharedPoint(input)].join('\n');
}
