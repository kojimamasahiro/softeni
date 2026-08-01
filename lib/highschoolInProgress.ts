// lib/highschoolInProgress.ts
//
// 開催中（結果が一部のみ／組み合わせのみ）の高校全国大会について、
// **都道府県別・学校別**に出場エントリーと現在の勝ち上がりを引けるようにするモジュール。
//
// 目的（docs/wiki/seo.md #11）:
// 大会期間中は「{大会}{年}」系クエリの需要がピークになるが、速報クエリで
// テンプレSEOサイトと正面勝負はしない方針。代わりに farm が構造的に持てない
// 「{県名} インターハイ 2026」「{学校名} インターハイ 2026」のロングテールを、
// **既にインデックスされている都道府県ページ・学校ページ**で受ける。
// 残り会期が短いときに新規URLを作っても間に合わないため、既存ページの更新で取る。
//
// このモジュールは getStaticProps からのみ import すること（fs を使用）。

import fs from 'fs';
import path from 'path';

import {
  getPlayerResolver,
  getSchoolResolver,
  HS_NATIONAL_SLUGS,
  HS_NATIONAL_TOURNAMENTS,
  type HsNationalTournamentSlug,
  type PlayerLink,
} from '@/lib/highschoolNationalTournaments';
import { computeResultCoverage } from '@/lib/tournamentCoverage';
import type { TournamentInformationEntry } from '@/types/tournament';

const DETAILS_ROOT = ['data', 'tournaments', 'details'];
const CATEGORY_ORDER: Record<string, number> = { team: 0, doubles: 1, singles: 2 };

/** 1 エントリー（個人はペア、団体は1校）の現在の状況 */
export type InProgressEntryStanding = {
  /** 表示ラベル（例: 4回戦進出 / 3回戦敗退 / ベスト8 / 出場） */
  statusLabel: string;
  /** まだ勝ち上がり中か（true なら「進出」系） */
  alive: boolean;
  /** 選手名＋結果ページへのリンク。団体戦は空配列 */
  playerLinks: PlayerLink[];
};

/** ある学校の、ある種目での出場状況 */
export type InProgressSchoolCategory = {
  categoryId: string;
  /** 例: 男子ダブルス */
  label: string;
  category: string;
  /** その種目の対戦表（全試合結果）ページ */
  bracketHref: string;
  standings: InProgressEntryStanding[];
};

/** ある学校の、開催中大会での出場状況（全種目ぶん） */
export type InProgressSchool = {
  teamName: string;
  /** 学校ページへの href。学校ページが実在しない場合 null */
  teamHref: string | null;
  prefecture: string | null;
  categories: InProgressSchoolCategory[];
  /** 現在まだ勝ち上がり中のエントリーが1つでもあるか（並び順に使う） */
  hasAlive: boolean;
  /** 到達している最深ラウンド（並び順に使う。大きいほど勝ち残っている） */
  deepestRound: number;
};

/** 開催中の大会 1 つぶんの、都道府県または学校向けサマリー */
export type InProgressScope = {
  slug: HsNationalTournamentSlug;
  /** 正式名称 */
  label: string;
  /** 通称（インターハイ 等） */
  shortLabel: string;
  year: number;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  /** 歴代記録ページ（この大会の入口） */
  hubHref: string;
  /** すでに開始しているか（開催前は「組み合わせ」表記にする） */
  hasStarted: boolean;
  /** 結果が1件でも入っているか（false なら「組み合わせのみ」） */
  hasAnyResult: boolean;
  schools: InProgressSchool[];
};

type RawParticipant = {
  id: string;
  lastName?: string | null;
  firstName?: string | null;
  team?: string | null;
  prefecture?: string | null;
};

type RawDetail = {
  participants?: RawParticipant[];
  entries?: Array<{ entryNo: number; playerIds: string[] }>;
  results?: Array<{
    entryNo: number;
    tournament?: { label?: string; rank?: { kind?: string; round?: number; bestLevel?: number } | null } | null;
  }>;
  matches?: Array<{ stage?: string | null; round?: string | null; winnerEntryNo?: number | null }>;
};

function resolveRoot(): string {
  return process.cwd();
}

function readInformation(tournamentId: string): TournamentInformationEntry[] {
  const p = path.join(resolveRoot(), 'data', 'tournaments', 'information', `${tournamentId}.json`);
  if (!fs.existsSync(p)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
    return Array.isArray(parsed) ? (parsed as TournamentInformationEntry[]) : [];
  } catch {
    return [];
  }
}

