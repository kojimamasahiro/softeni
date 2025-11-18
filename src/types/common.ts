// src/types/common.ts
export interface MatchResult {
  round: string;
  opponent: string;
  result: string;
  score: string;
  partner?: string | null;
}

export interface Stage {
  format: 'round-robin' | 'tournament';
  group?: string;
  results: MatchResult[];
}

export interface Result {
  playerIds: string[];
  result: string;
}
