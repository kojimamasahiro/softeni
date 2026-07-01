// lib/playerStats/identity.ts
// 選手同定: participant（姓名）→ 数値 id 解決 / playerKey / homonyms。
// 数値 id はリンク用、playerKey（正規化名@所属）は集計の同定用（§D）。
// 規約は first-wins（既存 generate-player-analysis.mjs は後勝ちだが、契約は先勝ち）。

import fs from 'fs';
import path from 'path';

export interface PlayerIndexRow {
  id: number;
  lastName: string;
  firstName: string;
  count?: number;
}

export interface Identity {
  /** nameKey(`${lastName}\t${firstName}`) → 数値 id（first-wins）。 */
  byName: Map<string, number>;
  /** 数値 id → 表示名/姓名。 */
  byId: Map<number, { lastName: string; firstName: string }>;
  /**
   * homonyms.json に登録された「同姓同名で複数実在人物」を示す nameKey 集合。
   * index.json は 1 名前 = 1 数値 id しか持たないため、これらの id は複数人物を
   * 融合している可能性がある（データ契約 §D）。分離は人物別 id 払い出し（P7/設計）が必要。
   * 当面は homonymRisk フラグとして下流（UI 注記・記事）へ伝える。
   */
  homonymNames: Set<string>;
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export function nameKey(lastName: string, firstName: string): string {
  return `${lastName}\t${firstName}`;
}

let cached: Identity | null = null;

/** players/index.json から Identity を構築（first-wins・プロセス内キャッシュ）。 */
export function loadIdentity(root?: string): Identity {
  if (cached) return cached;
  const cwd = root || process.cwd();
  const rows =
    readJson<PlayerIndexRow[]>(
      path.join(cwd, 'data', 'players', 'index.json'),
    ) ?? [];
  const byName = new Map<string, number>();
  const byId = new Map<number, { lastName: string; firstName: string }>();
  for (const r of rows) {
    if (!r?.lastName || !r?.firstName || typeof r.id !== 'number') continue;
    const key = nameKey(r.lastName, r.firstName);
    // first-wins: 未登録時のみ set。
    if (!byName.has(key)) byName.set(key, r.id);
    if (!byId.has(r.id)) {
      byId.set(r.id, { lastName: r.lastName, firstName: r.firstName });
    }
  }

  // homonyms.json（同姓同名で複数実在人物）を読み、nameKey 集合を作る。
  const homonyms =
    readJson<Array<{ lastName?: string; firstName?: string }>>(
      path.join(cwd, 'data', 'players', 'homonyms.json'),
    ) ?? [];
  const homonymNames = new Set<string>();
  for (const h of homonyms) {
    if (h?.lastName && h?.firstName) {
      homonymNames.add(nameKey(h.lastName, h.firstName));
    }
  }

  cached = { byName, byId, homonymNames };
  return cached;
}

/** 数値 id が同姓同名融合のリスクを持つか（homonyms.json 登録名）。 */
export function isHomonymId(identity: Identity, id: number): boolean {
  const info = identity.byId.get(id);
  if (!info) return false;
  return identity.homonymNames.has(nameKey(info.lastName, info.firstName));
}

export function __resetIdentityCache(): void {
  cached = null;
}

/** 姓名から数値 id を解決（first-wins）。未登録は null。 */
export function resolveNumericId(
  identity: Identity,
  lastName: string | null | undefined,
  firstName: string | null | undefined,
): number | null {
  if (!lastName || !firstName) return null;
  return identity.byName.get(nameKey(lastName, firstName)) ?? null;
}

/** 表記揺れ吸収（空白除去＋NFKC）。playerKey 用。 */
export function normalizeKeyPart(s: string): string {
  return s.replace(/\s+/g, '').normalize('NFKC');
}

/**
 * 選手個人の比較キー（名前@所属）。同姓同名を所属で区別しつつ、ペアが替わっても
 * 同一選手として同定できる（既存 tournamentRecords.playerKey と同方式）。
 */
export function playerKey(name: string, team?: string | null): string {
  const base = team ? `${name}@${team}` : name;
  return normalizeKeyPart(base);
}
