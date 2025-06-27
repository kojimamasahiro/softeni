// src/types/stats.ts
// types/stats.ts

export interface Games {
  total: number;
  won: number;
  lost: number;
  gameRate: number;
}

export interface MatchStats {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface PartnerStats {
  [partnerId: string]: {
    matches: MatchStats;
    games: Games;
  };
}

export interface YearStats {
  [year: string]: {
    matches: MatchStats;
    games: Games;
  };
}

export interface PlayerStats {
  playerId: string;
  totalMatches: number;
  wins: number;
  losses: number;
  totalWinRate: number;
  games: Games;
  byPartner: PartnerStats;
  byYear: YearStats;
}
