export const NORMAL_GAME_WIN_POINTS = 4;
export const FINAL_GAME_WIN_POINTS = 7;

export const getRequiredWins = (bestOf: number) => Math.ceil(bestOf / 2);

export const isFinalGame = (bestOf: number, gamesWonA: number = 0, gamesWonB: number = 0) => {
  const requiredWins = getRequiredWins(bestOf);
  return gamesWonA === requiredWins - 1 && gamesWonB === requiredWins - 1;
};

export const getPointsToWinForGame = (bestOf: number, gamesWonA: number = 0, gamesWonB: number = 0) =>
  isFinalGame(bestOf, gamesWonA, gamesWonB) ? FINAL_GAME_WIN_POINTS : NORMAL_GAME_WIN_POINTS;

export const isWinningScore = (scoreFor: number, scoreAgainst: number, pointsToWin: number) => scoreFor >= pointsToWin && scoreFor - scoreAgainst >= 2;
