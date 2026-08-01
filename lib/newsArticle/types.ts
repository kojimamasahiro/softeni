// /news 記事（プレビュー / 結果速報）の記録スキーマと、記事ビューの型定義。
// 詳細な設計意図は各型のコメントを参照（元 lib/newsArticle.ts から分割・2026-08-01）。

import type { MilestoneEvent } from '../milestones';

export type NewsArticleType = 'preview' | 'result';
export type NewsArticleState = 'draft' | 'review' | 'published';

export type NewsArticleRecord = {
  articleId: string;
  type: NewsArticleType;
  state: NewsArticleState;
  tournamentId: string;
  year: number;
  /** 省略 / null は全種目対象 */
  categoryId?: string | null;
  /** テンプレ生成のため通常は空。明示指定があれば優先 */
  title?: string;
  description?: string;
  /**
   * OGP 画像のパス（"/og/news/<id>-<hash>.png"）。
   * tools/sns-images/news_og.py がローカル生成して書き戻す（result の published のみ）。
   * 設計: docs/raw/2026-06-22-news-ogp-image-design.md
   */
  ogImage?: string;
  createdAt?: string;
  updatedAt?: string;
};

/**
 * プレビューに出す選手参照。
 * playerId は `/players/{id}/results`（結果ページ）の数値 ID。
 * curated プロフィール（`/players/{slug}`）とは別系統で、count>=5 の全選手が対象。
 * 結果ページを持たない選手は null（リンク無し・名前のみ）。
 */
export type PreviewPlayerRef = {
  name: string;
  playerId: number | null;
  /** 今大会も出場するか */
  returning: boolean;
  /**
   * この選手個人の所属（表示用・正規化済み）。無ければ null。
   * ペア全員の所属が同じ場合は呼び出し側の `team`（ペア共通の所属）を使い、
   * 所属が割れている（混成ペア）場合はこちらを選手ごとに表示する。
   */
  team: string | null;
};

/**
 * プレビュー: ピックアップ選手の「今大会の途中経過/敗退」。
 * 進行中の年でも results 配列が入る運用（normalize-core の rank.kind:'ongoing'）に対応し、
 * 当年・種目の detail.results から該当エントリーの状況を引く。results 未掲載なら null（非表示）。
 *   state: alive=進行中（◯◯進出） / eliminated=敗退 / champion=優勝 / runnerup=準優勝
 */
export type EntryStanding = {
  label: string;
  state: 'alive' | 'eliminated' | 'champion' | 'runnerup';
};

/**
 * ペアが分かれた（partial/split）ときに、結果バッジを紐付ける主役となる「今大会のエントリー」。
 * 前回主役（王者/入賞者）をベースにせず、今大会に実在するペアを主体に見せる（案A+C）。
 * 例: 前回王者 内本隆文・内田理久 → 今大会 内本隆文・上松俊貴。この型は「内本・上松」を表す。
 */
export type CurrentPairEntry = {
  /** 今大会ペアの選手（所属は per-player。混成ペアは team=null 側で個別表示） */
  players: PreviewPlayerRef[];
  /** ペア共通の所属（表示用・正規化済み）。混成ペアは null */
  team: string | null;
  /** この今大会エントリーの途中経過/敗退（未掲載なら null） */
  standing: EntryStanding | null;
  /** この今大会エントリーへ引き継がれた「前回主役の選手名」（注記用。例: ["内本隆文"]） */
  carriedFrom: string[];
};

/** プレビュー: 前回王者の今大会への出場状況（連覇・防衛ウォッチ） */
export type TitleDefenseWatch = {
  /** 前回王者の表示（ペア/校）。団体戦や選手が空のとき用 */
  defendingChampionDisplay: string;
  /** 前回優勝年 */
  defendingYear: number;
  /** 所属校（表示用・正規化済み）。団体戦は校名 */
  team: string | null;
  /** 前回王者の選手（個人戦/ダブルス。団体は空）。returning で継続可否を持つ */
  players: PreviewPlayerRef[];
  /**
   * intact: ペア/校がそのまま出場（連覇に挑む）
   * partial: ダブルスで片方の選手のみ継続出場（相方は不在。新ペアで連覇に挑む）
   * split : 前回王者ペアが分かれ、双方が別々の新ペアで継続出場（複数の currentEntries）
   * absent: 前回王者は不在（新王者へ）
   */
  status: 'intact' | 'partial' | 'split' | 'absent';
  /**
   * 今大会側のエントリー。intact/partial は 1 件、split は複数件、absent は空。
   * partial/split の結果バッジはこちら（今大会の実在ペア）に紐付ける。
   */
  currentEntries: CurrentPairEntry[];
  /** intact 時の今大会の途中経過/敗退（partial/split は currentEntries 側を使う。未掲載なら null） */
  standing: EntryStanding | null;
};

