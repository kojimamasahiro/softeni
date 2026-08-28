// pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx

import fs from 'fs';
import path from 'path';

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import AdUnit from '@/components/AdUnit';
import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import ResultContextBlocks, { type InsightSummary, type PriorMeetingSummary } from '@/components/ResultContextBlocks';
import MatchResults from '@/components/Tournament/MatchResults';
import ResultCoverageNotice from '@/components/Tournament/ResultCoverageNotice';
import TeamResults from '@/components/Tournament/TeamResults';
import TournamentBracket from '@/components/Tournament/TournamentBracket';
import type { ContextMilestone } from '@/components/TournamentContextBlocks';
import { AD_SLOTS } from '@/lib/ads';
import { getScoreMatchLinksForTournament, type ScoreMatchLink } from '@/lib/matchReverseIndex';
import { getChampionDefeat, getChampionMilestones, getGiantKillings, suppressChampionDefeatIfDuplicate } from '@/lib/milestones';
import { getPublishedInsight } from '@/lib/tournamentInsight';
import { findPublishedPreviewForTournament } from '@/lib/newsArticle';
import { PackedTournamentDetailData, packTournamentDetailData, unpackTournamentDetailData } from '@/lib/packedPageData';
import { getPlayerIdToName, getPlayerNameToId } from '@/lib/playersIndex';
import { resolveAliasedPlayerId, resolveAliasedTeam } from '@/lib/playerStats/participantAliases';
import { buildSiteUrl } from '@/lib/siteConfig';
import { getTournamentOgImage } from '@/lib/tournamentOgImage';
import { buildPriorMeetingIndex, meetingKey } from '@/lib/priorMeetings';
import { buildEventOrganizer, buildEventPlace, resolveEventDates, sportsEventBaseFields } from '@/lib/sportsEventJsonLd';
import { applyAbandonment, getAbandonment } from '@/lib/tournamentAbandonment';
import { computeResultCoverage, formatResultCoverageMetaSuffix } from '@/lib/tournamentCoverage';
import { getHistoricalWinners } from '@/lib/tournamentRecords';
import { buildTournamentSearchNames } from '@/lib/tournamentSearchNames';
import { TournamentDetailData, TournamentIndexEntry, TournamentInformationEntry } from '@/types/index';

type LinkCategory = {
  label: string;
  year: string;
  category: string;
  gender: string;
  age: string;
  isCurrent: boolean;
};

type HighschoolTeamLink = {
  prefectureId: string;
  teamId: string;
};

interface TournamentYearResultPageProps {
  generation: string;
  tournamentId: string;
  year: string;
  gameCategory: string;
  ageCategory: string;
  gender: string;
  label: string;
  /** 検索で使われる大会名。未設定なら label。docs/wiki/seo.md「大会名の表記と検索語の乖離」 */
  searchLabel?: string | null;
  /** 略称。先頭1件を title / h1 に併記する */
  searchAliases?: string[];
  categoryLabel: string;
  infoForYear: TournamentInformationEntry | null;
  detailDataPacked: PackedTournamentDetailData | null;
  linkCategories: LinkCategory[] | null;
  infoWarnings?: string[];
  detailsWarnings?: string[];
  federationId?: string | null;
  highschoolTeamLinks?: Record<string, HighschoolTeamLink> | null;
  prefectureName?: string | null;
  blockId?: string | null;
  blockName?: string | null;
  scoreMatchLinks?: ScoreMatchLink[];
  // 文脈ブロック（連覇 / 初優勝 / 王者撃破）。docs/wiki/news-context-blocks.md
  contextMilestones?: ContextMilestone[];
  // 文脈ブロック「前哨戦・再戦」。この年・種目で実際に組まれた対戦のうち、
  // 直近の他大会（主に地区大会）で既に対戦していたもの。lib/priorMeetings.ts
  priorMeetingCards?: PriorMeetingSummary[];
  /**
   * 大会インサイト（LLM執筆・機械照合済みの読み物）。ADR-012。
   * 未公開・未検証なら null で、その場合セクションに何も出さない。
   */
  insight?: InsightSummary | null;
  // 対応する展望（preview）記事の articleId（あれば）。/news への内部リンク用。
  // 「結果」を狙うリンクではないため、SEO カニバリの心配なく張れる（docs/wiki/seo.md #8）。
  previewArticleId?: string | null;
  /**
   * この大会・年度・種目の OGP 画像（ベスト8のトーナメント表、1200x630）。
   * 決勝が未確定なら null で、既定の summary カードにフォールバックする。
   * 生成: tools/sns-images/tournament_og.py
   */
  ogImage?: string | null;
}

