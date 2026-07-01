// lib/playerStats/sourceAdapter.ts
// L0: 既存 JSON の読み込み・スキーマ変種判定・大会メタ join。
// ここだけがファイル形式を知る（差し替えれば入力元を変えられる）。副作用なし（読み取りのみ）。
//
// データ契約: §A（スキーマ変種）/ §F（大会メタ join: year=年度 / isNational / stage）。

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const INTERNATIONAL_GENERATIONS = new Set([
  'international',
  'international-qualifier',
]);

export interface TournamentMeta {
  tournamentId: string;
  label: string;
  generationId: string | null;
  isMajorTitle: boolean;
  /** index.json 収録かつ国際・国際予選以外（§F）。local_index は常に false。 */
  isNational: boolean;
}

export interface RawParticipant {
  id: string;
  lastName?: string | null;
  firstName?: string | null;
  team?: string | null;
  prefecture?: string | null;
}

export interface RawEntry {
  entryNo: number;
  playerIds: string[];
  type?: string | null;
}

export interface RawMatch {
  entries?: number[];
  scores?: Record<string, number>;
  round?: string | null;
  winnerEntryNo?: number;
  retired?: boolean;
  stage?: string | null;
  group?: string | null;
}

export interface RawResult {
  entryNo?: number;
  playerIds?: string[];
  tournament?: {
    label?: string;
    rank?: { kind?: string; bestLevel?: number; round?: number };
  } | null;
  roundrobin?: { group?: string; rank?: number } | null;
}

export interface StandardDetail {
  participants: RawParticipant[];
  entries: RawEntry[];
  matches: RawMatch[];
  results: RawResult[];
}

export type SchemaVariant =
  | 'standard' // entries, matches, participants, results
  | 'matchesOnly' // matches, results（temp・pid 無し）
  | 'roundRobinOnly' // roundRobinMatches, standings
  | 'mixed' // 標準＋別リーグ
  | 'unknown';

export interface InformationEntry {
  year: number;
  startDate?: string | null;
  endDate?: string | null;
  location?: string | null;
  sourceUrl?: string | null;
}

function readJsonRaw(filePath: string): { text: string; data: unknown } | null {
  try {
    const text = fs.readFileSync(filePath, 'utf-8');
    return { text, data: JSON.parse(text) };
  } catch {
    return null;
  }
}

export class SourceAdapter {
  readonly root: string;
  private metaByTid: Map<string, TournamentMeta> | null = null;
  private infoByTid = new Map<string, InformationEntry[]>();
  private hashCache = new Map<string, string>();
  private warned = new Set<string>();

  constructor(root?: string) {
    this.root = root || process.cwd();
  }

  private detailsRoot(): string {
    return path.join(this.root, 'data', 'tournaments', 'details');
  }

  /** 大会メタ（isNational/isMajorTitle/generationId/label）を join した Map。 */
  getTournamentMeta(): Map<string, TournamentMeta> {
    if (this.metaByTid) return this.metaByTid;
    const map = new Map<string, TournamentMeta>();
    const load = (file: string, national: boolean) => {
      const parsed = readJsonRaw(
        path.join(this.root, 'data', 'tournaments', file),
      );
      const arr = Array.isArray(parsed?.data) ? (parsed!.data as any[]) : [];
      for (const t of arr) {
        if (!t?.tournamentId) continue;
        const generationId: string | null = t.generationId ?? null;
        const isNational =
          national &&
          !(generationId && INTERNATIONAL_GENERATIONS.has(generationId));
        map.set(t.tournamentId, {
          tournamentId: t.tournamentId,
          label: t.label ?? t.tournamentId,
          generationId,
          isMajorTitle: Boolean(t.isMajorTitle),
          isNational,
        });
      }
    };
    // index.json（national 候補）→ local_index.json（常に非 national・未登録のみ）
    load('index.json', true);
    const localParsed = readJsonRaw(
      path.join(this.root, 'data', 'tournaments', 'local_index.json'),
    );
    const localArr = Array.isArray(localParsed?.data)
      ? (localParsed!.data as any[])
      : [];
    for (const t of localArr) {
      if (!t?.tournamentId || map.has(t.tournamentId)) continue;
      map.set(t.tournamentId, {
        tournamentId: t.tournamentId,
        label: t.label ?? t.tournamentId,
        generationId: t.generationId ?? null,
        isMajorTitle: Boolean(t.isMajorTitle),
        isNational: false,
      });
    }
    this.metaByTid = map;
    return map;
  }