/** プレビュー: 前回入賞者（準優勝/ベスト4/ベスト8）で今大会も出場 */
export type ReturningPlacer = {
  placement: '準優勝' | 'ベスト4' | 'ベスト8';
  /** 前回の表示（ペア/校）。団体戦用 */
  display: string;
  /** 所属校（表示用・正規化済み） */
  team: string | null;
  /** 入賞時の選手（個人戦/ダブルス。団体は空） */
  players: PreviewPlayerRef[];
  /**
   * intact: ペア/校がそのまま継続 / partial: 片方のみ継続（相方不在）/ split: 双方が別ペアで継続
   */
  status: 'intact' | 'partial' | 'split';
  /** 今大会側のエントリー（partial/split で今大会ペアを主役化するため） */
  currentEntries: CurrentPairEntry[];
  /** intact 時の今大会の途中経過/敗退（進行中の年のみ。未掲載なら null） */
  standing: EntryStanding | null;
};

/** プレビュー: 過去の優勝者（前々回以前）で今大会も出場 */
export type ReturningFormerChampion = {
  /** 優勝した年（新しい順） */
  years: number[];
  /** 当時の優勝表示 */
  display: string;
  /** 所属校（表示用・正規化済み） */
  team: string | null;
  /** 当時の優勝選手（個人戦/ダブルス。団体は空） */
  players: PreviewPlayerRef[];
  /** intact: ペア/校がそのまま継続 / partial: 片方のみ継続 / split: 双方が別ペアで継続 */
  status: 'intact' | 'partial' | 'split';
  /** 今大会側のエントリー（partial/split で今大会ペアを主役化するため） */
  currentEntries: CurrentPairEntry[];
  /** intact 時の今大会の途中経過/敗退（進行中の年のみ。未掲載なら null） */
  standing: EntryStanding | null;
};

/**
 * プレビュー: 直近大会の好成績者の再登場。
 * 当プレビュー種目の出場者のうち、直近の他大会（プレビュー開催日から3ヶ月以内・最大2大会・
 * isMajorTitle 優先）で **ベスト4以上**（優勝/準優勝/ベスト4）の成績を残した選手・校をピックアップする。
 * 「種目を問わない」: 直近大会のどの種目での好成績でもよい。
 * 判定単位は他ブロックと同様（個人戦は選手単位＝playerKey、団体戦は校単位＝championKey/teamMatchKey、
 * 2026-07-30〜。団体は当大会が team カテゴリのときのみ championKeySet と突合するため、
 * 個人戦プレビューに校が混ざることはない）。
 */
export type RecentAchiever = {
  /** 表示名（個人戦=選手名 / 団体戦=校名） */
  display: string;
  /** 所属校（表示用・正規化済み）。団体戦は null（display が校名のため） */
  team: string | null;
  /** ピックアップ選手（個人戦/ダブルスのみ。団体戦は空配列）。playerId は結果ページリンク用 */
  players: PreviewPlayerRef[];
  /** 直近大会の表示名（index.json の label） */
  tournamentLabel: string;
  /** 直近大会の開催年 */
  year: number;
  /** 好成績を残した種目の表示ラベル（例: 男子シングルス） */
  categoryLabel: string;
  /** その大会での成績 */
  placement: '優勝' | '準優勝' | 'ベスト4';
  /** isMajorTitle の大会か */
  isMajor: boolean;
  /** 今大会の途中経過/敗退（進行中の年のみ。未掲載なら null） */
  standing: EntryStanding | null;
};

