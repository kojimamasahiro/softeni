// lib/delegation.ts
//
// 「これから開催される国際大会の**日本代表選手団**」を読み、大会ハブと選手ページに出す。
//
// 経緯（docs/wiki/upcoming-tournaments-runbook.md S9）:
// 第1弾では代表を名乗らず「予選会の上位進出者」だけを出していた。予選会はシングルスのみで
// 団体・混合の選考は別経路のため、当サイトのデータからは代表が導出できなかったためで、
// ランブックの「やらないと決めたこと」にも *連盟・主催者の公式発表を待つ* と書いてある。
// 2026-07-15 提出の JOC 名簿でその条件が満たされたので、名簿を一次データとして持ち込む。
//
// **名簿は当サイトが導出したものではなく、外部の公式発表の転記**である。そのため
// `source` / `sourceUrl` / `announcedOn` を必ずデータ側に持たせ、描画側で出典を併記する。
// 逆に、名簿に書かれていないこと（混合ダブルスのペア構成など）は推測して足さない。
//
// 予選会ブロック（lib/qualifierFinishers.ts）との関係:
// 名簿がある大会では**名簿が優先**し、予選会ブロックは出さない。予選会の上位4人には
// 代表に選ばれていない選手が混ざり（2026年のアジア競技大会では8人中3人）、
// 名簿がある状態でそれを併記すると誤読を招くため。名簿が無い大会（world-championship 等）は
// 従来どおり予選会ブロックが受け持つ。

import fs from 'fs';
import path from 'path';

import type { TournamentInformationEntry } from '@/types/tournament';

import { getPlayerStatistics } from './playerStats/playerStatistics';

/** `data/tournaments/delegations/*.json` 1件ぶん（ファイルの生の形）。 */
export type DelegationSource = {
  tournamentId: string;
  /** 対応する開催情報（information）の年。この年の回の代表であることを示す */
  year: number;
  label: string;
  /** 発表日（YYYY-MM-DD）。不明なら null */
  announcedOn: string | null;
  source: string;
  sourceUrl: string;
  /** 入力時のメモ。**公開ページには出さない**（information の `note` と同じ扱い） */
  note?: string;
  members: DelegationMemberSource[];
};

export type DelegationMemberSource = {
  lastName: string;
  firstName: string;
  kanaLast?: string;
  kanaFirst?: string;
  gender: 'boys' | 'girls';
  /** 名簿に書かれた所属（正式名称）。サイト内の略称へは寄せない */
  affiliation: string;
  /** 学生の場合の学年表記（例: 日本体育大学4年）。無ければ null */
  schoolYear?: string | null;
  /** 出場種目。information の `categories[].categoryId` と対応する */
  categoryIds: string[];
};

/** 描画用に選手ページ・通算成績を解決したあとの1人ぶん。 */
export type DelegationMember = {
  name: string;
  kana: string | null;
  affiliation: string;
  schoolYear: string | null;
  /** 選手ページを持つ場合の数値 id */
  playerId: number | null;
  /** 出場種目の表示ラベル（information の categories から解決。未解決の id は落とす） */
  categoryLabels: string[];
  /** 当サイト収録分の通算成績。選手ページを持たない場合などは null */
  record: { matches: number; wins: number; losses: number; winRate: number } | null;
};

export type DelegationBlock = {
  label: string;
  announcedOn: string | null;
  source: string;
  sourceUrl: string;
  /** 性別ラベル（男子/女子）ごと。名簿の並び順を保つ */
  groups: { genderLabel: string; members: DelegationMember[] }[];
};

const GENDER_LABEL: Record<string, string> = { boys: '男子', girls: '女子' };

/** 大会ハブ・選手ページの両方が使う、名簿ファイルの読み込み（プロセス内キャッシュ）。 */
let cachedSources: DelegationSource[] | null = null;

export function loadDelegationSources(): DelegationSource[] {
  if (cachedSources) return cachedSources;

  // nft（output file tracing）が静的解決できるよう、パスセグメントはリテラルで書く。
  // 詳細: docs/wiki/deployment.md「output file tracing（nft）のワイルドカード走査」
  const dir = path.join(process.cwd(), 'data', 'tournaments', 'delegations');
  if (!fs.existsSync(dir)) {
    cachedSources = [];
    return cachedSources;
  }

  const out: DelegationSource[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as DelegationSource;
      if (parsed?.tournamentId && Array.isArray(parsed.members)) out.push(parsed);
    } catch {
      // 壊れたファイルは読み飛ばす（代表ブロックが出ないだけで他は壊れない）
    }
  }
  cachedSources = out;
  return out;
}

