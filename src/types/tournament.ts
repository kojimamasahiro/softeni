// src/types/tournament.ts

export interface TournamentIndexEntry {
  tournamentId: string;
  generationId: string;
  label: string;
  isMajorTitle: boolean;
  officialUrl: string;
  federationId?: string;
  /** 高校総体の地区（ブロック）大会など、複数都道府県にまたがる大会の所属ブロックID。federationId とは排他 */
  blockId?: string;
}

export interface TournamentCategoryInfo {
  categoryId: string;
  label: string;
  category: string;
  gender: string;
  age: string;
  /**
   * 大会運営上の状態。'abandoned' は「途中で打ち切られ、以降の試合が実施されなかった」。
   * 未設定＝通常どおり最後まで実施（既存データは全て未設定）。
   * 打ち切り「理由」は保持しない（docs/raw/2026-07-26-abandoned-tournament-ui-design.md）。
   */
  status?: 'abandoned';
  /** status==='abandoned' のとき、最後に完了したラウンド名（例: "3回戦"）。 */
  abandonedAfterRound?: string;
}

export interface TournamentInformationEntry {
  year: number;
  location: string;
  startDate: string;
  endDate: string;
  source: string;
  sourceUrl: string;
  categories: TournamentCategoryInfo[];
}

export interface TournamentParticipant {
  id: string; // 金子_凌_松本市役所_長野
  lastName: string;
  firstName: string;
  team: string;
  prefecture: string | null;
  playerId?: number;
}

export interface TournamentEntry {
  entryNo: number;
  playerIds: string[];
  type?: string;
}

export interface TournamentMatch {
  entries: number[];
  scores: Record<string, number>;
  round: string | null;
  winnerEntryNo: number;
  retired: boolean;
  stage: string;
  group: string | null;
  matchId: string;
  nextMatchId: string | null;
  prevMatchIds: string[];
  prevMatchId: string | null;
}

export interface TournamentResult {
  entryNo: number;
  tournament?: {
    label: string;
    rank: {
      kind: string;
      value: number;
    };
  };
  roundrobin?: {
    group: string;
    rank: number;
  };
}

export interface TournamentDetailData {
  participants: TournamentParticipant[];
  entries: TournamentEntry[];
  matches: TournamentMatch[];
  results: TournamentResult[];
}

export type MatchRow = {
  matchId?: string;
  stage: string | null;
  group?: string | null;
  round?: string | null;
  opponentDisplayName?: string;
  /** 対戦相手のプレーヤーID（結果ページリンク用）。シングルスは1要素、ダブルスは最大2要素。 */
  opponentPlayerIds?: number[];
  /**
   * 直近の他大会で同じ相手と対戦していた場合の説明（前哨戦・再戦）。
   * lib/priorMeetings.ts / docs/wiki/news-context-blocks.md ⑥
   */
  rematchOf?: string | null;
  result: 'win' | 'lose' | 'draw';
  games: { won: string; lost: string };
};
