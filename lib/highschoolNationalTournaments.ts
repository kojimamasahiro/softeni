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
export type HsNationalTournamentSlug = 'championship' | 'japan-cup' | 'senbatsu';

export type HsNationalTournamentMeta = {
  slug: HsNationalTournamentSlug;
  tournamentId: string;
  /** 正式名称 */
  label: string;
  /** 短縮・通称（見出し向け） */
  shortLabel: string;
  /**
   * 検索略称（例: ハイジャパ）。タイトル/見出し/FAQ に literal で出して
   * 略称クエリを拾うために使う。専用ページは作らず、この大会ハブに集約する。
   * 詳細は docs/wiki/seo.md #3。
   */
  aliases?: string[];
  officialUrl: string;
  /** カードや概要に出す短い説明 */
  description: string;
};

/** 高校カテゴリで歴代記録を出す全国大会の定義 */
export const HS_NATIONAL_TOURNAMENTS: Record<HsNationalTournamentSlug, HsNationalTournamentMeta> = {
  championship: {
    slug: 'championship',
    tournamentId: 'highschool-championship',
    label: '全国高等学校総合体育大会',
    shortLabel: 'インターハイ',
    officialUrl: 'https://www.zen-koutairen.com/',
    description:
      '全国高等学校総合体育大会（インターハイ）ソフトテニス競技は、各都道府県予選を勝ち上がった代表が男子・女子の団体戦と個人戦（ダブルス）で全国一を争う、高校ソフトテニス最大級の全国大会です。本ページでは歴代の優勝校・準優勝・ベスト4を年度別・種目別にまとめています。',
  },
  'japan-cup': {
    slug: 'japan-cup',
    tournamentId: 'highschool-japan-cup',
    label: 'ハイスクールジャパンカップ',
    shortLabel: 'ハイスクールジャパンカップ',
    aliases: ['ハイジャパ'],
    officialUrl: 'https://www.gosen-sp.jp/hjs/',
    description:
      'ゴーセン杯争奪ハイスクールジャパンカップ（通称「ハイジャパ」）は、高校生個人の日本一を決めるソフトテニスの全国大会です。男子・女子それぞれシングルスとダブルスを実施し、各地区の代表選手が頂点を争います。本ページでは歴代の優勝・準優勝・ベスト4を年度別・種目別にまとめ、出場校の戦績ページへもリンクしています。',
  },
  senbatsu: {
    slug: 'senbatsu',
    tournamentId: 'highschool-senbatsu',
    label: '全日本高等学校選抜ソフトテニス大会',
    shortLabel: '高校選抜',
    aliases: ['高校選抜'],
    officialUrl: 'https://www.zen-koutairen.com/',
    description:
      '全日本高等学校選抜ソフトテニス大会（高校選抜）は、毎年3月に開催される男子・女子の団体戦の全国大会です。各地区予選を勝ち上がった代表校が、新チームでの日本一を争います。インターハイ・ハイスクールジャパンカップと並ぶ高校三大タイトルの一つで、本ページでは歴代の優勝校・準優勝・ベスト4を年度別にまとめています。',
  },
};

export const HS_NATIONAL_SLUGS = Object.keys(HS_NATIONAL_TOURNAMENTS) as HsNationalTournamentSlug[];

// tournamentId（例: 'highschool-championship'）から高校全国大会のスラッグを逆引きする。
// 汎用大会ハブ（/tournaments/[generation]/[tournamentId]）が高校全国大会の歴代まとめ
// （/highschool/tournaments/[tournament]）とカニバるため、ハブ側の noindex 判定と
// 高校歴代ページへの内部リンク生成に使う。詳細は docs/wiki/seo.md #3。
export function getHsNationalSlugByTournamentId(tournamentId: string): HsNationalTournamentSlug | null {
  return HS_NATIONAL_SLUGS.find((slug) => HS_NATIONAL_TOURNAMENTS[slug].tournamentId === tournamentId) ?? null;
}

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