function parseCategoryFile(fileName: string): { categoryId: string; category: string; age: string; gender: string } | null {
  const base = fileName.replace(/\.json$/, '');
  const parts = base.split('-');
  if (parts.length < 3) return null;
  const gender = parts.pop() as string;
  const age = parts.pop() as string;
  const category = parts.join('-');
  return { categoryId: `${category}-${age}-${gender}`, category, age, gender };
}

/** rank から「どこまで到達したか」を数値化する（並び順用。大きいほど勝ち残り） */
function rankDepth(rank: { kind?: string; round?: number; bestLevel?: number } | null | undefined): number {
  if (!rank) return 0;
  if (rank.kind === 'winner') return 10000;
  if (rank.kind === 'runnerup') return 9000;
  if (rank.kind === 'best') return 8000 - (rank.bestLevel ?? 64);
  return rank.round ?? 0;
}

/**
 * 全高校全国大会を走査し、開催中のものについて
 * 「(都道府県, 性別) → 学校一覧」「(学校名, 都道府県, 性別) → 学校」を引ける索引を作る。
 *
 * ページ生成は 47都道府県×2 + 学校数ぶん呼ばれるため、モジュールスコープで1度だけ構築する。
 */
type Index = {
  byPrefecture: Map<string, InProgressScope[]>;
  bySchool: Map<string, InProgressScope[]>;
};

let cachedIndex: Index | null = null;

function prefKey(prefecture: string, gender: string): string {
  return `${prefecture}::${gender}`;
}

function schoolKey(teamName: string, prefecture: string | null, gender: string): string {
  return `${teamName}::${prefecture ?? ''}::${gender}`;
}

