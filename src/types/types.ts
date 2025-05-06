// types.ts
export interface MatchResult {
  round: string;
  opponent: string;
  result: string;
  score: string;
  partner?: string;
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
  results?: MatchResult[];
  partner?: string;
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
  matches: Tournament[];
  majorTitles: MajorTitle[];
}

export interface PlayerInfo {
  id: string;
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  team: string;
  position: string;
  handedness: string;
  birthDate: string;
  height: number;
  profileLinks: {
    label: string;
    url: string;
  }[];
};

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
  results?: { playerIds: string[]; result: string }[];
}

export interface LiveData {
  tournament: string;
  updatedAt: string;
  startDate: string;
  endDate: string;
  players: {
    playerId: string;
    status: string;
    latestResult: string;
    nextMatch: string;
  }[];
}