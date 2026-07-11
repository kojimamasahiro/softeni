// lib/ratingsUpsets.ts
// data/ratings/upsets.json（giant-killing イベント。scripts/ranking/generate-ratings.mjs が生成）の
// 読み取り側。ビルド時に大会結果ページ・記事の milestone（'giant-killing'）へ供給する。
// レート・期待勝率の数値は表示に出さない方針（2026-07-11決定。定性表現「金星」のみ）だが、
// 生成物には含まれるため、閾値変更や検証に使える。

import fs from 'fs';
import path from 'path';

export interface UpsetSideRef {
  name: string;
  /** 対戦時点の事前レート（内部指標・非公開） */
  rating: number;
}

export interface UpsetEvent {
  year: number;
  tournamentId: string;
  categoryId: string;
  discipline: string;
  gender: string;
  round: string | null;
  winners: UpsetSideRef[];
  losers: UpsetSideRef[];
  /** 勝者の事前期待勝率（内部指標・非公開） */
  expectedWinProb: number;
  ratingGap: number;
}

let cache: Map<string, UpsetEvent[]> | null = null;

function loadAll(): Map<string, UpsetEvent[]> {
  if (cache) return cache;
  cache = new Map();
  const p = path.join(process.cwd(), 'data', 'ratings', 'upsets.json');
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as { events?: UpsetEvent[] };
    for (const e of raw.events ?? []) {
      if (!e || !e.tournamentId || !e.categoryId || !e.year) continue;
      const key = `${e.tournamentId}\t${e.categoryId}\t${e.year}`;
      const arr = cache.get(key) ?? [];
      arr.push(e);
      cache.set(key, arr);
    }
  } catch {
    // 生成物が無い環境（ratings 未生成）ではイベントなしとして振る舞う
  }
  return cache;
}

/** テスト用: キャッシュ破棄。 */
export function __resetUpsetsCache(): void {
  cache = null;
}

/** 対象の大会×カテゴリ×年の upset イベント（期待勝率昇順 = 大きい金星から）。 */
export function getUpsets(tournamentId: string, categoryId: string, year: number): UpsetEvent[] {
  const events = loadAll().get(`${tournamentId}\t${categoryId}\t${year}`) ?? [];
  return events.slice().sort((a, b) => a.expectedWinProb - b.expectedWinProb);
}
