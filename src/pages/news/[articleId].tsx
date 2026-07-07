// src/pages/news/[articleId].tsx
// /news/<articleId> 記事ページ（大会展望 / preview のみ）。
// 結果記事（result）は廃止し、結果・優勝・歴代まとめは大会ハブ／高校歴代ページに集約した（ADR-008）。
// 本文は LLM を使わず、文脈ブロック（前回王者・出場校 ほか）から決定的に構成する。
// 公開は state==='published' かつ type==='preview' の記事のみ。
// 設計: docs/wiki/news-context-blocks.md / ADR-005 / ADR-008。

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  buildNewsArticleView,
  collectArticleMentions,
  getArticleRecord,
  listPublishedPreviews,
  type EntryStanding,
  type NewsArticleView,
  type PickPlayerCard,
  type PreviewPlayerRef,
  type TitleDefenseWatch,
} from '@/lib/newsArticle';
import { buildSiteUrl, siteConfig } from '@/lib/siteConfig';

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 選手名。結果ページ（/players/{id}/results）がある選手はリンク化する */
function PlayerName({ p }: { p: PreviewPlayerRef }) {
  if (p.playerId != null) {
    return (
      <Link href={`/players/${p.playerId}/results/`} className="text-link hover:underline">
        {p.name}
      </Link>
    );
  }
  return <>{p.name}</>;
}

/**
 * 今大会の途中経過/敗退バッジ（進行中の年のみ。results 未掲載なら何も出ない）。
 * alive=進行中（緑）/ champion=優勝（琥珀）/ runnerup=準優勝（琥珀）/ eliminated=敗退（灰）
 * size='lg' は「注目の選手」カードの結果表示用（文中の添え物ではなく主役として大きく出す）。
 */
function StandingBadge({ standing, size = 'sm' }: { standing: EntryStanding | null; size?: 'sm' | 'lg' }) {
  if (!standing) return null;
  const cls =
    standing.state === 'alive'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
      : standing.state === 'eliminated'
        ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100';
  if (size === 'lg') {
    return <span className={`inline-block shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold ${cls}`}>{standing.label}</span>;
  }
  return <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>今大会: {standing.label}</span>;
}

/**
 * 「注目の選手」カード1件。
 * 過去の実績（前回入賞/過去の優勝/直近大会の好成績）はサブテキストに留め、
 * 今大会の結果を右側の大きいバッジで主役にする（文字の羅列で読みにくい問題への対応）。
 */
