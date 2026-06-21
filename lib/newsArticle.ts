// lib/newsArticle.ts
// /news 記事（プレビュー / 結果速報）の記録スキーマと、記事ビューの組み立て。
// 記事は「一次成果物＝文脈ブロック」の再利用先の一つ（ADR-005）。本文は LLM を使わず
// 既存の文脈ブロック（historical-winners / milestone / career-record）から決定的に構成する。
//
// 設計: docs/wiki/news-context-blocks.md / docs/raw/2026-06-21-news-auto-draft-design.md / ADR-005。
// fs を使うため getStaticProps / ビルドスクリプトからのみ import すること。
//
// 公開フロー（human-in-the-loop）: 記事レコードは data/news/<articleId>.json。
//   state: 'draft' → 'review' → 'published'。公開（getStaticPaths 対象）は published のみ。
//   プレビュー→結果の昇格は同一 articleId で type を 'preview'→'result' に変えて行う。

import fs from 'fs';
import path from 'path';

import { getCareerRecordByFullName } from './careerRecord';
import { getChampionMilestones, type MilestoneEvent } from './milestones';
import { getHistoricalWinners, parseCategoryFile } from './tournamentRecords';

export type NewsArticleType = 'preview' | 'result';
export type NewsArticleState = 'draft' | 'review' | 'published';

