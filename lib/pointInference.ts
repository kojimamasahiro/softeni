import { determineWinnerTeam, ERROR_RESULT_TYPES, getPlayerUniqueId } from './matchLogic';

/**
 * ポイント入力の自動推定に必要な文脈。
 * 「今どちらがサーブ／レシーブで、それぞれ誰か」は入力欄ではなく試合の進行から決まるので、
 * 呼び出し側（コントローラ）が算出して渡す。
 */
export type PointInferenceContext = {
  teamAPlayers: string[];
  teamBPlayers: string[];
  servingTeam: 'A' | 'B' | null;
  /** サーブ選手の一意ID（`getPlayerUniqueId` 形式） */
  servingPlayerId: string | null;
  receivingTeam: 'A' | 'B' | null;
  /** レシーブ選手の一意ID（`getPlayerUniqueId` 形式） */
  receivingPlayerId: string | null;
};

/** 推定対象になるポイント入力の項目。`PointDataState` の部分集合。 */
type InferablePointData = {
  winner_team: string;
  serving_team: string;
  rally_count: number;
  first_serve_fault: boolean;
  double_fault: boolean;
  result_type: string;
  winner_player: string;
  loser_player: string;
};

const oppositeTeam = (team: 'A' | 'B'): 'A' | 'B' => (team === 'A' ? 'B' : 'A');

/**
 * 入力済みの内容から一意に決まる項目を補完する。
 *
 * 方針:
 * - **空欄のみ埋める**。既に入っている値は上書きしない（手動の選択が常に優先）。
 * - 埋めた値は通常の選択と同じ扱いで、記録ボタンを押すまで確定しない。
 *
 * 推定できるもの:
 * 1. 結果タイプ＋関与選手 → 勝者チーム（ウィナー系は本人のチーム、ミス系は相手チーム）
 * 2. サービスエース → 得点はサーブ側、決めたのはサーブ選手、ラリー数1
 * 3. ダブルフォルト → 得点はレシーブ側、ミスはサーブ選手、1stフォルトあり、ラリー数1
 * 4. レシーブ失敗 → 得点はサーブ側、ミスはレシーブ選手、ラリー数2
 * 5. シングルス（1チーム1人）→ 結果タイプ＋勝者チームが決まれば関与選手は一意
 */
export const inferPointData = <T extends InferablePointData>(data: T, context: PointInferenceContext): T => {
  const next: T = { ...data };

  if (!next.serving_team && context.servingTeam) {
    next.serving_team = context.servingTeam;
  }

  // 1. 結果タイプ＋関与選手 → 勝者チーム
  if (!next.winner_team && next.result_type) {
    const involvedPlayer = ERROR_RESULT_TYPES.has(next.result_type) ? next.loser_player : next.winner_player;
    if (involvedPlayer) {
      const autoWinner = determineWinnerTeam(involvedPlayer, next.result_type);
      if (autoWinner) {
        next.winner_team = autoWinner;
      }
    }
  }

  // 2. サービスエース
  if (next.result_type === 'service_ace' && context.servingTeam) {
    if (!next.winner_team) next.winner_team = context.servingTeam;
    if (!next.winner_player && context.servingPlayerId) next.winner_player = context.servingPlayerId;
    if (!next.rally_count) next.rally_count = 1;
  }

  // 3. ダブルフォルト
  if (next.result_type === 'double_fault' && context.servingTeam) {
    if (!next.winner_team) next.winner_team = oppositeTeam(context.servingTeam);
    if (!next.loser_player && context.servingPlayerId) next.loser_player = context.servingPlayerId;
    if (!next.rally_count) next.rally_count = 1;
    next.first_serve_fault = true;
  }

  // 4. レシーブ失敗
  if (next.result_type === 'receive_error' && context.servingTeam) {
    if (!next.winner_team) next.winner_team = context.servingTeam;
    if (!next.loser_player && context.receivingPlayerId) next.loser_player = context.receivingPlayerId;
    if (!next.rally_count) next.rally_count = 2;
  }

  // 5. シングルスは関与選手が一意に決まる
  if (next.result_type && (next.winner_team === 'A' || next.winner_team === 'B')) {
    const isErrorResult = ERROR_RESULT_TYPES.has(next.result_type);
    const involvedTeam = isErrorResult ? oppositeTeam(next.winner_team) : next.winner_team;
    const involvedTeamPlayers = involvedTeam === 'A' ? context.teamAPlayers : context.teamBPlayers;

    if (involvedTeamPlayers.length === 1) {
      const involvedPlayerId = getPlayerUniqueId(involvedTeam, 0, involvedTeamPlayers[0]);

      if (isErrorResult && !next.loser_player) {
        next.loser_player = involvedPlayerId;
      }
      if (!isErrorResult && !next.winner_player) {
        next.winner_player = involvedPlayerId;
      }
    }
  }

  return next;
};
