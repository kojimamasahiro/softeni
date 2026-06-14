// src/pages/tournaments/index.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import TournamentSearchTable, {
  TournamentInstance,
  TournamentLevel,
} from '@/components/tournaments/TournamentSearchTable';

// ─── 型定義（ビルド専用） ──────────────────────────────────────────────────
type TournamentIndex = {
  tournamentId: string;
  generationId: string;
  label: string;
  isMajorTitle: boolean;
  officialUrl: string;
};

type LocalTournamentIndex = TournamentIndex & {
  federationId: string;
  areaId?: TournamentLevel;
};

type InfoCategory = {
  categoryId: string;
  label: string;
  category: string;
  gender: string;
  age: string;
};

type TournamentInfo = {
  year: number;
  location: string;
  startDate: string;
  endDate: string;
  label?: string;
  sourceUrl?: string;
  categories: InfoCategory[];
};

type Props = {
  instances: TournamentInstance[];
  prefectures: { id: string; name: string }[];
  years: number[];
  generations: { id: string; label: string }[];
};

// ─── ユーティリティ ───────────────────────────────────────────────────────
function readJSONSafe<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    return null;
  }
}

/** tournamentId から level を推定する */
function inferLevel(tournamentId: string, isLocal: boolean): TournamentLevel {
  if (isLocal) return 'prefecture';
  if (tournamentId.startsWith('east-') || tournamentId.startsWith('west-'))
    return 'block';
  return 'national';
}

