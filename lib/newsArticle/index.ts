// lib/newsArticle/index.ts
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
//
// 実装は責務ごとに分割済み（2026-08-01）:
//   types.ts        … 型定義
//   recordIO.ts      … 記事レコードの読み書き・一覧・検索
//   contextBlocks.ts … 文脈ブロック（連覇ウォッチ・前回入賞者・直近好成績者・前哨戦 ほか）の構築
//   index.ts（本ファイル） … 上記を束ねて記事ビューを組み立てるエントリーポイント

import { getTournamentHubHref } from '@/lib/highschoolNationalTournamentMeta';

import { buildRecentAchieverIndex, buildCategoryBlock, type RecentAchievementInfo } from './contextBlocks';
import { listCategoryIds, tournamentMetaOf } from './recordIO';
import type { NewsArticleRecord, NewsArticleView, NewsCategoryBlock } from './types';

export * from './types';
export * from './recordIO';

function defaultTitle(record: NewsArticleRecord, tournamentLabel: string): string {
  return record.type === 'preview'
    ? `${tournamentLabel} ${record.year} 展望・連覇/前回王者・出場校`
    : `${tournamentLabel} ${record.year} 結果・優勝・歴代まとめ`;
}

/**
 * meta description。
 * 前哨戦（priorMeetings）が算出できているときは、**当サイトにしか無い切り口**なので
 * 「直近大会での対戦成績」を一文だけ足す。他の展望サイトと文面で差別化する狙い
 * （[seo.md](../docs/wiki/seo.md) #8「farm が構造的に持てない DB 由来の文脈で差別化」）。
 * 算出できない大会では従来文のまま（分岐 1 箇所で戻せる）。
 */
function defaultDescription(record: NewsArticleRecord, tournamentLabel: string, categories: NewsCategoryBlock[]): string {
  if (record.type !== 'preview') {
    return `ソフトテニス「${tournamentLabel}」${record.year}年の結果。優勝者・連覇/初優勝などの記録を歴代データと合わせてまとめています。`;
  }
  const base = `ソフトテニス「${tournamentLabel}」${record.year}年の展望。前回王者の連覇挑戦・前回入賞者の再登場・出場規模・歴代優勝者を当サイト収録データからまとめています。`;
  const totalCards = categories.reduce((n, c) => n + (c.priorMeetings?.totalCards ?? 0), 0);
  if (totalCards === 0) return base;
  return `${base}直近の大会で既に対戦している${totalCards}件の顔合わせも掲載。`;
}

/** 記事レコードから描画用ビューを組み立てる */
export function buildNewsArticleView(record: NewsArticleRecord): NewsArticleView {
  const { label: tournamentLabel, generationId } = tournamentMetaOf(record.tournamentId);
  const categoryIds = record.categoryId && record.categoryId.length > 0 ? [record.categoryId] : listCategoryIds(record.tournamentId, record.year);

  // 直近大会の好成績者インデックスは種目に依存しないので記事単位で 1 回だけ構築する。
  // result 記事では使わないため preview のときのみ。
  const recentIndex = record.type === 'preview' ? buildRecentAchieverIndex(record.tournamentId, record.year) : new Map<string, RecentAchievementInfo>();

  const categories: NewsCategoryBlock[] = [];
  for (const cid of categoryIds) {
    const block = buildCategoryBlock(record, cid, generationId, recentIndex);
    if (block) categories.push(block);
  }

  // 高校全国大会は汎用ハブが noindex のため歴代記録ページへ振り替わる（seo.md #3）
  const hubHref = generationId ? getTournamentHubHref(generationId, record.tournamentId) : '';

  return {
    record,
    tournamentLabel,
    generation: generationId,
    hubHref,
    title: record.title || defaultTitle(record, tournamentLabel),
    description: record.description || defaultDescription(record, tournamentLabel, categories),
    categories,
  };
}

/**
 * 記事本文が実名で言及している選手を、構造化データ（JSON-LD の mentions）用に集約する。
 * ソース: 各カテゴリブロックの pickPlayers（注目の選手カード）と titleDefense（前回王者の連覇/防衛ウォッチ）。
 * 同一選手が複数箇所（例: 前回王者かつ注目の選手）に出ることがあるため、playerId（無ければ name）で重複排除する。
 * 表示順は影響しないため、カテゴリ・出現順のまま返す。
 */
export function collectArticleMentions(categories: NewsCategoryBlock[]): import('./types').PreviewPlayerRef[] {
  const seen = new Set<string>();
  const mentions: import('./types').PreviewPlayerRef[] = [];

  const add = (p: import('./types').PreviewPlayerRef) => {
    const key = p.playerId != null ? `id:${p.playerId}` : `name:${p.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    mentions.push(p);
  };

  for (const cat of categories) {
    if (cat.titleDefense) {
      for (const p of cat.titleDefense.players) add(p);
    }
    for (const card of cat.pickPlayers) {
      for (const p of card.players) add(p);
    }
  }

  return mentions;
}
