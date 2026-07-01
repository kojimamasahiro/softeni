// lib/playerStats/types.ts
// Player Statistics Engine 内部型（集計内部専用）。
// 公開型は src/types/playerStatistics.ts。ここは L0/L1（SourceAdapter/Facts）と
// Aggregator が共有する中間表現を定義する。
//
// 設計: docs/raw/2026-07-01-player-statistics-engine.md
// データ契約: docs/raw/2026-07-01-player-statistics-engine-data-contract.md（実装はこれを正とする）

/** 種目トークン。mixed は gender 由来（データ契約 §B）。 */
export type Discipline = 'singles' | 'doubles' | 'mixed' | 'team';

/** 性別トークン。 */
export type Gender = 'boys' | 'girls' | 'mixed';

/**
 * 最終順位の統一モデル（データ契約 §C）。
 * knockout の敗退ラウンド / リーグ止まり / 不明 を含む。
 */
export type Placement =
  | { kind: 'winner' }
  | { kind: 'runnerup' }
  | { kind: 'best'; bestLevel: 4 | 8 } // ベスト4 / ベスト8
  | { kind: 'roundLoss'; round: number } // n回戦敗退（knockout）
  | { kind: 'groupOnly'; groupRank: number } // リーグ止まり（tournament=null・roundrobin 有り）
  | { kind: 'unknown' }; // tournament=null・roundrobin 無し

/**
 * 相手・相方の人物参照。数値 id はリンク用（未解決なら null）、
 * playerKey（正規化名@所属）は集計の同定用（数値 id が付かない相手にも効く）。
 */
export interface PersonRef {
  /** 数値 id（players/index.json 姓名解決）。未解決は null。 */
  id: number | null;
  /** 集計同定キー（正規化名@所属）。 */
  key: string;
  /** 表示名（姓名連結）。 */
  name: string;
  /** 当時の所属。 */
  team: string | null;
}

/**
 * 1 試合 1 件。個人戦（singles/doubles/mixed）のみ。
 * team は個人統計の対象外（データ契約 §E）のため MatchFact を持たない。
 */
export interface PlayerMatchFact {
  tournamentId: string;
  tournamentName: string;
  /** 年度（暦年ではない。データ契約 §F）。 */
  year: number;
  categoryId: string;
  category: Discipline;
  gender: Gender;
  /** 年齢は生文字列で保持のみ（集計キーにしない）。 */
  ageRaw: string;

  /** 時系列順序用（開催日 startDate。無ければ空文字）。 */
  date: string;
  /** 同日内の順序を確定する単調増加値（データ契約 §G）。 */
  roundOrder: number;
  /** ラウンド名リテラル（例: 決勝 / 準決勝 / 3回戦）。 */
  round: string | null;
  stage: 'knockout' | 'roundrobin';

  result: 'win' | 'lose' | 'draw';
  gamesWon: number;
  gamesLost: number;

  /**
   * 勝率・ゲーム率の分子分母に入れるか（retired=true は false）。
   * placement 側には影響しない（別経路。データ契約 §E）。
   */
  countsForWinRate: boolean;

  /** 対戦相手（対個人。doubles は 2 名）。 */
  opponents: PersonRef[];
  /** 相方（doubles のみ。singles は null）。 */
  partner: PersonRef | null;

  /** 当時の自分の所属。 */
  selfTeam: string | null;
  /** 大会格。 */
  isNational: boolean;
  isMajorTitle: boolean;
}

/**
 * 1 大会カテゴリ 1 件（出場単位）。placement・進出率の素。
 * team も placement は取り得るが、個人 id への結び付けが無いため Facts には載せない
 * （データ契約 §E）。ここでは個人戦の出場のみ。
 */
export interface PlayerEntryFact {
  tournamentId: string;
  tournamentName: string;
  year: number;
  categoryId: string;
  category: Discipline;
  gender: Gender;
  ageRaw: string;

  date: string;
  isNational: boolean;
  isMajorTitle: boolean;

  entryNo: number;
  placement: Placement;
  /** 進出率の分子判定（データ契約 §G）。 */
  reachedFinal: boolean;
  reachedSemifinal: boolean;
  /** この出場がノックアウト個人戦か（進出率の分母対象）。 */
  isKnockoutSinglesDoublesMixed: boolean;

  partner: PersonRef | null;
  selfTeam: string | null;
}

/** 選手 1 人の Facts バンドル（時系列昇順にソート済み）。 */
export interface PlayerFacts {
  playerId: number;
  displayName: string;
  currentTeam: string | null;
  matches: PlayerMatchFact[];
  entries: PlayerEntryFact[];
  /** 依存した大会ファイル群の合成ハッシュ（増分判定）。 */
  sourceHash: string;
  /** 集計ロジックのバージョン。 */
  engineVersion: string;
}

/** 選手→出場カテゴリ 逆引き索引の 1 行。 */
export interface ReverseIndexEntry {
  /** `${tournamentId}/${year}/${categoryId}` の集合。 */
  categories: string[];
}

/** 逆引き索引全体（numericId → categories）。 */
export type ReverseIndex = Record<string, ReverseIndexEntry>;
