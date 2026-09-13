// lib/university.ts
//
// 大学カテゴリ（/university）のデータ読み込み。中身は「高校 → 大学」の進路データだけで、
// 生成は scripts/build-university-pathways.mjs、採用条件もそちらのヘッダに書いてある。
//
// 大学は `participants[].prefecture` が `日本学連`/`学連` で地域軸が無いため、
// 小中高のような「都道府県 → チーム」のツリーは作らない。進路から大学を探す構成にしている。
// 経緯: docs/wiki/university.md
//
// fs を使うため getStaticProps からのみ import すること。

import fs from 'fs';
import path from 'path';

export type UniversityGender = 'boys' | 'girls';

export interface UniversityPathwayRecord {
  player: string;
  highschool: string;
  highschoolPrefecture: string | null;
  highschoolLastYear: number;
  universityFirstYear: number;
  /** 性別。mixed のみに出ている選手は null（男女どちらのページにも出す） */
  gender: UniversityGender | null;
  /** 採用根拠（pair / name）。UIには出さない */
  basis: 'pair' | 'name';
}

interface PathwayFile {
  maxYearGap: number;
  pathways: Record<string, UniversityPathwayRecord[]>;
}

let fileCache: PathwayFile | null = null;

function load(): PathwayFile {
  if (fileCache) return fileCache;
  try {
    fileCache = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'university', 'pathways.json'), 'utf-8')) as PathwayFile;
  } catch {
    fileCache = { maxYearGap: 4, pathways: {} };
  }
  return fileCache;
}

const matchesGender = (r: UniversityPathwayRecord, gender: UniversityGender) => r.gender === null || r.gender === gender;

/** 採用条件の年差（ページの注記に出す） */
export function getMaxYearGap(): number {
  return load().maxYearGap;
}

/** 大学別の出身高校一覧（/university/pathways/[gender]/）での、大学ごとの見出しアンカー */
export function universityAnchor(university: string): string {
  return `u-${university}`;
}

export function universityPathwaysHref(university: string, gender: UniversityGender): string {
  return `/university/pathways/${gender}/#${universityAnchor(university)}`;
}

let teamHrefCache: Map<string, string> | null = null;

/**
 * 大学のチームページ（/teams/[teamId]）が存在すればそのパス。
 * `/teams` のページは team-name-mappings.json のキーと STリーグ出場チームにしか無い。
 * 大学は 2026-09-14 に収録試合数100以上の38校を mapping に入れた（docs/wiki/university.md）。
 */
export function getUniversityTeamHref(university: string): string | null {
  if (!teamHrefCache) {
    teamHrefCache = new Map();
    try {
      const mappings = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'teams', 'team-name-mappings.json'), 'utf-8')) as Record<string, string[]>;
      for (const [id, names] of Object.entries(mappings)) for (const n of names) if (!teamHrefCache.has(n)) teamHrefCache.set(n, `/teams/${id}/`);
    } catch {
      // mappings が無ければリンクしない
    }
  }
  return teamHrefCache.get(university) ?? null;
}

/** 大学（性別ごと）と、そこへ進学した高校のまとまり */
export interface UniversityGroup {
  university: string;
  highschools: {
    highschool: string;
    prefecture: string | null;
    players: { name: string; highschoolLastYear: number; universityFirstYear: number }[];
  }[];
  playerCount: number;
}

/**
 * **大学から見た「出身高校」**のまとまり。
 * 大学が主語なのは、大学側にページがほとんど無く、この一覧が大学の受け皿になるため
 * （「{大学名} ソフトテニス部」需要）。高校起点の見え方は高校の学校ページの「進路」節が担当する。
 *
 * 並びは中学版（getFeederGroups）と同じく「出身校の種類が多い順 → 人数が多い順 → 名前」。
 */
export function getUniversityGroups(gender: UniversityGender): UniversityGroup[] {
  const groups: UniversityGroup[] = [];
  for (const [university, records] of Object.entries(load().pathways)) {
    const byHs = new Map<string, UniversityGroup['highschools'][number]>();
    let playerCount = 0;
    for (const r of records) {
      if (!matchesGender(r, gender)) continue;
      const key = `${r.highschool}\t${r.highschoolPrefecture ?? ''}`;
      const hs = byHs.get(key) ?? { highschool: r.highschool, prefecture: r.highschoolPrefecture, players: [] };
      hs.players.push({ name: r.player, highschoolLastYear: r.highschoolLastYear, universityFirstYear: r.universityFirstYear });
      byHs.set(key, hs);
      playerCount += 1;
    }
    if (playerCount === 0) continue;
    const highschools = [...byHs.values()];
    for (const h of highschools) h.players.sort((a, b) => b.universityFirstYear - a.universityFirstYear || a.name.localeCompare(b.name, 'ja'));
    highschools.sort(
      (a, b) =>
        b.players.length - a.players.length ||
        b.players[0].universityFirstYear - a.players[0].universityFirstYear ||
        (a.prefecture ?? '').localeCompare(b.prefecture ?? '', 'ja') ||
        a.highschool.localeCompare(b.highschool, 'ja'),
    );
    groups.push({ university, highschools, playerCount });
  }
  return groups.sort((a, b) => b.highschools.length - a.highschools.length || b.playerCount - a.playerCount || a.university.localeCompare(b.university, 'ja'));
}