/**
 * プレビュー: 「注目の選手」カード1件分。
 * returningPlacers / returningFormerChampions / recentAchievers の3ブロックは
 * いずれも「過去の実績 + 今大会の途中経過/敗退」という同じ構造を持つため、
 * 1つのカード表現に統合し、今大会の結果（勝ち上がり中/優勝/準優勝を上位、
 * 敗退を下位）でソートして表示する（見せ方の改善: docs/wiki/news-context-blocks.md）。
 */
export type PickPlayerCard = {
  /** React key 用の一意 ID */
  id: string;
  /** 選手（個人戦/ダブルス。団体や players が空の場合は display を使う） */
  players: PreviewPlayerRef[];
  /** players が空のときの表示（ペア/校の display） */
  display: string;
  /** 所属校（ペア/校で共通の場合）。混成ペア等で割れている場合は null（players 側の team を使う） */
  team: string | null;
  /** true のとき選手ごとの所属を名前の直後に表示する（team が null のときのみ意味を持つ） */
  perPlayerTeam: boolean;
  /**
   * 過去の実績の表示（例: "前回準優勝" "2019・2020年優勝" "選抜2026 女子シングルス 準優勝"）。
   * 同一の今大会ペアが複数の実績由来でまとまる場合（ペア解消の組み替え等）は複数行になる。
   * UI では 1 行ずつ表示する。
   */
  achievements: string[];
  /** 今大会の途中経過/敗退（未掲載なら null） */
  standing: EntryStanding | null;
};

/** プレビュー: 出場規模・勢力図（純粋な事実） */
export type FieldOverview = {
  /** 出場ペア/選手/校の数（エントリー数） */
  entryCount: number;
  /** 都道府県別エントリー数（多い順・上位） */
  topPrefectures: Array<{ prefecture: string; count: number }>;
  /** 複数エントリーを送り込む所属校（2 以上・多い順） */
  multiEntryTeams: Array<{ team: string; count: number }>;
};

/** 前哨戦の 1 カード（表示用） */
export type PriorMeetingCard = {
  /** 対戦が行われた大会のラベル（例: 近畿高等学校ソフトテニス選手権大会） */
  tournamentLabel: string;
  year: number;
  /** 例: 準々決勝 */
  round: string | null;
  winner: PreviewPlayerRef[];
  loser: PreviewPlayerRef[];
  /** その大会での勝者側の所属（表示用。混成ペアなら null） */
  winnerTeam: string | null;
  loserTeam: string | null;
  /**
   * 今大会で再戦が起こるか。
   * - `scheduled`: 対戦カードが組まれている（＝再戦が実現する／した）
   * - `pending`: **まだ1試合も行われていない**（開催前）。両ペアとも当然勝ち残っているが、
   *   勝ち上がった結果ではないので「勝ち上がり中」とは言えない
   * - `possible`: 大会が進行中で、両ペアとも勝ち残っている
   * - `gone`: 少なくとも一方が敗退済みで、もう起こらない
   * - `unknown`: 今大会の結果が未掲載で判定できない
   *
   * `pending` と `possible` を分けているのは、`results` が `kind:'ongoing'`（未実施）でも
   * standing が `alive`／ラベル「勝ち上がり中」になるため（ADR-007 の運用）。開催前は
   * 全ペアが alive なので、そのまま「両者勝ち上がり中」と出すと事実に反する。
   */
  rematchStatus: 'scheduled' | 'pending' | 'possible' | 'gone' | 'unknown';
  /**
   * 今大会のドロー上、両者が勝ち上がった場合に**最短で当たるラウンド**の表示名。
   * ドローから復元できなければ null（`entries[].type` が無い大会など）。
   */
  meetingRoundLabel: string | null;
  /** 今大会での各ペアの状況（勝ち上がり中/敗退/優勝など）。未掲載なら null */
  winnerStanding: EntryStanding | null;
  loserStanding: EntryStanding | null;
  /**
   * 今大会で再戦が**実際に行われて決着した**場合の結果。未実施・未確定なら null。
   * `revenge` は前回敗れた側が今回勝った（＝雪辱）ことを示す。
   */
  currentResult: { winnerNames: string[]; revenge: boolean } | null;
};

