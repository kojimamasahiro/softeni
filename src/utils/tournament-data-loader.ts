// src/utils/tournament-data-loader.ts

import fs from 'fs';
import path from 'path';

import { applyAbandonment, getAbandonment } from '@/lib/tournamentAbandonment';
import type { TournamentDetailData, TournamentIndexEntry, TournamentInformationEntry } from '@/types/tournament';

type TournamentFileDescriptor = {
  tournamentId: string;
  year: number;
  category: string;
  filePath: string;
};

// ビルド時、この2関数は「大会ディレクトリ全走査」と「大会JSONの読み込み+parse」を
// 呼ばれるたびに実行していた。team-data-aggregator は 1回の集計の中でも Pass1 /
// Pass1.5(不動点ループ) / Pass2 で全ファイルを読み直すため、1ページ生成あたり
// 297ファイル × 数回 の readFileSync + JSON.parse が走っていた。
// 内容はビルド中に変化しないので、プロセス内で一度だけ読んでキャッシュする。
// （全297ファイルを保持してもヒープ約36MB。実測 parse 208ms/回。）
let cachedTournamentFiles: TournamentFileDescriptor[] | null = null;
const tournamentDataCache = new Map<string, TournamentDetailData | null>();
// information/<tid>.json も loadTournamentData から大会ファイル数ぶん引かれるため、
// 同様にプロセス内キャッシュする（打ち切り判定で毎回読むのを避ける）。
const tournamentInfoCache = new Map<string, TournamentInformationEntry[]>();

/**
 * Recursively scan data/tournaments/details/ for all JSON files
 * @returns Array of { tournamentId, year, category, filePath }
 */
export function getAllTournamentFiles(): TournamentFileDescriptor[] {
  if (cachedTournamentFiles) return cachedTournamentFiles;

  const detailsDir = path.join(process.cwd(), 'data/tournaments/details');
  const results: TournamentFileDescriptor[] = [];

  if (!fs.existsSync(detailsDir)) {
    cachedTournamentFiles = results;
    return results;
  }

  // Scan tournament directories
  const tournamentDirs = fs.readdirSync(detailsDir).filter((file) => fs.statSync(path.join(detailsDir, file)).isDirectory());

  for (const tournamentId of tournamentDirs) {
    const tournamentDir = path.join(detailsDir, tournamentId);
    const yearDirs = fs.readdirSync(tournamentDir).filter((file) => fs.statSync(path.join(tournamentDir, file)).isDirectory());

    for (const yearStr of yearDirs) {
      const year = parseInt(yearStr, 10);
      if (isNaN(year)) continue;

      const yearDir = path.join(tournamentDir, yearStr);
      const jsonFiles = fs.readdirSync(yearDir).filter((file) => file.endsWith('.json') && !file.startsWith('og'));

      for (const jsonFile of jsonFiles) {
        const category = jsonFile.replace('.json', '');
        const filePath = path.join(yearDir, jsonFile);
        results.push({ tournamentId, year, category, filePath });
      }
    }
  }

  cachedTournamentFiles = results;
  return results;
}

/**
 * detail のファイルパスから {tournamentId, year, categoryId} を復元する。
 * 期待する形: .../data/tournaments/details/<tournamentId>/<year>/<categoryId>.json
 */
function parseDetailPath(filePath: string): { tournamentId: string; year: number; categoryId: string } | null {
  const parts = filePath.split(path.sep);
  const detailsIdx = parts.lastIndexOf('details');
  if (detailsIdx < 0 || parts.length < detailsIdx + 4) return null;
  const tournamentId = parts[detailsIdx + 1];
  const year = Number(parts[detailsIdx + 2]);
  const categoryId = parts[detailsIdx + 3].replace(/\.json$/, '');
  if (!tournamentId || !Number.isFinite(year) || !categoryId) return null;
  return { tournamentId, year, categoryId };
}

/**
 * Load and parse a single tournament JSON file
 *
 * 返り値はプロセス内で共有されるキャッシュ済みオブジェクト。呼び出し側で
 * 破壊的変更をしてはならない（読み取り専用として扱うこと）。
 *
 * 打ち切り大会（information の categories[].status==='abandoned'）の場合、ここで
 * results の `rank.kind:'ongoing'` を確定成績（ベスト8等）へ解決してから返す。
 * detail を読む経路の choke point をここ1箇所にすることで、消費側が解決漏れを
 * 起こさないようにしている。詳細は lib/tournamentAbandonment.ts。
 * 打ち切りでない大会（＝既存の全データ）では素通しで、挙動は一切変わらない。
 */
