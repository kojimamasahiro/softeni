// src/types/tournament.ts
// types/tournament.ts

export interface TournamentSummary {
  id: string;
  meta: {
    sortId: number;
    name: string;
    region: string;
    type: string;
    category: string;
    officialUrl: string;
    isMajorTitle: boolean;
  };
  years: TournamentYearData[];
}

export interface TournamentYearData {
  year: string;
  status: string;
  scheduledDate?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  url?: string;
  results: {
    playerIds?: string[];
    team?: string;
    prefecture?: string;
    result: string;
    category?: string;
  }[];
  matches?: {
    round: string;
    pair?: string[];
    team?: string;
    opponentTeam?: MatchOpponentTeam;
    opponents?: MatchOpponent[];
    opponent?: string;
    result: 'win' | 'lose';
    games: { won: string; lost: string };
    entryNo: number;
    name: string;
    category?: string;
  }[];
  roundRobinMatches?: {
    round: string;
    pair?: string[];
    team?: string;
    opponentTeam?: MatchOpponentTeam;
    opponents?: MatchOpponent[];
    opponent?: string;
    result: 'win' | 'lose';
    games: { won: string; lost: string };
    entryNo: number;
    name: string;
    category?: string;
  }[];
  standings?: {
    [category: string]: {
      [group: string]: {
        id: number;
        name: string;
        rank: number;
        wins?: number;
        losses?: number;
        points?: number;
        scoreDiff?: number;
      }[];
    };
  };
}

export interface MatchOpponent {
  lastName: string;
  firstName: string;
  team: string;
  prefecture: string | null;
  playerId: string | null;
  tempId: string;
}

export interface MatchOpponentTeam {
  team: string;
  prefecture: string;
}

// ----
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
  informationId: string;
  year: number;
  location: string;
  startDate: string;
  endDate: string;
  source: string;
  sourceUrl: string;
  categories: TournamentCategoryInfo[];
}

export interface TournamentParticipant {
  id: string;
  lastName: string;
  firstName: string;
  team: string;
  prefecture: string | null;
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