export type PriorMeetingsBlock = {
  /** 既知の対戦カード総数（表示は上位のみ） */
  totalCards: number;
  /** 対戦履歴を持つ出場ペア（団体は校）数 / 全出場数 */
  coveredEntries: number;
  totalEntries: number;
  /** 数え上げの単位。ダブルス=ペア / シングルス=選手 / 団体=校 */
  unit: 'ペア' | '選手' | '校';
  /** 供給元の大会ラベル（重複除去・新しい順） */
  sourceLabels: string[];
  /**
   * カード（今大会で再戦が確定しているものを優先した順）。
   * UI は先頭 `PRIOR_MEETING_CARDS` 件を常時表示し、残りは折りたたみで見せる。
   * `totalCards` が真の総数で、この配列は `PRIOR_MEETING_CARDS_MAX` 件で打ち切る。
   */
  cards: PriorMeetingCard[];
  /** 常時表示する件数（これを超えた分は折りたたみ） */
  visibleCards: number;
};

export type NewsCategoryBlock = {
  categoryId: string;
  categoryLabel: string;
  /** 前回王者（year-1 の優勝者）。無ければ null */
  previousChampion: string | null;
  /** 歴代優勝者（新しい年が先頭） */
  historicalWinners: Array<{ year: number; display: string | null }>;
  /** 結果速報のみ: その年の優勝者表示 */
  champion: string | null;
  /** 結果速報のみ: milestone（連覇/初優勝など） */
  milestones: Array<{
    kind: string;
    label: string;
    confidence: MilestoneEvent['confidence'];
    scopeNote?: string | null;
  }>;
  /** プレビューのみ: 連覇・防衛ウォッチ（前回王者の出場状況）。算出不能なら null */
  titleDefense: TitleDefenseWatch | null;
  /** プレビューのみ: 前回入賞者（準優勝/ベスト4）で今大会も出場する者 */
  returningPlacers: ReturningPlacer[];
  /** プレビューのみ: 前々回以前の優勝者で今大会も出場する者 */
  returningFormerChampions: ReturningFormerChampion[];
  /** プレビューのみ: 直近他大会でベスト4以上の好成績を残した出場者 */
  recentAchievers: RecentAchiever[];
  /** プレビューのみ: 前哨戦（出場ペアどうしが直近の他大会で既に対戦していたカード）。無ければ null */
  priorMeetings: PriorMeetingsBlock | null;
  /**
   * プレビューのみ: 「注目の選手」統合カード。
   * returningPlacers / returningFormerChampions / recentAchievers を1本にマージし、
   * 今大会の結果（勝ち上がり中/優勝/準優勝 > 未掲載 > 敗退）でソート済み。
   * 表示にはこちらを使う（3配列は組み立て用の中間データとして残す）。
   */
  pickPlayers: PickPlayerCard[];
  /** プレビューのみ: 出場規模・勢力図。算出不能なら null */
  fieldOverview: FieldOverview | null;
  /** その年・種目の結果ページ（年度別）への内部リンク。算出不能なら null */
  resultHref: string | null;
};

export type NewsArticleView = {
  record: NewsArticleRecord;
  tournamentLabel: string;
  /** 大会の generationId（内部リンク URL 構築用） */
  generation: string;
  /** 大会ハブ（歴代まとめ）への内部リンク */
  hubHref: string;
  title: string;
  description: string;
  categories: NewsCategoryBlock[];
};

/** 前回主役（王者/入賞者）→ 今大会での継続状況と、結果を紐付ける今大会エントリー */
export type PairFate = {
  /**
   * intact: ペア/校がそのまま継続（1 currentEntry）
   * partial: 片方のみ継続・相方は不在（1 currentEntry。新パートナーはいる場合も）
   * split : ペアが分かれ、双方が別々の新ペアで継続（複数 currentEntries）
   * absent: 誰も継続していない（0 currentEntry）
   */
  status: 'intact' | 'partial' | 'split' | 'absent';
  /** 前回主役の選手（returning フラグ付き。団体は空） */
  prevPlayers: PreviewPlayerRef[];
  /** 今大会側のエントリー（結果バッジはこちらに紐付ける） */
  currentEntries: CurrentPairEntry[];
};
