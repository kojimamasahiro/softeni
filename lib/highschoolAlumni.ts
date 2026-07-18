// lib/highschoolAlumni.ts
// 学校ページ「主な卒業生」の集計ロジック（Phase 2、2026-07-18 要件確定）。
// 定義: 「当サイト収録の高校全国大会に本校所属で出場し、卒業後も収録大会に出場した選手」。
// - 在籍判定: 高校3大会（IH / ハイジャパ / 選抜）の participants に当該校所属で出現
// - 卒業後判定: 高校最終出現年 +1 以降に、大学・社会人・国際大会 or STリーグに別チームで出現
//   （+1 で区切ることで中学生の同姓同名の混入を防ぐ）
// - 掲載閾値: 選手結果ページ実在（players/index.json count>=5）AND
//   （全日本系大会でベスト8以上 or STリーグ出場 or 国際大会出場)
// - ランキング配点には使わない（強豪校ランキングの定義は高校の成績のまま）
// 要件・経緯: docs/raw/2026-07-17-idea-highschool-strong-school-ranking.md
// 同姓同名は名前ベース名寄せの既存規約（players/index.json の最初の id、改姓は追跡しない）に従う。

import fs from 'fs';
import path from 'path';

/** 在籍判定に使う高校全国大会 */
const HS_TOURNAMENTS = ['highschool-championship', 'highschool-japan-cup', 'highschool-senbatsu'];

/** 国際大会（出場のみで掲載条件を満たす） */
const INTL_TOURNAMENTS = new Set([
  'international-hiroshima-peacecup',
  'international-korea-cup',
  'yonex-hokkaido-international',
  'world-championship-qualifier',
  'asian-championship-qualifier',
  'asian-games-qualifier',
]);

/** 全日本主要（ベスト8以上で掲載条件を満たす・実績表示の優先度高） */
const MAJOR_TOURNAMENTS = new Set(['zennihon-championship', 'zennihon-indoor', 'zennihon-singles']);

/** その他の大学・社会人大会（ベスト8以上で掲載条件を満たす） */
const OTHER_ADULT_TOURNAMENTS = new Set([
  'zennihon-business-group',
  'zennihon-university',
  'zennihon-university-indoor',
  'zennihon-university-ouza',
  'zennihon-workers',
  'zennihon-mixed',
  'east-japan',
  'west-japan',
  'lucent-tokyo-indoor',
]);

export type AlumniEntry = {
  name: string;
  playerId: number | null;
  /** 代表実績1行（例: 天皇賜杯・皇后賜杯 全日本選手権大会 ベスト4（2025）） */
  achievement: string;
  /** 卒業後に最後に確認できた所属 */
  currentTeam: string;
  lastSeenYear: number;
};

type Appearance = {
  year: number;
  team: string;
  tournamentId: string; // 'st-league' を含む
  /** 実績スコア（大会tier + 成績）。掲載条件を満たさない出場は 0 */
  score: number;
  rankLabel: string | null; // 優勝 / 準優勝 / ベスト4 / ベスト8 / null(出場)
};

export type PrefectureAlumniEntry = AlumniEntry & {
  /** 出身校（高校カテゴリの正準名） */
  school: string;
};

type AlumniIndex = {
  /** `${gender}|${team}` -> AlumniEntry[]（実績順・上位のみ） */
  bySchool: Map<string, AlumniEntry[]>;
  /** `${gender}|${都道府県名}` -> PrefectureAlumniEntry[]（実績順・上位のみ） */
  byPrefecture: Map<string, PrefectureAlumniEntry[]>;
};

let cache: AlumniIndex | null = null;

function rankInfo(rank: { kind?: string; bestLevel?: number } | null | undefined): { label: string; weight: number } | null {
  if (!rank) return null;
  if (rank.kind === 'winner') return { label: '優勝', weight: 9 };
  if (rank.kind === 'runnerup') return { label: '準優勝', weight: 7 };
  if (rank.kind === 'best' && rank.bestLevel === 4) return { label: 'ベスト4', weight: 5 };
  if (rank.kind === 'best' && rank.bestLevel === 8) return { label: 'ベスト8', weight: 3 };
  return null;
}

