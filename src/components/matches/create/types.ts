export type TeamFormState = {
  entry_number: string;
  player1_last_name: string;
  player1_first_name: string;
  player1_team_name: string;
  player1_region: string;
  player2_last_name: string; // ダブルスの場合のみ
  player2_first_name: string; // ダブルスの場合のみ
  player2_team_name: string; // ダブルスの場合のみ
  player2_region: string; // ダブルスの場合のみ
};

export type EntryOption = {
  entryNo: number;
  label: string;
  players: {
    last_name: string;
    first_name: string;
    team_name: string;
    region: string;
  }[];
  /** 団体戦のエントリーだけが持つ選手候補（同じチーム名で個人戦に出た選手） */
  members?: {
    last_name: string;
    first_name: string;
    last_year: number;
  }[];
};
