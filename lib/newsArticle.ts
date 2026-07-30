// lib/newsArticle.ts
// /news 記事（プレビュー / 結果速報）の記録スキーマと、記事ビューの組み立て。
// 記事は「一次成果物＝文脈ブロック」の再利用先の一つ（ADR-005）。本文は LLM を使わず
// 既存の文脈ブロック（historical-winners / milestone / career-record）から決定的に構成する。
//
// 設計: docs/wiki/news-context-blocks.md / docs/raw/2026-06-21-news-auto-draft-design.md / ADR-005。
// fs を使うため getStaticProps / ビルドスクリプトからのみ import すること。
//
// 公開フロー（human-in-the-loop）: 記事レコードは data/news/<articleId>.json。
//   state: 'draft' → 'review' → 'published'。公開（getStaticPaths 対象）は published のみ。
//   プレビュー→結果の昇格は同一 articleId で type を 'preview'→'result' に変えて行う。

import fs from 'fs';
import path from 'path';

import { getChampionMilestones, getGiantKillings, type MilestoneEvent } from './milestones';
import { getBracketLayout, meetingRoundIndex, roundLabelOf } from './bracketLayout';
import { buildPriorMeetingIndex, meetingKey } from './priorMeetings';
import {
  buildParticipantMap,
  getHistoricalWinners,
  parseCategoryFile,
  readYearDetail,
  resolveEntryToChampion,
  type ChampionEntry,
  type RawDetail,
  type RawParticipant,
} from './tournamentRecords';
import { getCategoryLabel } from './utils';

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

const NEWS_ROOT = ['data', 'news'];
const DETAILS_ROOT = ['data', 'tournaments', 'details'];