export type NewsArticleRecord = {
  articleId: string;
  type: NewsArticleType;
  state: NewsArticleState;
  tournamentId: string;
  year: number;
  /** 省略 / null は全種目対象 */
  categoryId?: string | null;
  /** テンプレ生成のため通常は空。明示指定があれば優先 */
  title?: string;
  description?: string;
  /**
   * OGP 画像のパス（"/og/news/<id>-<hash>.png"）。
   * tools/sns-images/news_og.py がローカル生成して書き戻す（result の published のみ）。
   * 設計: docs/raw/2026-06-22-news-ogp-image-design.md
   */
  ogImage?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NewsNotablePlayer = {
  slug: string;
  display: string;
  team: string | null;
  wins: number;
  matches: number;
  titles: string[];
};

export type NewsCategoryBlock = {
  categoryId: string;
  categoryLabel: string;
  /** 前回王者（year-1 の優勝者）。無ければ null */
  previousChampion: string | null;
  /** 歴代優勝者（新しい年が先頭） */
  historicalWinners: Array<{ year: number; display: string | null }>;
  /** 結果速報のみ: その年の優勝者表示 */
  champion: string | null;
  /** 結果速報のみ: milestone（連覇/初優勝など） */
  milestones: Array<{
    kind: string;
    label: string;
    confidence: MilestoneEvent['confidence'];
    scopeNote?: string | null;
  }>;
  /** プレビューのみ: シード中の注目選手（curated のみ） */
  notablePlayers: NewsNotablePlayer[];
  /** その年・種目の結果ページ（年度別）への内部リンク。算出不能なら null */
  resultHref: string | null;
};

export type NewsArticleView = {
  record: NewsArticleRecord;
  tournamentLabel: string;
  /** 大会の generationId（内部リンク URL 構築用） */
  generation: string;
  /** 大会ハブ（歴代まとめ）への内部リンク */
  hubHref: string;
  title: string;
  description: string;
  categories: NewsCategoryBlock[];
};

const NEWS_ROOT = ['data', 'news'];
const DETAILS_ROOT = ['data', 'tournaments', 'details'];

function resolveRoot(): string {
  return process.cwd();
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function tournamentMetaOf(tournamentId: string): {
  label: string;
  generationId: string;
} {
  const idx = readJson<
    Array<{ tournamentId: string; label?: string; generationId?: string }>
  >(path.join(resolveRoot(), 'data', 'tournaments', 'index.json'));
  const hit = idx?.find((t) => t.tournamentId === tournamentId);
  return {
    label: hit?.label ?? tournamentId,
    generationId: hit?.generationId ?? '',
  };
}

/** categoryId（`category-age-gender`）を URL 構成パーツに分解する */
function categoryPathParts(
  categoryId: string,
): { category: string; age: string; gender: string } | null {
  const parts = categoryId.split('-');
  if (parts.length < 3) return null;
  const gender = parts.pop() as string;
  const age = parts.pop() as string;
  const category = parts.join('-');
  return { category, age, gender };
}

/** 記事レコードを読む */
export function getArticleRecord(articleId: string): NewsArticleRecord | null {
  return readJson<NewsArticleRecord>(
    path.join(resolveRoot(), ...NEWS_ROOT, `${articleId}.json`),
  );
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

/** 公開（published）記事のみ。getStaticPaths / 一覧で使う */
export function listPublishedArticles(): NewsArticleRecord[] {
  return listArticleRecords()
    .filter((r) => r.state === 'published')
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

/** 対象 tournamentId/year に存在する categoryId 一覧（details 実体から） */
function listCategoryIds(tournamentId: string, year: number): string[] {
  const dir = path.join(
    resolveRoot(),
    ...DETAILS_ROOT,
    tournamentId,
    String(year),
  );
  if (!fs.existsSync(dir)) return [];
  const ids: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const parsed = parseCategoryFile(f);
    if (parsed) ids.push(parsed.categoryId);
  }
  return ids;
}

type RawDetail = {
  participants?: Array<{
    id: string;
    lastName?: string;
    firstName?: string;
    team?: string;
  }>;
  entries?: Array<{ entryNo: number; playerIds: string[]; type?: string }>;
};

/** シード entry の選手のうち curated（career-record あり）を注目選手として返す */
function notablePlayersFromSeeds(
  tournamentId: string,
  year: number,
  categoryId: string,
): NewsNotablePlayer[] {
  const detailPath = path.join(
    resolveRoot(),
    ...DETAILS_ROOT,
    tournamentId,
    String(year),
    `${categoryId}.json`,
  );
  const data = readJson<RawDetail>(detailPath);
  if (!data) return [];
  const pmap = new Map(
    (data.participants ?? []).map((p) => [p.id, p] as const),
  );
  const seen = new Set<string>();
  const out: NewsNotablePlayer[] = [];

  for (const entry of data.entries ?? []) {
    if (entry.type !== 'seed') continue;
    for (const pid of entry.playerIds) {
      const p = pmap.get(pid);
      const fullName = p
        ? `${p.lastName ?? ''}${p.firstName ?? ''}`.trim()
        : '';
      if (!fullName) continue;
      const cr = getCareerRecordByFullName(fullName);
      if (!cr || seen.has(cr.subject.slug)) continue;
      seen.add(cr.subject.slug);
      out.push({
        slug: cr.subject.slug,
        display: cr.subject.display,
        team: cr.subject.team,
        wins: cr.totals.wins,
        matches: cr.totals.matches,
        titles: cr.titles
          .slice(0, 3)
          .map((t) => `${t.year} ${t.tournamentLabel}`),
      });
    }
  }
  // 通算勝数の多い順（注目度の代理指標）
  out.sort((a, b) => b.wins - a.wins);
  return out;
}

function buildCategoryBlock(
  record: NewsArticleRecord,
  categoryId: string,
  generation: string,
): NewsCategoryBlock | null {
  const { tournamentId, year, type } = record;
  const hw = getHistoricalWinners(tournamentId, categoryId, {
    targetYear: year,
  });
  if (!hw) return null;

  const previousChampion =
    hw.champions.find((c) => c.year === year - 1)?.display ?? null;
  const champion = hw.champions.find((c) => c.year === year)?.display ?? null;

  let milestones: NewsCategoryBlock['milestones'] = [];
  let notablePlayers: NewsNotablePlayer[] = [];

  if (type === 'result') {
    const ms = getChampionMilestones(tournamentId, categoryId, year);
    milestones = (ms?.events ?? []).map((e) => ({
      kind: e.kind,
      label: e.label,
      confidence: e.confidence,
      scopeNote: e.scopeNote ?? null,
    }));
  } else {
    notablePlayers = notablePlayersFromSeeds(tournamentId, year, categoryId);
  }

  const parts = generation ? categoryPathParts(categoryId) : null;
  const resultHref = parts
    ? `/tournaments/${generation}/${tournamentId}/${year}/${parts.category}/${parts.age}/${parts.gender}/`
    : null;

  return {
    categoryId,
    categoryLabel: hw.categoryLabel,
    previousChampion,
    historicalWinners: hw.champions.map((c) => ({
      year: c.year,
      display: c.display,
    })),
    champion: type === 'result' ? champion : null,
    milestones,
    notablePlayers,
    resultHref,
  };
}

function defaultTitle(
  record: NewsArticleRecord,
  tournamentLabel: string,
): string {
  return record.type === 'preview'
    ? `${tournamentLabel} ${record.year} 展望・注目選手・前回王者`
    : `${tournamentLabel} ${record.year} 結果・優勝・歴代まとめ`;
}

function defaultDescription(
  record: NewsArticleRecord,
  tournamentLabel: string,
): string {
  return record.type === 'preview'
    ? `ソフトテニス「${tournamentLabel}」${record.year}年の展望。注目選手・前回王者・歴代優勝者を当サイト掲載データからまとめています。`
    : `ソフトテニス「${tournamentLabel}」${record.year}年の結果。優勝者・連覇/初優勝などの記録を歴代データと合わせてまとめています。`;
}

/** 記事レコードから描画用ビューを組み立てる */
export function buildNewsArticleView(
  record: NewsArticleRecord,
): NewsArticleView {
  const { label: tournamentLabel, generationId } = tournamentMetaOf(
    record.tournamentId,
  );
  const categoryIds =
    record.categoryId && record.categoryId.length > 0
      ? [record.categoryId]
      : listCategoryIds(record.tournamentId, record.year);

  const categories: NewsCategoryBlock[] = [];
  for (const cid of categoryIds) {
    const block = buildCategoryBlock(record, cid, generationId);
    if (block) categories.push(block);
  }

  const hubHref = generationId
    ? `/tournaments/${generationId}/${record.tournamentId}/`
    : '';

  return {
    record,
    tournamentLabel,
    generation: generationId,
    hubHref,
    title: record.title || defaultTitle(record, tournamentLabel),
    description:
      record.description || defaultDescription(record, tournamentLabel),
    categories,
  };
}
