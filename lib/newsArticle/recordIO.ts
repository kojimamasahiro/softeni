// 記事レコード（data/news/<articleId>.json）の読み書きと一覧・検索。
// fs を使うため getStaticProps / ビルドスクリプトからのみ import すること。
// 元 lib/newsArticle.ts から分割（2026-08-01）。

import fs from 'fs';
import path from 'path';

import { parseCategoryFile } from '../tournamentRecords';
import type { NewsArticleRecord } from './types';

const NEWS_ROOT = ['data', 'news'];
const DETAILS_ROOT = ['data', 'tournaments', 'details'];

export function resolveRoot(): string {
  return process.cwd();
}

export function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export function tournamentMetaOf(tournamentId: string): {
  label: string;
  generationId: string;
} {
  const idx = readJson<Array<{ tournamentId: string; label?: string; generationId?: string }>>(path.join(resolveRoot(), 'data', 'tournaments', 'index.json'));
  const hit = idx?.find((t) => t.tournamentId === tournamentId);
  return {
    label: hit?.label ?? tournamentId,
    generationId: hit?.generationId ?? '',
  };
}

/** categoryId（`category-age-gender`）を URL 構成パーツに分解する */
export function categoryPathParts(categoryId: string): { category: string; age: string; gender: string } | null {
  const parts = categoryId.split('-');
  if (parts.length < 3) return null;
  const gender = parts.pop() as string;
  const age = parts.pop() as string;
  const category = parts.join('-');
  return { category, age, gender };
}

/** 記事レコードを読む */
export function getArticleRecord(articleId: string): NewsArticleRecord | null {
  return readJson<NewsArticleRecord>(path.join(resolveRoot(), ...NEWS_ROOT, `${articleId}.json`));
}

/** 全記事レコード（state 問わず） */
export function listArticleRecords(): NewsArticleRecord[] {
  const dir = path.join(resolveRoot(), ...NEWS_ROOT);
  if (!fs.existsSync(dir)) return [];
  const out: NewsArticleRecord[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const rec = readJson<NewsArticleRecord>(path.join(dir, f));
    if (rec?.articleId) out.push(rec);
  }
  return out;
}

/**
 * 公開（published）記事のみ。getStaticPaths / 一覧で使う。
 * 公開日の降順（新しい記事が先頭）。updatedAt が同値（同一バッチでの一括公開等）の
 * 場合は createdAt を第二キーにして、実際の公開順が保たれるようにする。
 */
export function listPublishedArticles(): NewsArticleRecord[] {
  return listArticleRecords()
    .filter((r) => r.state === 'published')
    .sort((a, b) => {
      const byUpdatedAt = (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
      if (byUpdatedAt !== 0) return byUpdatedAt;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
}

/**
 * 公開済みの「展望（preview）」記事のみ。
 * 結果（result）記事は廃止し、「大会ごとの結果・優勝・歴代まとめ」は
 * 大会ハブ（/tournaments/[generation]/[tournamentId]、高校全国大会は
 * /highschool/tournaments/[tournament]）に集約する（ADR-008）。
 * /news は大会前の展望（前回王者・出場校 ほか）専用とする。
 */
export function listPublishedPreviews(): NewsArticleRecord[] {
  return listPublishedArticles().filter((r) => r.type === 'preview');
}

/**
 * 指定の大会・年度に対応する公開済み展望（preview）記事（あれば1件）。
 * 大会結果ページ（[gender]/index.tsx）から展望記事への内部リンクを出すために使う。
 * 1大会・1年度につき記事は基本1件（全種目対象。categoryId は問わない）を想定。
 * 「結果」を狙うリンクではなく、preview記事とのカニバリを避けるための低リスクな内部リンク
 * （docs/wiki/seo.md #8 の方針に沿う。結果クエリでの競合は意図しない）。
 */
export function findPublishedPreviewForTournament(tournamentId: string, year: number): NewsArticleRecord | null {
  return listPublishedPreviews().find((r) => r.tournamentId === tournamentId && r.year === year) ?? null;
}

/** 対象 tournamentId/year に存在する categoryId 一覧（details 実体から） */
export function listCategoryIds(tournamentId: string, year: number): string[] {
  const dir = path.join(resolveRoot(), ...DETAILS_ROOT, tournamentId, String(year));
  if (!fs.existsSync(dir)) return [];
  const ids: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const parsed = parseCategoryFile(f);
    if (parsed) ids.push(parsed.categoryId);
  }
  return ids;
}
