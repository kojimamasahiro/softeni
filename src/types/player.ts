// src/types/player.ts
import { MajorTitle } from '@/types/title';
import { Tournament } from '@/types/tournament';

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
  retired?: boolean;
  profileLinks: {
    label: string;
    url: string;
  }[];
}

export interface PlayerData {
  highlight?: string;
  matches: Tournament[];
  majorTitles: MajorTitle[];
}
