// types/entry.ts

export interface EntryInfo {
  entryNo: number;
  information: {
    lastName: string;
    firstName: string;
    team: string;
    playerId?: string;
    tempId?: string;
    prefecture?: string;
  }[];
  type?: string;
}
