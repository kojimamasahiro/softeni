// lib/highschoolNationalTournaments.ts
// 高校カテゴリの「全国大会 歴代記録」ページ用サーバーロジック。
// data/tournaments/details と data/tournaments/information を読み、
// 大会ごと・年度ごと・種目ごとの上位入賞（優勝〜ベスト4）を抽出する。
//
// このモジュールは getStaticProps からのみ import すること（fs を使用）。

import fs from 'fs';
import path from 'path';

import type { TournamentInformationEntry } from '@/types/tournament';

/** URL スラッグ（/highschool/tournaments/[tournament]） */
export type HsNationalTournamentSlug = 'championship' | 'japan-cup';

export type HsNationalTournamentMeta = {
  slug: HsNationalTournamentSlug;
  tournamentId: string;
  /** 正式名称 */
  label: string;
  /** 短縮・通称（見出し向け） */
  shortLabel: string;
  officialUrl: string;
  /** カードや概要に出す短い説明 */
  description: string;
};

/** 高校カテゴリで歴代記録を出す全国大会の定義 */
export const HS_NATIONAL_TOURNAMENTS: Record<
  HsNationalTournamentSlug,
  HsNationalTournamentMeta
> = {
  championship: {
    slug: 'championship',
    tournamentId: 'highschool-championship',
    label: '全国高等学校総合体育大会',
    shortLabel: 'インターハイ',
    officialUrl: 'https://www.zen-koutairen.com/',
    description:
      '高校ソフトテニスの全国頂点を決める大会（インターハイ）。男子・女子の団体戦・個人戦（ダブルス）の歴代上位校・ペアをまとめています。',
  },
  'japan-cup': {
    slug: 'japan-cup',
    tournamentId: 'highschool-japan-cup',
    label: 'ハイスクールジャパンカップ',
    shortLabel: 'ハイスクールジャパンカップ',
    officialUrl: 'https://www.gosen-sp.jp/hjs/',
    description:
      '高校生個人の日本一を争う大会。男子・女子のシングルス・ダブルスの歴代上位選手をまとめています。',
  },
};

export const HS_NATIONAL_SLUGS = Object.keys(
  HS_NATIONAL_TOURNAMENTS,
) as HsNationalTournamentSlug[];

const GENERATION = 'highschool';
const DETAILS_ROOT = ['data', 'tournaments', 'details'];

/** 種目（団体→ダブルス→シングルス）の表示順 */
const CATEGORY_ORDER: Record<string, number> = {
  team: 0,
  doubles: 1,
  singles: 2,
};

/** 性別（男子→女子）の表示順 */
const GENDER_ORDER: Record<string, number> = {
  boys: 0,
  girls: 1,
  mixed: 2,
};

/** 上位入賞のひとつ（優勝 / 準優勝 / ベスト4 のいずれか） */
export type RecordPlacement = {
  /** 表示用ラベル: 優勝 / 準優勝 / ベスト4 */
  rankLabel: string;
  /** 並び順（優勝=1, 準優勝=2, ベスト4=3） */
  order: number;
  /** 表示文字列（個人: 選手名（所属） / 団体: 校名） */
  display: string;
  /** 選手名一覧（団体戦は空配列） */
  players: string[];
  /** 所属校 */
  teams: string[];
  /** 都道府県 */
  prefectures: string[];
};

/** 1 種目ぶんの記録 */
export type CategoryRecord = {
  categoryId: string; // 例: doubles-none-boys
  label: string; // 例: 男子ダブルス
  category: string; // team / doubles / singles
  gender: string; // boys / girls / mixed
  age: string; // none など
  /** 既存のトーナメント表（対戦表）ページへのリンク */
  bracketHref: string;
  placements: RecordPlacement[];
};

/** 1 年度ぶんの記録 */
export type YearRecord = {
  year: number;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  categories: CategoryRecord[];
};

/** 歴代優勝サマリーの 1 行（種目ごと） */
export type ChampionSummaryRow = {
  categoryId: string;
  label: string;
  byYear: { year: number; winner: string | null }[];
};

export type TournamentRecords = HsNationalTournamentMeta & {
  years: YearRecord[];
  championSummary: ChampionSummaryRow[];
  yearsCovered: number[];
};

type RawParticipant = {
  id: string;
  lastName?: string | null;
  firstName?: string | null;
  team?: string | null;
  prefecture?: string | null;
};

type RawEntry = { entryNo: number; playerIds: string[] };

type RawRank = {
  kind?: string;
  bestLevel?: number;
  round?: number;
};