function buildIndex(): Index {
  const byPrefecture = new Map<string, InProgressScope[]>();
  const bySchool = new Map<string, InProgressScope[]>();

  const resolveSchoolHref = getSchoolResolver();
  const resolvePlayerHref = getPlayerResolver();

  for (const slug of HS_NATIONAL_SLUGS) {
    const meta = HS_NATIONAL_TOURNAMENTS[slug];
    const tidDir = path.join(resolveRoot(), ...DETAILS_ROOT, meta.tournamentId);
    if (!fs.existsSync(tidDir)) continue;

    const information = readInformation(meta.tournamentId);
    const infoByYear = new Map(information.map((e) => [e.year, e] as const));
    const labelByYearCategory = new Map<number, Map<string, string>>();
    for (const e of information) {
      labelByYearCategory.set(e.year, new Map((e.categories ?? []).map((c) => [c.categoryId, c.label] as const)));
    }

    const yearDirs = fs
      .readdirSync(tidDir)
      .filter((y) => fs.statSync(path.join(tidDir, y)).isDirectory())
      .map(Number)
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => b - a);

    // 開催中なのは最新年度だけを想定する（過去年度の取り込み途中は対象外）
    for (const year of yearDirs.slice(0, 1)) {
      const yearDir = path.join(tidDir, String(year));
      const info = infoByYear.get(year) ?? null;
      const labelMap = labelByYearCategory.get(year) ?? new Map<string, string>();

      // (prefecture|school, gender) → 学校エントリ
      const schoolsByPrefGender = new Map<string, Map<string, InProgressSchool>>();
      let anyInProgress = false;
      let hasAnyResult = false;

      for (const f of fs.readdirSync(yearDir).filter((n) => n.endsWith('.json'))) {
        const parsed = parseCategoryFile(f);
        if (!parsed) continue;
        let data: RawDetail;
        try {
          data = JSON.parse(fs.readFileSync(path.join(yearDir, f), 'utf-8')) as RawDetail;
        } catch {
          continue;
        }

        const coverage = computeResultCoverage(data);
        if (coverage.status !== 'in_progress' && coverage.status !== 'not_recorded') continue;
        anyInProgress = true;
        if (coverage.status === 'in_progress') hasAnyResult = true;

        const participantById = new Map((data.participants ?? []).map((p) => [p.id, p] as const));
        const resultByEntry = new Map((data.results ?? []).map((r) => [r.entryNo, r] as const));
        const bracketHref = `/tournaments/highschool/${meta.tournamentId}/${year}/${parsed.category}/${parsed.age}/${parsed.gender}`;
        const categoryLabel = labelMap.get(parsed.categoryId) ?? parsed.categoryId;

        for (const entry of data.entries ?? []) {
          const participants = entry.playerIds.map((id) => participantById.get(id)).filter((p): p is RawParticipant => Boolean(p));
          if (participants.length === 0) continue;

          const teamName = participants.find((p) => p.team)?.team ?? null;
          if (!teamName) continue;
          const prefecture = participants.find((p) => p.prefecture)?.prefecture ?? null;

          const result = resultByEntry.get(entry.entryNo);
          const rank = result?.tournament?.rank ?? null;
          const standing: InProgressEntryStanding = {
            statusLabel: result?.tournament?.label ?? '出場',
            alive: rank?.kind === 'ongoing',
            playerLinks: participants
              .filter((p) => p.lastName || p.firstName)
              .map((p) => {
                const name = `${p.lastName ?? ''}${p.firstName ?? ''}`.trim();
                return { name, href: resolvePlayerHref(p.lastName ?? '', p.firstName ?? '') };
              }),
          };

          const key = prefKey(prefecture ?? '', parsed.gender);
          const schoolMap = schoolsByPrefGender.get(key) ?? new Map<string, InProgressSchool>();
          const school = schoolMap.get(teamName) ?? {
            teamName,
            teamHref: resolveSchoolHref(teamName, prefecture, parsed.gender),
            prefecture,
            categories: [],
            hasAlive: false,
            deepestRound: 0,
          };
          let cat = school.categories.find((c) => c.categoryId === parsed.categoryId);
          if (!cat) {
            cat = { categoryId: parsed.categoryId, label: categoryLabel, category: parsed.category, bracketHref, standings: [] };
            school.categories.push(cat);
          }
          cat.standings.push(standing);
          school.hasAlive = school.hasAlive || standing.alive;
          school.deepestRound = Math.max(school.deepestRound, rankDepth(rank));
          schoolMap.set(teamName, school);
          schoolsByPrefGender.set(key, schoolMap);
        }
      }

      if (!anyInProgress) continue;

      const todayIso = new Date().toISOString().slice(0, 10);
      const baseScope = {
        slug,
        label: meta.label,
        shortLabel: meta.shortLabel,
        year,
        location: info?.location || null,
        startDate: info?.startDate || null,
        endDate: info?.endDate || null,
        hubHref: `/highschool/tournaments/${slug}/`,
        hasStarted: Boolean(info?.startDate && info.startDate <= todayIso),
        hasAnyResult,
      };

      for (const [key, schoolMap] of schoolsByPrefGender) {
        const schools = [...schoolMap.values()].sort(sortSchools);
        for (const s of schools) s.categories.sort((a, b) => (CATEGORY_ORDER[a.category] ?? 9) - (CATEGORY_ORDER[b.category] ?? 9));

        const list = byPrefecture.get(key) ?? [];
        list.push({ ...baseScope, schools });
        byPrefecture.set(key, list);

        const [prefecture, gender] = key.split('::');
        for (const s of schools) {
          const sKey = schoolKey(s.teamName, prefecture || null, gender);
          const sList = bySchool.get(sKey) ?? [];
          sList.push({ ...baseScope, schools: [s] });
          bySchool.set(sKey, sList);
        }
      }
    }
  }

  return { byPrefecture, bySchool };
}

/** 勝ち残っている学校を先に、次に到達ラウンドの深い順、最後に校名順 */
function sortSchools(a: InProgressSchool, b: InProgressSchool): number {
  if (a.hasAlive !== b.hasAlive) return a.hasAlive ? -1 : 1;
  if (a.deepestRound !== b.deepestRound) return b.deepestRound - a.deepestRound;
  return a.teamName.localeCompare(b.teamName, 'ja');
}

function getIndex(): Index {
  if (!cachedIndex) cachedIndex = buildIndex();
  return cachedIndex;
}

/** 指定した都道府県・性別の、開催中大会の出場校一覧。無ければ空配列 */
export function getPrefectureInProgress(prefectureName: string, gender: 'boys' | 'girls'): InProgressScope[] {
  return getIndex().byPrefecture.get(prefKey(prefectureName, gender)) ?? [];
}

/** 指定した学校の、開催中大会での出場状況。無ければ空配列 */
export function getSchoolInProgress(teamName: string, prefectureName: string | null, gender: 'boys' | 'girls'): InProgressScope[] {
  return getIndex().bySchool.get(schoolKey(teamName, prefectureName, gender)) ?? [];
}