  metaFor(tournamentId: string): TournamentMeta {
    return (
      this.getTournamentMeta().get(tournamentId) ?? {
        tournamentId,
        label: tournamentId,
        generationId: null,
        isMajorTitle: false,
        isNational: false,
      }
    );
  }

  /** information/<tid>.json（年度→日付）。 */
  getInformation(tournamentId: string): InformationEntry[] {
    const hit = this.infoByTid.get(tournamentId);
    if (hit) return hit;
    const parsed = readJsonRaw(
      path.join(
        this.root,
        'data',
        'tournaments',
        'information',
        `${tournamentId}.json`,
      ),
    );
    const arr = Array.isArray(parsed?.data)
      ? (parsed!.data as InformationEntry[])
      : [];
    this.infoByTid.set(tournamentId, arr);
    return arr;
  }

  getInfoForYear(tournamentId: string, year: number): InformationEntry | null {
    return (
      this.getInformation(tournamentId).find(
        (e) => Number(e.year) === Number(year),
      ) ?? null
    );
  }

  /** keys からスキーマ変種を判定（§A）。 */
  detectVariant(data: Record<string, unknown>): SchemaVariant {
    const has = (k: string) => Array.isArray((data as any)[k]);
    const std = has('entries') && has('matches') && has('participants') && has('results');
    const rr = has('roundRobinMatches') && has('standings');
    if (std && rr) return 'mixed';
    if (std) return 'standard';
    if (rr) return 'roundRobinOnly';
    if (has('matches') && has('results')) return 'matchesOnly';
    return 'unknown';
  }

  private warnOnce(key: string, msg: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    // eslint-disable-next-line no-console
    console.warn(`[sourceAdapter] ${msg}`);
  }

  /**
   * 標準スキーマ detail を読む。標準の実体（entries/matches/participants/results）が
   * 揃っていれば mixed も標準部として返す。非標準は null（ログして skip）。
   */
  readStandardDetail(
    tournamentId: string,
    year: number | string,
    categoryId: string,
  ): StandardDetail | null {
    const filePath = path.join(
      this.detailsRoot(),
      tournamentId,
      String(year),
      `${categoryId}.json`,
    );
    const parsed = readJsonRaw(filePath);
    if (!parsed || typeof parsed.data !== 'object' || parsed.data === null) {
      return null;
    }
    const data = parsed.data as Record<string, unknown>;
    const variant = this.detectVariant(data);
    if (variant === 'standard' || variant === 'mixed') {
      return {
        participants: (data.participants as RawParticipant[]) ?? [],
        entries: (data.entries as RawEntry[]) ?? [],
        matches: (data.matches as RawMatch[]) ?? [],
        results: (data.results as RawResult[]) ?? [],
      };
    }
    this.warnOnce(
      `${tournamentId}/${year}/${categoryId}`,
      `non-standard schema (${variant}) skipped: ${tournamentId}/${year}/${categoryId}`,
    );
    return null;
  }

  /** ファイル内容ハッシュ（増分・sourceHash 用）。 */
  contentHash(tournamentId: string, year: number | string, categoryId: string): string {
    const rel = `${tournamentId}/${year}/${categoryId}`;
    const hit = this.hashCache.get(rel);
    if (hit) return hit;
    const filePath = path.join(
      this.detailsRoot(),
      tournamentId,
      String(year),
      `${categoryId}.json`,
    );
    let hash = '0';
    try {
      const buf = fs.readFileSync(filePath);
      hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
    } catch {
      hash = '0';
    }
    this.hashCache.set(rel, hash);
    return hash;
  }

  /**
   * details 配下の全「標準スキーマ」カテゴリファイルを列挙する
   * （逆引き構築の 1 回走査に使う）。返り値: {tournamentId, year, categoryId}。
   */
  listStandardCategoryFiles(): Array<{
    tournamentId: string;
    year: string;
    categoryId: string;
  }> {
    const out: Array<{ tournamentId: string; year: string; categoryId: string }> =
      [];
    const root = this.detailsRoot();
    if (!fs.existsSync(root)) return out;
    for (const tid of fs.readdirSync(root)) {
      const tDir = path.join(root, tid);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(tDir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      for (const year of fs.readdirSync(tDir)) {
        if (!/^\d{4}$/.test(year)) continue;
        const yDir = path.join(tDir, year);
        if (!fs.statSync(yDir).isDirectory()) continue;
        for (const file of fs.readdirSync(yDir)) {
          if (!file.endsWith('.json')) continue;
          const categoryId = file.replace(/\.json$/, '');
          out.push({ tournamentId: tid, year, categoryId });
        }
      }
    }
    return out;
  }
}
