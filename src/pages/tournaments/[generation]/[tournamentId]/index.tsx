// pages/tournaments/[generation]/[tournamentId]/index.tsx
// 大会ハブページ: 1大会の歴代（年度別・種別別）結果をまとめて内部リンクする。
// 「ソフトテニス 大会名 結果」など年度を含まない検索クエリの受け皿。

import fs from 'fs';
import path from 'path';

import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import TournamentContextBlocks, {
  type TournamentContextData,
} from '@/components/TournamentContextBlocks';
import { getCareerRecordByFullName } from '@/lib/careerRecord';
import { getHsNationalSlugByTournamentId } from '@/lib/highschoolNationalTournaments';
import { getChampionMilestones } from '@/lib/milestones';
import { getHistoricalWinners } from '@/lib/tournamentRecords';
import {
  buildEventOrganizer,
  buildEventPlace,
  resolveEventDates,
  sportsEventBaseFields,
} from '@/lib/sportsEventJsonLd';
import {
  TournamentIndexEntry,
  TournamentInformationEntry,
} from '@/types/index';
import { joinPlayerName } from '@/utils/playerName';

type CategoryLink = {
  label: string;
  category: string;
  age: string;
  gender: string;
  href: string;
  winner: string | null;
};

type YearGroup = {
  year: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  categories: CategoryLink[];
};

interface TournamentHubPageProps {
  generation: string;
  tournamentId: string;
  label: string;
  officialUrl: string | null;
  yearGroups: YearGroup[];
  // 高校全国大会（インターハイ/ジャパンカップ）の場合のみスラッグが入る。
  // このハブは /highschool/tournaments/[tournament] とカニバるため、
  // 高校全国大会では noindex,follow にして検索面を高校歴代ページへ集中させる。
  // docs/wiki/seo.md #3 参照。
  hsNationalSlug: string | null;
  // 文脈ブロック（最新年度の milestone と優勝者の通算成績）。docs/wiki/news-context-blocks.md
  contextBlocks: TournamentContextData;
}