export default function TournamentYearResultPage({
  generation,
  tournamentId,
  year,
  gameCategory,
  ageCategory,
  gender,
  label,
  searchLabel = null,
  searchAliases = [],
  categoryLabel,
  infoForYear,
  detailDataPacked,
  linkCategories,
  infoWarnings = [],
  detailsWarnings = [],
  federationId = null,
  highschoolTeamLinks = null,
  prefectureName = null,
  blockId = null,
  blockName = null,
  scoreMatchLinks = [],
  contextMilestones = [],
  priorMeetingCards = [],
  insight = null,
  previewArticleId = null,
  ogImage = null,
}: TournamentYearResultPageProps) {
  const pageUrl = `https://softeni-pick.com/tournaments/${generation}/${tournamentId}/${year}/${gameCategory}/${ageCategory}/${gender}/`;

  // 検索で使われる名前を title / h1 に literal で出す。searchLabel / searchAliases が
  // 未設定の大会では headingName === label となり、出力は従来と 1 文字も変わらない。
  // docs/wiki/seo.md「大会名の表記と検索語の乖離（missing literal）」
  const { headingName } = buildTournamentSearchNames(label, searchLabel, searchAliases);

  const [filter, setFilter] = useState<'all' | 'top8' | 'winners'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const detailData = useMemo(() => (detailDataPacked ? unpackTournamentDetailData(detailDataPacked) : null), [detailDataPacked]);

  // 打ち切り情報は detailData から導出できない（読み出し時点で ongoing が解決済みのため）ので
  // information から引く。打ち切りでない大会では null で、以降の挙動は一切変わらない。
  const categoryId = `${gameCategory}-${ageCategory}-${gender}`;
  const abandonment = useMemo(() => getAbandonment(infoForYear?.categories, categoryId), [infoForYear, categoryId]);

  // 「どこまで結果が反映されているか」。ADR-007 Open Question対応。
  // completed/unsupported（過去の完了済み大会や予選リーグのみのデータ）では
  // meta description・本文とも変化なし。
  const resultCoverage = useMemo(() => computeResultCoverage(detailData, abandonment), [detailData, abandonment]);
  const coverageMetaSuffix = formatResultCoverageMetaSuffix(resultCoverage);

  const breadcrumbs = [
    { label: 'ホーム', href: '/' },
    { label: '大会結果一覧', href: '/tournaments' },
  ];

  if (federationId && prefectureName) {
    breadcrumbs.push({ label: '地域大会', href: '/tournaments/local' });
    breadcrumbs.push({
      label: prefectureName,
      href: `/tournaments/local/${federationId}`,
    });
  }

  if (blockId && blockName) {
    breadcrumbs.push({ label: '地区大会', href: '/tournaments/block' });
    breadcrumbs.push({
      label: `${blockName}地区`,
      href: `/tournaments/block/${blockId}`,
    });
  }

  if (label) {
    breadcrumbs.push({
      label: `${label} 結果`,
      href: `/tournaments/${generation}/${tournamentId}`,
    });
  }

  breadcrumbs.push({
    label: `${label} ${year}年度 ${categoryLabel ? `${categoryLabel}` : ''}`,
    href: `/tournaments/${generation}/${tournamentId}/${year}/${gameCategory}/${ageCategory}/${gender}`,
  });

  return (
    <>
      <MetaHead
        title={`${headingName} ${year}年${categoryLabel ? ` ${categoryLabel}` : ''} 結果・トーナメント表 | ソフトテニス情報`}
        description={`ソフトテニス「${headingName}」${year}年${categoryLabel ? ` ${categoryLabel}` : ''}の試合結果・トーナメント表・優勝/上位入賞者の成績一覧。${infoForYear?.location ? `開催地は${infoForYear.location}。` : ''}過去大会の結果もまとめて掲載しています。${coverageMetaSuffix ?? ''}`}
        url={pageUrl}
        type="article"
        {...(ogImage ? { image: buildSiteUrl(ogImage), imageWidth: 1200, imageHeight: 630, twitterCardType: 'summary_large_image' as const } : {})}
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: `${label} ${year}年度  ${categoryLabel ? `${categoryLabel} ` : ''}大会結果`,
              author: { '@type': 'Person', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
              ...(infoForYear?.startDate && {
                datePublished: infoForYear.startDate,
              }),
              ...((infoForYear?.endDate || infoForYear?.startDate) && {
                dateModified: infoForYear?.endDate || infoForYear?.startDate,
              }),
              inLanguage: 'ja',
              mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
              description: `ソフトテニス「${label}」${year}年度${categoryLabel ? ` ${categoryLabel}` : ''}の試合結果・トーナメント表・優勝/上位入賞者の成績一覧。過去大会の結果もまとめて掲載しています。`,
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SportsEvent',
              name: `${label} ${year}年${categoryLabel ? ` ${categoryLabel}` : ''} 結果`,
              sport: 'ソフトテニス',
              inLanguage: 'ja',
              url: pageUrl,
              ...sportsEventBaseFields,
              ...resolveEventDates(infoForYear?.startDate, infoForYear?.endDate),
              location: buildEventPlace(infoForYear?.location),
              organizer: buildEventOrganizer(),
              description: `ソフトテニス「${label}」${year}年${categoryLabel ? ` ${categoryLabel}` : ''}の試合結果・トーナメント表・成績一覧。`,
            }),
          }}
        />

        <meta name="viewport" content="width=device-width,initial-scale=1.0"></meta>
      </Head>

      <PageLayout>
        <Breadcrumbs crumbs={breadcrumbs} />

        {/* h1 + 大会紹介文 */}
        <h1 className="text-2xl font-bold mb-4">
          {headingName} {year}年度 {categoryLabel ? `${categoryLabel} ` : ''}
          大会結果
        </h1>

        {/* どこまで結果が反映されているか（進行中/組み合わせのみ/打ち切りの大会でのみ表示） */}
        <ResultCoverageNotice coverage={resultCoverage} />

        <section className="mb-6 px-1">
          <p className="mb-2 text-sm text-gray-700 dark:text-gray-200">
            ソフトテニス「{label}」{year}年度
            {categoryLabel ? `${categoryLabel} ` : ''}
            の試合結果・トーナメント表・優勝/上位入賞者の成績一覧です。
          </p>
          {infoForYear?.location && infoForYear?.startDate && infoForYear?.endDate && (
            <p className="text-sm text-text-secondary">
              開催地:{infoForYear.location} / 日程:
              {infoForYear.startDate}〜{infoForYear.endDate}
            </p>
          )}
          {previewArticleId && (
            <p className="mt-2 text-sm">
              <Link href={`/news/${previewArticleId}/`} className="text-link hover:underline">
                {label} {year}年の展望・注目選手はこちら
              </Link>
            </p>
          )}
        </section>

        {/* 主力枠。リード文（開催地・日程・展望リンク）の直後＝ファーストビュー内に置く
            （2026-08-23 変更。経緯は docs/adr/ADR-016 の追記）。年度・カテゴリ切り替えの
            「後」だと 375x812 実測で top=628px となり枠の下半分が折り返し下に落ちたため、
            切り替えUIの「前」にした。この下の読み物（注目ポイント・トーナメント表・
            チーム別成績・試合結果一覧）は一切分断しない。 */}
        <AdUnit slot={AD_SLOTS.tournamentResult} />

        {/* 年度・カテゴリ切り替え */}
        {linkCategories &&
          linkCategories.length > 0 &&
          (() => {
            // 年度は「その年度に何かカテゴリがある」だけで候補に出す。選択中カテゴリが
            // その年度に無ければ、近いカテゴリへフォールバックして遷移先を決める
            // （完全一致 → 同カテゴリ・同性別 → 同カテゴリ → その年度の先頭カテゴリ）。
            const categoriesByYear = linkCategories.reduce<Record<string, LinkCategory[]>>((acc, link) => {
              if (!acc[link.year]) acc[link.year] = [];
              acc[link.year].push(link);
              return acc;
            }, {});

            const yearOptions = Object.keys(categoriesByYear)
              .sort((a, b) => Number(b) - Number(a))
              .map((yearValue) => {
                const links = categoriesByYear[yearValue];
                const exact = links.find((l) => l.category === gameCategory && l.age === ageCategory && l.gender === gender);
                const fallback =
                  exact ?? links.find((l) => l.category === gameCategory && l.gender === gender) ?? links.find((l) => l.category === gameCategory) ?? links[0];
                return { yearValue, target: fallback, isExact: Boolean(exact) };
              });

            const categoryOptions = linkCategories
              .filter((link) => link.year === year)
              .reduce<LinkCategory[]>((acc, link) => {
                if (!acc.some((l) => l.category === link.category && l.age === link.age && l.gender === link.gender)) acc.push(link);
                return acc;
              }, []);

            if (yearOptions.length <= 1 && categoryOptions.length <= 1) return null;

            return (
              <section className="mb-6 space-y-3">
                {yearOptions.length > 1 && (
                  <div>
                    <h2 className="text-sm font-semibold text-text-secondary mb-2">年度を切り替え</h2>
                    <ul className="flex flex-wrap gap-2">
                      {yearOptions.map(({ yearValue, target, isExact }) =>
                        yearValue === year ? (
                          <li key={yearValue}>
                            <span className="inline-block bg-gray-300 text-gray-600 px-3 py-1 rounded-full text-sm cursor-default">{yearValue}年度</span>
                          </li>
                        ) : (
                          <li key={yearValue}>
                            <Link href={`/tournaments/${generation}/${tournamentId}/${yearValue}/${target.category}/${target.age}/${target.gender}`}>
                              <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm hover:opacity-80 transition">
                                {yearValue}年度
                                {!isExact && <span className="ml-1 text-xs text-blue-500">（{target.label}）</span>}
                              </span>
                            </Link>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

                {categoryOptions.length > 1 && (
                  <div>
                    <h2 className="text-sm font-semibold text-text-secondary mb-2">カテゴリを切り替え</h2>
                    <ul className="flex flex-wrap gap-2">
                      {categoryOptions.map((link) =>
                        link.isCurrent ? (
                          <li key={`${link.category}-${link.age}-${link.gender}`}>
                            <span className="inline-block bg-gray-300 text-gray-600 px-3 py-1 rounded-full text-sm cursor-default">{link.label}</span>
                          </li>
                        ) : (
                          <li key={`${link.category}-${link.age}-${link.gender}`}>
                            <Link href={`/tournaments/${generation}/${tournamentId}/${year}/${link.category}/${link.age}/${link.gender}`}>
                              <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm hover:opacity-80 transition">
                                {link.label}
                              </span>
                            </Link>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </section>
            );
          })()}

        {/* 注目ポイント（過去データ由来: 連覇 / 初優勝 / 王者撃破） */}
        <ResultContextBlocks label={label} year={year} milestones={contextMilestones} priorMeetings={priorMeetingCards} insight={insight} />

        {/* トーナメント表 */}
        {detailData && <TournamentBracket detailData={detailData} gameCategory={gameCategory} abandonedAfterRound={abandonment?.abandonedAfterRound ?? null} />}

        {/* スコア詳細（ポイント分析つき試合） */}
        {scoreMatchLinks.length > 0 && (
          <section className="mb-6 rounded-lg border border-success-border bg-success-bg p-4">
            <h2 className="mb-2 text-base font-bold text-success">スコア詳細のある試合</h2>
            <p className="mb-3 text-xs text-success">ポイントごとの記録・分析を掲載しています。</p>
            <ul className="divide-y divide-emerald-200/70 dark:divide-emerald-900/60">
              {scoreMatchLinks.map((link) => (
                <li key={link.matchId}>
                  <Link
                    href={link.detailPath}
                    className="flex items-center gap-2 py-2 text-sm text-success transition-colors hover:text-emerald-700 dark:hover:text-emerald-300"
                  >
                    {link.round && <span className="shrink-0 rounded bg-success-bg px-1.5 py-0.5 text-xs font-semibold text-success">{link.round}</span>}
                    <span className="font-medium">
                      {link.teamA} vs {link.teamB}
                    </span>
                    <span aria-hidden className="ml-auto text-emerald-500">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* チーム別成績 */}
        <TeamResults
          detailData={detailData ? [detailData] : []}
          highschoolGender={generation === 'highschool' ? gender : null}
          highschoolTeamLinks={highschoolTeamLinks}
        />

        {(infoWarnings.length > 0 || detailsWarnings.length > 0) && (
          <section className="mt-6 mb-6 p-4 bg-warning-bg border border-warning-border rounded">
            <h3 className="font-semibold mb-2">データ警告</h3>
            <ul className="list-disc list-inside text-sm">
              {infoWarnings.map((w, i) => (
                <li key={`info-${i}`}>{w}</li>
              ))}
              {detailsWarnings.map((w, i) => (
                <li key={`det-${i}`}>{w}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="text-right mt-10 mb-2">
          <Link href="/tournaments" className="text-sm text-blue-500 hover:underline">
            大会結果一覧
          </Link>
        </div>

        {detailData && (
          <>
            <MatchResults
              detail={detailData}
              gameCategory={gameCategory}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filter={filter}
              setFilter={setFilter}
            />
          </>
        )}

        {infoForYear?.source && (
          <section className="mt-12 bg-gray-50 dark:bg-gray-800 border border-border rounded-lg p-5 text-sm text-text-secondary shadow-sm">
            <h2 className="text-base font-semibold text-text mb-2">出典・参考情報</h2>
            <p className="mb-3">本ページの試合結果データは、以下の情報をもとに作成しています。</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                {infoForYear.sourceUrl ? (
                  <a href={infoForYear.sourceUrl} className="text-link hover:underline font-medium" target="_blank" rel="noopener noreferrer">
                    {infoForYear.source}
                  </a>
                ) : (
                  <span className="font-medium">{infoForYear.source}</span>
                )}
              </li>
              <li>一部の情報は現地観戦や報道発表、X（旧Twitter）などから収集しています。</li>
            </ul>
            <p className="mt-3 text-xs text-text-muted">内容に誤りがある場合は、ページ下部のお問い合わせからご連絡ください。</p>
          </section>
        )}
      </PageLayout>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  // Build paths by scanning data/tournaments/details directory. We don't rely on data/tournaments.
  const detailsRoot = path.join(process.cwd(), 'data', 'tournaments', 'details');
  const paths: {
    params: {
      generation: string; // keep generation empty string because details doesn't include generation; caller expects a value - use 'unknown'
      tournamentId: string;
      year: string;
      gameCategory: string;
      ageCategory: string;
      gender: string;
    };
  }[] = [];

  if (!fs.existsSync(detailsRoot)) {
    return { paths: [], fallback: false };
  }

  const tournamentIds = fs.readdirSync(detailsRoot).filter((n) => {
    const p = path.join(detailsRoot, n);
    return fs.statSync(p).isDirectory();
  });

  // try to load data/tournaments/index.json to map tournamentId -> generationId
  const indexPath = path.join(process.cwd(), 'data', 'tournaments', 'index.json');
  const localIndexPath = path.join(process.cwd(), 'data', 'tournaments', 'local_index.json');
  const tournamentGenerationMap: Record<string, string> = {};

  const loadIndex = (p: string) => {
    if (fs.existsSync(p)) {
      try {
        const idx = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (Array.isArray(idx)) {
          for (const it of idx) {
            if (it && typeof it === 'object') {
              const entry = it as Record<string, unknown>;
              const tidVal = entry['tournamentId'];
              if (typeof tidVal === 'string' || typeof tidVal === 'number') {
                const tid = String(tidVal);
                const genVal = entry['generationId'];
                const gen = typeof genVal === 'string' || typeof genVal === 'number' ? String(genVal) : 'unknown';
                tournamentGenerationMap[tid] = gen;
              }
            }
          }
        }
      } catch (err) {
        void err;
      }
    }
  };

  loadIndex(indexPath);
  loadIndex(localIndexPath);

  for (const tid of tournamentIds) {
    const tidDir = path.join(detailsRoot, tid);
    const years = fs.readdirSync(tidDir).filter((y) => {
      const p = path.join(tidDir, y);
      return fs.statSync(p).isDirectory();
    });

    for (const y of years) {
      const yearDir = path.join(tidDir, y);
      const files = fs.readdirSync(yearDir).filter((f) => f.endsWith('.json'));
      for (const f of files) {
        const base = f.replace(/\.json$/, '');
        const parts = base.split('-');
        // expect [gameCategory, ageCategory, gender]
        if (parts.length < 3) continue;
        const gender = parts.pop() as string;
        const ageCategory = parts.pop() as string;
        const gameCategory = parts.join('-');

        paths.push({
          params: {
            generation: tournamentGenerationMap[tid] ?? 'unknown',
            tournamentId: tid,
            year: y,
            gameCategory,
            ageCategory,
            gender,
          },
        });
      }
    }
  }

  return {
    paths,
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { generation, tournamentId, year, gameCategory, ageCategory, gender } = context.params as {
    generation: string;
    tournamentId: string;
    year: string;
    gameCategory: string;
    ageCategory: string;
    gender: string;
  };

  const indexPath = path.join(process.cwd(), 'data', 'tournaments', 'index.json');
  const localIndexPath = path.join(process.cwd(), 'data', 'tournaments', 'local_index.json');

  let tournamentIndexEntry: TournamentIndexEntry | null = null;

  const loadIndexEntry = (p: string) => {
    if (fs.existsSync(p)) {
      try {
        const index = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (Array.isArray(index)) {
          for (const it of index) {
            if (it && typeof it === 'object') {
              const entry = it as TournamentIndexEntry;
              if (entry['tournamentId'] === tournamentId) {
                return entry;
              }
            }
          }
        }
      } catch (err) {
        console.error(`failed to parse index json: ${p}`, err);
      }
    }
    return null;
  };

  tournamentIndexEntry = loadIndexEntry(indexPath);
  if (!tournamentIndexEntry) {
    tournamentIndexEntry = loadIndexEntry(localIndexPath);
  }
  const playerIndexMap = getPlayerNameToId();
  const playerIdToNameMap = getPlayerIdToName();
  const infoPath = path.join(process.cwd(), 'data', 'tournaments', 'information', `${tournamentId}.json`);
  const infoWarnings: string[] = [];
  let infoForYear: TournamentInformationEntry | null = null;
  let linkCategories: LinkCategory[] | null = null;

  if (fs.existsSync(infoPath)) {
    try {
      const raw = fs.readFileSync(infoPath, 'utf-8');
      const parsed = JSON.parse(raw) as TournamentInformationEntry[];
      infoForYear = parsed.find((entry) => String(entry.year) === String(year)) ?? null;

      linkCategories = parsed.flatMap((entry) =>
        (entry.categories ?? []).map((cat) => ({
          label: cat.label,
          year: String(entry.year),
          category: cat.category,
          gender: cat.gender,
          age: cat.age,
          isCurrent: String(entry.year) === String(year) && cat.category === gameCategory && cat.gender === gender && cat.age === ageCategory,
        })),
      );

      if (!infoForYear) {
        infoWarnings.push(`information file found but no entry for year ${year}`);
      }
    } catch (err) {
      infoWarnings.push(`information JSON parse error: ${infoPath} - ${String(err)}`);
    }
  } else {
    infoWarnings.push(`information file not found: ${path.relative(process.cwd(), infoPath)}`);
  }

  // We no longer read from data/tournaments; use details + information as canonical sources
  const detailsBase = path.join(process.cwd(), 'data', 'tournaments', 'details', tournamentId);

  // category file name
  const categoryId = `${gameCategory}-${ageCategory}-${gender}`;
  const detailsPath = path.join(detailsBase, year, `${categoryId}.json`);

  // 打ち切り大会なら results の rank.kind:'ongoing' を確定成績へ解決する。
  // このページは loadTournamentData を経由せず fs で直接 detail を読むため、
  // ここでも明示的に適用が要る（lib/tournamentAbandonment.ts）。
  const abandonment = getAbandonment(infoForYear?.categories, categoryId);

  let detailData: TournamentDetailData | null = null;
  const detailsWarnings: string[] = [];
  if (fs.existsSync(detailsPath)) {
    try {
      detailData = JSON.parse(fs.readFileSync(detailsPath, 'utf-8'));
      if (detailData) {
        detailData = applyAbandonment(detailData, abandonment, `${tournamentId}/${year}/${categoryId}`);
      }

      // Resolve player IDs
      if (detailData && Array.isArray(detailData.participants)) {
        for (const p of detailData.participants) {
          if (p.lastName && p.firstName) {
            const key = `${p.lastName}::${p.firstName}`;
            let pid = playerIndexMap.get(key);
            // 国際大会などローマ字表記のみの参加者は姓名の完全一致では解決できないため、
            // 大会・年度スコープの手動対応表(data/tournaments/participant-aliases.json)を試す。
            // 解決できた場合は表示も対応表の実在情報（漢字名・実所属）に差し替える。
            if (pid === undefined) {
              const aliasedId = resolveAliasedPlayerId(tournamentId, year, p.lastName, p.firstName);
              if (aliasedId !== null) {
                const realTeam = resolveAliasedTeam(tournamentId, year, p.lastName, p.firstName);
                const kanjiName = playerIdToNameMap.get(aliasedId);
                pid = aliasedId;
                if (kanjiName) {
                  p.lastName = kanjiName.lastName;
                  p.firstName = kanjiName.firstName;
                }
                if (realTeam) {
                  p.team = realTeam;
                }
              }
            }
            if (pid !== undefined) {
              p.playerId = pid;
            }
          }
        }
      }
    } catch (err) {
      detailsWarnings.push(`details JSON parse error: ${detailsPath} - ${String(err)}`);
    }
  } else {
    detailsWarnings.push(`details file not found: ${path.relative(process.cwd(), detailsPath)}`);
  }

  // Resolving Federation / Prefecture info if available
  const federationId = tournamentIndexEntry?.federationId ?? null;
  let prefectureName: string | null = null;
  let highschoolTeamLinks: Record<string, HighschoolTeamLink> | null = null;

  if (federationId) {
    const prefPath = path.join(process.cwd(), 'data', 'prefectures.json');
    if (fs.existsSync(prefPath)) {
      try {
        const prefs = JSON.parse(fs.readFileSync(prefPath, 'utf-8')) as Array<{
          id: string;
          name: string;
        }>;
        const target = prefs.find((p) => p.id === federationId);
        if (target) {
          prefectureName = target.name;
        }
      } catch {
        // ignore
      }
    }
  }

  // Resolving Block（高校総体の地区大会など複数都道府県にまたがる大会）info if available
  const blockId = tournamentIndexEntry?.blockId ?? null;
  let blockName: string | null = null;

  if (blockId) {
    const blocksPath = path.join(process.cwd(), 'data', 'tournaments', 'blocks.json');
    if (fs.existsSync(blocksPath)) {
      try {
        const blocks = JSON.parse(fs.readFileSync(blocksPath, 'utf-8')) as Array<{
          id: string;
          name: string;
        }>;
        const target = blocks.find((b) => b.id === blockId);
        if (target) {
          blockName = target.name;
        }
      } catch {
        // ignore
      }
    }
  }

  if (generation === 'highschool' && detailData?.participants?.length) {
    const highschoolSummaryPath = path.join(process.cwd(), 'data', 'highschool', 'prefecture-summary.json');

    if (fs.existsSync(highschoolSummaryPath)) {
      try {
        const summaryEntries = JSON.parse(fs.readFileSync(highschoolSummaryPath, 'utf-8')) as Array<{
          prefecture: string;
          prefectureId: string;
          team: string;
          teamId: string;
        }>;

        const relevantKeys = new Set(
          detailData.participants.filter((participant) => participant.team).map((participant) => `${participant.team}::${participant.prefecture ?? ''}`),
        );

        highschoolTeamLinks = {};
        for (const entry of summaryEntries) {
          const key = `${entry.team}::${entry.prefecture ?? ''}`;
          if (!relevantKeys.has(key) || highschoolTeamLinks[key]) continue;

          highschoolTeamLinks[key] = {
            teamId: entry.teamId,
            prefectureId: entry.prefectureId,
          };
        }
      } catch (err) {
        detailsWarnings.push(`highschool team summary parse error: ${path.relative(process.cwd(), highschoolSummaryPath)} - ${String(err)}`);
      }
    }
  }

  // 掲載大会 → 試合詳細（score 系）の逆引きリンク
  const tournamentPath = `/tournaments/${generation}/${tournamentId}/${year}/${gameCategory}/${ageCategory}/${gender}`;
  const scoreMatchLinks = getScoreMatchLinksForTournament(tournamentPath);

  // 対応する展望（preview）記事があれば articleId を渡す（/news への内部リンク用）
  const previewYearNum = Number(year);
  const previewArticleId = Number.isFinite(previewYearNum) ? (findPublishedPreviewForTournament(tournamentId, previewYearNum)?.articleId ?? null) : null;

  // --- 文脈ブロック（過去データ由来のイベント）---
  // docs/wiki/news-context-blocks.md / ADR-005。
  // この年・種目の優勝者視点の milestone（連覇 / 初優勝）と、前回王者視点の
  // champion-defeat（王者撃破）を生成する。historical-winners は両者で共有して
  // 二重走査を避ける。
  const contextMilestones: ContextMilestone[] = [];
  const targetYearNum = Number(year);
  if (Number.isFinite(targetYearNum)) {
    const hw = getHistoricalWinners(tournamentId, categoryId, {
      targetYear: targetYearNum,
    });
    const championMs = getChampionMilestones(tournamentId, categoryId, targetYearNum, hw);
    const giantKillings = getGiantKillings(tournamentId, categoryId, targetYearNum);
    // 前回王者撃破が金星と同一試合の場合は金星を優先（二重表示の抑制）。
    const defeat = suppressChampionDefeatIfDuplicate(getChampionDefeat(tournamentId, categoryId, targetYearNum, hw), giantKillings);
    // 重要度順: repeat-title / first-title（getChampionMilestones で整列済み）→ giant-killing → champion-defeat。
    const events = [...(championMs?.events ?? []), ...giantKillings, ...(defeat ? [defeat] : [])];
    for (const e of events) {
      contextMilestones.push({
        kind: e.kind,
        // 大会結果ページは見出しで既に種目・性別を示しているため、種目名を含まない
        // resultLabel（例:「名前 2連覇（2025年〜）」）を使う。
        label: e.resultLabel,
        confidence: e.confidence,
        scopeNote: e.scopeNote ?? null,
      });
    }
  }

  // --- 文脈ブロック「前哨戦・再戦」---
  // 出場ペアどうしが直近の他大会（同一世代・同一種目・3ヶ月以内。主に地区大会）で
  // 既に対戦していた事実を、この年・種目の結果ページにも出す。プレビュー記事と同じ
  // lib/priorMeetings.ts を共有する（ADR-005「文脈ブロックが一次成果物」）。
  // ペア単位で照合するため団体戦・シングルスでは空になる（graceful）。
  const priorMeetingCards: PriorMeetingSummary[] = [];
  if (Number.isFinite(targetYearNum)) {
    const idx = buildPriorMeetingIndex(tournamentId, targetYearNum, categoryId, generation || null);
    if (idx.size > 0 && detailData?.matches?.length) {
      // 結果ページでは「今大会で実際に組まれた対戦」に絞る＝正真正銘の再戦だけを出す。
      // プレビュー側が「起こりうるカード」を見せるのと役割を分ける（カニバリ回避）。
      for (const m of detailData.matches) {
        const es = m.entries ?? [];
        if (es.length !== 2) continue;
        const list = idx.get(meetingKey(es[0], es[1]));
        if (!list?.length) continue;
        const prev = list[0];
        // この試合が決着していれば勝敗も持たせる（前回敗れた側が勝てば「雪辱」）。
        const curWinner = m.winnerEntryNo ?? null;
        priorMeetingCards.push({
          round: m.round ?? null,
          winnerNames: prev.winnerNames,
          loserNames: prev.loserNames,
          priorLabel: prev.tournamentLabel,
          priorYear: prev.year,
          priorRound: prev.round,
          currentWinnerNames: curWinner == null ? null : curWinner === prev.winnerEntryNo ? prev.winnerNames : prev.loserNames,
          revenge: curWinner != null && curWinner === prev.loserEntryNo,
        });
      }
    }
  }

  return {
    props: ((): Record<string, unknown> => {
      return {
        generation,
        tournamentId,
        year,
        gameCategory,
        ageCategory,
        gender,
        label: tournamentIndexEntry?.label ?? '',
        searchLabel: tournamentIndexEntry?.searchLabel ?? null,
        searchAliases: tournamentIndexEntry?.searchAliases ?? [],
        categoryLabel: infoForYear?.categories?.find((cat) => cat.categoryId === `${gameCategory}-${ageCategory}-${gender}`)?.label ?? '',
        infoForYear,
        detailDataPacked: detailData ? packTournamentDetailData(detailData) : null,
        linkCategories,
        infoWarnings,
        detailsWarnings,
        federationId,
        highschoolTeamLinks,
        prefectureName,
        blockId,
        blockName,
        scoreMatchLinks,
        contextMilestones,
        priorMeetingCards,
        insight: (() => {
          const found = getPublishedInsight(tournamentId, year, categoryId);
          return found ? { paragraphs: found.paragraphs, scopeNote: found.scopeNote } : null;
        })(),
        previewArticleId,
        ogImage: getTournamentOgImage(tournamentId, year, categoryId),
      };
    })(),
  };
};
