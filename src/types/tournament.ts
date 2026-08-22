// src/types/tournament.ts

export interface TournamentIndexEntry {
  tournamentId: string;
  generationId: string;
  label: string;
  isMajorTitle: boolean;
  officialUrl: string;
  federationId?: string;
  /** 高校総体の地区（ブロック）大会など、複数都道府県にまたがる大会の所属ブロックID。federationId とは排他 */
  blockId?: string;
  /**
   * 結果が `data/tournaments/details/` ではなく専用の特集ページ側にある大会の、その特集トップ（例: STリーグ→`/st-league/`）。
   * 設定するとハブページ（`/tournaments/[generation]/[tournamentId]`）は特集への誘導バナーを出し、
   * 特集ページとのカニバリを避けるため `noindex, follow` になる（高校全国大会と同じ扱い。docs/wiki/seo.md #3）。
   */
  featurePath?: string;
}

export interface TournamentCategoryInfo {
  categoryId: string;
  label: string;
  category: string;
  gender: string;
  age: string;
  /**
   * 大会運営上の状態。'abandoned' は「途中で打ち切られ、以降の試合が実施されなかった」。
   * 未設定＝通常どおり最後まで実施（既存データは全て未設定）。
   * 打ち切り「理由」は保持しない（docs/raw/2026-07-26-abandoned-tournament-ui-design.md）。
   */
  status?: 'abandoned';
  /** status==='abandoned' のとき、最後に完了したラウンド名（例: "3回戦"）。 */
  abandonedAfterRound?: string;
}

export interface TournamentInformationEntry {
  year: number;
  location: string;
  startDate: string;
  endDate: string;
  source: string;
  sourceUrl: string;
  categories: TournamentCategoryInfo[];
  /** その年度の表示名（例: "第3回STリーグ"）。無ければ index.json の label を使う。 */
  label?: string;
  /**
   * 結果がこのサイト内の別ページにある場合の内部URL（例: STリーグ→`/st-league/2025/matches/`）。
   * `data/tournaments/details/` を持たない大会でも大会一覧から結果へ導線を張るために使う。
   */
  resultPath?: string;
}

export interface TournamentParticipant {
  id: string; // 金子_凌_松本市役所_長野
  lastName: string;
  firstName: string;
  team: string;
  prefecture: string | null;
  playerId?: number;
}

export interface TournamentEntry {
  entryNo: number;
  playerIds: string[];
  type?: string;
}

export interface TournamentMatch {
  entries: number[];
  scores: Record<string, number>;
  round: string | null;
  winnerEntryNo: number;
  retired: boolean;
  stage: string;
  group: string | null;
  matchId: string;
  nextMatchId: string | null;
  prevMatchIds: string[];
  prevMatchId: string | null;
}

export interface TournamentResult {
  entryNo: number;
  tournament?: {
    label: string;
    rank: {
      kind: string;
      value: number;
    };
  };
  roundrobin?: {
    group: string;
    rank: number;
  };
}

/**
 * 決勝トーナメントのドロー（席順）。予選リーグ→決勝T形式の大会だけが持つ。
 *
 * 席は**エントリーではなく予選リーグの組に属する**ので (組, 組内順位) で書く。
 * `slots` の並びがそのままブラケットの席順で、長さは2の冪、`null` は空席（不戦勝）。
 * 詳細は docs/adr/ADR-015-knockout-draw-by-group.md。
 */
export interface KnockoutDraw {
  slots: ({ group: string; rank: number } | null)[];
}

export interface TournamentDetailData {
  participants: TournamentParticipant[];
  entries: TournamentEntry[];
  matches: TournamentMatch[];
  results: TournamentResult[];
  knockoutDraw?: KnockoutDraw | null;
}

export type MatchRow = {
  matchId?: string;
  stage: string | null;
  group?: string | null;
  round?: string | null;
  opponentDisplayName?: string;
  /** 対戦相手のプレーヤーID（結果ページリンク用）。シングルスは1要素、ダブルスは最大2要素。 */
  opponentPlayerIds?: number[];
  /**
   * 直近の他大会で同じ相手と対戦していた場合の説明（前哨戦・再戦）。
   * lib/priorMeetings.ts / docs/wiki/news-context-blocks.md ⑥
   */
  rematchOf?: string | null;
  result: 'win' | 'lose' | 'draw';
  games: { won: string; lost: string };
};
