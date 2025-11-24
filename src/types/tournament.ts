// src/types/tournament.ts

export interface TournamentIndexEntry {
  tournamentId: string;
  generationId: string;
  label: string;
  isMajorTitle: boolean;
  officialUrl: string;
}

export interface TournamentCategoryInfo {
  categoryId: string;
  label: string;
  category: string;
  gender: string;
  age: string;
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
  result: 'win' | 'lose' | 'draw';
  games: { won: string; lost: string };
};
