// types.ts
export interface MatchResult {
  round: string;
  opponent: string;
  result: string;
  score: string;
}

export interface Stage {
  format: 'round-robin' | 'tournament';
  group?: string;
  results: MatchResult[];
}

export interface Tournament {
  tournament: string;
  dateRange?: string;
  location?: string;
  link?: string;
  format: 'round-robin' | 'tournament' | 'combined';
  finalResult?: string;
  groupStage?: Stage;
  finalStage?: Stage;
  results?: MatchResult[]; // 単独モード
}

export interface YearlyResult {
  year: number;
  result: string;
}

export interface MajorTitle {
  name: string;
  years: YearlyResult[];
}

export interface PlayerData {
  id: string;
  name: string;
  matches: Tournament[];
  majorTitles: MajorTitle[];
}