type RawResult = {
  entryNo: number;
  tournament?: { label?: string; rank?: RawRank } | null;
};

type RawDetail = {
  participants?: RawParticipant[];
  entries?: RawEntry[];
  results?: RawResult[];
};

function resolveRoot(): string {
  return process.cwd();
}

function readInformation(tournamentId: string): TournamentInformationEntry[] {
  const infoPath = path.join(
    resolveRoot(),
    'data',
    'tournaments',
    'information',
    `${tournamentId}.json`,
  );
  if (!fs.existsSync(infoPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    return Array.isArray(parsed)
      ? (parsed as TournamentInformationEntry[])
      : [];
  } catch {
    return [];
  }
}

/** rank から並び順とラベルを決める。対象外なら null。 */
function classifyRank(
  rank: RawRank | undefined,
): { order: number; rankLabel: string } | null {
  if (!rank) return null;
  if (rank.kind === 'winner') return { order: 1, rankLabel: '優勝' };
  if (rank.kind === 'runnerup') return { order: 2, rankLabel: '準優勝' };
  if (rank.kind === 'best' && rank.bestLevel === 4) {
    return { order: 3, rankLabel: 'ベスト4' };
  }
  return null;
}

/** entry を選手名・所属・都道府県・表示文字列へ解決する */
function resolveEntry(
  entry: RawEntry,
  participantById: Map<string, RawParticipant>,
): Pick<RecordPlacement, 'display' | 'players' | 'teams' | 'prefectures'> {
  const players: string[] = [];
  const teams: string[] = [];
  const prefectures: string[] = [];

  for (const id of entry.playerIds) {
    const p = participantById.get(id);
    if (!p) {
      // 参加者情報が無い場合は id をそのまま名前として扱う
      players.push(id);
      continue;
    }
    const name = `${p.lastName ?? ''}${p.firstName ?? ''}`.trim();
    if (name) players.push(name);
    if (p.team && !teams.includes(p.team)) teams.push(p.team);
    if (p.prefecture && !prefectures.includes(p.prefecture)) {
      prefectures.push(p.prefecture);
    }
  }

  const nameStr = players.join('・');
  let display: string;
  if (!nameStr) {
    // 団体戦: 選手名が無いので校名で表示
    display = teams.join('・');
  } else if (teams.length > 0) {
    display = `${nameStr}（${teams.join('・')}）`;
  } else {
    display = nameStr;
  }

  return { display, players, teams, prefectures };
}

/** 1 種目ファイルから上位入賞（優勝〜ベスト4）を抽出 */
function extractPlacements(detailPath: string): RecordPlacement[] {
  let data: RawDetail;
  try {
    data = JSON.parse(fs.readFileSync(detailPath, 'utf-8')) as RawDetail;
  } catch {
    return [];
  }

  const participantById = new Map<string, RawParticipant>(
    (data.participants ?? []).map((p) => [p.id, p] as const),
  );
  const entryByNo = new Map<number, RawEntry>(
    (data.entries ?? []).map((e) => [e.entryNo, e] as const),
  );

  const placements: RecordPlacement[] = [];
  for (const result of data.results ?? []) {
    const classified = classifyRank(result.tournament?.rank);
    if (!classified) continue;
    const entry = entryByNo.get(result.entryNo);
    if (!entry) continue;
    const resolved = resolveEntry(entry, participantById);
    if (!resolved.display) continue;
    placements.push({
      rankLabel: classified.rankLabel,
      order: classified.order,
      ...resolved,
    });
  }

  // 優勝→準優勝→ベスト4 の順、ベスト4 内は校名で安定ソート
  placements.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.display.localeCompare(b.display, 'ja');
  });
  return placements;
}

function parseCategoryFile(fileName: string): {
  categoryId: string;
  category: string;
  age: string;
  gender: string;
} | null {
  const base = fileName.replace(/\.json$/, '');
  const parts = base.split('-');
  if (parts.length < 3) return null;
  const gender = parts.pop() as string;
  const age = parts.pop() as string;
  const category = parts.join('-');
  return { categoryId: `${category}-${age}-${gender}`, category, age, gender };
}

function sortCategories(a: CategoryRecord, b: CategoryRecord): number {
  const ga = GENDER_ORDER[a.gender] ?? 9;
  const gb = GENDER_ORDER[b.gender] ?? 9;
  if (ga !== gb) return ga - gb;
  const ca = CATEGORY_ORDER[a.category] ?? 9;
  const cb = CATEGORY_ORDER[b.category] ?? 9;
  if (ca !== cb) return ca - cb;
  return a.categoryId.localeCompare(b.categoryId);
}

