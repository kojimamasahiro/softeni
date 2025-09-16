// src/types/tournament.ts
// types/tournament.ts
import { MatchResult, Stage } from '@/types/common';

export interface Tournament {
  tournament: string;
  dateRange?: string;
  location?: string;
  link?: string;
  format: 'round-robin' | 'tournament' | 'combined';
  finalResult?: string;
  groupStage?: Stage;
  finalStage?: Stage;
  results?: MatchResult[];
  partner?: string;
}

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

export interface TournamentMeta {
  id: string;
  sortId: number;
  name: string;
  region: string;
  type: string;
  category: string;
  officialUrl: string;
  isMajorTitle: boolean;
  source?: string;
  sourceUrl?: string;
}