/** 所属校と、その学校ページへのリンク（実在しない場合 href=null） */
export type TeamLink = {
  name: string;
  href: string | null;
};

/** 選手名と、その試合結果ページへのリンク（結果ページが無い場合 href=null） */
export type PlayerLink = {
  name: string;
  href: string | null;
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
  /** 選手名＋試合結果ページへのリンク（players と同じ並び。団体戦は空配列） */
  playerLinks: PlayerLink[];
  /** 所属校 */
  teams: string[];
  /** 所属校＋学校ページへのリンク（teams と同じ並び） */
  teamLinks: TeamLink[];
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

/** 歴代優勝サマリーの 1 セル（年度ごとの優勝） */
export type ChampionCell = {
  year: number;
  /** 表示用の文字列（個人: 選手名（所属） / 団体: 校名）。優勝者不明の年は null */
  winner: string | null;
  /** 選手名一覧（団体戦は空配列） */
  players: string[];
  /** 選手名＋試合結果ページへのリンク（players と同じ並び。団体戦は空配列） */
  playerLinks: PlayerLink[];
  /** 所属校 */
  teams: string[];
  /** 所属校＋学校ページへのリンク（teams と同じ並び） */
  teamLinks: TeamLink[];
  /** 都道府県 */
  prefectures: string[];
};

/** 歴代優勝サマリーの 1 行（種目ごと） */
export type ChampionSummaryRow = {
  categoryId: string;
  label: string;
  byYear: ChampionCell[];
};

/** まだ結果データが無い、開催予定（または開催中）の大会 */
export type UpcomingEdition = {
  year: number;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  /** 実施予定の種目ラベル一覧 */
  categoryLabels: string[];
  source: string | null;
  sourceUrl: string | null;
};

export type TournamentRecords = HsNationalTournamentMeta & {
  years: YearRecord[];
  championSummary: ChampionSummaryRow[];
  /** information にあり、まだ結果が無い開催予定（新しい年が先） */
  upcoming: UpcomingEdition[];
  /** 収録情報の最終更新日（ISO 日付）。構造化データの dateModified 用 */
  lastModified: string | null;
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
  const infoPath = path.join(resolveRoot(), 'data', 'tournaments', 'information', `${tournamentId}.json`);
  if (!fs.existsSync(infoPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    return Array.isArray(parsed) ? (parsed as TournamentInformationEntry[]) : [];
  } catch {
    return [];
  }
}

/** rank から並び順とラベルを決める。対象外なら null。 */
function classifyRank(rank: RawRank | undefined): { order: number; rankLabel: string } | null {
  if (!rank) return null;
  if (rank.kind === 'winner') return { order: 1, rankLabel: '優勝' };
  if (rank.kind === 'runnerup') return { order: 2, rankLabel: '準優勝' };
  if (rank.kind === 'best' && rank.bestLevel === 4) {
    return { order: 3, rankLabel: 'ベスト4' };
  }
  return null;
}

/**
 * 学校名・都道府県・性別から、実在する学校ページの href を返すリゾルバ。
 * data/highschool/prefectures/<prefId>/summary.json を唯一の正とし、
 * そこに存在する (teamId, prefectureId, gender) のみリンクする（デッドリンク防止）。
 * モジュールスコープで一度だけ構築してキャッシュする。
 */
type SchoolResolver = (name: string, prefecture: string | null, gender: string) => string | null;

type SchoolEntry = {
  prefectureId: string;
  teamId: string;
  gender: string;
  prefecture: string | null;
};

let cachedSchoolResolver: SchoolResolver | null = null;

function getSchoolResolver(): SchoolResolver {
  if (cachedSchoolResolver) return cachedSchoolResolver;

  const byName = new Map<string, SchoolEntry[]>();
  const prefRoot = path.join(resolveRoot(), 'data', 'highschool', 'prefectures');

  try {
    for (const prefId of fs.readdirSync(prefRoot)) {
      const summaryPath = path.join(prefRoot, prefId, 'summary.json');
      if (!fs.existsSync(summaryPath)) continue;
      let entries: Array<{
        team?: string;
        teamId?: string;
        prefecture?: string | null;
        gender?: string;
      }>;
      try {
        entries = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
      } catch {
        continue;
      }
      if (!Array.isArray(entries)) continue;
      for (const e of entries) {
        if (!e.team || !e.teamId || !e.gender) continue;
        const list = byName.get(e.team) ?? [];
        list.push({
          prefectureId: prefId,
          teamId: e.teamId,
          gender: e.gender,
          prefecture: e.prefecture ?? null,
        });
        byName.set(e.team, list);
      }
    }
  } catch {
    // prefectures ディレクトリが無い等。リンク無しで継続。
  }

  // mixed はどの性別ページにも出る規約（[teamId].tsx の isVisibleGender に合わせる）
  const visible = (entryGender: string, target: string) => entryGender === target || entryGender === 'mixed';

  cachedSchoolResolver = (name, prefecture, gender) => {
    if (gender !== 'boys' && gender !== 'girls') return null;
    const cands = (byName.get(name) ?? []).filter((c) => visible(c.gender, gender));
    // 同名校は都道府県で絞り込み
    const narrowed = prefecture && cands.some((c) => c.prefecture === prefecture) ? cands.filter((c) => c.prefecture === prefecture) : cands;
    const unique = new Map(narrowed.map((c) => [`${c.prefectureId}/${c.teamId}`, c] as const));
    if (unique.size !== 1) return null;
    const only = unique.values().next().value as SchoolEntry;
    return `/highschool/${gender}/${only.prefectureId}/${only.teamId}`;
  };

  return cachedSchoolResolver;
}

/**
 * 姓名から、その選手の試合結果ページ（/players/{id}/results）の href を返すリゾルバ。
 * data/players/index.json を唯一の正とし、結果ページが実在する選手（count>=5、
 * results.tsx の getStaticPaths と同条件）のみリンクする（デッドリンク防止）。
 * 同姓同名は最初の ID を使う（players/index.tsx・学校ページと同じ規約）。
 * モジュールスコープで一度だけ構築してキャッシュする。
 */
type PlayerResolver = (lastName: string, firstName: string) => string | null;

let cachedPlayerResolver: PlayerResolver | null = null;

function getPlayerResolver(): PlayerResolver {
  if (cachedPlayerResolver) return cachedPlayerResolver;

  const nameToId = new Map<string, number>();
  const indexPath = path.join(resolveRoot(), 'data', 'players', 'index.json');

  try {
    const arr = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as Array<{
      id: number;
      lastName: string;
      firstName: string;
      count?: number;
    }>;
    for (const p of arr) {
      if ((p.count ?? 0) < 5) continue; // 結果ページが無い選手はリンクしない
      const key = `${p.lastName}::${p.firstName}`;
      if (!nameToId.has(key)) nameToId.set(key, p.id);
    }
  } catch {
    // index.json が無い/壊れている場合はリンク無しで継続
  }

  cachedPlayerResolver = (lastName, firstName) => {
    if (!lastName && !firstName) return null;
    const id = nameToId.get(`${lastName}::${firstName}`);
    return id !== undefined ? `/players/${id}/results` : null;
  };

  return cachedPlayerResolver;
}

/** entry を選手名・所属・都道府県・表示文字列へ解決する */
function resolveEntry(
  entry: RawEntry,
  participantById: Map<string, RawParticipant>,
  gender: string,
  resolveSchoolHref: SchoolResolver,
  resolvePlayerHref: PlayerResolver,
): Pick<RecordPlacement, 'display' | 'players' | 'playerLinks' | 'teams' | 'teamLinks' | 'prefectures'> {
  const players: string[] = [];
  const playerLinks: PlayerLink[] = [];
  const teams: string[] = [];
  const prefectures: string[] = [];
  const prefByTeam = new Map<string, string | null>();

  for (const id of entry.playerIds) {
    const p = participantById.get(id);
    if (!p) {
      // 参加者情報が無い場合は id をそのまま名前として扱う（リンク無し）
      players.push(id);
      playerLinks.push({ name: id, href: null });
      continue;
    }
    const name = `${p.lastName ?? ''}${p.firstName ?? ''}`.trim();
    if (name) {
      players.push(name);
      playerLinks.push({
        name,
        href: resolvePlayerHref(p.lastName ?? '', p.firstName ?? ''),
      });
    }
    if (p.team && !teams.includes(p.team)) {
      teams.push(p.team);
      prefByTeam.set(p.team, p.prefecture ?? null);
    }
    if (p.prefecture && !prefectures.includes(p.prefecture)) {
      prefectures.push(p.prefecture);
    }
  }

  const teamLinks: TeamLink[] = teams.map((name) => ({
    name,
    href: resolveSchoolHref(name, prefByTeam.get(name) ?? null, gender),
  }));

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

  return { display, players, playerLinks, teams, teamLinks, prefectures };
}

/** 1 種目ファイルから上位入賞（優勝〜ベスト4）を抽出 */
function extractPlacements(detailPath: string, gender: string, resolveSchoolHref: SchoolResolver, resolvePlayerHref: PlayerResolver): RecordPlacement[] {
  let data: RawDetail;
  try {
    data = JSON.parse(fs.readFileSync(detailPath, 'utf-8')) as RawDetail;
  } catch {
    return [];
  }

  const participantById = new Map<string, RawParticipant>((data.participants ?? []).map((p) => [p.id, p] as const));
  const entryByNo = new Map<number, RawEntry>((data.entries ?? []).map((e) => [e.entryNo, e] as const));

  const placements: RecordPlacement[] = [];
  for (const result of data.results ?? []) {
    const classified = classifyRank(result.tournament?.rank);
    if (!classified) continue;
    const entry = entryByNo.get(result.entryNo);
    if (!entry) continue;
    const resolved = resolveEntry(entry, participantById, gender, resolveSchoolHref, resolvePlayerHref);
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
export function getHsNationalTournamentRecords(slug: HsNationalTournamentSlug): TournamentRecords {
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

  const resolveSchoolHref = getSchoolResolver();
  const resolvePlayerHref = getPlayerResolver();
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
        const placements = extractPlacements(path.join(yearDir, f), parsed.gender, resolveSchoolHref, resolvePlayerHref);
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

  // information にあるが結果（details）がまだ無い年 = 開催予定（または集計待ち）
  const resultYears = new Set(yearsCovered);
  const upcoming: UpcomingEdition[] = information
    .filter((e) => !resultYears.has(e.year))
    .sort((a, b) => b.year - a.year)
    .map((e) => ({
      year: e.year,
      location: e.location || null,
      startDate: e.startDate || null,
      endDate: e.endDate || null,
      categoryLabels: (e.categories ?? []).map((c) => c.label),
      source: e.source || null,
      sourceUrl: e.sourceUrl || null,
    }));

  // 構造化データ dateModified 用に、information 中の最新日付を採用
  const allDates = information.flatMap((e) => [e.endDate, e.startDate]).filter((d): d is string => Boolean(d));
  const lastModified = allDates.length > 0 ? allDates.sort().slice(-1)[0] : null;

  return {
    ...meta,
    years,
    championSummary,
    upcoming,
    lastModified,
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
    const byYear: ChampionCell[] = years
      .map((yr) => {
        const cat = yr.categories.find((x) => x.categoryId === c.categoryId);
        const champ = cat?.placements.find((p) => p.order === 1) ?? null;
        return {
          year: yr.year,
          winner: champ?.display ?? null,
          players: champ?.players ?? [],
          playerLinks: champ?.playerLinks ?? [],
          teams: champ?.teams ?? [],
          teamLinks: champ?.teamLinks ?? [],
          prefectures: champ?.prefectures ?? [],
        };
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