/** `tournamentId` と開催年から名簿を引く。無ければ null。 */
export function findDelegationSource(tournamentId: string, year: number | null | undefined): DelegationSource | null {
  if (year === null || year === undefined) return null;
  return loadDelegationSources().find((d) => d.tournamentId === tournamentId && d.year === year) ?? null;
}

/**
 * 選手ページ側（純関数 `buildUpcomingInternationalLinks`）へ渡す索引。
 *
 * `本大会ID -> { year, 出典, '姓::名' -> categoryIds }`。
 * 純関数に fs を持ち込まないための形で、種目の**表示ラベルは持たない**
 * （呼ばれた先で information の categories から解決する）。
 */
export type DelegationLookup = Map<
  string,
  {
    year: number;
    source: string;
    sourceUrl: string;
    announcedOn: string | null;
    members: Map<string, string[]>;
  }
>;

export function buildDelegationLookup(): DelegationLookup {
  const lookup: DelegationLookup = new Map();
  for (const d of loadDelegationSources()) {
    lookup.set(d.tournamentId, {
      year: d.year,
      source: d.source,
      sourceUrl: d.sourceUrl,
      announcedOn: d.announcedOn ?? null,
      members: new Map(d.members.map((m) => [`${m.lastName}::${m.firstName}`, m.categoryIds ?? []])),
    });
  }
  return lookup;
}

/** categoryId -> 表示ラベル。information に無い id は解決できないので落とす。 */
export function resolveCategoryLabels(categoryIds: string[], edition: TournamentInformationEntry | null): string[] {
  const byId = new Map((edition?.categories ?? []).map((c) => [c.categoryId, c.label]));
  return categoryIds.map((id) => byId.get(id)).filter((l): l is string => Boolean(l));
}

/**
 * 大会ハブに出す代表選手ブロックを組み立てる。
 *
 * @param tournamentId    本大会の tournamentId（例: `asian-games`）
 * @param edition         これから開催される回の開催情報。種目ラベルの解決に使う
 * @param playerNameToId  `姓::名` -> 選手ページの数値 id
 */
export async function getDelegationBlock(args: {
  tournamentId: string;
  edition: TournamentInformationEntry | null;
  playerNameToId: Map<string, number>;
}): Promise<DelegationBlock | null> {
  const { tournamentId, edition, playerNameToId } = args;

  const source = findDelegationSource(tournamentId, edition?.year ?? null);
  if (!source || source.members.length === 0) return null;

  const byGender = new Map<string, DelegationMember[]>();

  for (const m of source.members) {
    const playerId = playerNameToId.get(`${m.lastName}::${m.firstName}`) ?? null;
    const list = byGender.get(m.gender) ?? [];
    list.push({
      name: `${m.lastName}${m.firstName}`,
      kana: m.kanaLast || m.kanaFirst ? `${m.kanaLast ?? ''}${m.kanaFirst ?? ''}` : null,
      affiliation: m.affiliation,
      schoolYear: m.schoolYear ?? null,
      playerId,
      categoryLabels: resolveCategoryLabels(m.categoryIds ?? [], edition),
      record: playerId !== null ? await loadRecord(playerId) : null,
    });
    byGender.set(m.gender, list);
  }

  const groups = [...byGender.entries()]
    // 名簿の並び順をそのまま保つ（連盟が付けた順序に意味があるため並べ替えない）
    .map(([gender, members]) => ({ genderLabel: GENDER_LABEL[gender] ?? gender, members }))
    .sort((a, b) => ['男子', '女子'].indexOf(a.genderLabel) - ['男子', '女子'].indexOf(b.genderLabel));

  return {
    label: source.label,
    announcedOn: source.announcedOn ?? null,
    source: source.source,
    sourceUrl: source.sourceUrl,
    groups,
  };
}

/** 通算成績（当サイト収録分）。引けなければ null。lib/qualifierFinishers.ts と同じ引き方。 */
async function loadRecord(playerId: number): Promise<DelegationMember['record']> {
  try {
    const stats = await getPlayerStatistics(playerId, { sections: ['career'] });
    const m = stats?.career?.overall?.matches;
    if (!m || m.total === 0) return null;
    return { matches: m.total, wins: m.wins, losses: m.losses, winRate: m.winRate };
  } catch {
    return null;
  }
}