// ─── ページコンポーネント ──────────────────────────────────────────────────
export default function TournamentsIndexPage({
  instances,
  prefectures,
  years,
  generations,
}: Props) {
  const pageUrl = 'https://softeni-pick.com/tournaments/';

  return (
    <>
      <MetaHead
        title="大会一覧 | ソフトテニス情報 Softeni Pick"
        description="ソフトテニスの大会を年・カテゴリ・地域で絞り込み検索できます。全国大会からブロック・都道府県大会まで網羅。"
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
              headline: '大会一覧',
              author: { '@type': 'Person', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
              description:
                'ソフトテニスの大会を年・カテゴリ・地域で絞り込み検索できます。',
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'ホーム',
                  item: 'https://softeni-pick.com/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: '大会一覧',
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '大会一覧', href: '/tournaments' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-6">大会一覧</h1>

        <div className="flex gap-3 mb-6">
          <Link
            href="/tournaments/major"
            className="flex-1 flex flex-col items-center gap-1 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors"
          >
            <span className="text-lg">🏆</span>
            <span className="font-semibold text-sm text-yellow-800 dark:text-yellow-200">
              主要大会結果
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              全国・ブロック大会
            </span>
          </Link>
          <Link
            href="/tournaments/local"
            className="flex-1 flex flex-col items-center gap-1 p-4 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
          >
            <span className="text-lg">📍</span>
            <span className="font-semibold text-sm text-green-800 dark:text-green-200">
              地域大会結果
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              都道府県・地域連盟大会
            </span>
          </Link>
        </div>

        <TournamentSearchTable
          instances={instances}
          prefectures={prefectures}
          years={years}
          generations={generations}
        />
      </PageLayout>
    </>
  );
}

// ─── データ取得 ───────────────────────────────────────────────────────────
export const getStaticProps: GetStaticProps<Props> = async () => {
  const dataRoot = path.join(process.cwd(), 'data');
  const tournamentRoot = path.join(dataRoot, 'tournaments');

  const generationsPath = path.join(tournamentRoot, 'genarations.json');
  const indexPath = path.join(tournamentRoot, 'index.json');
  const localIndexPath = path.join(tournamentRoot, 'local_index.json');
  const informationDir = path.join(tournamentRoot, 'information');
  const detailsDir = path.join(tournamentRoot, 'details');
  const prefecturesPath = path.join(dataRoot, 'prefectures.json');

  // ── マスターデータ読み込み ──
  const rawGenerations =
    readJSONSafe<{ generationId: string; label: string }[]>(generationsPath) ??
    [];
  const genLabelMap = Object.fromEntries(
    rawGenerations.map((g) => [g.generationId, g.label]),
  );
  const generations = rawGenerations.map((g) => ({
    id: g.generationId,
    label: g.label,
  }));

  const mainTournaments = readJSONSafe<TournamentIndex[]>(indexPath) ?? [];
  const localTournaments =
    readJSONSafe<LocalTournamentIndex[]>(localIndexPath) ?? [];

  const rawPrefectures =
    readJSONSafe<{ id: string; name: string; region: string }[]>(
      prefecturesPath,
    ) ?? [];
  const prefectures = rawPrefectures.map((p) => ({ id: p.id, name: p.name }));

  // location 文字列 → prefectureId 逆引きマップ
  const prefNameToId: Record<string, string> = {};
  for (const p of rawPrefectures) {
    prefNameToId[p.name] = p.id;
  }

  const instances: TournamentInstance[] = [];

  // ── 全国・ブロック大会 ──
  for (const t of mainTournaments) {
    const infoPath = path.join(informationDir, `${t.tournamentId}.json`);
    const infos = readJSONSafe<TournamentInfo[]>(infoPath);
    if (!infos) continue;

    const level = inferLevel(t.tournamentId, false);

    for (const info of infos) {
      const detailDir = path.join(
        detailsDir,
        t.tournamentId,
        String(info.year),
      );
      const hasInternalResult =
        fs.existsSync(detailDir) &&
        fs.readdirSync(detailDir).some((f) => f.endsWith('.json'));

      let firstCategoryPath: string | null = null;
      for (const cat of info.categories) {
        const detailPath = path.join(detailDir, `${cat.categoryId}.json`);
        if (fs.existsSync(detailPath)) {
          firstCategoryPath = `/tournaments/${t.generationId}/${t.tournamentId}/${info.year}/${cat.category}/${cat.age}/${cat.gender}`;
          break;
        }
      }

      instances.push({
        tournamentId: t.tournamentId,
        generation: t.generationId,
        generationLabel: genLabelMap[t.generationId] ?? t.generationId,
        year: info.year,
        label: info.label ?? t.label,
        startDate: info.startDate,
        endDate: info.endDate,
        location: info.location,
        prefectureId: prefNameToId[info.location] ?? null,
        level,
        categoryLabels: info.categories.map((c) => c.label),
        hasInternalResult,
        officialUrl: info.sourceUrl ?? t.officialUrl,
        firstCategoryPath,
      });
    }
  }

  // ── 地域大会 ──
  for (const t of localTournaments) {
    const infoPath = path.join(informationDir, `${t.tournamentId}.json`);
    const infos = readJSONSafe<TournamentInfo[]>(infoPath);
    if (!infos) continue;

    const level: TournamentLevel = t.areaId
      ? t.areaId
      : inferLevel(t.tournamentId, true);

    for (const info of infos) {
      const detailDir = path.join(
        detailsDir,
        t.tournamentId,
        String(info.year),
      );
      const hasInternalResult =
        fs.existsSync(detailDir) &&
        fs.readdirSync(detailDir).some((f) => f.endsWith('.json'));

      let firstCategoryPath: string | null = null;
      for (const cat of info.categories) {
        const detailPath = path.join(detailDir, `${cat.categoryId}.json`);
        if (fs.existsSync(detailPath)) {
          firstCategoryPath = `/tournaments/${t.generationId}/${t.tournamentId}/${info.year}/${cat.category}/${cat.age}/${cat.gender}`;
          break;
        }
      }

      instances.push({
        tournamentId: t.tournamentId,
        generation: t.generationId,
        generationLabel: genLabelMap[t.generationId] ?? t.generationId,
        year: info.year,
        label: info.label ?? t.label,
        startDate: info.startDate,
        endDate: info.endDate,
        location: info.location,
        prefectureId: t.federationId,
        level,
        categoryLabels: info.categories.map((c) => c.label),
        hasInternalResult,
        officialUrl: info.sourceUrl ?? t.officialUrl,
        firstCategoryPath,
      });
    }
  }

  // 開催日降順
  instances.sort((a, b) => b.startDate.localeCompare(a.startDate));

  // 年リスト（降順）
  const years = [...new Set(instances.map((i) => i.year))].sort(
    (a, b) => b - a,
  );

  return {
    props: { instances, prefectures, years, generations },
  };
};
