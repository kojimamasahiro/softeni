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
export function buildReverseIndex(adapter: SourceAdapter, identity: Identity): ReverseIndex {
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

/**
 * 逆引き索引の増分更新（P7 §6.2）。detail 本体が変わった catKey 群についてのみ
 * 所属選手を引き直し、索引を in-place 更新する。削除された catKey は全選手から取り除く。
 * 返り値: 影響選手 id（更新前の保持者 ∪ 更新後の所属者）。
 */
export function applyReverseIndexDelta(index: ReverseIndex, adapter: SourceAdapter, identity: Identity, detailsChangedKeys: string[]): Set<number> {
  const keySet = new Set(detailsChangedKeys);
  const affected = new Set<number>();

  // 更新前の保持者（1 走査で対象キーの保持者を収集）
  const oldHolders = new Map<string, Set<number>>();
  for (const [idStr, entry] of Object.entries(index)) {
    for (const key of entry.categories) {
      if (!keySet.has(key)) continue;
      let set = oldHolders.get(key);
      if (!set) {
        set = new Set<number>();
        oldHolders.set(key, set);
      }
      set.add(Number(idStr));
    }
  }

  for (const key of detailsChangedKeys) {
    const [tournamentId, year, categoryId] = key.split('/');
    // 更新後の所属者（ファイル消滅・非標準化は空 = 全員から除去）
    const newMembers = new Set<number>();
    const detail = adapter.readStandardDetail(tournamentId, year, categoryId);
    if (detail) {
      for (const p of detail.participants) {
        const id = resolveNumericId(identity, p.lastName, p.firstName);
        if (id != null) newMembers.add(id);
      }
    }
    const before = oldHolders.get(key) ?? new Set<number>();
    for (const id of before) affected.add(id);
    for (const id of newMembers) affected.add(id);

    // 除去（保持していたが所属しなくなった）
    for (const id of before) {
      if (newMembers.has(id)) continue;
      const entry = index[String(id)];
      if (!entry) continue;
      entry.categories = entry.categories.filter((c) => c !== key);
      if (entry.categories.length === 0) delete index[String(id)];
    }
    // 追加（新たに所属）
    for (const id of newMembers) {
      const idStr = String(id);
      const entry = index[idStr] ?? { categories: [] };
      if (!entry.categories.includes(key)) {
        entry.categories = [...entry.categories, key].sort();
      }
      index[idStr] = entry;
    }
  }
  return affected;
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
