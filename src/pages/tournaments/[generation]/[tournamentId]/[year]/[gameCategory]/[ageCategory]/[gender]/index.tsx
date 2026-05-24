// pages/tournaments/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/index.tsx

import fs from 'fs';
import path from 'path';

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import MatchResults from '@/components/Tournament/MatchResults';
import TeamResults from '@/components/Tournament/TeamResults';
import TournamentBracket from '@/components/Tournament/TournamentBracket';
import {
  PackedTournamentDetailData,
  packTournamentDetailData,
  unpackTournamentDetailData,
} from '@/lib/packedPageData';
import {
  TournamentDetailData,
  TournamentIndexEntry,
  TournamentInformationEntry,
} from '@/types/index';

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
  categoryLabel: string;
  infoForYear: TournamentInformationEntry | null;
  detailDataPacked: PackedTournamentDetailData | null;
  linkCategories: LinkCategory[] | null;
  infoWarnings?: string[];
  detailsWarnings?: string[];
  federationId?: string | null;
  highschoolTeamLinks?: Record<string, HighschoolTeamLink> | null;
  prefectureName?: string | null;
}

export default function TournamentYearResultPage({
  generation,
  tournamentId,
  year,
  gameCategory,
  ageCategory,
  gender,
  label,
  categoryLabel,
  infoForYear,
  detailDataPacked,
  linkCategories,
  infoWarnings = [],
  detailsWarnings = [],
  federationId = null,
  highschoolTeamLinks = null,
  prefectureName = null,
}: TournamentYearResultPageProps) {
  const pageUrl = `https://softeni-pick.com/tournaments/${generation}/${tournamentId}/${year}/${gameCategory}/${ageCategory}/${gender}`;

  const [filter, setFilter] = useState<'all' | 'top8' | 'winners'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const detailData = useMemo(
    () =>
      detailDataPacked ? unpackTournamentDetailData(detailDataPacked) : null,
    [detailDataPacked],
  );

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

  breadcrumbs.push({
    label: `${label} ${year}年度 ${categoryLabel ? `${categoryLabel}` : ''}`,
    href: `/tournaments/${generation}/${tournamentId}/${year}/${gameCategory}/${ageCategory}/${gender}`,
  });

  return (
    <>
      <MetaHead
        title={`${label} ${year}年 ${categoryLabel} | ソフトテニス情報`}
        description={`${label} ${year}年 ${categoryLabel}の試合結果・トーナメント表・成績一覧`}
        url={pageUrl}
        type="article"
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
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
              description: `${label} ${year}年度  ${categoryLabel ? `${categoryLabel} ` : ''}のソフトテニス大会結果を確認できます。過去の大会結果も掲載`,
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: breadcrumbs.map((crumb, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: crumb.label,
                item: `https://softeni-pick.com${crumb.href}`,
              })),
            }),
          }}
        />

        <meta
          name="viewport"
          content="width=device-width,initial-scale=1.0"
        ></meta>
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs crumbs={breadcrumbs} />

          {/* ✅ h1 + 大会紹介文 */}
          <h1 className="text-2xl font-bold mb-4">
            {label} {year}年度 {categoryLabel ? `${categoryLabel} ` : ''}
            大会結果
          </h1>
          <section className="mb-6 px-1">
            {infoForYear?.location &&
              infoForYear?.startDate &&
              infoForYear?.endDate && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  開催地:{infoForYear.location} / 日程:
                  {infoForYear.startDate}〜{infoForYear.endDate}
                </p>
              )}
          </section>

          {/* ✅ トーナメント表 */}
          {detailData && <TournamentBracket detailData={detailData} />}

          {/* ✅ チーム別成績 */}
          <TeamResults
            detailData={detailData ? [detailData] : []}
            highschoolGender={generation === 'highschool' ? gender : null}
            highschoolTeamLinks={highschoolTeamLinks}
          />

          {(infoWarnings.length > 0 || detailsWarnings.length > 0) && (
            <section className="mt-6 mb-6 p-4 bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded">
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

          {linkCategories && linkCategories.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-bold mb-3">その他の大会結果</h2>
              {Object.entries(
                linkCategories.reduce<Record<string, LinkCategory[]>>(
                  (acc, link) => {
                    if (!acc[link.year]) acc[link.year] = [];
                    acc[link.year].push(link);
                    return acc;
                  },
                  {},
                ),
              )
                .sort((a, b) => Number(b[0]) - Number(a[0])) // 年で降順
                .map(([yearValue, links]) => (
                  <div
                    className="mb-4"
                    key={`${yearValue}-${links
                      .map(
                        (link) =>
                          `${link.year}-${link.category}-${link.age}-${link.gender}`,
                      )
                      .join('-')}`}
                  >
                    <h4 className="text-md mb-2">{yearValue}年度</h4>
                    <ul className="flex flex-wrap gap-2">
                      {links.map((link) =>
                        link.isCurrent ? (
                          <li
                            key={`${link.year}-${link.category}-${link.age}-${link.gender}`}
                          >
                            <span className="inline-block bg-gray-300 text-gray-600 px-3 py-1 rounded-full text-sm cursor-default">
                              {link.label}
                            </span>
                          </li>
                        ) : (
                          <li
                            key={`${link.year}-${link.category}-${link.age}-${link.gender}`}
                          >
                            <Link
                              href={`/tournaments/${generation}/${tournamentId}/${link.year}/${link.category}/${link.age}/${link.gender}`}
                            >
                              <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm hover:opacity-80 transition">
                                {link.label}
                              </span>
                            </Link>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                ))}
            </section>
          )}

          <div className="text-right mt-10 mb-2">
            <Link
              href="/tournaments"
              className="text-sm text-blue-500 hover:underline"
            >
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
            <section className="mt-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 text-sm text-gray-700 dark:text-gray-300 shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">
                出典・参考情報
              </h2>
              <p className="mb-3">
                本ページの試合結果データは、以下の情報をもとに作成しています。
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  {infoForYear.sourceUrl ? (
                    <a
                      href={infoForYear.sourceUrl}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {infoForYear.source}
                    </a>
                  ) : (
                    <span className="font-medium">{infoForYear.source}</span>
                  )}
                </li>
                <li>
                  一部の情報は現地観戦や報道発表、X（旧Twitter）などから収集しています。
                </li>
              </ul>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                内容に誤りがある場合は、ページ下部のお問い合わせからご連絡ください。
              </p>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  // Build paths by scanning data/tournaments/details directory. We don't rely on data/tournaments.
  const detailsRoot = path.join(
    process.cwd(),
    'data',
    'tournaments',
    'details',
  );
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
  const indexPath = path.join(
    process.cwd(),
    'data',
    'tournaments',
    'index.json',
  );
  const localIndexPath = path.join(
    process.cwd(),
    'data',
    'tournaments',
    'local_index.json',
  );
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
                const gen =
                  typeof genVal === 'string' || typeof genVal === 'number'
                    ? String(genVal)
                    : 'unknown';
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
  const { generation, tournamentId, year, gameCategory, ageCategory, gender } =
    context.params as {
      generation: string;
      tournamentId: string;
      year: string;
      gameCategory: string;
      ageCategory: string;
      gender: string;
    };

  const indexPath = path.join(
    process.cwd(),
    'data',
    'tournaments',
    'index.json',
  );
  const localIndexPath = path.join(
    process.cwd(),
    'data',
    'tournaments',
    'local_index.json',
  );

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
  const playersIndexPath = path.join(
    process.cwd(),
    'data',
    'players',
    'index.json',
  );
  const playerIndexMap = new Map<string, number>();
  if (fs.existsSync(playersIndexPath)) {
    try {
      const playersIndex = JSON.parse(
        fs.readFileSync(playersIndexPath, 'utf-8'),
      ) as Array<{
        id: number;
        lastName: string;
        firstName: string;
        count: number;
      }>;
      for (const p of playersIndex) {
        if (p.count < 5) continue;

        const key = `${p.lastName}::${p.firstName}`;
        // If multiple IDs exist, the first one is used (similar to players/index.tsx)
        if (!playerIndexMap.has(key)) {
          playerIndexMap.set(key, p.id);
        }
      }
    } catch (err) {
      console.error('failed to parse players index.json', err);
    }
  }
  const infoPath = path.join(
    process.cwd(),
    'data',
    'tournaments',
    'information',
    `${tournamentId}.json`,
  );
  const infoWarnings: string[] = [];
  let infoForYear: TournamentInformationEntry | null = null;
  let linkCategories: LinkCategory[] | null = null;

  if (fs.existsSync(infoPath)) {
    try {
      const raw = fs.readFileSync(infoPath, 'utf-8');
      const parsed = JSON.parse(raw) as TournamentInformationEntry[];
      infoForYear =
        parsed.find((entry) => String(entry.year) === String(year)) ?? null;

      linkCategories = parsed.flatMap((entry) =>
        (entry.categories ?? []).map((cat) => ({
          label: cat.label,
          year: String(entry.year),
          category: cat.category,
          gender: cat.gender,
          age: cat.age,
          isCurrent:
            String(entry.year) === String(year) &&
            cat.category === gameCategory &&
            cat.gender === gender &&
            cat.age === ageCategory,
        })),
      );

      if (!infoForYear) {
        infoWarnings.push(
          `information file found but no entry for year ${year}`,
        );
      }
    } catch (err) {
      infoWarnings.push(
        `information JSON parse error: ${infoPath} - ${String(err)}`,
      );
    }
  } else {
    infoWarnings.push(
      `information file not found: ${path.relative(process.cwd(), infoPath)}`,
    );
  }

  // We no longer read from data/tournaments; use details + information as canonical sources
  const detailsBase = path.join(
    process.cwd(),
    'data',
    'tournaments',
    'details',
    tournamentId,
  );

  // category file name
  const categoryId = `${gameCategory}-${ageCategory}-${gender}`;
  const detailsPath = path.join(detailsBase, year, `${categoryId}.json`);

  let detailData: TournamentDetailData | null = null;
  const detailsWarnings: string[] = [];
  if (fs.existsSync(detailsPath)) {
    try {
      detailData = JSON.parse(fs.readFileSync(detailsPath, 'utf-8'));

      // Resolve player IDs
      if (detailData && Array.isArray(detailData.participants)) {
        for (const p of detailData.participants) {
          if (p.lastName && p.firstName) {
            const key = `${p.lastName}::${p.firstName}`;
            const pid = playerIndexMap.get(key);
            if (pid !== undefined) {
              p.playerId = pid;
            }
          }
        }
      }
    } catch (err) {
      detailsWarnings.push(
        `details JSON parse error: ${detailsPath} - ${String(err)}`,
      );
    }
  } else {
    detailsWarnings.push(
      `details file not found: ${path.relative(process.cwd(), detailsPath)}`,
    );
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

  if (generation === 'highschool' && detailData?.participants?.length) {
    const highschoolSummaryPath = path.join(
      process.cwd(),
      'data',
      'highschool',
      'prefecture-summary.json',
    );

    if (fs.existsSync(highschoolSummaryPath)) {
      try {
        const summaryEntries = JSON.parse(
          fs.readFileSync(highschoolSummaryPath, 'utf-8'),
        ) as Array<{
          prefecture: string;
          prefectureId: string;
          team: string;
          teamId: string;
        }>;

        const relevantKeys = new Set(
          detailData.participants
            .filter((participant) => participant.team)
            .map(
              (participant) =>
                `${participant.team}::${participant.prefecture ?? ''}`,
            ),
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
        detailsWarnings.push(
          `highschool team summary parse error: ${path.relative(
            process.cwd(),
            highschoolSummaryPath,
          )} - ${String(err)}`,
        );
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
        categoryLabel:
          infoForYear?.categories?.find(
            (cat) =>
              cat.categoryId === `${gameCategory}-${ageCategory}-${gender}`,
          )?.label ?? '',
        infoForYear,
        detailDataPacked: detailData
          ? packTournamentDetailData(detailData)
          : null,
        linkCategories,
        infoWarnings,
        detailsWarnings,
        federationId,
        highschoolTeamLinks,
        prefectureName,
      };
    })(),
  };
};
