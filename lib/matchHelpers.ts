// lib/matchHelpers.ts - マッチデータ操作のヘルパー関数
import { Match, MatchPlayer } from '../src/types/database';

/**
 * プレイヤー名を取得する（個別フィールドから）
 */
export const getPlayerName = (
  match: Match,
  team: 'A' | 'B',
  player: 1 | 2,
): string => {
  const prefix = `team_${team.toLowerCase()}`;
  const lastNameKey = `${prefix}_player${player}_last_name` as keyof Match;
  const firstNameKey = `${prefix}_player${player}_first_name` as keyof Match;

  const lastName = match[lastNameKey] as string;
  const firstName = match[firstNameKey] as string;

  if (!lastName || !firstName) return '';
  return `${lastName} ${firstName}`;
};

/**
 * プレイヤー名を取得する（構造化データから）
 */
export const getPlayerNameFromTeams = (
  match: Match,
  team: 'A' | 'B',
  playerIndex: number,
): string => {
  if (
    !match.teams ||
    !match.teams[team] ||
    !match.teams[team].players[playerIndex]
  ) {
    return '';
  }

  const player = match.teams[team].players[playerIndex];
  return `${player.last_name} ${player.first_name}`;
};

/**
 * エントリー番号を取得する
 */
export const getEntryNumber = (match: Match, team: 'A' | 'B'): string => {
  // 構造化データから取得を試行
  if (match.teams && match.teams[team]) {
    return match.teams[team].entry_number;
  }

  // 個別フィールドから取得
  const prefix = `team_${team.toLowerCase()}`;
  const entryNumberKey = `${prefix}_entry_number` as keyof Match;
  return (match[entryNumberKey] as string) || '';
};

/**
 * チーム表示名を取得する（シンプル版）
 */
export const getTeamDisplayName = (match: Match, team: 'A' | 'B'): string => {
  // 構造化データから取得を試行
  if (match.teams && match.teams[team]) {
    const teamData = match.teams[team];
    const players = teamData.players
      .map((player) => `${player.last_name} ${player.first_name}`)
      .join(' / ');
    return `${teamData.entry_number} ${players}`;
  }

  // 個別フィールドから生成
  const player1 = getPlayerName(match, team, 1);
  if (!player1) return '';

  const entryNumber = getEntryNumber(match, team);
  const player2 = getPlayerName(match, team, 2);

  const playerNames = player2 ? `${player1} / ${player2}` : player1;
  return entryNumber ? `${entryNumber} ${playerNames}` : playerNames;
};

/**
 * 全プレイヤー情報を取得する
 */
export const getAllPlayers = (match: Match, team: 'A' | 'B'): MatchPlayer[] => {
  // 構造化データから取得を試行
  if (match.teams && match.teams[team]) {
    return match.teams[team].players;
  }

  // 個別フィールドから構築
  const players: MatchPlayer[] = [];
  const prefix = `team_${team.toLowerCase()}`;

  // プレイヤー1
  const player1LastName = match[
    `${prefix}_player1_last_name` as keyof Match
  ] as string;
  const player1FirstName = match[
    `${prefix}_player1_first_name` as keyof Match
  ] as string;
  const player1TeamName = match[
    `${prefix}_player1_team_name` as keyof Match
  ] as string;
  const player1Region = match[
    `${prefix}_player1_region` as keyof Match
  ] as string;

  if (player1LastName && player1FirstName) {
    players.push({
      last_name: player1LastName,
      first_name: player1FirstName,
      team_name: player1TeamName || '',
      region: player1Region || '',
    });
  }

  // プレイヤー2（ダブルスの場合）
  if (match.game_type === 'doubles') {
    const player2LastName = match[
      `${prefix}_player2_last_name` as keyof Match
    ] as string;
    const player2FirstName = match[
      `${prefix}_player2_first_name` as keyof Match
    ] as string;
    const player2TeamName = match[
      `${prefix}_player2_team_name` as keyof Match
    ] as string;
    const player2Region = match[
      `${prefix}_player2_region` as keyof Match
    ] as string;

    if (player2LastName && player2FirstName) {
      players.push({
        last_name: player2LastName,
        first_name: player2FirstName,
        team_name: player2TeamName || '',
        region: player2Region || '',
      });
    }
  }

  return players;
};

/**
 * 使用例
 */
export const exampleUsage = (match: Match) => {
  // プレイヤー名の取得
  const teamAPlayer1 = getPlayerName(match, 'A', 1);
  const teamAPlayer2 = getPlayerName(match, 'A', 2);

  // 構造化データからの取得
  const teamAPlayer1Alt = getPlayerNameFromTeams(match, 'A', 0);
  const teamAPlayer2Alt = getPlayerNameFromTeams(match, 'A', 1);

  // エントリー番号
  const entryNumberA = getEntryNumber(match, 'A');

  console.log('従来形式:', { teamAPlayer1, teamAPlayer2 });
  console.log('構造化データ:', { teamAPlayer1Alt, teamAPlayer2Alt });
  console.log('エントリー番号:', entryNumberA);
};
