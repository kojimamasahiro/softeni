// src/types/player.ts

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