function resolveRoot(): string {
  return process.cwd();
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function tournamentMetaOf(tournamentId: string): {
  label: string;
  generationId: string;
} {
  const idx = readJson<Array<{ tournamentId: string; label?: string; generationId?: string }>>(path.join(resolveRoot(), 'data', 'tournaments', 'index.json'));
  const hit = idx?.find((t) => t.tournamentId === tournamentId);
  return {
    label: hit?.label ?? tournamentId,
    generationId: hit?.generationId ?? '',
  };
}

/** categoryId（`category-age-gender`）を URL 構成パーツに分解する */
function categoryPathParts(categoryId: string): { category: string; age: string; gender: string } | null {
  const parts = categoryId.split('-');
  if (parts.length < 3) return null;
  const gender = parts.pop() as string;
  const age = parts.pop() as string;
  const category = parts.join('-');
  return { category, age, gender };
}

/** 記事レコードを読む */
export function getArticleRecord(articleId: string): NewsArticleRecord | null {
  return readJson<NewsArticleRecord>(path.join(resolveRoot(), ...NEWS_ROOT, `${articleId}.json`));
}

/** 全記事レコード（state 問わず） */
export function listArticleRecords(): NewsArticleRecord[] {
  const dir = path.join(resolveRoot(), ...NEWS_ROOT);
  if (!fs.existsSync(dir)) return [];
  const out: NewsArticleRecord[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const rec = readJson<NewsArticleRecord>(path.join(dir, f));
    if (rec?.articleId) out.push(rec);
  }
  return out;
}

/**
 * 公開（published）記事のみ。getStaticPaths / 一覧で使う。
 * 公開日の降順（新しい記事が先頭）。updatedAt が同値（同一バッチでの一括公開等）の
 * 場合は createdAt を第二キーにして、実際の公開順が保たれるようにする。
 */
export function listPublishedArticles(): NewsArticleRecord[] {
  return listArticleRecords()
    .filter((r) => r.state === 'published')
    .sort((a, b) => {
      const byUpdatedAt = (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
      if (byUpdatedAt !== 0) return byUpdatedAt;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
}

/**
 * 公開済みの「展望（preview）」記事のみ。
 * 結果（result）記事は廃止し、「大会ごとの結果・優勝・歴代まとめ」は
 * 大会ハブ（/tournaments/[generation]/[tournamentId]、高校全国大会は
 * /highschool/tournaments/[tournament]）に集約する（ADR-008）。
 * /news は大会前の展望（前回王者・出場校 ほか）専用とする。
 */
export function listPublishedPreviews(): NewsArticleRecord[] {
  return listPublishedArticles().filter((r) => r.type === 'preview');
}

/**
 * 指定の大会・年度に対応する公開済み展望（preview）記事（あれば1件）。
 * 大会結果ページ（[gender]/index.tsx）から展望記事への内部リンクを出すために使う。
 * 1大会・1年度につき記事は基本1件（全種目対象。categoryId は問わない）を想定。
 * 「結果」を狙うリンクではなく、preview記事とのカニバリを避けるための低リスクな内部リンク
 * （docs/wiki/seo.md #8 の方針に沿う。結果クエリでの競合は意図しない）。
 */
export function findPublishedPreviewForTournament(tournamentId: string, year: number): NewsArticleRecord | null {
  return listPublishedPreviews().find((r) => r.tournamentId === tournamentId && r.year === year) ?? null;
}

/** 対象 tournamentId/year に存在する categoryId 一覧（details 実体から） */
function listCategoryIds(tournamentId: string, year: number): string[] {
  const dir = path.join(resolveRoot(), ...DETAILS_ROOT, tournamentId, String(year));
  if (!fs.existsSync(dir)) return [];
  const ids: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const parsed = parseCategoryFile(f);
    if (parsed) ids.push(parsed.categoryId);
  }
  return ids;
}

/**
 * 今大会（対象年・種目）の出場者インデックス。前年データとの照合に使う。
 * すべて当サイト掲載のエントリーデータから決定的に算出する（LLM/curation 非依存）。
 */
type FieldIndex = {
  entryCount: number;
  /** 出場選手の playerKey（名前@所属）集合。個人の継続出場判定に使う */
  playerKeySet: Set<string>;
  /** 各エントリーの championKey 集合。ペア/校単位の一致判定に使う */
  championKeySet: Set<string>;
  /** championKey → 今大会の entryNo（途中経過の引き当て用。最初の一致を採用） */
  championKeyToEntryNo: Map<string, number>;
  /** playerKey → 今大会の entryNo（partial=新ペアの継続選手の引き当て用） */
  playerKeyToEntryNo: Map<string, number>;
  /** フルネーム（正規化）→ 今大会の entryNo 集合（所属変更フォールバック照合用） */
  nameToEntryNos: Map<string, Set<number>>;
  /** entryNo → 今大会エントリーの名簿（分割時に今大会ペアを主役表示するため） */
  entryRosterByNo: Map<number, { players: PreviewPlayerRef[]; team: string | null }>;
  /** entryNo → 今大会の途中経過/敗退（detail.results 由来。未掲載なら空） */
  standingByEntryNo: Map<number, EntryStanding>;
  /** 都道府県別エントリー数 */
  prefectureCount: Map<string, number>;
  /** 所属校別エントリー数 */
  teamCount: Map<string, number>;
};

/** 当年・種目の detail.results 1 件 → 途中経過/敗退の表示情報。判定不能なら null */
function standingFromResult(r: {
  tournament?: {
    label?: string;
    rank?: { kind?: string; bestLevel?: number; round?: number };
  } | null;
  roundrobin?: {
    group?: string;
    rank?: number;
  } | null;
}): EntryStanding | null {
  // 予選リーグ敗退
  if (r.roundrobin && !r.tournament) {
    return {
      label: `予選敗退`,
      state: 'eliminated',
    };
  }

  const rank = r.tournament?.rank;
  const label = r.tournament?.label ?? null;
  if (!rank || !rank.kind) return null;

  switch (rank.kind) {
    case 'winner':
      return { label: label ?? '優勝', state: 'champion' };
    case 'runnerup':
      return { label: label ?? '準優勝', state: 'runnerup' };
    case 'ongoing':
      return { label: label ?? '勝ち上がり中', state: 'alive' };
    case 'best':
      return {
        label: label ?? (rank.bestLevel ? `ベスト${rank.bestLevel}` : '入賞'),
        state: 'eliminated',
      };
    case 'round':
      return {
        label: label ?? (rank.round ? `${rank.round}回戦敗退` : '敗退'),
        state: 'eliminated',
      };
    default:
      return null; // unknown
  }
}

// 年度間で所属校の表記が揺れる（2025「嬉野」 vs 2026「嬉野_佐賀県」など、
// 末尾に "_<都道府県>" が付くデータが混在）。照合キー・表示の両方でこれを吸収する。
function normPart(s: string): string {
  return s.replace(/\s+/g, '').normalize('NFKC');
}

/** 所属校名の末尾 "_<都道府県>" を除去（"_" 区切りは通常の校名に出ないため安全） */
function normalizeTeam(team: string): string {
  return team.replace(/_[^_]+?[都道府県]$/u, '');
}

/** 表示文字列中の "_<都道府県>" を除去（例: 高田商_奈良県 → 高田商） */
function cleanDisplay(s: string): string {
  return s.replace(/_[^_・（）()]+?[都道府県]/gu, '');
}

/** 選手の照合キー（名前@正規化所属）。所属不明なら名前のみ */
function playerMatchKey(name: string, team: string | undefined | null): string {
  const t = team ? normPart(normalizeTeam(team)) : '';
  return t ? `${normPart(name)}@${t}` : normPart(name);
}

/**
 * 姓名 → 結果ページの数値 ID（`/players/{id}/results`）。
 * `data/players/index.json` を唯一の正とし、結果ページが実在する選手（count>=5、
 * `players/[id]/results.tsx` の getStaticPaths と同条件）のみを姓名一致で解決する。
 * 同姓同名は最初の ID を使う（学校ページ・高校歴代ページと同じ既存規約）。
 * 注意: これは curated プロフィール `/players/{slug}` とは別系統（区別は public-pages.md 参照）。
 */
let cachedPlayerIdMap: Map<string, number> | null = null;
function getPlayerIdMap(): Map<string, number> {
  if (cachedPlayerIdMap) return cachedPlayerIdMap;
  const m = new Map<string, number>();
  const idx = readJson<Array<{ id: number; lastName: string; firstName: string; count: number }>>(path.join(resolveRoot(), 'data', 'players', 'index.json'));
  if (idx) {
    for (const p of idx) {
      if (p.count < 5) continue;
      const key = normPart(`${p.lastName}${p.firstName}`);
      if (!m.has(key)) m.set(key, p.id); // 同姓同名は最初の ID
    }
  }
  cachedPlayerIdMap = m;
  return m;
}

/** フルネーム（姓名連結）から結果ページ ID を解決。無ければ null */
function resolvePlayerId(fullName: string): number | null {
  return getPlayerIdMap().get(normPart(fullName)) ?? null;
}

/** ペア/校の照合キー（正規化所属で構築。championKey と同じ思想） */
function teamMatchKey(c: ChampionEntry): string | null {
  if (!c.display) return null;
  const teams = c.teams.map((t) => normPart(normalizeTeam(t))).sort();
  const names = c.players.map((n) => normPart(n)).sort();
  const base = names.length > 0 ? `${names.join('|')}@${teams.join('|')}` : teams.join('|');
  return base || null;
}

/** 対象年・種目のエントリーから出場者インデックスを構築する */
function buildFieldIndex(tournamentId: string, year: number, categoryId: string): FieldIndex | null {
  const detail = readYearDetail(tournamentId, year, categoryId);
  if (!detail || !detail.entries || detail.entries.length === 0) return null;
  const pmap = buildParticipantMap(detail);

  const playerKeySet = new Set<string>();
  const championKeySet = new Set<string>();
  const championKeyToEntryNo = new Map<string, number>();
  const playerKeyToEntryNo = new Map<string, number>();
  const nameToEntryNos = new Map<string, Set<number>>();
  const entryRosterByNo = new Map<number, { players: PreviewPlayerRef[]; team: string | null }>();
  const prefectureCount = new Map<string, number>();
  const teamCount = new Map<string, number>();
  let entryCount = 0;

  for (const e of detail.entries) {
    entryCount += 1;
    const names: string[] = [];
    const teams: string[] = [];
    const roster: PreviewPlayerRef[] = [];
    let firstPref: string | null = null;
    for (const pid of e.playerIds) {
      const p = pmap.get(pid);
      const name = p ? `${p.lastName ?? ''}${p.firstName ?? ''}`.trim() : pid;
      const team = p?.team ?? '';
      if (name) {
        names.push(name);
        const pk = playerMatchKey(name, team);
        playerKeySet.add(pk);
        if (!playerKeyToEntryNo.has(pk)) playerKeyToEntryNo.set(pk, e.entryNo);
        const nk = normPart(name);
        const ens = nameToEntryNos.get(nk) ?? new Set<number>();
        ens.add(e.entryNo);
        nameToEntryNos.set(nk, ens);
        roster.push({ name, playerId: resolvePlayerId(name), returning: true, team: team ? cleanDisplay(team) : null });
      }
      if (team) {
        const nt = normalizeTeam(team);
        if (!teams.includes(nt)) teams.push(nt);
      }
      if (!firstPref && p?.prefecture) firstPref = p.prefecture;
    }
    // ペア共通の所属（混成ペアは null → 選手ごとに team を出す）。teamDisplayOf と同じ思想。
    const distinctTeams = new Set(teams.map((t) => normPart(t)));
    const rosterTeam = names.length > 0 && distinctTeams.size === 1 && teams[0] ? cleanDisplay(teams[0]) : null;
    entryRosterByNo.set(e.entryNo, { players: roster, team: rosterTeam });
    const namesSorted = names.map(normPart).sort();
    const teamsSorted = teams.map(normPart).sort();
    const ck = names.length > 0 ? `${namesSorted.join('|')}@${teamsSorted.join('|')}` : teamsSorted.join('|');
    if (ck) {
      championKeySet.add(ck);
      if (!championKeyToEntryNo.has(ck)) championKeyToEntryNo.set(ck, e.entryNo);
    }
    if (firstPref) {
      prefectureCount.set(firstPref, (prefectureCount.get(firstPref) ?? 0) + 1);
    }
    const team0 = teams[0];
    if (team0) teamCount.set(team0, (teamCount.get(team0) ?? 0) + 1);
  }

  // 当年・種目の途中経過/敗退（detail.results 由来）。進行中で results 未掲載なら空のまま。
  const standingByEntryNo = new Map<number, EntryStanding>();
  for (const r of detail.results ?? []) {
    if (r.entryNo == null) continue;
    const s = standingFromResult(r);
    if (s) standingByEntryNo.set(r.entryNo, s);
  }

  return {
    entryCount,
    playerKeySet,
    championKeySet,
    championKeyToEntryNo,
    playerKeyToEntryNo,
    nameToEntryNos,
    entryRosterByNo,
    standingByEntryNo,
    prefectureCount,
    teamCount,
  };
}

/**
 * 所属変更フォールバック照合（2026-07-18〜）。
 * 「名前@所属」の照合は選手が年度間で所属を変えると外れる（例: east-japan 2026 の
 * 左近知美: 日本体育大学→ナガセケンコー。前回王者ペアの片割れが紐付かず partial 扱いになった）。
 * 名前のみ照合は同名別人の誤マッチ要因（2026-07-03 に廃した理由）のため、
 * **今大会内でフルネームが一意（1 エントリーのみ）の場合に限り** 名前のみで entryNo を解決する。
 */
function uniqueEntryNoByName(field: FieldIndex, name: string): number | null {
  const ens = field.nameToEntryNos.get(normPart(name));
  if (!ens || ens.size !== 1) return null;
  return ens.values().next().value ?? null;
}

/** 継続選手の今大会 entryNo。名前@所属 → （外れたら）一意な名前のみ の順で解決 */
function resolveFieldEntryNo(field: FieldIndex, name: string, team: string | null | undefined): number | null {
  return field.playerKeyToEntryNo.get(playerMatchKey(name, team)) ?? uniqueEntryNoByName(field, name);
}

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

/**
 * 前回主役の ChampionEntry を、今大会のどのエントリーに「継続」したか entryNo 単位で解決する。
 * 従来の returningOf は「両選手が出場」を一律 intact と判定していたが、両者が別々の新ペアに
 * 分かれた場合（split）を intact と誤判定していた。ここでは各継続選手の今大会 entryNo を引き、
 * 属する entryNo の数で intact/partial/split を区別し、結果バッジを今大会の実在ペアに紐付ける。
 * 所属表記揺れ（"_<県>"）は playerMatchKey 側で吸収する。
 */
function resolvePairFate(c: ChampionEntry, field: FieldIndex | null): PairFate {
  if (!field) return { status: 'absent', prevPlayers: [], currentEntries: [] };
  const isTeam = c.players.length === 0;
  if (isTeam) {
    const ck = teamMatchKey(c);
    const entryNo = ck ? field.championKeyToEntryNo.get(ck) : undefined;
    if (entryNo == null) return { status: 'absent', prevPlayers: [], currentEntries: [] };
    return {
      status: 'intact',
      prevPlayers: [],
      currentEntries: [{ players: [], team: teamDisplayOf(c), standing: field.standingByEntryNo.get(entryNo) ?? null, carriedFrom: [] }],
    };
  }

  // 個人/ダブルス: 「名前@正規化所属」で継続選手を判定し、各継続選手の今大会 entryNo を引く。
  // 所属変更（例: 大学→実業団）で外れる場合は一意な名前のみでフォールバック（resolveFieldEntryNo）。
  const prevPlayers: PreviewPlayerRef[] = c.players.map((name, i) => {
    const team = c.playerTeams[i] ?? null;
    return {
      name,
      playerId: resolvePlayerId(name),
      returning: resolveFieldEntryNo(field, name, team) != null,
      team: team ? cleanDisplay(team) : null,
    };
  });
  const returningCount = prevPlayers.filter((p) => p.returning).length;
  if (returningCount === 0) return { status: 'absent', prevPlayers, currentEntries: [] };

  // 継続選手 → 今大会 entryNo（同一 entry に複数の継続選手が入る＝ペア維持）
  const entryToCarried = new Map<number, string[]>();
  c.players.forEach((name, i) => {
    if (!prevPlayers[i].returning) return;
    const en = resolveFieldEntryNo(field, name, c.playerTeams[i] ?? null);
    if (en == null) return;
    const arr = entryToCarried.get(en) ?? [];
    arr.push(name);
    entryToCarried.set(en, arr);
  });

  const currentEntries: CurrentPairEntry[] = Array.from(entryToCarried.entries()).map(([en, carriedFrom]) => {
    const roster = field.entryRosterByNo.get(en);
    return {
      players: roster?.players ?? [],
      team: roster?.team ?? null,
      standing: field.standingByEntryNo.get(en) ?? null,
      carriedFrom,
    };
  });

  let status: PairFate['status'];
  if (currentEntries.length >= 2) status = 'split';
  else if (returningCount === prevPlayers.length) status = 'intact';
  else status = 'partial';
  return { status, prevPlayers, currentEntries };
}

/**
 * ChampionEntry の表示用所属校（正規化＋サフィックス除去）。
 * ダブルスでペアの所属が割れている（混成ペア）場合は、まとめて 1 つの所属として
 * 表示すると誤り（片方の選手の所属を両方に付けてしまう）になるため null を返す。
 * 呼び出し側は null のとき PreviewPlayerRef.team で選手ごとの所属を表示すること。
 */
function teamDisplayOf(c: ChampionEntry): string | null {
  const isTeam = c.players.length === 0;
  if (isTeam) return c.teams[0] ? cleanDisplay(c.teams[0]) : null;
  const distinctTeams = new Set(c.playerTeams.filter((t): t is string => !!t).map((t) => normPart(normalizeTeam(t))));
  if (distinctTeams.size > 1) return null; // 混成ペア: 個別表示に委ねる
  return c.teams[0] ? cleanDisplay(c.teams[0]) : null;
}

/** 前年 results の rank を入賞ラベルへ。優勝は別ブロック（連覇ウォッチ）が扱うため除く */
function placerLabel(rank: { kind?: string; bestLevel?: number } | undefined | null): '準優勝' | 'ベスト4' | 'ベスト8' | null {
  if (!rank) return null;
  if (rank.kind === 'runnerup') return '準優勝';
  if (rank.kind === 'best' && rank.bestLevel === 4) return 'ベスト4';
  if (rank.kind === 'best' && rank.bestLevel === 8) return 'ベスト8';
  return null;
}

/** プレビュー: 連覇・防衛ウォッチ（前回王者の今大会出場状況） */
function buildTitleDefense(prevChampionEntry: ChampionEntry | null, field: FieldIndex | null): TitleDefenseWatch | null {
  if (!prevChampionEntry || !prevChampionEntry.display || !field) return null;
  const fate = resolvePairFate(prevChampionEntry, field);
  return {
    defendingChampionDisplay: cleanDisplay(prevChampionEntry.display),
    defendingYear: prevChampionEntry.year,
    team: teamDisplayOf(prevChampionEntry),
    players: fate.prevPlayers,
    status: fate.status,
    currentEntries: fate.currentEntries,
    // intact は 1 件の今大会エントリーがそのまま前回王者。partial/split は currentEntries 側を使う。
    standing: fate.status === 'intact' ? (fate.currentEntries[0]?.standing ?? null) : null,
  };
}

/** プレビュー: 前回入賞者（準優勝/ベスト4）で今大会も出場する者 */
function buildReturningPlacers(detail: RawDetail | null, field: FieldIndex | null, prevYear: number): ReturningPlacer[] {
  if (!detail || !detail.entries || !detail.results || !field) return [];
  const pmap = buildParticipantMap(detail);
  const entryByNo = new Map(detail.entries.map((e) => [e.entryNo, e] as const));
  const out: ReturningPlacer[] = [];
  const order: Record<ReturningPlacer['placement'], number> = {
    準優勝: 0,
    ベスト4: 1,
    ベスト8: 2,
  };
  for (const r of detail.results) {
    const label = placerLabel(r.tournament?.rank);
    if (!label) continue;
    const entry = entryByNo.get(r.entryNo);
    if (!entry) continue;
    const ce = resolveEntryToChampion(entry, pmap, prevYear);
    if (!ce.display) continue;
    const fate = resolvePairFate(ce, field);
    if (fate.status === 'absent') continue;
    out.push({
      placement: label,
      display: cleanDisplay(ce.display),
      team: teamDisplayOf(ce),
      players: fate.prevPlayers,
      status: fate.status,
      currentEntries: fate.currentEntries,
      standing: fate.status === 'intact' ? (fate.currentEntries[0]?.standing ?? null) : null,
    });
  }
  out.sort((a, b) => order[a.placement] - order[b.placement]);
  return out;
}

/** プレビュー: 前々回以前の優勝者で今大会も出場する者（前回王者は連覇ウォッチで扱うため除く） */
function buildReturningFormerChampions(champions: ChampionEntry[], field: FieldIndex | null, year: number): ReturningFormerChampion[] {
  if (!field) return [];
  // championKey でまとめ、複数年優勝を集約する（players/team は最新年のものを採用）
  const byKey = new Map<
    string,
    {
      years: number[];
      display: string;
      team: string | null;
      players: PreviewPlayerRef[];
      status: 'intact' | 'partial' | 'split';
      currentEntries: CurrentPairEntry[];
      standing: EntryStanding | null;
    }
  >();
  for (const c of champions) {
    if (c.year >= year - 1) continue; // 前回王者・当年は除外
    if (!c.display) continue;
    const fate = resolvePairFate(c, field);
    if (fate.status === 'absent') continue;
    const key = teamMatchKey(c) ?? c.display;
    const cur = byKey.get(key);
    if (cur) {
      cur.years.push(c.year);
    } else {
      byKey.set(key, {
        years: [c.year],
        display: cleanDisplay(c.display),
        team: teamDisplayOf(c),
        players: fate.prevPlayers,
        status: fate.status,
        currentEntries: fate.currentEntries,
        // 途中経過は「人物」基準なので最新年（最初に出会う要素）の解決で十分
        standing: fate.status === 'intact' ? (fate.currentEntries[0]?.standing ?? null) : null,
      });
    }
  }
  return Array.from(byKey.values())
    .map((v) => ({
      years: v.years.sort((a, b) => b - a),
      display: v.display,
      team: v.team,
      players: v.players,
      status: v.status,
      currentEntries: v.currentEntries,
      standing: v.standing,
    }))
    .sort((a, b) => b.years[0] - a.years[0]);
}

/** プレビュー: 出場規模・勢力図 */
function buildFieldOverview(field: FieldIndex | null): FieldOverview | null {
  if (!field || field.entryCount === 0) return null;
  const topPrefectures = Array.from(field.prefectureCount.entries())
    .map(([prefecture, count]) => ({ prefecture, count }))
    .sort((a, b) => b.count - a.count || a.prefecture.localeCompare(b.prefecture))
    .slice(0, 5);
  const multiEntryTeams = Array.from(field.teamCount.entries())
    .filter(([, count]) => count >= 2)
    .map(([team, count]) => ({ team, count }))
    .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
  return { entryCount: field.entryCount, topPrefectures, multiEntryTeams };
}

// ---- 直近大会の好成績者（種目を問わず・3ヶ月以内・最大2大会・major優先） ----

/**
 * 当プレビュー種目の出場者（個人 or 校）1件に紐づく、直近大会での好成績。
 * 個人は人物単位、団体は校単位（`teamMatchKey`）で最良成績を保持する（2026-07-30〜）。
 */
type RecentAchievementInfo = {
  subjectKind: 'individual' | 'team';
  /** 個人戦=選手名 / 団体戦=校名（表示用に正規化済み） */
  name: string;
  tournamentLabel: string;
  year: number;
  categoryLabel: string;
  placement: '優勝' | '準優勝' | 'ベスト4';
  isMajor: boolean;
};

/** 直近候補に選ばれた大会の 1 開催 */
type RecentTournamentEdition = {
  tournamentId: string;
  year: number;
  label: string;
  isMajor: boolean;
  startDate: string;
};

const RECENT_WINDOW_MONTHS = 3;
const RECENT_TOURNAMENT_LIMIT = 2;
const RECENT_ACHIEVERS_PER_CATEGORY = 8;

type TournamentIndexRow = { tournamentId: string; label?: string; isMajorTitle?: boolean; generationId?: string };

/**
 * index.json（全国・主要大会）と local_index.json（地区大会・県大会）を連結して読む。
 * 従来は index.json のみだったため、地区大会（`highschool-*-block` 等）が候補に
 * 一切入らず、団体戦の直近好成績（recentAchievers）が地区大会団体戦の結果を拾えなかった
 * （2026-07-30 修正。`lib/priorMeetings.ts` の `readAllTournaments` と同じ理由・同じ対処）。
 * 重複する tournamentId は index.json 側を優先する（isMajorTitle 等の付加情報を持つため）。
 */
function readTournamentIndex(): TournamentIndexRow[] {
  const out: TournamentIndexRow[] = [];
  const seen = new Set<string>();
  for (const file of ['index.json', 'local_index.json']) {
    const rows = readJson<TournamentIndexRow[]>(path.join(resolveRoot(), 'data', 'tournaments', file)) ?? [];
    for (const r of rows) {
      if (!r.tournamentId || seen.has(r.tournamentId)) continue;
      seen.add(r.tournamentId);
      out.push(r);
    }
  }
  return out;
}

/** 大会情報（開催日）を読む。年度ごとの startDate を持つ */
function readTournamentEditions(tournamentId: string): Array<{ year: number; startDate?: string }> {
  const arr = readJson<Array<{ year: number; startDate?: string }>>(path.join(resolveRoot(), 'data', 'tournaments', 'information', `${tournamentId}.json`));
  return Array.isArray(arr) ? arr : [];
}

/** categoryId（category-age-gender）→ 表示ラベル（例: 男子シングルス） */
function categoryDisplayLabel(categoryId: string): string {
  const parts = categoryPathParts(categoryId);
  if (!parts) return categoryId;
  const g = parts.gender === 'boys' ? '男子' : parts.gender === 'girls' ? '女子' : parts.gender === 'mixed' ? '混合' : '';
  return `${g}${getCategoryLabel(parts.category)}`;
}

/** rank → ベスト4以上の好成績ラベル。該当しなければ null */
function bestPlacement(rank: { kind?: string; bestLevel?: number } | undefined | null): '優勝' | '準優勝' | 'ベスト4' | null {
  if (!rank) return null;
  if (rank.kind === 'winner') return '優勝';
  if (rank.kind === 'runnerup') return '準優勝';
  if (rank.kind === 'best' && rank.bestLevel === 4) return 'ベスト4';
  return null;
}

function placementRank(p: '優勝' | '準優勝' | 'ベスト4'): number {
  return p === '優勝' ? 3 : p === '準優勝' ? 2 : 1;
}

/** preview 開催日（startDate, ISO）。情報が無ければ null */
function previewStartDate(tournamentId: string, year: number): string | null {
  const ed = readTournamentEditions(tournamentId).find((e) => e.year === year);
  return ed?.startDate ?? null;
}

/**
 * プレビュー開催日から見た「直近の他大会」を最大 RECENT_TOURNAMENT_LIMIT 件選ぶ。
 * 条件: 開催日が (previewDate − 3ヶ月, previewDate) の窓内・自大会は除外・
 *       **プレビュー対象大会と同一 generationId**（2026-07-26 追加。理由は下記）。
 * 並び: isMajorTitle 優先 → 新しい順。これで major を優先しつつ枠を埋める。
 *
 * generationId フィルタ（2026-07-26）:
 * 従来は世代を問わず index.json の全大会を候補にし `isMajorTitle` 優先でソートしていたため、
 * 高校大会のプレビューでも**一般カテゴリの major が枠を独占**していた。実測（インターハイ 2026）:
 * 枠を取っていたのは全日本ミックス（6/6・major）と全日本シングルス（5/15・major）で、
 * IH 出場者との一致はそれぞれ 1 人 / 0 人。最も関連の深いハイスクールジャパンカップ
 * （6/25・21 人一致）は major でないため構造的に選ばれなかった。
 *
 * さらに重要なのは**誤り混入**で、この 1 人は同名別人だった。全日本ミックス
 * `doubles-over65-mixed` のベスト4「山本幸輝」が、IH 2026 男子ダブルスでフルネームが一意な
 * 高校生「山本幸輝（早鞆・山口県）」に `uniqueEntryNoByName` フォールバックで紐づき、
 * over65 混合ダブルスの成績が「主要大会」バッジ付きで高校生に表示される状態だった。
 * 世代をまたぐ照合は年齢・所属という手掛かりが効かず同名別人リスクが最大化するため、
 * 「本文は決定的生成・誤り混入ゼロ」（ADR-005）の原則に沿って**候補段階で世代を絞る**。
 *
 * トレードオフ: 高校生が一般大会で入賞した事実（本物なら強い文脈情報）は拾えなくなる。
 * 名寄せ（homonyms）が整備され世代をまたいだ照合が安全になった時点で再検討する。
 */
function findRecentTournaments(previewTournamentId: string, previewDateIso: string): RecentTournamentEdition[] {
  const previewDate = new Date(previewDateIso);
  if (Number.isNaN(previewDate.getTime())) return [];
  const windowStart = new Date(previewDate);
  windowStart.setMonth(windowStart.getMonth() - RECENT_WINDOW_MONTHS);

  const idx = readTournamentIndex();
  // プレビュー対象大会の generationId。index.json に無い場合は絞り込みを諦めて従来動作にする
  // （誤って候補ゼロにするより、従来の挙動を保つ方が安全）。
  const previewGeneration = idx.find((t) => t.tournamentId === previewTournamentId)?.generationId ?? null;
  const candidates: RecentTournamentEdition[] = [];
  for (const t of idx) {
    if (!t.tournamentId || t.tournamentId === previewTournamentId) continue;
    if (previewGeneration && t.generationId !== previewGeneration) continue;
    for (const ed of readTournamentEditions(t.tournamentId)) {
      if (!ed.startDate) continue;
      const d = new Date(ed.startDate);
      if (Number.isNaN(d.getTime())) continue;
      if (d > windowStart && d < previewDate) {
        candidates.push({
          tournamentId: t.tournamentId,
          year: ed.year,
          label: t.label ?? t.tournamentId,
          isMajor: Boolean(t.isMajorTitle),
          startDate: ed.startDate,
        });
      }
    }
  }
  candidates.sort((a, b) => Number(b.isMajor) - Number(a.isMajor) || b.startDate.localeCompare(a.startDate));
  return candidates.slice(0, RECENT_TOURNAMENT_LIMIT);
}

/**
 * 直近大会（最大2）の全種目から、ベスト4以上の選手・校を索引化する。
 * 種目を問わず、個人戦は人物単位（`playerMatchKey`）、団体戦は校単位（`teamMatchKey`）で
 * 最良成績を保持する（2026-07-30〜。従来は団体戦を per-player 不可として対象外にしていたが、
 * `championKeyToEntryNo`／`teamMatchKey` は他ブロック（連覇ウォッチ等）で既に校単位判定に
 * 使われている既存の仕組みのため、同じキーで団体も扱えるようにした）。
 * 当プレビュー種目の出場者照合に使うため、キーは `playerMatchKey`／`teamMatchKey`
 * （buildFieldIndex の playerKeyToEntryNo／championKeyToEntryNo と同一の作り方）。
 */
function buildRecentAchieverIndex(previewTournamentId: string, previewYear: number): Map<string, RecentAchievementInfo> {
  const out = new Map<string, RecentAchievementInfo>();
  const startDate = previewStartDate(previewTournamentId, previewYear);
  if (!startDate) return out;
  const recents = findRecentTournaments(previewTournamentId, startDate);

  const better = (a: RecentAchievementInfo, b: RecentAchievementInfo) => {
    // 成績優先 → major 優先 → 新しい年
    if (placementRank(a.placement) !== placementRank(b.placement)) return placementRank(a.placement) > placementRank(b.placement) ? a : b;
    if (a.isMajor !== b.isMajor) return a.isMajor ? a : b;
    return a.year >= b.year ? a : b;
  };

  for (const rt of recents) {
    for (const cid of listCategoryIds(rt.tournamentId, rt.year)) {
      const detail = readYearDetail(rt.tournamentId, rt.year, cid);
      if (!detail || !detail.entries || !detail.results) continue;
      const pmap = buildParticipantMap(detail);
      const entryByNo = new Map(detail.entries.map((e) => [e.entryNo, e] as const));
      const categoryLabel = categoryDisplayLabel(cid);
      for (const r of detail.results) {
        const placement = bestPlacement(r.tournament?.rank);
        if (!placement) continue;
        const entry = entryByNo.get(r.entryNo);
        if (!entry) continue;
        const ce = resolveEntryToChampion(entry, pmap, rt.year);
        if (!ce.display) continue;

        if (ce.players.length === 0) {
          // 団体戦: 校単位（teamMatchKey）で1キー。個人の playerKeyToEntryNo とは
          // 別の名前空間（championKeyToEntryNo）で突合するため、個人戦プレビューには出ない。
          const key = teamMatchKey(ce);
          if (!key) continue;
          const info: RecentAchievementInfo = {
            subjectKind: 'team',
            name: cleanDisplay(ce.display),
            tournamentLabel: rt.label,
            year: rt.year,
            categoryLabel,
            placement,
            isMajor: rt.isMajor,
          };
          const cur = out.get(key);
          out.set(key, cur ? better(cur, info) : info);
          continue;
        }

        for (const name of ce.players) {
          const info: RecentAchievementInfo = {
            subjectKind: 'individual',
            name,
            tournamentLabel: rt.label,
            year: rt.year,
            categoryLabel,
            placement,
            isMajor: rt.isMajor,
          };
          // 所属表記揺れを吸収するため、ペアの各所属でキーを張る
          for (const team of ce.teams.length > 0 ? ce.teams : [null]) {
            const key = playerMatchKey(name, team);
            const cur = out.get(key);
            out.set(key, cur ? better(cur, info) : info);
          }
        }
      }
    }
  }
  return out;
}

/**
 * 当プレビュー種目の出場者（個人 or 校）のうち、直近大会で好成績を残したものを抽出する。
 * 既に他ブロック（連覇ウォッチ・前回入賞者・過去の優勝者）で出ている選手は重複排除する
 * （団体戦は他ブロックの `alreadyShownNames` に校名が入ることが無いため、実質すり抜けない）。
 */
function buildRecentAchievers(field: FieldIndex | null, recentIndex: Map<string, RecentAchievementInfo>, alreadyShownNames: Set<string>): RecentAchiever[] {
  if (!field || recentIndex.size === 0) return [];
  const seen = new Set<string>(alreadyShownNames);
  const out: RecentAchiever[] = [];
  for (const [key, info] of recentIndex) {
    // 当大会の出場者か。個人=playerKey（外れたら一意な名前のみでフォールバック。所属変更を吸収）、
    // 団体=championKey（teamMatchKey）。名前空間が分かれているため、団体の校名が誤って
    // 個人戦プレビューの選手と衝突することはない。
    const entryNo =
      info.subjectKind === 'team' ? field.championKeyToEntryNo.get(key) : (field.playerKeyToEntryNo.get(key) ?? uniqueEntryNoByName(field, info.name));
    if (entryNo == null) continue; // 当大会の出場者でない
    const dedupKey = `${info.subjectKind}:${normPart(info.name)}`;
    if (seen.has(dedupKey)) continue; // 既出（他ブロック or 同一主体の別キー）
    seen.add(dedupKey);
    // 今大会の途中経過/敗退（前回入賞者の再登場ブロックと同様、キー→entryNo→standing で引く）
    const standing = field.standingByEntryNo.get(entryNo) ?? null;
    out.push({
      display: info.name,
      team: null,
      players: info.subjectKind === 'team' ? [] : [{ name: info.name, playerId: resolvePlayerId(info.name), returning: true, team: null }],
      tournamentLabel: info.tournamentLabel,
      year: info.year,
      categoryLabel: info.categoryLabel,
      placement: info.placement,
      isMajor: info.isMajor,
      standing,
    });
  }
  out.sort(
    (a, b) =>
      placementRank(b.placement) - placementRank(a.placement) || Number(b.isMajor) - Number(a.isMajor) || b.year - a.year || a.display.localeCompare(b.display),
  );
  return out.slice(0, RECENT_ACHIEVERS_PER_CATEGORY);
}

/**
 * 今大会の途中経過/敗退の「見たい順」ランク。小さいほど上位に表示する。
 * champion/runnerup（勝ち切った）＞ alive（勝ち上がり中）＞ null（結果未掲載）＞ eliminated（敗退）。
 * 大会終了後に見に来る人は「今大会どうだったか」を最優先で知りたいという想定（見せ方の改善）。
 */
function standingSortRank(s: EntryStanding | null): number {
  if (!s) return 2;
  switch (s.state) {
    case 'champion':
    case 'runnerup':
      return 0;
    case 'alive':
      return 1;
    case 'eliminated':
      return 3;
    default:
      return 2;
  }
}

/**
 * returningPlacers / returningFormerChampions / recentAchievers を
 * 1本の PickPlayerCard[] にマージし、今大会の結果順にソートする。
 * 同ランク内は元の並び（各ブロックの優先順位・登場順）を保つ（Array#sort は安定ソート）。
 */
function buildPickPlayers(
  returningPlacers: ReturningPlacer[],
  returningFormerChampions: ReturningFormerChampion[],
  recentAchievers: RecentAchiever[],
): PickPlayerCard[] {
  const cards: PickPlayerCard[] = [];

  // 前回主役の選手名（ペア表示用）。ペア解消時の注記に使う。
  const prevNamesOf = (players: PreviewPlayerRef[]) => players.map((pl) => pl.name).join('・');

  returningPlacers.forEach((p, i) => {
    if (p.status === 'intact') {
      // ペア/校がそのまま継続: 前回主役をそのまま主役にする。
      cards.push({
        id: `placer-${i}`,
        players: p.players,
        display: p.display,
        team: p.team,
        perPlayerTeam: !p.team,
        achievements: [`前回${p.placement}`],
        standing: p.standing,
      });
    } else {
      // partial/split: 今大会の実在ペアを主役にし、結果バッジをそこへ紐付ける（案A）。
      // 前回ペアと解消の事実は実績行へ（案C）。split は今大会ペアごとに 1 枚。
      p.currentEntries.forEach((ce, j) => {
        cards.push({
          id: `placer-${i}-${j}`,
          players: ce.players,
          display: prevNamesOf(ce.players),
          team: ce.team,
          perPlayerTeam: !ce.team,
          achievements: [`前回${p.placement}：${prevNamesOf(p.players)}（ペア解消）`],
          standing: ce.standing,
        });
      });
    }
  });

  returningFormerChampions.forEach((f, i) => {
    const yearsLabel = `${f.years.join('・')}年優勝`;
    if (f.status === 'intact') {
      cards.push({
        id: `former-${i}`,
        players: f.players,
        display: f.display,
        team: f.team,
        perPlayerTeam: !f.team,
        achievements: [yearsLabel],
        standing: f.standing,
      });
    } else {
      f.currentEntries.forEach((ce, j) => {
        cards.push({
          id: `former-${i}-${j}`,
          players: ce.players,
          display: prevNamesOf(ce.players),
          team: ce.team,
          perPlayerTeam: !ce.team,
          achievements: [`${yearsLabel}：${prevNamesOf(f.players)}（ペア解消）`],
          standing: ce.standing,
        });
      });
    }
  });

  recentAchievers.forEach((a, i) => {
    cards.push({
      id: `recent-${i}`,
      players: a.players,
      display: a.display,
      team: a.team,
      perPlayerTeam: false,
      achievements: [`${a.tournamentLabel}${a.year} ${a.categoryLabel} ${a.placement}`],
      standing: a.standing,
    });
  });

  // 同一の「今大会ペア」が複数の前回主役由来で重複することがある。
  // 例: 前回準優勝ペア(内本・内田)と前回ベスト4ペア(矢野・上松)がともに分割し、内本と上松が
  // 今大会に同じペアを組む → 内本由来と上松由来で「内本・上松」カードが2枚出る。
  // 今大会ペア（選手名の集合）単位で 1 枚にまとめ、複数の実績理由は achievements の複数行として保持する
  // （UI で 1 行ずつ表示する）。
  const merged = new Map<string, PickPlayerCard>();
  for (const card of cards) {
    const key =
      card.players.length > 0
        ? card.players
            .map((p) => normPart(p.name))
            .sort()
            .join('|')
        : normPart(card.display);
    const cur = merged.get(key);
    if (!cur) {
      merged.set(key, { ...card, achievements: [...card.achievements] });
      continue;
    }
    for (const a of card.achievements) if (!cur.achievements.includes(a)) cur.achievements.push(a);
    // 通常は同じペアなので standing も同一だが、念のためより上位（見たい順）を採用する。
    if (standingSortRank(card.standing) < standingSortRank(cur.standing)) cur.standing = card.standing;
  }

  return Array.from(merged.values()).sort((a, b) => standingSortRank(a.standing) - standingSortRank(b.standing));
}

/**
 * 前哨戦として載せる「最短で当たるラウンド」の上限（0 始まり。2 = 3回戦まで）。
 *
 * 地区大会で対戦した相手は同じ地区＝同じ都道府県圏なので、全国大会のドローでは
 * 意図的に離される。実測（インターハイ 2026）では **3 回戦までに当たる組は 0**、
 * 男子ダブルス 103 組のうち 52 組は決勝でしか当たらなかった。
 * 「決勝まで行かないと当たらないのに前哨戦として並べるのは誇大」という判断で閾値を置く。
 *
 * **実際に対戦カードが組まれた／対戦が行われたものは、この閾値に関係なく必ず残す**
 * （`keepCard` 参照）。大会が進んで再戦が実現したら、何回戦であっても出したいため。
 */
const PRIOR_MEETING_MAX_ROUND_INDEX = 2;

/** 前哨戦ブロックで**常時表示**するカード数（1 種目あたり） */
const PRIOR_MEETING_CARDS = 6;
/**
 * 折りたたみを開いたときに見せられるカード数の上限（1 種目あたり）。
 * 全件（インターハイ女子ダブルスで 273 件）を出すと 1 ページの HTML が数百 KB 増えるため、
 * ここで打ち切る。真の総数は `totalCards` に出しており、そちらで規模は伝わる。
 */
const PRIOR_MEETING_CARDS_MAX = 50;

/**
 * 「直近の対戦」ブロックを組み立てる。
 *
 * `lib/priorMeetings.ts` がペア単位で索引した「出場ペアどうしの過去の対戦」を、
 * 表示用に整形する。**今大会で既に対戦カードが確定しているもの（＝再戦が実現するもの）を
 * 最優先**で見せる。インターハイ 2026 のように 1 回戦しか登録されていない段階では該当が
 * 少ないが、大会が進んで `matches` が埋まるにつれて増える（ADR-007 の ongoing 運用）。
 */
function buildPriorMeetingsBlock(
  tournamentId: string,
  year: number,
  categoryId: string,
  generation: string,
  field: FieldIndex | null,
): PriorMeetingsBlock | null {
  const index = buildPriorMeetingIndex(tournamentId, year, categoryId, generation || null);
  if (index.size === 0) return null;

  const detail = readYearDetail(tournamentId, year, categoryId);
  const totalEntries = detail?.entries?.length ?? 0;

  // 今大会で既に組まれている対戦カード（1 回戦など）を集合化し、再戦の実現を判定する。
  const scheduled = new Set<string>();
  for (const m of detail?.matches ?? []) {
    const es = m.entries ?? [];
    if (es.length === 2) scheduled.add(meetingKey(es[0], es[1]));
  }
  // 大会が実際に始まっているか（1 試合でも勝敗が付いているか）。
  // 開催前は results が `kind:'ongoing'` で全員 alive になるため、standing だけでは
  // 「勝ち上がっている」と「まだ始まっていない」を区別できない。
  const hasStarted = (detail?.matches ?? []).some((m) => m.winnerEntryNo != null);

  // 団体戦は 1 エントリ = 1 校で、`names` に校名が入る。所属の重複表示（例:「明徳義塾（明徳義塾）」）を
  // 避けるため所属は付けず、校名を選手名として `resolvePlayerId` に渡すこともしない（誤リンクになる）。
  const isTeamCategory = categoryId.startsWith('team');

  const pmap = detail ? buildParticipantMap(detail) : new Map<string, RawParticipant>();
  const entryById = new Map((detail?.entries ?? []).map((e) => [e.entryNo, e] as const));
  /** 今大会のエントリ → 所属（ペアで割れていれば null。団体戦は名前がそのまま校名なので null） */
  const teamOf = (entryNo: number): string | null => {
    if (isTeamCategory) return null;
    const e = entryById.get(entryNo);
    if (!e) return null;
    const teams = new Set<string>();
    for (const id of e.playerIds ?? []) {
      const t = pmap.get(id)?.team;
      if (t) teams.add(cleanDisplay(t));
    }
    return teams.size === 1 ? [...teams][0] : null;
  };
  const refs = (names: string[]): PreviewPlayerRef[] =>
    names.map((n) => ({ name: cleanDisplay(n), playerId: isTeamCategory ? null : resolvePlayerId(n), returning: true, team: null }));

  // 今大会で組まれた対戦の勝敗（決着済みのものだけ）。「今大会で再戦」の結果表示に使う。
  const currentWinnerByKey = new Map<string, number>();
  for (const m of detail?.matches ?? []) {
    const es = m.entries ?? [];
    if (es.length === 2 && m.winnerEntryNo != null) currentWinnerByKey.set(meetingKey(es[0], es[1]), m.winnerEntryNo);
  }

  const standingOf = (entryNo: number): EntryStanding | null => field?.standingByEntryNo.get(entryNo) ?? null;
  /** 敗退済み＝もう対戦は起こらない。優勝/準優勝/勝ち上がり中は「まだ起こりうる」側に数える。 */
  const isOut = (s: EntryStanding | null): boolean => s?.state === 'eliminated';

  // ドローから「最短で当たるラウンド」を求める。type 未入力の大会では null（絞り込みもしない）。
  const layout = getBracketLayout(tournamentId, year, categoryId);

  const cards: PriorMeetingCard[] = [];
  /** カード → 最短で当たるラウンド index。表示型には出さず絞り込みにだけ使う。 */
  const cardRoundIndex = new Map<PriorMeetingCard, number | null>();
  /** カード → 今大会の entryNo ペア。カバレッジ集計に使う。 */
  const cardEntryNos = new Map<PriorMeetingCard, [number, number]>();
  const sourceLabels = new Set<string>();
  for (const [key, list] of index) {
    for (const m of list) {
      const ws = standingOf(m.winnerEntryNo);
      const ls = standingOf(m.loserEntryNo);
      // 今大会で対戦が組まれていれば scheduled。そうでなければ、どちらかが敗退していれば
      // 再戦はもう起こらない（gone）。両者健在なら possible。結果未掲載なら unknown。
      const rematchStatus: PriorMeetingCard['rematchStatus'] = scheduled.has(key)
        ? 'scheduled'
        : isOut(ws) || isOut(ls)
          ? 'gone'
          : !hasStarted
            ? 'pending'
            : ws || ls
              ? 'possible'
              : 'unknown';
      const roundIdx = layout ? meetingRoundIndex(layout, m.winnerEntryNo, m.loserEntryNo) : null;
      const meetingRoundLabel = layout && roundIdx != null ? roundLabelOf(roundIdx, layout.totalRounds) : null;

      // 今大会の勝者が「前回negative側」なら雪辱。前回勝者の名前は m.winnerNames。
      const curWinner = currentWinnerByKey.get(key);
      const currentResult =
        curWinner == null
          ? null
          : {
              winnerNames: curWinner === m.winnerEntryNo ? m.winnerNames : m.loserNames,
              revenge: curWinner === m.loserEntryNo,
            };
      const card: PriorMeetingCard = {
        tournamentLabel: m.tournamentLabel,
        year: m.year,
        round: m.round,
        winner: refs(m.winnerNames),
        loser: refs(m.loserNames),
        winnerTeam: teamOf(m.winnerEntryNo),
        loserTeam: teamOf(m.loserEntryNo),
        rematchStatus,
        meetingRoundLabel,
        winnerStanding: ws,
        loserStanding: ls,
        currentResult,
      };
      cards.push(card);
      cardRoundIndex.set(card, roundIdx);
      cardEntryNos.set(card, [m.winnerEntryNo, m.loserEntryNo]);
      sourceLabels.add(m.tournamentLabel);
    }
  }
  // ---- 絞り込み ----
  // ドロー上「3回戦まで」に当たる組だけを前哨戦として残す（PRIOR_MEETING_MAX_ROUND_INDEX）。
  // ただし **実際に対戦カードが組まれた／決着したものは何回戦でも残す**。
  // 大会が進んで再戦が実現したら、決勝であってもそれは「起きた事実」なので出したい。
  // ドローを復元できない大会（`entries[].type` 未入力）は絞り込まず従来どおり全件出す。
  const keepCard = (c: PriorMeetingCard): boolean => {
    if (c.rematchStatus === 'scheduled' || c.currentResult) return true; // 実現した／する
    if (!layout) return true; // ドロー不明なので判断しない（安全側）
    if (c.meetingRoundLabel == null) return true;
    const idx = cardRoundIndex.get(c);
    return idx == null || idx <= PRIOR_MEETING_MAX_ROUND_INDEX;
  };
  const kept = cards.filter(keepCard);
  const keptEntryNos = new Set<number>();
  for (const c of kept) {
    const nos = cardEntryNos.get(c);
    if (nos) {
      keptEntryNos.add(nos[0]);
      keptEntryNos.add(nos[1]);
    }
  }
  const keptCoveredEntries = keptEntryNos.size;

  // 再戦確定 → まだ起こりうる → 大会前（未掲載）→ もう起こらない、の順。
  // 同順位内では前回対戦のラウンドが深い（決勝に近い＝カードの格が高い）ものを優先する。
  const statusRank = (s: PriorMeetingCard['rematchStatus']): number =>
    s === 'scheduled' ? 4 : s === 'possible' ? 3 : s === 'pending' ? 2 : s === 'unknown' ? 1 : 0;
  const roundRank = (r: string | null): number => {
    if (!r) return 0;
    if (r.includes('決勝') && !r.includes('準')) return 100;
    if (r.includes('準決勝')) return 90;
    if (r.includes('準々決勝')) return 80;
    const m = /(\d+)回戦/u.exec(r);
    return m ? Number(m[1]) : 10;
  };
  cards.sort(
    (a, b) =>
      statusRank(b.rematchStatus) - statusRank(a.rematchStatus) ||
      roundRank(b.round) - roundRank(a.round) ||
      a.tournamentLabel.localeCompare(b.tournamentLabel),
  );

  if (kept.length === 0) return null;

  // 集計は「残したカード」基準にする（総数だけ全件だと数字と中身が乖離するため）。
  const keptSources = new Set(kept.map((c) => c.tournamentLabel));
  return {
    totalCards: kept.length,
    coveredEntries: keptCoveredEntries,
    totalEntries,
    unit: isTeamCategory ? '校' : categoryId.startsWith('singles') ? '選手' : 'ペア',
    sourceLabels: [...keptSources],
    cards: kept.slice(0, PRIOR_MEETING_CARDS_MAX),
    visibleCards: PRIOR_MEETING_CARDS,
  };
}

function buildCategoryBlock(
  record: NewsArticleRecord,
  categoryId: string,
  generation: string,
  recentIndex: Map<string, RecentAchievementInfo>,
): NewsCategoryBlock | null {
  const { tournamentId, year, type } = record;
  const hw = getHistoricalWinners(tournamentId, categoryId, {
    targetYear: year,
  });
  if (!hw) return null;

  const previousChampion = hw.champions.find((c) => c.year === year - 1)?.display ?? null;
  const champion = hw.champions.find((c) => c.year === year)?.display ?? null;

  let milestones: NewsCategoryBlock['milestones'] = [];
  let titleDefense: TitleDefenseWatch | null = null;
  let returningPlacers: ReturningPlacer[] = [];
  let returningFormerChampions: ReturningFormerChampion[] = [];
  let recentAchievers: RecentAchiever[] = [];
  let fieldOverview: FieldOverview | null = null;
  let priorMeetings: PriorMeetingsBlock | null = null;

  if (type === 'result') {
    const ms = getChampionMilestones(tournamentId, categoryId, year);
    // giant-killing（金星）も結果記事の素材に含める（記事は human-in-the-loop なので
    // 敗者記名のトーンは承認時に人が確認できる）。
    const giantKillings = getGiantKillings(tournamentId, categoryId, year);
    milestones = [...(ms?.events ?? []), ...giantKillings].map((e) => ({
      kind: e.kind,
      label: e.label,
      confidence: e.confidence,
      scopeNote: e.scopeNote ?? null,
    }));
  } else {
    // プレビュー: 当サイト掲載のエントリー＋前年データを照合し、決定的に展望を構成する。
    const field = buildFieldIndex(tournamentId, year, categoryId);
    const prevChampionEntry = hw.champions.find((c) => c.year === year - 1) ?? null;
    const prevDetail = readYearDetail(tournamentId, year - 1, categoryId);
    titleDefense = buildTitleDefense(prevChampionEntry, field);
    returningPlacers = buildReturningPlacers(prevDetail, field, year - 1);
    returningFormerChampions = buildReturningFormerChampions(hw.champions, field, year);
    // 直近大会の好成績者は、上記ブロックで既出の選手を除いてピックアップする
    const alreadyShownNames = new Set<string>();
    // 前回主役に加え、ペア解消後の今大会ペア（新パートナー含む）も既出として重複排除する。
    const addPrevAndCurrent = (players: PreviewPlayerRef[], currentEntries: CurrentPairEntry[]) => {
      for (const p of players) alreadyShownNames.add(normPart(p.name));
      for (const ce of currentEntries) for (const p of ce.players) alreadyShownNames.add(normPart(p.name));
    };
    if (titleDefense) addPrevAndCurrent(titleDefense.players, titleDefense.currentEntries);
    for (const rp of returningPlacers) addPrevAndCurrent(rp.players, rp.currentEntries);
    for (const rf of returningFormerChampions) addPrevAndCurrent(rf.players, rf.currentEntries);
    recentAchievers = buildRecentAchievers(field, recentIndex, alreadyShownNames);
    fieldOverview = buildFieldOverview(field);
    priorMeetings = buildPriorMeetingsBlock(tournamentId, year, categoryId, generation, field);
  }

  // その年・種目の結果ページは details ファイルが存在する場合のみ生成される
  // （結果ページの getStaticPaths が details ディレクトリを走査するため）。
  // プレビューでは公開時点で結果が未掲載のことがあるので、実在する場合のみリンクを張る。
  const parts = generation ? categoryPathParts(categoryId) : null;
  const hasResultDetail = Boolean(readYearDetail(tournamentId, year, categoryId));
  const resultHref = parts && hasResultDetail ? `/tournaments/${generation}/${tournamentId}/${year}/${parts.category}/${parts.age}/${parts.gender}/` : null;

  const pickPlayers = buildPickPlayers(returningPlacers, returningFormerChampions, recentAchievers);

  return {
    categoryId,
    categoryLabel: hw.categoryLabel,
    previousChampion,
    historicalWinners: hw.champions.map((c) => ({
      year: c.year,
      display: c.display,
    })),
    champion: type === 'result' ? champion : null,
    milestones,
    titleDefense,
    returningPlacers,
    returningFormerChampions,
    recentAchievers,
    priorMeetings,
    pickPlayers,
    fieldOverview,
    resultHref,
  };
}

function defaultTitle(record: NewsArticleRecord, tournamentLabel: string): string {
  return record.type === 'preview'
    ? `${tournamentLabel} ${record.year} 展望・連覇/前回王者・出場校`
    : `${tournamentLabel} ${record.year} 結果・優勝・歴代まとめ`;
}

/**
 * meta description。
 * 前哨戦（priorMeetings）が算出できているときは、**当サイトにしか無い切り口**なので
 * 「直近大会での対戦成績」を一文だけ足す。他の展望サイトと文面で差別化する狙い
 * （[seo.md](../docs/wiki/seo.md) #8「farm が構造的に持てない DB 由来の文脈で差別化」）。
 * 算出できない大会では従来文のまま（分岐 1 箇所で戻せる）。
 */
function defaultDescription(record: NewsArticleRecord, tournamentLabel: string, categories: NewsCategoryBlock[]): string {
  if (record.type !== 'preview') {
    return `ソフトテニス「${tournamentLabel}」${record.year}年の結果。優勝者・連覇/初優勝などの記録を歴代データと合わせてまとめています。`;
  }
  const base = `ソフトテニス「${tournamentLabel}」${record.year}年の展望。前回王者の連覇挑戦・前回入賞者の再登場・出場規模・歴代優勝者を当サイト掲載データからまとめています。`;
  const totalCards = categories.reduce((n, c) => n + (c.priorMeetings?.totalCards ?? 0), 0);
  if (totalCards === 0) return base;
  return `${base}直近の大会で既に対戦している${totalCards}件の顔合わせも掲載。`;
}

/** 記事レコードから描画用ビューを組み立てる */
export function buildNewsArticleView(record: NewsArticleRecord): NewsArticleView {
  const { label: tournamentLabel, generationId } = tournamentMetaOf(record.tournamentId);
  const categoryIds = record.categoryId && record.categoryId.length > 0 ? [record.categoryId] : listCategoryIds(record.tournamentId, record.year);

  // 直近大会の好成績者インデックスは種目に依存しないので記事単位で 1 回だけ構築する。
  // result 記事では使わないため preview のときのみ。
  const recentIndex = record.type === 'preview' ? buildRecentAchieverIndex(record.tournamentId, record.year) : new Map<string, RecentAchievementInfo>();

  const categories: NewsCategoryBlock[] = [];
  for (const cid of categoryIds) {
    const block = buildCategoryBlock(record, cid, generationId, recentIndex);
    if (block) categories.push(block);
  }

  const hubHref = generationId ? `/tournaments/${generationId}/${record.tournamentId}/` : '';

  return {
    record,
    tournamentLabel,
    generation: generationId,
    hubHref,
    title: record.title || defaultTitle(record, tournamentLabel),
    description: record.description || defaultDescription(record, tournamentLabel, categories),
    categories,
  };
}

/**
 * 記事本文が実名で言及している選手を、構造化データ（JSON-LD の mentions）用に集約する。
 * ソース: 各カテゴリブロックの pickPlayers（注目の選手カード）と titleDefense（前回王者の連覇/防衛ウォッチ）。
 * 同一選手が複数箇所（例: 前回王者かつ注目の選手）に出ることがあるため、playerId（無ければ name）で重複排除する。
 * 表示順は影響しないため、カテゴリ・出現順のまま返す。
 */
export function collectArticleMentions(categories: NewsCategoryBlock[]): PreviewPlayerRef[] {
  const seen = new Set<string>();
  const mentions: PreviewPlayerRef[] = [];

  const add = (p: PreviewPlayerRef) => {
    const key = p.playerId != null ? `id:${p.playerId}` : `name:${p.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    mentions.push(p);
  };

  for (const cat of categories) {
    if (cat.titleDefense) {
      for (const p of cat.titleDefense.players) add(p);
    }
    for (const card of cat.pickPlayers) {
      for (const p of card.players) add(p);
    }
  }

  return mentions;
}
