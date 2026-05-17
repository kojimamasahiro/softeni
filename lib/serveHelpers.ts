import { Game } from '../src/types/database';
import { isFinalGame as isFinalGameByWins } from './matchRules';

/**
 * ゲーム開始時のサーブ権を決定する
 * @param gameNumber ゲーム番号（1から開始）
 * @param initialServeTeam 第1ゲームで最初にサーブを行うチーム
 * @returns このゲームで最初にサーブを行うチーム
 */
export function determineInitialServeTeam(
  gameNumber: number,
  initialServeTeam: 'A' | 'B',
): 'A' | 'B' {
  // ゲームごとにサーブ権を交代
  // 奇数ゲーム: initialServeTeam、偶数ゲーム: 相手チーム
  if (gameNumber % 2 === 1) {
    return initialServeTeam;
  } else {
    return initialServeTeam === 'A' ? 'B' : 'A';
  }
}

/**
 * ファイナルゲームかどうかを判定する
 * @param gameNumber ゲーム番号
 * @param bestOf 何ゲームマッチか（通常5）
 * @param gamesWonA チームAの勝利ゲーム数
 * @param gamesWonB チームBの勝利ゲーム数
 * @returns ファイナルゲームかどうか
 */
export function isFinalGame(
  gameNumber: number,
  bestOf: number,
  gamesWonA: number = 0,
  gamesWonB: number = 0,
): boolean {
  void gameNumber;
  return isFinalGameByWins(bestOf, gamesWonA, gamesWonB);
}

/**
 * 現在のポイントでのサーブ権を計算する
 * @param game 現在のゲーム
 * @param pointNumber ポイント番号（1から開始）
 * @param bestOf 何ゲームマッチか
 * @param gamesWonA チームAの勝利ゲーム数（オプション）
 * @param gamesWonB チームBの勝利ゲーム数（オプション）
 * @returns サーブを行うチーム
 */
export function getCurrentServingTeam(
  game: Game,
  pointNumber: number,
  bestOf: number,
  gamesWonA: number = 0,
  gamesWonB: number = 0,
): 'A' | 'B' {
  if (!game.initial_serve_team) {
    throw new Error('Initial serve team not set');
  }

  const initialServeTeam = game.initial_serve_team as 'A' | 'B';

  // ファイナルゲーム判定
  const finalGame = isFinalGame(game.game_number, bestOf, gamesWonA, gamesWonB);

  if (finalGame) {
    // ファイナルゲーム: 2ポイントごとにサーブ交代
    // ポイント1-2: 初期サーブチーム、ポイント3-4: 相手チーム、ポイント5-6: 初期サーブチーム...
    const switchCount = Math.floor((pointNumber - 1) / 2);
    return switchCount % 2 === 0
      ? initialServeTeam
      : initialServeTeam === 'A'
        ? 'B'
        : 'A';
  } else {
    // 通常のゲーム: ゲーム全体を通して同じチームがサーブ
    return initialServeTeam;
  }
}

/**
 * ゲーム内のすべてのポイントのサーブ権を再計算する
 * @param game ゲーム情報
 * @param bestOf 何ゲームマッチか
 * @param gamesWonA チームAの勝利ゲーム数（オプション）
 * @param gamesWonB チームBの勝利ゲーム数（オプション）
 * @returns 各ポイントのサーブ権の配列
 */
export function calculateAllServingTeams(
  game: Game,
  bestOf: number,
  gamesWonA: number = 0,
  gamesWonB: number = 0,
): ('A' | 'B')[] {
  if (!game.initial_serve_team) {
    return [];
  }

  const totalPoints = (game.points?.length || 0) + 1; // 現在のポイントも含む
  const servingTeams: ('A' | 'B')[] = [];

  for (let pointNumber = 1; pointNumber <= totalPoints; pointNumber++) {
    servingTeams.push(
      getCurrentServingTeam(game, pointNumber, bestOf, gamesWonA, gamesWonB),
    );
  }

  return servingTeams;
}

/**
 * サーブ権の表示用テキストを生成する
 * @param servingTeam サーブを行うチーム
 * @returns 表示用テキスト
 */
export function getServeDisplayText(servingTeam: 'A' | 'B'): string {
  return `🏓 ${servingTeam}のサーブ`;
}

/**
 * 現在のポイントでサーブを行う選手を決定する
 * 通常ゲーム: 同じチーム内で2ポイントごとに選手交代
 * ファイナルゲーム: チーム交代を考慮し、各チーム内で2ポイントごとに選手交代
 * シングルスの場合：常に1人の選手
 * @param game 現在のゲーム
 * @param pointNumber ポイント番号（1から開始）
 * @param bestOf 何ゲームマッチか
 * @param gamesWonA チームAの勝利ゲーム数
 * @param gamesWonB チームBの勝利ゲーム数
 * @param teamPlayers サーブチームの選手配列
 * @param initialPlayerIndex 初期サーブ選手のインデックス（オプション）
 * @returns サーブを行う選手のインデックス（0または1）
 */
export function getCurrentServingPlayerIndex(
  game: Game,
  pointNumber: number,
  bestOf: number,
  gamesWonA: number = 0,
  gamesWonB: number = 0,
  teamPlayers: string[] = [],
  initialPlayerIndex?: number,
): number {
  // シングルスの場合は常に0番目の選手
  if (teamPlayers.length <= 1) {
    return 0;
  }

  // 初期サーブ選手のインデックスを取得（game.initial_serve_player_indexまたは引数から）
  const gameInitialPlayerIndex =
    game.initial_serve_player_index ?? initialPlayerIndex ?? 0;

  // ファイナルゲーム判定
  const finalGame = isFinalGame(game.game_number, bestOf, gamesWonA, gamesWonB);

  if (finalGame) {
    // ファイナルゲーム: チーム交代を考慮して選手を決定
    // まず現在のサーブチームを取得
    const currentServingTeam = getCurrentServingTeam(
      game,
      pointNumber,
      bestOf,
      gamesWonA,
      gamesWonB,
    );

    // 初期サーブチームと現在のサーブチームが同じかどうかで選手を決定
    const initialServeTeam = game.initial_serve_team as 'A' | 'B';
    const isInitialTeamServing = currentServingTeam === initialServeTeam;

    if (isInitialTeamServing) {
      // 初期サーブチームの場合：設定された初期選手から4ポイントごとに交代
      // ポイント1-2, 5-6, 9-10...: 初期選手、ポイント3-4, 7-8, 11-12...: もう一方の選手
      const teamSwitchCount = Math.floor((pointNumber - 1) / 4);
      return (gameInitialPlayerIndex + teamSwitchCount) % 2;
    } else {
      // 相手チームの場合：0番目の選手から4ポイントごとに交代
      // ポイント1-2, 5-6, 9-10...: 0番目選手、ポイント3-4, 7-8, 11-12...: 1番目選手
      const adjustedPoint = pointNumber - 2; // 相手チームは3ポイント目から開始
      const teamSwitchCount = Math.floor(Math.max(0, adjustedPoint - 1) / 4);
      return teamSwitchCount % 2;
    }
  } else {
    // 通常のゲーム: 同じチーム内で2ポイントごとに選手が交代
    const switchCount = Math.floor((pointNumber - 1) / 2);
    return (gameInitialPlayerIndex + switchCount) % 2;
  }
}