export interface UniversityPathwayLink {
  href: string;
  /** 出身高校を追跡できた選手の数 */
  playerCount: number;
}

/**
 * チームページ（/teams/[teamId]）から、その大学の「出身高校」一覧へのリンク。
 * `names` は team-name-mappings.json の表記の配列（改称校は旧称も含む）。
 * 複数の表記が一覧に出ている場合は人数の多い表記の見出しへ飛ばし、人数は合算する。
 */
export function getUniversityPathwayLinks(names: string[]): Record<UniversityGender, UniversityPathwayLink | null> {
  const result: Record<UniversityGender, UniversityPathwayLink | null> = { boys: null, girls: null };
  for (const gender of ['boys', 'girls'] as const) {
    const hits = getUniversityGroups(gender).filter((g) => names.includes(g.university));
    if (hits.length === 0) continue;
    const main = hits.reduce((a, b) => (b.playerCount > a.playerCount ? b : a));
    result[gender] = { href: universityPathwaysHref(main.university, gender), playerCount: hits.reduce((n, g) => n + g.playerCount, 0) };
  }
  return result;
}

/** 高校の学校ページに出す「進学先大学」の1行 */
export interface UniversityDestination {
  university: string;
  /** 大学別の出身高校一覧の、その大学の見出しへのリンク */
  href: string;
  players: { name: string; highschoolLastYear: number; universityFirstYear: number }[];
}

let destinationCache: Map<string, UniversityDestination[]> | null = null;

/**
 * 高校の学校ページ（/highschool/[gender]/[prefectureId]/[teamId]）の「進学先大学」。
 * 高校名は大会データの participants[].team と学校ページの teamName が同じ正準名である前提
 * （lib/highschoolFeederSchools.ts と同じ）。
 */
export function getUniversityDestinations(highschool: string, prefecture: string | null, gender: string): UniversityDestination[] {
  if (!destinationCache) {
    const out = new Map<string, Map<string, UniversityDestination>>();
    for (const [university, records] of Object.entries(load().pathways)) {
      for (const r of records) {
        const genders: UniversityGender[] = r.gender ? [r.gender] : ['boys', 'girls'];
        for (const g of genders) {
          const hsKey = `${r.highschool}\t${r.highschoolPrefecture ?? ''}\t${g}`;
          const byUniv = out.get(hsKey) ?? new Map<string, UniversityDestination>();
          const entry = byUniv.get(university) ?? { university, href: universityPathwaysHref(university, g), players: [] };
          entry.players.push({ name: r.player, highschoolLastYear: r.highschoolLastYear, universityFirstYear: r.universityFirstYear });
          byUniv.set(university, entry);
          out.set(hsKey, byUniv);
        }
      }
    }
    destinationCache = new Map();
    for (const [hsKey, byUniv] of out) {
      const list = [...byUniv.values()];
      for (const e of list) e.players.sort((a, b) => b.universityFirstYear - a.universityFirstYear || a.name.localeCompare(b.name, 'ja'));
      list.sort(
        (a, b) =>
          b.players.length - a.players.length ||
          b.players[0].universityFirstYear - a.players[0].universityFirstYear ||
          a.university.localeCompare(b.university, 'ja'),
      );
      destinationCache.set(hsKey, list);
    }
  }
  return destinationCache.get(`${highschool}\t${prefecture ?? ''}\t${gender}`) ?? [];
}

export interface UniversityStats {
  /** 掲載した進路の件数（＝選手数） */
  records: number;
  universities: number;
  /** 中学 → 高校の進路にも出ていて、高校名が一致する選手（中学から大学まで追跡できた人数） */
  fromSecondarySchool: number;
  boys: { universities: number; records: number };
  girls: { universities: number; records: number };
}

export function getUniversityStats(): UniversityStats {
  const all = Object.values(load().pathways).flat();

  // 中学 → 高校の進路（data/secondaryschool/pathways.json）と高校名で繋がる選手
  const hsByPlayer = new Map<string, string>();
  try {
    const jhs = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'secondaryschool', 'pathways.json'), 'utf-8')) as {
      pathways: Record<string, { player: string; highschool: string }[]>;
    };
    for (const records of Object.values(jhs.pathways ?? {})) for (const r of records) hsByPlayer.set(r.player, r.highschool);
  } catch {
    // 中学の進路が無ければ0
  }

  const byGender = (g: UniversityGender) => {
    const groups = getUniversityGroups(g);
    return { universities: groups.length, records: groups.reduce((n, x) => n + x.playerCount, 0) };
  };

  return {
    records: all.length,
    universities: Object.keys(load().pathways).length,
    fromSecondarySchool: all.filter((r) => hsByPlayer.get(r.player) === r.highschool).length,
    boys: byGender('boys'),
    girls: byGender('girls'),
  };
}

export interface UniversityTournamentLink {
  tournamentId: string;
  label: string;
  href: string;
}

/** 大学の大会ハブ。大会軸は既存の /tournaments/university/[tournamentId]/ へ寄せる（ADR-010） */
export function getUniversityTournaments(): UniversityTournamentLink[] {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'tournaments', 'index.json'), 'utf-8')) as {
      tournamentId: string;
      generationId: string;
      label: string;
    }[];
    return list
      .filter((t) => t.generationId === 'university')
      .map((t) => ({ tournamentId: t.tournamentId, label: t.label, href: `/tournaments/university/${t.tournamentId}/` }));
  } catch {
    return [];
  }
}
