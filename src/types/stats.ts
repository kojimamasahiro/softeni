// types/stats.ts

export interface MatchStats {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
  };
  
  export interface PartnerStats {
    [partnerId: string]: {
      matches: MatchStats;
    };
  };
  
  export interface YearStats {
    [year: string]: {
      matches: MatchStats;
    };
  };
  
  export interface SummaryStats {
    totalMatches: number;
    wins: number;
    losses: number;
    totalWinRate: number;
    byPartner: PartnerStats;
    byYear: YearStats;
    playerId: string;
  };
  