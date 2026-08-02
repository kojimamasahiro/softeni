import { getGamesWon, isMatchFinishedByGames } from './videoReview';

import type { Match } from '@/types/database';

/**
 * 選手の一意識別子を生成する（チーム + インデックス + 名前）。
 * `src/pages/beta/matches/[matchId]/input.tsx` と `video-review.tsx` の
 * ポイント入力・レビュー UI で選手選択の値として共通に使う。
 */
export const getPlayerUniqueId = (team: 'A' | 'B', index: number, name: string): string => `${team}-${index}-${name}`;

/** 一意識別子からチーム（A/B）を抽出する。該当しない場合は null。 */
export const getTeamFromPlayerId = (uniqueId: string): 'A' | 'B' | null => {
  if (uniqueId.startsWith('A-')) return 'A';
  if (uniqueId.startsWith('B-')) return 'B';
  return null;
};

/** 一意識別子から選手名を抽出する（先頭のチーム(A/B)とインデックスを除いた残り）。 */
export const getPlayerNameFromId = (uniqueId: string): string => {
  const parts = uniqueId.split('-');
  return parts.slice(2).join('-');
};

/**
 * 構造化データ（`match.teams`）または旧形式の個別フィールド／文字列から
 * 指定チームの選手名一覧を取得する。
 */
export const getPlayerNamesFromMatch = (match: Match, team: 'A' | 'B'): string[] => {
  if (match.teams?.[team]) {
    return match.teams[team].players.map((player) => `${player.last_name} ${player.first_name}`);
  }

  const players: string[] = [];
  const prefix = `team_${team.toLowerCase()}`;

  const player1LastName = match[`${prefix}_player1_last_name` as keyof Match] as string;
  const player1FirstName = match[`${prefix}_player1_first_name` as keyof Match] as string;

  if (player1LastName && player1FirstName) {
    players.push(`${player1LastName} ${player1FirstName}`);
  }

  const player2LastName = match[`${prefix}_player2_last_name` as keyof Match] as string;
  const player2FirstName = match[`${prefix}_player2_first_name` as keyof Match] as string;

  if (player2LastName && player2FirstName) {
    players.push(`${player2LastName} ${player2FirstName}`);
  }

  if (players.length === 0) {
    const teamString = team === 'A' ? match.team_a : match.team_b;
    if (teamString) {
      try {
        const withoutEntryNumber = teamString.replace(/^[A-Za-z0-9]+\s+/, '');
        const playerParts = withoutEntryNumber.split(' / ');

        return playerParts
          .map((part) => {
            const playerMatch = part.trim().match(/^([^\(]+)/);
            return playerMatch ? playerMatch[1].trim() : part.trim();
          })
          .filter(Boolean);
      } catch (error) {
        console.warn('Failed to parse team string:', teamString, error);
        return [];
      }
    }
  }

  return players;
};

/** 「ウィナー」系の結果タイプ一覧（ポイント入力・動画レビューのボタン表示で共用）。 */
export const WINNER_BUTTONS = [
  { value: 'smash_winner', label: 'スマッシュ' },
  { value: 'volley_winner', label: 'ボレー' },
  { value: 'passing_winner', label: 'ストローク' },
  { value: 'drop_winner', label: 'ドロップ' },
  { value: 'net_in_winner', label: 'ネットイン' },
] as const;

/** 「ミス」系の結果タイプ一覧（ポイント入力・動画レビューのボタン表示で共用）。 */
export const ERROR_BUTTONS = [
  { value: 'net', label: 'ネット' },
  { value: 'out', label: 'アウト' },
  { value: 'smash_error', label: 'スマ失敗' },
  { value: 'volley_error', label: 'ボレ失敗' },
  { value: 'receive_error', label: 'レシーブ失敗' },
  { value: 'follow_error', label: 'フォロー失敗' },
] as const;

const WINNER_RESULT_TYPES = new Set(['smash_winner', 'volley_winner', 'passing_winner', 'drop_winner', 'net_in_winner', 'service_ace', 'winner']);
export const ERROR_RESULT_TYPES = new Set(['net', 'out', 'smash_error', 'volley_error', 'double_fault', 'receive_error', 'follow_error']);

/**
 * 関与選手（一意識別子）とプレイ結果タイプから勝者チームを自動決定する。
 * ウィナー系は選手のチームが勝者、ミス系は相手チームが勝者。
 */
export const determineWinnerTeam = (playerUniqueId: string, resultType: string): 'A' | 'B' | null => {
  if (!playerUniqueId || !resultType) return null;

  const playerTeam = getTeamFromPlayerId(playerUniqueId);
  if (!playerTeam) return null;

  if (WINNER_RESULT_TYPES.has(resultType)) {
    return playerTeam;
  }

  if (ERROR_RESULT_TYPES.has(resultType)) {
    return playerTeam === 'A' ? 'B' : 'A';
  }

  return null;
};

/** ゲームの勝敗数から試合が終了しているかを判定する。 */
export const isMatchFinished = (match: Match): boolean => {
  if (!match.games || match.games.length === 0) return false;

  const { gamesWonA, gamesWonB } = getGamesWon(match);
  return isMatchFinishedByGames(match.best_of, gamesWonA, gamesWonB);
};

/** 試合が終了している場合に勝者チームを返す。未終了の場合は null。 */
export const getMatchWinner = (match: Match): 'A' | 'B' | null => {
  if (!isMatchFinished(match)) return null;

  const { gamesWonA, gamesWonB } = getGamesWon(match);
  const requiredWins = Math.ceil(match.best_of / 2);

  if (gamesWonA >= requiredWins) return 'A';
  if (gamesWonB >= requiredWins) return 'B';
  return null;
};