export function loadTournamentData(filePath: string): TournamentDetailData | null {
  const cached = tournamentDataCache.get(filePath);
  if (cached !== undefined) return cached;

  let parsed: TournamentDetailData | null = null;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    parsed = JSON.parse(content) as TournamentDetailData;
  } catch (error) {
    console.error(`Failed to load tournament data from ${filePath}:`, error);
    parsed = null;
  }

  // 取り込み途中の空ファイル（`{}`）や、想定と違う形のJSONを弾く。
  // 呼び出し側は軒並み `if (!tournamentData) continue;` で受けているので、null を返せば安全に飛ばせる。
  //
  // なぜ要るか（2026-08-26）: `data/tournaments/details/zennihon-workers/{2022,2023}/*.json` が
  // 取り込み作業中のプレースホルダとして中身 `{}` のまま置かれており、
  // `src/utils/team-data-aggregator.ts` が `for (const p of data.participants)` で
  // **本番ビルド全体を落としていた**（`TypeError: a.participants is not iterable` →
  // `Failed to collect page data for /teams/[teamId]/[year]/[gender]`）。
  // `lib/playerStats/sourceAdapter.ts` は同じファイルを既に
  // 「non-standard schema (unknown) skipped」として飛ばしており、こちらだけ防御が無かった。
  // 部分的なデータ1つでビルド全体が落ちないよう、読み取りの choke point で揃える。
  if (parsed && !Array.isArray((parsed as { participants?: unknown }).participants)) {
    console.warn(`[tournament-data-loader] participants を持たないため読み飛ばし: ${filePath}`);
    parsed = null;
  }

  const descriptor = parsed ? parseDetailPath(filePath) : null;
  if (parsed && descriptor) {
    const abandonment = getTournamentAbandonment(descriptor.tournamentId, descriptor.year, descriptor.categoryId);
    parsed = applyAbandonment(parsed, abandonment, `${descriptor.tournamentId}/${descriptor.year}/${descriptor.categoryId}`);
  }

  tournamentDataCache.set(filePath, parsed);
  return parsed;
}

/**
 * 指定大会・年・種目の打ち切り情報（information の categories[]）を返す。打ち切りでなければ null。
 * coverage 表示など「打ち切りであること自体」を知りたい呼び出し側も使う
 * （loadTournamentData 後の detail は ongoing が解決済みで判別できないため）。
 */
export function getTournamentAbandonment(tournamentId: string, year: number, categoryId: string) {
  const info = getTournamentInfo(tournamentId, year);
  return getAbandonment(info?.categories, categoryId);
}

/**
 * Get tournament information from data/tournaments/information/{tournamentId}.json
 */
export function getTournamentInfo(tournamentId: string, year?: number): TournamentInformationEntry | null {
  const infoArray = readTournamentInfoCached(tournamentId);
  if (infoArray.length === 0) return null;

  if (year) {
    return infoArray.find((info) => info.year === year) || null;
  }

  // Return the most recent entry if no year specified
  return infoArray.slice().sort((a, b) => b.year - a.year)[0] || null;
}

function readTournamentInfoCached(tournamentId: string): TournamentInformationEntry[] {
  const hit = tournamentInfoCache.get(tournamentId);
  if (hit) return hit;

  const infoPath = path.join(process.cwd(), `data/tournaments/information/${tournamentId}.json`);
  let parsed: TournamentInformationEntry[] = [];
  if (fs.existsSync(infoPath)) {
    try {
      parsed = JSON.parse(fs.readFileSync(infoPath, 'utf-8')) as TournamentInformationEntry[];
    } catch (error) {
      console.error(`Failed to load tournament info from ${infoPath}:`, error);
      parsed = [];
    }
  }

  tournamentInfoCache.set(tournamentId, parsed);
  return parsed;
}

/**
 * Get tournament label from data/tournaments/index.json
 */
export function getTournamentLabel(tournamentId: string): string {
  const indexPath = path.join(process.cwd(), 'data/tournaments/index.json');

  if (!fs.existsSync(indexPath)) {
    return tournamentId;
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    const tournaments = JSON.parse(content) as TournamentIndexEntry[];
    const tournament = tournaments.find((t) => t.tournamentId === tournamentId);
    return tournament?.label || tournamentId;
  } catch (error) {
    console.error(`Failed to load tournament index:`, error);
    return tournamentId;
  }
}

/**
 * Get all tournament information entries
 */
export function getAllTournamentInfo(tournamentId: string): TournamentInformationEntry[] {
  const infoPath = path.join(process.cwd(), `data/tournaments/information/${tournamentId}.json`);

  if (!fs.existsSync(infoPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(infoPath, 'utf-8');
    return JSON.parse(content) as TournamentInformationEntry[];
  } catch (error) {
    console.error(`Failed to load tournament info from ${infoPath}:`, error);
    return [];
  }
}
/**
 * Get all tournament index entries
 */
export function getAllTournamentIndex(): TournamentIndexEntry[] {
  const indexPath = path.join(process.cwd(), 'data/tournaments/index.json');

  if (!fs.existsSync(indexPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(content) as TournamentIndexEntry[];
  } catch (error) {
    console.error(`Failed to load tournament index:`, error);
    return [];
  }
}

export type TournamentDescriptor = {
  tournamentId: string;
  year: number;
  category: string;
  filePath: string;
};

export type PreloadedTournamentData = {
  descriptor: TournamentDescriptor;
  data: TournamentDetailData;
};

/**
 * Load all tournament data into memory
 */
export function loadAllTournamentData(): PreloadedTournamentData[] {
  const files = getAllTournamentFiles();
  const results: PreloadedTournamentData[] = [];

  for (const file of files) {
    const data = loadTournamentData(file.filePath);
    if (data) {
      results.push({
        descriptor: file,
        data,
      });
    }
  }

  return results;
}
