// src/types/live.ts
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
