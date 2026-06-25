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
  // 収録試合数。結果ページが実在するのは count>=5 の選手のみ（デッドリンク防止に使う）
  count?: number;
  profileLinks: {
    label: string;
    url: string;
  }[];
}