export default function TournamentHubPage({
  generation,
  tournamentId,
  label,
  officialUrl,
  yearGroups,
  hsNationalSlug,
  contextBlocks,
}: TournamentHubPageProps) {
  const pageUrl = `https://softeni-pick.com/tournaments/${generation}/${tournamentId}/`;
  const hsNationalHref = hsNationalSlug
    ? `/highschool/tournaments/${hsNationalSlug}`
    : null;

  const years = yearGroups.map((g) => g.year);
  const latestYear = years[0] ?? '';
  const oldestYear = years[years.length - 1] ?? '';
  const yearRange =
    latestYear && oldestYear && latestYear !== oldestYear
      ? `${oldestYear}〜${latestYear}年`
      : latestYear
        ? `${latestYear}年`
        : '';

  const championRows = yearGroups.flatMap((g) =>
    g.categories
      .filter((c) => c.winner)
      .map((c) => ({
        year: g.year,
        categoryLabel: c.label,
        winner: c.winner as string,
        href: c.href,
        location: g.location,
        startDate: g.startDate,
        endDate: g.endDate,
      })),
  );

  const breadcrumbs = [
    { label: 'ホーム', href: '/' },
    { label: '大会結果一覧', href: '/tournaments' },
    {
      label: `${label} 結果`,
      href: `/tournaments/${generation}/${tournamentId}`,
    },
  ];

  const title = `${label} 結果・歴代優勝/上位入賞者まとめ | ソフトテニス情報`;
  const description = `ソフトテニス「${label}」の歴代大会結果・トーナメント表・優勝/上位入賞者を年度別にまとめています。${yearRange ? `${yearRange}の` : ''}試合結果を一覧から確認できます。`;

  return (
    <>
      <MetaHead
        title={title}
        description={description}
        url={pageUrl}
        type="website"
        noindex={!!hsNationalSlug}
        noindexFollow={!!hsNationalSlug}
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: `${label} 結果（歴代一覧）`,
              inLanguage: 'ja',
              url: pageUrl,
              about: {
                '@type': 'Thing',
                name: `ソフトテニス ${label}`,
              },
              description,
            }),
          }}
        />
        {championRows.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: `${label} 歴代優勝者`,
                numberOfItems: championRows.length,
                itemListElement: championRows.map((r, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  item: {
                    '@type': 'SportsEvent',
                    name: `${label} ${r.year}年 ${r.categoryLabel}`,
                    sport: 'ソフトテニス',
                    inLanguage: 'ja',
                    url: `https://softeni-pick.com${r.href}`,
                    ...sportsEventBaseFields,
                    ...resolveEventDates(r.startDate, r.endDate),
                    location: buildEventPlace(r.location),
                    organizer: buildEventOrganizer(),
                    // performer: 優勝者（その大会の出場者）を推奨項目として付与
                    ...(r.winner
                      ? {
                          performer: {
                            '@type': 'SportsTeam',
                            name: r.winner,
                          },
                        }
                      : {}),
                    description: `優勝: ${r.winner}`,
                  },
                })),
              }),
            }}
          />
        )}
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
      </Head>

      <PageLayout>
        <Breadcrumbs crumbs={breadcrumbs} />

        <h1 className="text-2xl font-bold mb-4">
          {label} 大会結果（歴代一覧）
        </h1>

        {hsNationalHref && (
          <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm dark:border-blue-900 dark:bg-blue-950">
            <Link
              href={hsNationalHref}
              className="font-semibold text-blue-700 hover:underline dark:text-blue-300"
            >
              {label} 歴代記録（優勝・準優勝・ベスト4／開催予定）はこちら →
            </Link>
            <p className="mt-1 text-gray-600 dark:text-gray-300">
              種目別の歴代優勝サマリーや出場校の戦績まで、{label}
              のまとめは高校カテゴリの歴代記録ページに集約しています。
            </p>
          </div>
        )}

        <section className="mb-6 px-1">
          <p className="mb-2 text-sm text-gray-700 dark:text-gray-200">
            ソフトテニス「{label}
            」の歴代の試合結果・トーナメント表・優勝/上位入賞者を年度別にまとめています。
            {yearRange ? `${yearRange}の大会結果を掲載中です。` : ''}
            見たい年度・種別を選ぶと、各大会の詳細な結果ページに移動できます。
          </p>
          {officialUrl && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              公式サイト:{' '}
              <a
                href={officialUrl}
                className="text-blue-600 dark:text-blue-400 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {officialUrl}
              </a>
            </p>
          )}
        </section>

        {championRows.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold mb-3">{label} 歴代優勝者</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 dark:border-gray-600 text-left">
                    <th className="py-2 pr-3 font-semibold whitespace-nowrap">
                      年度
                    </th>
                    <th className="py-2 pr-3 font-semibold whitespace-nowrap">
                      種別
                    </th>
                    <th className="py-2 pr-3 font-semibold">優勝</th>
                  </tr>
                </thead>
                <tbody>
                  {championRows.map((r) => (
                    <tr
                      key={`${r.year}-${r.categoryLabel}`}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td className="py-2 pr-3 align-top whitespace-nowrap">
                        <Link
                          href={r.href}
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {r.year}年度
                        </Link>
                      </td>
                      <td className="py-2 pr-3 align-top">{r.categoryLabel}</td>
                      <td className="py-2 pr-3 align-top">{r.winner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <TournamentContextBlocks label={label} data={contextBlocks} />

        {yearGroups.length === 0 ? (
          <p className="text-sm text-gray-500">
            現在、掲載中の結果データがありません。
          </p>
        ) : (
          yearGroups.map((g) => (
            <section className="mb-8" key={g.year}>
              <h2 className="text-lg font-bold mb-1">
                {label} {g.year}年度 結果
              </h2>
              {(g.location || g.startDate) && (
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  {g.location ? `開催地:${g.location}` : ''}
                  {g.location && g.startDate ? ' / ' : ''}
                  {g.startDate
                    ? `日程:${g.startDate}${g.endDate ? `〜${g.endDate}` : ''}`
                    : ''}
                </p>
              )}
              <ul className="flex flex-wrap gap-2">
                {g.categories.map((c) => (
                  <li key={`${g.year}-${c.category}-${c.age}-${c.gender}`}>
                    <Link href={c.href}>
                      <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm hover:opacity-80 transition dark:bg-blue-900 dark:text-blue-100">
                        {c.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        <div className="text-right mt-10 mb-2">
          <Link
            href="/tournaments"
            className="text-sm text-blue-500 hover:underline"
          >
            大会結果一覧へ
          </Link>
        </div>
      </PageLayout>
    </>
  );
}

const DETAILS_ROOT = ['data', 'tournaments', 'details'];

// 詳細JSONから優勝ペア（選手名・所属）を抽出する。なければ null。
function extractWinner(detailPath: string): string | null {
  try {
    const data = JSON.parse(fs.readFileSync(detailPath, 'utf-8')) as {
      participants?: Array<{
        id: string;
        lastName?: string;
        firstName?: string;
        team?: string;
      }>;
      entries?: Array<{ entryNo: number; playerIds: string[] }>;
      results?: Array<{
        entryNo: number;
        tournament?: { rank?: { kind?: string } };
      }>;
    };
    const winResult = (data.results ?? []).find(
      (r) => r.tournament?.rank?.kind === 'winner',
    );
    if (!winResult) return null;
    const entry = (data.entries ?? []).find(
      (e) => e.entryNo === winResult.entryNo,
    );
    if (!entry) return null;
    const pmap = new Map(
      (data.participants ?? []).map((p) => [p.id, p] as const),
    );
    const names = entry.playerIds.map((id) => {
      const p = pmap.get(id);
      return p ? joinPlayerName(p.lastName, p.firstName) : id;
    });
    const teams = [
      ...new Set(
        entry.playerIds
          .map((id) => pmap.get(id)?.team)
          .filter((t): t is string => Boolean(t)),
      ),
    ];
    const nameStr = names.join('・');
    return teams.length > 0 ? `${nameStr}（${teams.join('・')}）` : nameStr;
  } catch {
    return null;
  }
}

function loadGenerationMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const file of ['index.json', 'local_index.json']) {
    const p = path.join(process.cwd(), 'data', 'tournaments', file);
    if (!fs.existsSync(p)) continue;
    try {
      const idx = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(idx)) {
        for (const it of idx) {
          if (it && typeof it === 'object') {
            const entry = it as Record<string, unknown>;
            const tid = entry['tournamentId'];
            const gen = entry['generationId'];
            if (typeof tid === 'string') {
              map[tid] = typeof gen === 'string' ? gen : 'unknown';
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return map;
}

function loadIndexEntry(tournamentId: string): TournamentIndexEntry | null {
  for (const file of ['index.json', 'local_index.json']) {
    const p = path.join(process.cwd(), 'data', 'tournaments', file);
    if (!fs.existsSync(p)) continue;
    try {
      const idx = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(idx)) {
        const found = idx.find(
          (it) =>
            it &&
            typeof it === 'object' &&
            (it as TournamentIndexEntry).tournamentId === tournamentId,
        );
        if (found) return found as TournamentIndexEntry;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const detailsRoot = path.join(process.cwd(), ...DETAILS_ROOT);
  if (!fs.existsSync(detailsRoot)) {
    return { paths: [], fallback: false };
  }

  const generationMap = loadGenerationMap();
  const tournamentIds = fs.readdirSync(detailsRoot).filter((n) => {
    const p = path.join(detailsRoot, n);
    return fs.statSync(p).isDirectory();
  });

  const paths = tournamentIds.map((tid) => ({
    params: {
      generation: generationMap[tid] ?? 'unknown',
      tournamentId: tid,
    },
  }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { generation, tournamentId } = context.params as {
    generation: string;
    tournamentId: string;
  };

  const indexEntry = loadIndexEntry(tournamentId);
  const label = indexEntry?.label ?? tournamentId;
  const officialUrl = indexEntry?.officialUrl || null;

  // information から年度ごとの開催情報・カテゴリラベルを取得
  const infoPath = path.join(
    process.cwd(),
    'data',
    'tournaments',
    'information',
    `${tournamentId}.json`,
  );
  let information: TournamentInformationEntry[] = [];
  if (fs.existsSync(infoPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
      if (Array.isArray(parsed)) information = parsed;
    } catch {
      // ignore
    }
  }

  const categoryLabelByYear = new Map<string, Map<string, string>>();
  const infoByYear = new Map<string, TournamentInformationEntry>();
  for (const entry of information) {
    const y = String(entry.year);
    infoByYear.set(y, entry);
    const m = new Map<string, string>();
    for (const cat of entry.categories ?? []) {
      m.set(cat.categoryId, cat.label);
    }
    categoryLabelByYear.set(y, m);
  }

  // details ディレクトリを走査し、実際にデータがある年度・種別のみリンク化
  const tidDir = path.join(process.cwd(), ...DETAILS_ROOT, tournamentId);
  const yearGroups: YearGroup[] = [];

  if (fs.existsSync(tidDir)) {
    const years = fs
      .readdirSync(tidDir)
      .filter((y) => {
        const p = path.join(tidDir, y);
        return fs.statSync(p).isDirectory();
      })
      .sort((a, b) => Number(b) - Number(a)); // 年度降順

    for (const y of years) {
      const yearDir = path.join(tidDir, y);
      const files = fs.readdirSync(yearDir).filter((f) => f.endsWith('.json'));

      const labelMap = categoryLabelByYear.get(y) ?? new Map<string, string>();
      const categories: CategoryLink[] = [];

      for (const f of files) {
        const base = f.replace(/\.json$/, '');
        const parts = base.split('-');
        if (parts.length < 3) continue;
        const gender = parts.pop() as string;
        const age = parts.pop() as string;
        const category = parts.join('-');
        const categoryId = `${category}-${age}-${gender}`;

        categories.push({
          label: labelMap.get(categoryId) ?? categoryId,
          category,
          age,
          gender,
          href: `/tournaments/${generation}/${tournamentId}/${y}/${category}/${age}/${gender}`,
          winner: extractWinner(path.join(yearDir, f)),
        });
      }

      if (categories.length === 0) continue;

      const info = infoByYear.get(y) ?? null;
      yearGroups.push({
        year: y,
        location: info?.location || null,
        startDate: info?.startDate || null,
        endDate: info?.endDate || null,
        categories,
      });
    }
  }

  // --- 文脈ブロック（最新年度の milestone と優勝者の通算成績）---
  // docs/wiki/news-context-blocks.md / ADR-005。
  const latestGroup = yearGroups[0] ?? null;
  const latestYear = latestGroup?.year ?? null;
  const contextBlocks: TournamentContextData = {
    latestYear,
    milestones: [],
    championRecords: [],
  };

  if (latestGroup) {
    const ty = Number(latestGroup.year);
    const seenMilestone = new Set<string>();
    const seenRecord = new Set<string>();

    // 最新年度の種目は yearGroups（解析済み）を再利用し、ディレクトリ再走査と
    // categoryId の再パースを避ける。
    for (const c of latestGroup.categories) {
      const categoryId = `${c.category}-${c.age}-${c.gender}`;

      // historical-winners は milestone と career-record で共有し、二重走査を避ける
      const hw = getHistoricalWinners(tournamentId, categoryId, {
        targetYear: ty,
      });

      // milestone（連覇 / 初優勝）
      const ms = getChampionMilestones(tournamentId, categoryId, ty, hw);
      for (const e of ms?.events ?? []) {
        // ラベルではなくイベント実体（種別×大会×種目×年×主役）で重複排除する。
        // 同一表示文字列の別イベント（例: 別種目の初優勝）を取りこぼさない。
        // 主役（subject.display）まで含めるのは、ダブルスを選手個人単位で判定する
        // ため同一年・同一種目で複数選手のイベント（例: 2人とも初優勝）が出るから。
        const key = `${e.kind}|${e.tournamentId}|${e.categoryId}|${e.year}|${e.subject.display}`;
        if (seenMilestone.has(key)) continue;
        seenMilestone.add(key);
        contextBlocks.milestones.push({
          kind: e.kind,
          label: e.label,
          confidence: e.confidence,
          scopeNote: e.scopeNote ?? null,
        });
      }

      // 優勝者の career-record（curated 選手のみ取得できる）
      const champ = hw?.champions.find((cc) => cc.year === ty);
      for (const name of champ?.players ?? []) {
        const cr = getCareerRecordByFullName(name);
        if (!cr || seenRecord.has(cr.subject.slug)) continue;
        seenRecord.add(cr.subject.slug);
        contextBlocks.championRecords.push({
          slug: cr.subject.slug,
          display: cr.subject.display,
          team: cr.subject.team,
          totals: {
            matches: cr.totals.matches,
            wins: cr.totals.wins,
            losses: cr.totals.losses,
            winRate: cr.totals.winRate,
          },
          titles: cr.titles.map((t) => ({
            year: t.year,
            tournamentLabel: t.tournamentLabel,
            categoryLabel: t.categoryLabel,
          })),
          scopeNote: cr.scopeNote,
        });
      }
    }
  }

  return {
    props: {
      generation,
      tournamentId,
      label,
      officialUrl,
      yearGroups,
      hsNationalSlug: getHsNationalSlugByTournamentId(tournamentId),
      contextBlocks,
    },
  };
};