/** 指定スラッグの大会の歴代記録を取得する */
export function getHsNationalTournamentRecords(
  slug: HsNationalTournamentSlug,
): TournamentRecords {
  const meta = HS_NATIONAL_TOURNAMENTS[slug];
  const information = readInformation(meta.tournamentId);

  const infoByYear = new Map<string, TournamentInformationEntry>();
  const labelByYearCategory = new Map<string, Map<string, string>>();
  for (const entry of information) {
    const y = String(entry.year);
    infoByYear.set(y, entry);
    const m = new Map<string, string>();
    for (const cat of entry.categories ?? []) {
      m.set(cat.categoryId, cat.label);
    }
    labelByYearCategory.set(y, m);
  }

  const tidDir = path.join(resolveRoot(), ...DETAILS_ROOT, meta.tournamentId);
  const years: YearRecord[] = [];

  if (fs.existsSync(tidDir)) {
    const yearDirs = fs
      .readdirSync(tidDir)
      .filter((y) => fs.statSync(path.join(tidDir, y)).isDirectory())
      .sort((a, b) => Number(b) - Number(a)); // 年度降順

    for (const y of yearDirs) {
      const yearDir = path.join(tidDir, y);
      const files = fs.readdirSync(yearDir).filter((f) => f.endsWith('.json'));
      const labelMap = labelByYearCategory.get(y) ?? new Map<string, string>();

      const categories: CategoryRecord[] = [];
      for (const f of files) {
        const parsed = parseCategoryFile(f);
        if (!parsed) continue;
        const placements = extractPlacements(path.join(yearDir, f));
        if (placements.length === 0) continue;
        categories.push({
          categoryId: parsed.categoryId,
          label: labelMap.get(parsed.categoryId) ?? parsed.categoryId,
          category: parsed.category,
          gender: parsed.gender,
          age: parsed.age,
          bracketHref: `/tournaments/${GENERATION}/${meta.tournamentId}/${y}/${parsed.category}/${parsed.age}/${parsed.gender}`,
          placements,
        });
      }
      if (categories.length === 0) continue;
      categories.sort(sortCategories);

      const info = infoByYear.get(y) ?? null;
      years.push({
        year: Number(y),
        location: info?.location || null,
        startDate: info?.startDate || null,
        endDate: info?.endDate || null,
        categories,
      });
    }
  }

  const championSummary = buildChampionSummary(years);
  const yearsCovered = years.map((y) => y.year);

  return {
    ...meta,
    years,
    championSummary,
    yearsCovered,
  };
}

/** 種目ごとの歴代優勝サマリーを作る */
function buildChampionSummary(years: YearRecord[]): ChampionSummaryRow[] {
  // 種目順を保つため、最初に現れた種目の並びを記録
  const orderIndex = new Map<string, number>();
  const labelById = new Map<string, string>();
  const sample: CategoryRecord[] = [];
  for (const yr of years) {
    for (const c of yr.categories) {
      if (!orderIndex.has(c.categoryId)) {
        orderIndex.set(c.categoryId, sample.length);
        sample.push(c);
        labelById.set(c.categoryId, c.label);
      }
    }
  }
  sample.sort(sortCategories);

  return sample.map((c) => {
    const byYear = years
      .map((yr) => {
        const cat = yr.categories.find((x) => x.categoryId === c.categoryId);
        const winner =
          cat?.placements.find((p) => p.order === 1)?.display ?? null;
        return { year: yr.year, winner };
      })
      .filter((row) => row.winner !== null);
    return {
      categoryId: c.categoryId,
      label: labelById.get(c.categoryId) ?? c.categoryId,
      byYear,
    };
  });
}

/** 一覧ページ用: 各大会の概要 + 収録年度範囲 */
export type TournamentSummary = HsNationalTournamentMeta & {
  yearsCovered: number[];
  latestYear: number | null;
  earliestYear: number | null;
};

export function listHsNationalTournamentSummaries(): TournamentSummary[] {
  return HS_NATIONAL_SLUGS.map((slug) => {
    const records = getHsNationalTournamentRecords(slug);
    const yearsCovered = records.yearsCovered;
    return {
      ...HS_NATIONAL_TOURNAMENTS[slug],
      yearsCovered,
      latestYear: yearsCovered.length ? Math.max(...yearsCovered) : null,
      earliestYear: yearsCovered.length ? Math.min(...yearsCovered) : null,
    };
  });
}
