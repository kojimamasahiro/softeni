// lib/playerStats/reverseIndex.ts
// 選手 → 出場カテゴリ 逆引き索引（§H）。details（標準スキーマ）を 1 回だけ走査し、
// participant 姓名 → 数値 id 解決 → Map<numericId, Set<`${tid}/${year}/${categoryId}`>>。
// Facts 生成時は当該選手の該当カテゴリだけを開く（全大会スキャン回避＝線形性の担保）。

import fs from 'fs';
import path from 'path';

import { Identity, resolveNumericId } from './identity';
import { SourceAdapter } from './sourceAdapter';
import type { ReverseIndex } from './types';

export const REVERSE_INDEX_PATH = ['data', 'players', '_index', 'by-player.json'];

/** details 全走査で逆引き索引を構築する（O(M)・1 回のみ）。 */
export function buildReverseIndex(
  adapter: SourceAdapter,
  identity: Identity,
): ReverseIndex {
  const byId = new Map<number, Set<string>>();
  for (const { tournamentId, year, categoryId } of adapter.listStandardCategoryFiles()) {
    const detail = adapter.readStandardDetail(tournamentId, year, categoryId);
    if (!detail) continue;
    const key = `${tournamentId}/${year}/${categoryId}`;
    const seen = new Set<number>();
    for (const p of detail.participants) {
      const id = resolveNumericId(identity, p.lastName, p.firstName);
      if (id == null || seen.has(id)) continue;
      seen.add(id);
      let set = byId.get(id);
      if (!set) {
        set = new Set<string>();
        byId.set(id, set);
      }
      set.add(key);
    }
  }
  const out: ReverseIndex = {};
  for (const [id, set] of byId) {
    out[String(id)] = { categories: Array.from(set).sort() };
  }
  return out;
}

export function writeReverseIndex(root: string, index: ReverseIndex): void {
  const outPath = path.join(root, ...REVERSE_INDEX_PATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(index), 'utf-8');
}

export function readReverseIndex(root: string): ReverseIndex | null {
  const outPath = path.join(root, ...REVERSE_INDEX_PATH);
  try {
    return JSON.parse(fs.readFileSync(outPath, 'utf-8')) as ReverseIndex;
  } catch {
    return null;
  }
}
