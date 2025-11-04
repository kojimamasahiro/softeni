import { Game } from '../src/types/database';

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
  // 5ゲームマッチの場合、3-3になった場合の第7ゲームがファイナルゲーム
  const requiredWins = Math.ceil(bestOf / 2);

  // 両チームが(requiredWins - 1)勝利している場合がファイナルゲーム
  return gamesWonA === requiredWins - 1 && gamesWonB === requiredWins - 1;
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
  const finalGame = isFinalGame(game.game_number, bestOf, gamesWonA, gamesWonB);

  if (finalGame) {
    // ファイナルゲームの場合：2ポイントごとにサーブ交代
    // ポイント1-2: 初期サーブチーム、ポイント3-4: 相手チーム、ポイント5-6: 初期サーブチーム...
    const switchCount = Math.floor((pointNumber - 1) / 2);
    return switchCount % 2 === 0
      ? initialServeTeam
      : initialServeTeam === 'A'
        ? 'B'
        : 'A';
  } else {
    // 通常のゲームの場合：そのゲーム全体を通して同じチームがサーブ
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
