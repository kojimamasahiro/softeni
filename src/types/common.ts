// src/types/common.ts
export interface MatchResult {
  round: string;
  opponent: string;
  result: string;
  score: string;
  partner?: string | null;
  /** 直近の他大会で同じ相手と対戦していた場合の説明（前哨戦・再戦）。lib/priorMeetings.ts */
  rematchOf?: string | null;
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
