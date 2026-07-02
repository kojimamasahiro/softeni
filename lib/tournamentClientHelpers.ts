// Client-safe helpers for tournaments. These functions must not import Node built-ins.
export interface TournamentMeta {
  id: string;
  name: string;
  generation: string;
  categoryTypes: string[];
  isMajorTitle: boolean;
  officialUrl?: string;
}

export interface TournamentYearMeta {
  year: number;
  startDate: string;
  endDate: string;
  location: string;
  status: string;
}

export interface TournamentInfo {
  meta: TournamentMeta;
  yearMeta: TournamentYearMeta;
  fullName: string;
  detailUrl: string;
  exists: boolean;
}

// generation label helper intentionally omitted in client helpers

export const generateTournamentUrlFromMatch = (match: {
  tournament_name: string | null;
  tournament_id?: string | null;
  tournament_generation: string | null;
  tournament_gender: string | null;
  tournament_category: string | null;
  tournament_year?: number | null;
}): string | null => {
  if (!match.tournament_generation || !match.tournament_gender || !match.tournament_id) {
    return null;
  }
  const year = match.tournament_year || new Date().getFullYear();
  const gameCategory = match.tournament_category === 'singles' ? 'singles' : 'doubles';
  const ageCategory = 'none';
  const gender = match.tournament_gender;

  return `/tournaments/${match.tournament_generation}/${match.tournament_id}/${year}/${gameCategory}/${ageCategory}/${gender}`;
};
