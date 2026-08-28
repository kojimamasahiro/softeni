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
  /**
   * 検索で実際に使われる大会名。`label`（正式名称）と食い違う大会だけ設定する。
   * 設定するとハブ・年度別結果ページの title / h1 / description がこちらを主表記にし、
   * 正式名称は併記へ回る（置き換えではない）。未設定なら `label` をそのまま使い表示は変わらない。
   *
   * 例: 全中の正式名称「全国中学校体育大会」は全競技共通の名称で、
   * ソフトテニスの利用者は「全国中学校ソフトテニス大会」で検索する。
   * docs/wiki/seo.md「大会名の表記と検索語の乖離（missing literal）」
   */
  searchLabel?: string;
  /**
   * 略称・通称。先頭の 1 件が title / h1 に `略称（検索名）` の形で併記される。
   * `searchLabel` / `label` と重複する値は無視される（二重表記の防止）。
   */
  searchAliases?: string[];
  /**
   * 名称についての補足を1文で。`searchLabel` を主表記にすると正式名称が本文から消えるため、
   * その関係を明示する受け皿。h1 直下と FAQ に出る。
   *
   * 例: 全中は「全国中学校体育大会のソフトテニス競技」であって、`label` の
   * 「全国中学校大会」はサイト上の表記。この関係を書けるのはここだけ。
   */
  searchNote?: string;
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
  /**
   * 会場の構造化データ。大会と会場は 1:N（日別・種目別・複数市区町村）のため配列。
   * フィールド定義と記載ルールは docs/wiki/data-model.md「大会の会場データ（`venues`）」が正。
   */
  venues?: TournamentVenue[];
  /** 入力時のメモ（出典の誤りや、値を書かなかった理由）。**公開ページには出さない**。 */
  note?: string;
  /** 大会要項PDFのURL。取得できていなければ null。 */
  guidelineUrl?: string | null;
}

/**
 * 大会の会場1件。`data/tournaments/information/*.json` の `venues[]` に対応する。
 * 必須は prefecture / city / name の3つで、残りは出典（要項PDF等）に記載があるときだけ入る。
 * **推測で埋めない**（記載が無い・値が壊れている場合は省略し `note` に理由を残す）。
 */
export interface TournamentVenue {
  prefecture: string;
  city: string | null;
  name: string | null;
  aliases?: string[];
  /** 出典の表記そのまま。`name` を修正したときだけ書く */
  nameRaw?: string;
  postalCode?: string;
  /** 都道府県から書く。先頭が `prefecture` と一致するかで出典の誤記を検出できる */
  address?: string;
  tel?: string;
  courts?: number;
  /** 正規化語彙: クレー / ハード / 砂入り人工芝 / 木床フローリング */
  surface?: string;
  /** どの日・どの種目に使われたか。自由文 */
  usage?: string;
  note?: string;
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
