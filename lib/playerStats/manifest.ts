// lib/playerStats/manifest.ts
// L4: 増分ビルド用 contentHash manifest（data/players/_manifest.json）。
// 大会ファイル（details/** ＝ catKey / information/* ＝ `info:{tid}`）の内容ハッシュを保持し、
// 前回ビルドとの diff から「変更大会 → 影響選手」だけを再生成する（設計 §6.2）。
//
// 全再計算の条件: engineVersion 変更 / グローバル入力（index.json・local_index.json・
// players/index.json・homonyms.json）の変更 / manifest・逆引き不在 / --full 指定。
// config（ranking-config.json）変更は facts に影響しないため、configChanged フラグとして
// 下流（rankings / public-json）にのみ伝える。

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { SourceAdapter } from './sourceAdapter';

export const MANIFEST_PATH = ['data', 'players', '_manifest.json'];

/** 直近ビルドの変更内容（下流スクリプトが増分範囲の決定に使う）。 */
export interface ManifestLastRun {
  /** full = 全再計算（下流も全件対象）。incremental = 影響選手のみ。 */
  mode: 'full' | 'incremental';
  at: string;
  /** 変更のあった manifest キー（catKey / `info:{tid}`）。 */
  changedFiles: string[];
  /** _facts を再生成（または削除）した選手 id。mode=full のときは空（=全選手）。 */
  affectedPlayers: number[];
  /** 変更 catKey の年度（ランキングの増分対象）。 */
  changedYears: number[];
  /** ranking-config.json が前回から変わったか（rankings/public は全再生成）。 */
  configChanged: boolean;
  /** generate-rankings が記録: 順位表の行が変わった選手 id（public-json の増分対象）。 */
  rankingAffectedPlayers?: number[];
}

export interface BuildManifest {
  engineVersion: string;
  /** data/ranking-config.json の内容ハッシュ。 */
  configHash: string;
  /** グローバル入力（大会 index・選手 index・homonyms）の合成ハッシュ。 */
  globalHash: string;
  /** catKey(`tid/year/categoryId`) と `info:{tid}` → 内容ハッシュ（sha1 先頭16桁）。 */
  files: Record<string, string>;
  lastRun: ManifestLastRun | null;
  generatedAt: string;
}

/** ファイル内容ハッシュ（sha1 先頭16桁。無ければ '0'）。 */
export function hashFile(filePath: string): string {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
  } catch {
    return '0';
  }
}

/** グローバル入力の合成ハッシュ（変更時は全再計算）。 */
export function computeGlobalHash(root: string): string {
  const targets = [
    ['data', 'tournaments', 'index.json'],
    ['data', 'tournaments', 'local_index.json'],
    ['data', 'players', 'index.json'],
    ['data', 'players', 'homonyms.json'],
  ];
  const parts = targets.map((p) => hashFile(path.join(root, ...p)));
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16);
}

export function computeConfigHash(root: string): string {
  return hashFile(path.join(root, 'data', 'ranking-config.json'));
}

/**
 * 現在の入力ファイル群のハッシュスナップショット。
 * details/** の標準カテゴリファイル（catKey）＋ 出現大会の information（`info:{tid}`）。
 */
export function snapshotFiles(root: string, adapter: SourceAdapter): Record<string, string> {
  const files: Record<string, string> = {};
  const tids = new Set<string>();
  for (const { tournamentId, year, categoryId } of adapter.listStandardCategoryFiles()) {
    files[`${tournamentId}/${year}/${categoryId}`] = adapter.contentHash(tournamentId, year, categoryId);
    tids.add(tournamentId);
  }
  for (const tid of tids) {
    files[`info:${tid}`] = hashFile(path.join(root, 'data', 'tournaments', 'information', `${tid}.json`));
  }
  return files;
}

export interface FilesDiff {
  /** 双方に存在しハッシュが変わったキー。 */
  changed: string[];
  /** 新規キー。 */
  added: string[];
  /** 消えたキー。 */
  removed: string[];
}

/** 前回 manifest との diff（純関数・単体テスト対象）。 */
export function diffFiles(oldFiles: Record<string, string>, newFiles: Record<string, string>): FilesDiff {
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  for (const key of Object.keys(newFiles)) {
    if (!(key in oldFiles)) added.push(key);
    else if (oldFiles[key] !== newFiles[key]) changed.push(key);
  }
  for (const key of Object.keys(oldFiles)) {
    if (!(key in newFiles)) removed.push(key);
  }
  changed.sort();
  added.sort();
  removed.sort();
  return { changed, added, removed };
}

export function isEmptyDiff(diff: FilesDiff): boolean {
  return diff.changed.length === 0 && diff.added.length === 0 && diff.removed.length === 0;
}

/**
 * diff を「影響 catKey 集合」へ展開する（純関数・単体テスト対象）。
 * - catKey の変更/追加/削除 → そのまま。
 * - `info:{tid}` の変更（開催日等）→ その大会の全 catKey（詳細は不変でも facts の date が変わる）。
 * 返り値: detailsChanged = detail 本体が変わった catKey（逆引き索引の更新が必要）、
 *         affected = facts 再生成が必要な catKey 全体。
 */
export function expandDiffToCatKeys(
  diff: FilesDiff,
  oldFiles: Record<string, string>,
  newFiles: Record<string, string>,
): { detailsChanged: string[]; affected: string[] } {
  const isInfo = (k: string) => k.startsWith('info:');
  const detailsChanged = [...diff.changed.filter((k) => !isInfo(k)), ...diff.added.filter((k) => !isInfo(k)), ...diff.removed.filter((k) => !isInfo(k))];
  const affected = new Set<string>(detailsChanged);
  const infoTids = [...diff.changed, ...diff.added, ...diff.removed].filter(isInfo).map((k) => k.slice('info:'.length));
  if (infoTids.length > 0) {
    const tidSet = new Set(infoTids);
    for (const key of [...Object.keys(newFiles), ...Object.keys(oldFiles)]) {
      if (isInfo(key)) continue;
      const tid = key.split('/')[0];
      if (tidSet.has(tid)) affected.add(key);
    }
  }
  return {
    detailsChanged: [...new Set(detailsChanged)].sort(),
    affected: [...affected].sort(),
  };
}

/** catKey 集合から変更年度を抽出する（純関数）。 */
export function yearsOfCatKeys(catKeys: string[]): number[] {
  const years = new Set<number>();
  for (const key of catKeys) {
    const y = Number(key.split('/')[1]);
    if (Number.isFinite(y)) years.add(y);
  }
  return [...years].sort((a, b) => a - b);
}

export function readManifest(root: string): BuildManifest | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, ...MANIFEST_PATH), 'utf-8')) as BuildManifest;
  } catch {
    return null;
  }
}

export function writeManifest(root: string, manifest: BuildManifest): void {
  const outPath = path.join(root, ...MANIFEST_PATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(manifest), 'utf-8');
}

/** generate-rankings が lastRun へ rankingAffectedPlayers を書き足す（read-modify-write）。 */
export function updateLastRun(root: string, patch: Partial<ManifestLastRun>): void {
  const manifest = readManifest(root);
  if (!manifest || !manifest.lastRun) return;
  manifest.lastRun = { ...manifest.lastRun, ...patch };
  writeManifest(root, manifest);
}
