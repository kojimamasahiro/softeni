// lib/playersIndex.ts
//
// `data/players/index.json`（約1.4MB / 18,500件）をビルド中に何度も読まないための共有層。
//
// 背景: 選手ページへの内部リンクを張るために「姓名 -> 選手ページの数値id」の対応が要る。
// これを各ページの getStaticProps が個別に `readFileSync` + `JSON.parse` + Map 構築して
// いたため、**1ページあたり 9.8ms**（2026-08-28 実測）がページ数ぶん積み上がっていた。
// 対象ルートの合計は約1,800ページで、それだけで20秒近くになる。
//
// 一般則は docs/wiki/deployment.md「静的ページ生成のコスト特性」:
// ビルド時にデータファイルを読むユーティリティは、必ずプロセス内キャッシュを持たせること。
//
// **返り値はプロセス内で共有される読み取り専用データ**。呼び出し側で書き換えないこと。
//
// パスは `path.join(process.cwd(), 'data', 'players', 'index.json')` とリテラルで書いている。
// 配列 spread にすると nft がリポジトリ全体を glob する（同 wiki の nft の節）。

import fs from 'fs';
import path from 'path';

export type PlayerIndexEntry = {
  id: number;
  lastName: string;
  firstName: string;
  count: number;
};

/** 選手ページ（/players/{id}/results）が実在する下限。サイト共通の規約。 */
export const PLAYER_PAGE_MIN_COUNT = 5;

let cachedIndex: PlayerIndexEntry[] | null = null;
let cachedNameToId: Map<string, number> | null = null;
let cachedIdToName: Map<number, { lastName: string; firstName: string }> | null = null;

/** `data/players/index.json` の生データ。読めなければ空配列。 */
export function getPlayerIndex(): readonly PlayerIndexEntry[] {
  if (cachedIndex) return cachedIndex;

  const indexPath = path.join(process.cwd(), 'data', 'players', 'index.json');
  try {
    cachedIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as PlayerIndexEntry[];
  } catch (err) {
    console.error('failed to parse players index.json', err);
    cachedIndex = [];
  }
  return cachedIndex;
}

/**
 * `姓::名` -> 選手ページの数値 id。
 * `count >= PLAYER_PAGE_MIN_COUNT` のみ。同姓同名は最初の id を使う（先勝ち）。
 */
export function getPlayerNameToId(): ReadonlyMap<string, number> {
  if (cachedNameToId) return cachedNameToId;

  const map = new Map<string, number>();
  for (const p of getPlayerIndex()) {
    if (p.count < PLAYER_PAGE_MIN_COUNT) continue;
    const key = `${p.lastName}::${p.firstName}`;
    if (!map.has(key)) map.set(key, p.id);
  }
  cachedNameToId = map;
  return cachedNameToId;
}

/** 数値 id -> 姓名。閾値なしの全件（別名解決から漢字表記を引くのに使う）。 */
export function getPlayerIdToName(): ReadonlyMap<number, { lastName: string; firstName: string }> {
  if (cachedIdToName) return cachedIdToName;

  const map = new Map<number, { lastName: string; firstName: string }>();
  for (const p of getPlayerIndex()) {
    if (!map.has(p.id)) map.set(p.id, { lastName: p.lastName, firstName: p.firstName });
  }
  cachedIdToName = map;
  return cachedIdToName;
}