function PickPlayerCardItem({ card }: { card: PickPlayerCard }) {
  const borderCls =
    card.standing?.state === 'alive'
      ? 'border-emerald-300 dark:border-emerald-700'
      : card.standing?.state === 'champion' || card.standing?.state === 'runnerup'
        ? 'border-amber-300 dark:border-amber-700'
        : 'border-gray-200 dark:border-gray-700';
  return (
    <li className={`rounded-xl border px-4 py-3 ${borderCls}`}>
      {/*
        モバイルはバッジを上、名前・実績をフル幅で下に積む（flex-col）。名前が横幅を
        奪われず省略（truncate）せずに済む。sm 以上は従来の左右レイアウト（名前左・バッジ右）。
      */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="order-2 min-w-0 sm:order-1">
          <p className="break-words text-sm font-semibold">
            {card.players.length > 0 ? <PlayerNames players={card.players} perPlayerTeam={card.perPlayerTeam} /> : card.display}
          </p>
          {card.players.length > 0 && card.team && <p className="break-words text-xs text-text-muted">{card.team}</p>}
          {/* 前大会の実績。ペア解消の組み替えで複数由来がある場合は 1 行ずつ表示する。 */}
          {card.achievements.map((a, i) => (
            <p key={i} className="break-words text-xs text-text-muted">
              {a}
            </p>
          ))}
        </div>
        <div className="order-1 shrink-0 sm:order-2">
          {card.standing ? <StandingBadge standing={card.standing} size="lg" /> : <span className="text-xs text-gray-400 dark:text-gray-500">結果未掲載</span>}
        </div>
      </div>
    </li>
  );
}

/**
 * 選手名を「・」区切りで並べる（各名はリンク化されうる）。
 * perPlayerTeam が true のとき、選手ごとの所属を名前の直後に付ける。
 * ペア共通の所属がある（呼び出し側の team が非 null）場合はそちらをペア全体の末尾に
 * 一度だけ付ける運用なので、perPlayerTeam は所属が割れている（混成ペア）ときだけ渡すこと。
 */
function PlayerNames({ players, perPlayerTeam }: { players: PreviewPlayerRef[]; perPlayerTeam?: boolean }) {
  return (
    <>
      {players.map((p, i) => (
        <span key={`${p.name}-${i}`}>
          {i > 0 && '・'}
          <PlayerName p={p} />
          {perPlayerTeam && p.team && `（${p.team}）`}
        </span>
      ))}
    </>
  );
}

/** 前回王者を「まだ勝ち残っている／結果未定」なら琥珀で強調、敗退なら灰に落とす */
function isAliveOrOpen(s: EntryStanding | null): boolean {
  return s == null || s.state === 'alive' || s.state === 'champion' || s.state === 'runnerup';
}

/**
 * 連覇・防衛の行方（案A: 前回王者ヒーローカード）。
 * 前回王者はプレビューの見出し格なので、注目の選手より一段強い専用カードで主役化する。
 * intact=そのまま連覇挑戦 / absent=不在（灰） / partial・split=ペア解消（今大会ペアを行で並べる）。
 * 王者が敗退済みのときは琥珀を灰に落として過度な強調を避ける。
 */
function TitleDefenseHero({ td }: { td: TitleDefenseWatch }) {
  const heroAlive =
    td.status === 'absent' ? false : td.status === 'intact' ? isAliveOrOpen(td.standing) : td.currentEntries.some((ce) => isAliveOrOpen(ce.standing));
  const shellCls = heroAlive
    ? 'border-2 border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20'
    : 'border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40';
  const pillCls = heroAlive ? 'text-amber-800 dark:text-amber-200' : 'text-gray-500 dark:text-gray-400';

  // intact: 前回王者ペア/校がそのまま連覇に挑む
  const intactPill =
    td.standing?.state === 'champion'
      ? '連覇達成'
      : td.standing?.state === 'runnerup'
        ? '連覇ならず（準優勝）'
        : td.standing?.state === 'eliminated'
          ? '連覇ならず'
          : td.standing?.state === 'alive'
            ? '連覇挑戦中'
            : '連覇挑戦';

  return (
    <div className="mb-3">
      <h3 className="mb-2 text-sm font-semibold">連覇・防衛の行方</h3>

      {(td.status === 'intact' || td.status === 'absent') && (
        <div className={`rounded-xl px-4 py-3 ${shellCls}`}>
          {/* ラベルは常に上・フル幅。名前とバッジはモバイルで縦積み、sm 以上で左右に分ける。 */}
          <p className={`mb-1 inline-flex items-center gap-1 text-xs font-semibold ${pillCls}`}>
            {td.status === 'absent' ? '前回王者不在' : `前回王者・${intactPill}`}
          </p>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
            <div className="order-2 min-w-0 sm:order-1">
              <p className="break-words text-base font-semibold">
                {td.players.length > 0 ? <PlayerNames players={td.players} perPlayerTeam={!td.team} /> : td.defendingChampionDisplay}
              </p>
              <p className="break-words text-xs text-text-muted">
                {td.defendingYear}年優勝
                {td.team && ` ・ ${td.team}`}
              </p>
            </div>
            <div className="order-1 shrink-0 sm:order-2">
              {td.status === 'absent' ? (
                <span className="text-xs text-text-muted">新王者へ</span>
              ) : td.standing ? (
                <span className="inline-block whitespace-nowrap rounded-full bg-white px-3 py-1 text-sm font-semibold text-warning dark:bg-gray-900">
                  {td.standing.label}
                </span>
              ) : (
                <span className="text-xs text-gray-400 dark:text-gray-500">結果未掲載</span>
              )}
            </div>
          </div>
        </div>
      )}

      {(td.status === 'partial' || td.status === 'split') && (
        <div className={`rounded-xl px-4 py-3 ${shellCls}`}>
          <p className={`mb-1 inline-flex items-center gap-1 text-xs font-semibold ${pillCls}`}>前回王者ペア・ペア解消</p>
          <p className="break-words text-base font-semibold">
            {td.players.length > 0 ? <PlayerNames players={td.players} perPlayerTeam={!td.team} /> : td.defendingChampionDisplay}
          </p>
          <p className="break-words text-xs text-text-muted">
            {td.defendingYear}年優勝
            {td.team && ` ・ ${td.team}`}・{td.status === 'split' ? '双方が新ペアで連覇を狙う' : '継続選手が新ペアで連覇に挑む'}
          </p>
          <ul className="mt-2 flex flex-col gap-2 border-t border-warning-border pt-2">
            {td.currentEntries.map((ce, i) => (
              <li key={i} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="order-2 min-w-0 sm:order-1">
                  <p className="break-words text-sm font-semibold">
                    {ce.players.length > 0 ? <PlayerNames players={ce.players} perPlayerTeam={!ce.team} /> : td.defendingChampionDisplay}
                  </p>
                  {ce.team && <p className="break-words text-xs text-text-muted">{ce.team}</p>}
                </div>
                <div className="order-1 shrink-0 sm:order-2">
                  {ce.standing ? (
                    <StandingBadge standing={ce.standing} size="lg" />
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">結果未掲載</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function NewsArticlePage({ view }: { view: NewsArticleView }) {
  const { record, tournamentLabel, title, description, categories, hubHref } = view;
  const pageUrl = `https://softeni-pick.com/news/${record.articleId}/`;
  const isPreview = record.type === 'preview';

  // 記事専用 OGP（tools/sns-images/news_og.py がローカル生成）。無ければ既定カードへフォールバック。
  const hasArticleOg = Boolean(record.ogImage);
  const ogImageUrl = record.ogImage ? buildSiteUrl(record.ogImage) : siteConfig.ogImage;

  const publishedLabel = formatDate(record.createdAt);
  const updatedLabel = formatDate(record.updatedAt);

  const breadcrumbs = [
    { label: 'ホーム', href: '/' },
    { label: '大会展望', href: '/news/' },
    { label: title, href: `/news/${record.articleId}/` },
  ];

  // 本文で実名言及している選手（前回王者・注目の選手カード）を JSON-LD の mentions に載せる。
  // 結果ページを持つ選手のみ url を付ける（存在しない URL を構造化データに書かないため）。
  const mentionedPlayers = collectArticleMentions(categories);
  const mentions = mentionedPlayers.map((p) => ({
    '@type': 'Person',
    name: p.name,
    ...(p.playerId != null ? { url: buildSiteUrl(`/players/${p.playerId}/results/`) } : {}),
  }));

  return (
    <>
      <MetaHead
        title={`${title} | ソフトテニス情報`}
        description={description}
        url={pageUrl}
        type="article"
        image={ogImageUrl}
        {...(hasArticleOg
          ? {
              imageWidth: 1200,
              imageHeight: 630,
              twitterCardType: 'summary_large_image' as const,
            }
          : {})}
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'NewsArticle',
              headline: title,
              inLanguage: 'ja',
              url: pageUrl,
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': pageUrl,
              },
              image: [ogImageUrl],
              about: {
                '@type': 'Thing',
                name: `ソフトテニス ${tournamentLabel}`,
              },
              ...(mentions.length > 0 ? { mentions } : {}),
              author: {
                '@type': 'Organization',
                name: siteConfig.siteName,
                url: siteConfig.baseUrl,
              },
              publisher: {
                '@type': 'Organization',
                name: siteConfig.siteName,
                url: siteConfig.baseUrl,
                logo: {
                  '@type': 'ImageObject',
                  url: siteConfig.ogImage,
                },
              },
              ...(record.createdAt ? { datePublished: record.createdAt } : {}),
              dateModified: record.updatedAt ?? record.createdAt,
              description,
            }),
          }}
        />
      </Head>

      <PageLayout>
        <Breadcrumbs crumbs={breadcrumbs} />

        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        {(publishedLabel || updatedLabel) && (
          <p className="mb-2 text-xs text-text-muted">
            {publishedLabel && record.createdAt && <time dateTime={record.createdAt}>公開: {publishedLabel}</time>}
            {updatedLabel && record.updatedAt && record.updatedAt !== record.createdAt && (
              <time dateTime={record.updatedAt} className="ml-2">
                更新: {updatedLabel}
              </time>
            )}
          </p>
        )}
        <p className="mb-6 text-sm text-text-secondary">
          {description}
          <span className="ml-1 text-xs text-text-muted">※成績・記録は当サイト掲載大会分の集計に基づきます。</span>
        </p>

        {categories.length === 0 && <p className="text-sm text-gray-500">掲載データがありません。</p>}

        {categories.map((c) => (
          <section key={c.categoryId} className="mb-8 border-t border-border pt-5">
            <h2 className="mb-3 text-lg font-bold">{c.categoryLabel}</h2>

            {/* 結果速報: 優勝者 + milestone */}
            {!isPreview && c.champion && (
              <p className="mb-2 text-sm">
                <span className="font-semibold">優勝:</span> {c.champion}
              </p>
            )}
            {!isPreview && c.milestones.length > 0 && (
              <ul className="mb-3 flex flex-wrap gap-2">
                {c.milestones.map((m, i) => (
                  <li key={`${m.kind}-${i}`}>
                    <span className="inline-block rounded-full bg-warning-bg px-3 py-1 text-sm font-semibold text-warning">{m.label}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* プレビュー: 連覇・防衛の行方（案A: 前回王者ヒーローカード） */}
            {isPreview && c.titleDefense && <TitleDefenseHero td={c.titleDefense} />}
            {isPreview && !c.titleDefense && c.previousChampion && (
              <p className="mb-2 text-sm">
                <span className="font-semibold">前回王者:</span> {c.previousChampion}
              </p>
            )}

            {/*
              プレビュー: 注目の選手（前回入賞者の再登場 / 過去の優勝者の再挑戦 / 直近大会の好成績者を統合）。
              文章の羅列だと今大会の結果が読み取りにくいため、カード化して結果バッジを主役にし、
              今大会の結果（勝ち上がり中/優勝/準優勝 > 未掲載 > 敗退）順に並べる。
            */}
            {isPreview && c.pickPlayers.length > 0 && (
              <div className="mb-3">
                <h3 className="mb-2 text-sm font-semibold">注目の選手</h3>
                <ul className="flex flex-col gap-2">
                  {c.pickPlayers.map((card) => (
                    <PickPlayerCardItem key={card.id} card={card} />
                  ))}
                </ul>
              </div>
            )}

            {/* プレビュー: 出場規模・勢力図 */}
            {isPreview && c.fieldOverview && (
              <div className="mb-3">
                <h3 className="mb-1 text-sm font-semibold">今大会の概況</h3>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  出場 <span className="font-semibold">{c.fieldOverview.entryCount}</span>
                  {c.categoryId.startsWith('singles') ? '選手' : c.categoryId.startsWith('doubles') ? 'ペア' : c.categoryId.startsWith('team') ? '校' : '組'}。
                  {c.fieldOverview.topPrefectures.length > 0 && (
                    <> 都道府県別では {c.fieldOverview.topPrefectures.map((p) => `${p.prefecture}${p.count}`).join('、')} が上位。</>
                  )}
                </p>
                {c.fieldOverview.multiEntryTeams.length > 0 && (
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    複数エントリー校: {c.fieldOverview.multiEntryTeams.map((t) => `${t.team}（${t.count}）`).join('、')}
                  </p>
                )}
              </div>
            )}

            {/* 共通: 歴代優勝者 */}
            {c.historicalWinners.length > 0 && (
              <div>
                <h3 className="mb-1 text-sm font-semibold">歴代優勝者</h3>
                <ul className="list-inside list-disc space-y-0.5 text-sm text-gray-700 dark:text-gray-200">
                  {c.historicalWinners.map((w) => (
                    <li key={w.year}>
                      {w.year}年: {w.display ?? '—'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 結果速報: その年・種目の結果詳細ページへ */}
            {!isPreview && c.resultHref && (
              <p className="mt-3 text-sm">
                <Link href={c.resultHref} className="text-link hover:underline">
                  {record.year}年 {c.categoryLabel} の結果詳細を見る →
                </Link>
              </p>
            )}

            {/* プレビュー: その年・種目の大会結果ページへ（結果掲載後のみリンク化） */}
            {isPreview && c.resultHref && (
              <p className="mt-3 text-sm">
                <Link href={c.resultHref} className="text-link hover:underline">
                  {record.year}年 {c.categoryLabel} の大会結果を見る →
                </Link>
              </p>
            )}
          </section>
        ))}

        {hubHref && (
          <div className="mt-10 border-t border-border pt-5">
            <h2 className="mb-2 text-base font-bold">関連ページ</h2>
            <ul className="list-inside list-disc space-y-1 text-sm">
              <li>
                <Link href={hubHref} className="text-link hover:underline">
                  {tournamentLabel} の歴代優勝者・大会まとめ
                </Link>
              </li>
            </ul>
          </div>
        )}

        <div className="mt-10 text-right">
          <Link href="/news/" className="text-sm text-blue-500 hover:underline">
            ニュース一覧へ
          </Link>
        </div>
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  // 展望（preview）のみビルドする。結果記事は廃止し、結果・優勝・歴代まとめは
  // 大会ハブ／高校歴代ページに集約した（ADR-008）。
  const paths = listPublishedPreviews().map((r) => ({
    params: { articleId: r.articleId },
  }));
  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const articleId = (context.params as { articleId: string }).articleId;
  const record = getArticleRecord(articleId);
  if (!record || record.state !== 'published' || record.type !== 'preview') {
    return { notFound: true };
  }
  return { props: { view: buildNewsArticleView(record) } };
};