function genderOfFile(file: string): 'boys' | 'girls' | 'mixed' | null {
  if (file.includes('-boys')) return 'boys';
  if (file.includes('-girls')) return 'girls';
  if (file.includes('-mixed')) return 'mixed';
  return null;
}

function readJson(p: string): unknown | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

type DetailFile = {
  participants?: Array<{ id?: string; lastName?: string | null; firstName?: string | null; team?: string | null; prefecture?: string | null }>;
  entries?: Array<{ entryNo?: number; playerIds?: string[] }>;
  results?: Array<{ entryNo?: number; tournament?: { rank?: { kind?: string; bestLevel?: number } | null } | null }>;
};

function listDetailFiles(root: string, tournamentId: string): string[] {
  const dir = path.join(root, 'data', 'tournaments', 'details', tournamentId);
  const files: string[] = [];
  let years: string[] = [];
  try {
    years = fs.readdirSync(dir);
  } catch {
    return files;
  }
  for (const y of years) {
    const yDir = path.join(dir, y);
    let names: string[] = [];
    try {
      names = fs.readdirSync(yDir).filter((f) => f.endsWith('.json'));
    } catch {
      continue;
    }
    for (const f of names) files.push(path.join(yDir, f));
  }
  return files;
}

function buildIndex(root: string): AlumniIndex {
  // 1) 高校キャリア: name -> team -> { lastYear, genders, prefecture }
  const hs = new Map<string, Map<string, { lastYear: number; genders: Set<string>; prefecture: string }>>();
  for (const tid of HS_TOURNAMENTS) {
    for (const file of listDetailFiles(root, tid)) {
      const g = genderOfFile(path.basename(file));
      const year = Number(path.basename(path.dirname(file)));
      if (!g || !Number.isFinite(year)) continue;
      const d = readJson(file) as DetailFile | null;
      for (const p of d?.participants ?? []) {
        const name = `${p.lastName ?? ''}${p.firstName ?? ''}`;
        if (!name || !p.team) continue;
        let teams = hs.get(name);
        if (!teams) hs.set(name, (teams = new Map()));
        let rec = teams.get(p.team);
        if (!rec) teams.set(p.team, (rec = { lastYear: year, genders: new Set(), prefecture: '' }));
        rec.lastYear = Math.max(rec.lastYear, year);
        if (p.prefecture) rec.prefecture = p.prefecture;
        if (g === 'mixed') {
          rec.genders.add('boys');
          rec.genders.add('girls');
        } else {
          rec.genders.add(g);
        }
      }
    }
  }

  // 2) 卒業後の出場: name -> Appearance[]
  const post = new Map<string, Appearance[]>();
  const pushPost = (name: string, a: Appearance) => {
    const list = post.get(name);
    if (list) list.push(a);
    else post.set(name, [a]);
  };

  const adultIds = [...INTL_TOURNAMENTS, ...MAJOR_TOURNAMENTS, ...OTHER_ADULT_TOURNAMENTS];
  for (const tid of adultIds) {
    const isIntl = INTL_TOURNAMENTS.has(tid);
    const tierBase = isIntl ? 18 : MAJOR_TOURNAMENTS.has(tid) ? 20 : 10;
    for (const file of listDetailFiles(root, tid)) {
      const year = Number(path.basename(path.dirname(file)));
      if (!Number.isFinite(year)) continue;
      const d = readJson(file) as DetailFile | null;
      if (!d?.participants) continue;
      const byPid = new Map<string, { name: string; team: string }>();
      for (const p of d.participants) {
        const name = `${p.lastName ?? ''}${p.firstName ?? ''}`;
        if (!p.id || !name || !p.team) continue;
        byPid.set(p.id, { name, team: p.team });
      }
      // 成績（優勝〜ベスト8）を entryNo -> rank で引く
      const rankByEntry = new Map<number, { label: string; weight: number }>();
      for (const r of d.results ?? []) {
        const info = rankInfo(r.tournament?.rank);
        if (info && r.entryNo != null) rankByEntry.set(r.entryNo, info);
      }
      const seen = new Set<string>(); // 同一大会内の重複記録を防ぐ（name単位で最良のみ）
      for (const e of d.entries ?? []) {
        const info = e.entryNo != null ? rankByEntry.get(e.entryNo) : undefined;
        for (const pid of e.playerIds ?? []) {
          const p = byPid.get(pid);
          if (!p) continue;
          const key = `${p.name}|${e.entryNo}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const qualifies = isIntl || info != null;
          pushPost(p.name, {
            year,
            team: p.team,
            tournamentId: tid,
            score: qualifies ? tierBase + (info?.weight ?? 0) : 0,
            rankLabel: info?.label ?? null,
          });
        }
      }
    }
  }

  // 3) STリーグ出場（出場のみで掲載条件を満たす）
  const stBase = path.join(root, 'data', 'st-league');
  let stYears: string[] = [];
  try {
    stYears = fs.readdirSync(stBase).filter((y) => /^\d{4}$/.test(y));
  } catch {
    stYears = [];
  }
  for (const y of stYears) {
    const d = readJson(path.join(stBase, y, 'participants.json')) as Record<
      string,
      Array<{ name?: string[]; players?: Array<{ lastName?: string; firstName?: string }> }>
    > | null;
    if (!d) continue;
    for (const g of ['boys', 'girls']) {
      for (const team of d[g] ?? []) {
        const teamName = team.name?.[0] ?? 'STリーグ';
        for (const pl of team.players ?? []) {
          const name = `${pl.lastName ?? ''}${pl.firstName ?? ''}`;
          if (!name) continue;
          pushPost(name, {
            year: Number(y),
            team: teamName,
            tournamentId: 'st-league',
            score: 16,
            rankLabel: null,
          });
        }
      }
    }
  }

  // 4) 選手結果ページの有無（count>=5、results.tsx の getStaticPaths と同条件）
  const playerByName = new Map<string, { id: number; count: number }>();
  const idx = readJson(path.join(root, 'data', 'players', 'index.json')) as Array<{
    id: number;
    lastName?: string;
    firstName?: string;
    count?: number;
  }> | null;
  for (const p of idx ?? []) {
    const name = `${p.lastName ?? ''}${p.firstName ?? ''}`;
    // 同姓同名は最初の id を使う（学校ページ・players/index.tsx と同じ規約）
    if (name && !playerByName.has(name)) playerByName.set(name, { id: p.id, count: p.count ?? 0 });
  }

  // 大会ラベル
  const tIndex = readJson(path.join(root, 'data', 'tournaments', 'index.json')) as Array<{
    tournamentId?: string;
    label?: string;
  }> | null;
  const labelOf = (tid: string): string => {
    if (tid === 'st-league') return 'STリーグ';
    // data/tournaments/index.json 未掲載の大会のフォールバック
    const fallback: Record<string, string> = {
      'yonex-hokkaido-international': 'YONEX CUP 国際ソフトテニス札幌大会',
    };
    return tIndex?.find((t) => t.tournamentId === tid)?.label ?? fallback[tid] ?? tid;
  };

  // 5) 学校×性別ごと・都道府県×性別ごとに集計
  const bySchool = new Map<string, AlumniEntry[]>();
  const byPrefecture = new Map<string, Array<PrefectureAlumniEntry & { _score: number }>>();
  for (const [name, teams] of hs) {
    const player = playerByName.get(name);
    if (!player || player.count < 5) continue; // 結果ページ実在が条件（デッドリンク防止）
    const appearances = post.get(name);
    if (!appearances) continue;
    const hsTeamNames = new Set(teams.keys());
    for (const [team, rec] of teams) {
      // 卒業後 = 高校最終出現年 +1 以降、かつ高校在籍校とは別チーム
      const after = appearances.filter((a) => a.year >= rec.lastYear + 1 && !hsTeamNames.has(a.team));
      const qualifying = after.filter((a) => a.score > 0);
      if (qualifying.length === 0) continue;
      const best = [...qualifying].sort((a, b) => b.score - a.score || b.year - a.year)[0];
      const latest = [...after].sort((a, b) => b.year - a.year)[0];
      const achievement = best.rankLabel
        ? `${labelOf(best.tournamentId)} ${best.rankLabel}（${best.year}）`
        : `${labelOf(best.tournamentId)}出場（${best.year}）`;
      const entry: AlumniEntry = {
        name,
        playerId: player.id,
        achievement,
        currentTeam: latest.team,
        lastSeenYear: latest.year,
        // 並び替え用の内部値は closure で保持せず、score を後段ソートに使うため一時付与
      };
      for (const g of rec.genders) {
        const key = `${g}|${team}`;
        const list = bySchool.get(key);
        const item = { ...entry, _score: best.score } as AlumniEntry & { _score: number };
        if (list) list.push(item);
        else bySchool.set(key, [item]);
        // 県別集計（同一選手が同県の複数校に出現した場合は後段で最良のみ残す）
        if (rec.prefecture) {
          const pKey = `${g}|${rec.prefecture}`;
          const pList = byPrefecture.get(pKey);
          const pItem = { ...entry, school: team, _score: best.score };
          if (pList) pList.push(pItem);
          else byPrefecture.set(pKey, [pItem]);
        }
      }
    }
  }
  for (const [key, list] of bySchool) {
    const sorted = (list as Array<AlumniEntry & { _score: number }>)
      .sort((a, b) => b._score - a._score || b.lastSeenYear - a.lastSeenYear || a.name.localeCompare(b.name, 'ja'))
      .slice(0, 5)
      .map((item) => ({
        name: item.name,
        playerId: item.playerId,
        achievement: item.achievement,
        currentTeam: item.currentTeam,
        lastSeenYear: item.lastSeenYear,
      }));
    bySchool.set(key, sorted);
  }

  const byPrefectureFinal = new Map<string, PrefectureAlumniEntry[]>();
  for (const [key, list] of byPrefecture) {
    // 同一選手の重複（同県の複数校在籍）はスコア最良の1件に統合
    const byName = new Map<string, PrefectureAlumniEntry & { _score: number }>();
    for (const item of list) {
      const cur = byName.get(item.name);
      if (!cur || item._score > cur._score) byName.set(item.name, item);
    }
    const sorted = [...byName.values()]
      .sort((a, b) => b._score - a._score || b.lastSeenYear - a.lastSeenYear || a.name.localeCompare(b.name, 'ja'))
      .slice(0, 5)
      .map((item) => ({
        name: item.name,
        playerId: item.playerId,
        achievement: item.achievement,
        currentTeam: item.currentTeam,
        lastSeenYear: item.lastSeenYear,
        school: item.school,
      }));
    byPrefectureFinal.set(key, sorted);
  }

  return { bySchool, byPrefecture: byPrefectureFinal };
}

/** 学校×性別の「主な卒業生」上位5名（掲載条件を満たす選手がいない場合は空配列） */
export function getSchoolAlumni(root: string, teamName: string, gender: string): AlumniEntry[] {
  if (!cache) cache = buildIndex(root);
  return cache.bySchool.get(`${gender}|${teamName}`) ?? [];
}

/**
 * 都道府県×性別の「県内高校出身の主な選手」上位5名。
 * prefectureName は正準形（例: 奈良県・東京都・北海道）で渡す。
 */
export function getPrefectureAlumni(root: string, prefectureName: string, gender: string): PrefectureAlumniEntry[] {
  if (!cache) cache = buildIndex(root);
  return cache.byPrefecture.get(`${gender}|${prefectureName}`) ?? [];
}
