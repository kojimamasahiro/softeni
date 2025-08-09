// src/pages/temp/[generation]/[tournamentId]/[year]/[gameCategory]/[ageCategory]/[gender]/data.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import EntryOverview from '@/components/EntryOverview';
import MetaHead from '@/components/MetaHead';

interface EntryInfo {
  entryNo: number;
  information: {
    lastName: string;
    firstName: string;
    team: string;
    playerId?: string;
    tempId?: string;
    prefecture?: string;
  }[];
  team?: string;
  prefecture?: string;
  type?: string;
}

interface TournamentMeta {
  id: string;
  sortId: number;
  name: string;
  region: string;
  type: string;
  category: string;
  officialUrl?: string;
  isMajorTitle?: boolean;
  source?: string;
  sourceUrl?: string;
}

interface MatchResult {
  round: string;
  player1: { entryNo: number; won: number; lost: number };
  player2: { entryNo: number; won: number; lost: number };
  winner: number;
}

interface Props {
  generation: string;
  tournamentId: string;
  year: string;
  gameCategory: string;
  ageCategory: string;
  gender: string;
  entries: EntryInfo[];
  matches: MatchResult[] | null;
  meta: TournamentMeta;
  categoryLabel: string;
}

export default function EntryDataPage({
  generation,
  tournamentId,
  year,
  gameCategory,
  ageCategory,
  gender,
  entries,
  matches,
  meta,
  categoryLabel,
}: Props) {
  const jsonStr = JSON.stringify(entries, null, 2);
  const pageUrl = `https://softeni-pick.com/tournaments/${generation}/${meta.id}/${year}/${gameCategory}/${ageCategory}${gender}/data`;

  return (
    <>
      <MetaHead
        title={`${meta.name} ${year} ${categoryLabel ? `${categoryLabel} ` : ''}大会データ - ソフトテニス情報`}
        description={`${meta.name} ${year} ${categoryLabel ? `${categoryLabel} ` : ''}年の大会データを掲載。非営利目的の活用が可能です。`}
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
              headline: `${meta.name} ${year}年  ${categoryLabel ? `${categoryLabel} ` : ''}大会データ`,
              author: { '@type': 'Person', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
              description: `${meta.name} ${year}年  ${categoryLabel ? `${categoryLabel} ` : ''}の大会データを確認できます。`,
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
                  name: '大会結果一覧',
                  item: 'https://softeni-pick.com/tournaments',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: `${meta.name} ${year}年 ${categoryLabel ? `${categoryLabel}` : ''}`,
                  item: `https://softeni-pick.com/tournaments/${generation}/${meta.id}/${year}/${gameCategory}/${ageCategory}/${gender}`,
                },
                {
                  '@type': 'ListItem',
                  position: 4,
                  name: `大会データ`,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '大会結果一覧', href: '/tournaments' },
            {
              label: `${meta.name} ${year}年 ${categoryLabel ? `${categoryLabel}` : ''}`,
              href: `/tournaments/${generation}/${meta.id}/${year}/${gameCategory}/${ageCategory}/${gender}`,
            },
            { label: '大会データ', href: '#' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-4">
          {meta.name} {year}年 {categoryLabel ? `${categoryLabel} ` : ''}
          大会データ
        </h1>

        <section className="text-sm text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
          <p className="mb-2">
            学校・団体別の選手構成や出場者の分析、資料作成などにご活用いただけます。
          </p>
          <ul className="list-disc list-inside mb-2">
            <li>個人利用、非営利目的での使用は自由です。</li>
            <li>
              選手名やチーム名の表記は、原資料に基づく手動入力のため、誤記の可能性があります。
            </li>
            <li>
              公式発表とは異なる場合があります。正式な記録は大会主催者の情報をご確認ください。
            </li>
          </ul>
        </section>

        <h2 className="text-xl font-semibold mt-8 mb-2">エントリーデータ</h2>
        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm max-h-[300px] overflow-auto whitespace-pre-wrap">
          {jsonStr}
        </pre>

        <button
          onClick={() => {
            navigator.clipboard.writeText(jsonStr);
            alert('クリップボードにコピーしました');
          }}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          JSONをコピー
        </button>

        {matches && (
          <>
            <h2 className="text-xl font-semibold mt-10 mb-2">対戦結果データ</h2>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm max-h-[300px] overflow-auto whitespace-pre-wrap">
              {JSON.stringify(matches, null, 2)}
            </pre>
          </>
        )}

        {gameCategory !== 'versus' && (
          <EntryOverview entries={{ default: entries }} />
        )}

        <div className="mt-6">
          <Link
            href={`/temp/${generation}/${tournamentId}/${year}/${gameCategory}/${ageCategory}/${gender}`}
            className="text-sm text-blue-600 hover:underline"
          >
            大会結果ページ
          </Link>
        </div>
        <div className="mt-6 text-xs text-gray-500 border-t pt-4">
          <p>
            ※ 本データはSofteni
            Pickが独自に整理・構築したものであり、正確性を保証するものではありません。
            <br />
            ご利用にあたって生じた不利益等について、当サイトは一切の責任を負いません。
          </p>
        </div>

        {meta.source && (
          <section className="mt-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 text-sm text-gray-700 dark:text-gray-300 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-2">
              出典・参考情報
            </h2>
            <p className="mb-3">
              本ページの試合結果データは、以下の情報をもとに作成しています。
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                {meta.sourceUrl ? (
                  <a
                    href={meta.sourceUrl}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {meta.source}
                  </a>
                ) : (
                  <span className="font-medium">{meta.source}</span>
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
      </main>
    </>
  );
}

// ✅ 新しい Path 対応
export const getStaticPaths: GetStaticPaths = async () => {
  const baseDir = path.join(process.cwd(), 'data/temp');
  const generations = fs.readdirSync(baseDir);

  const paths: {
    params: {
      generation: string;
      tournamentId: string;
      year: string;
      gameCategory: string;
      ageCategory: string;
      gender: string;
    };
  }[] = [];

  for (const generation of generations) {
    const generationDir = path.join(baseDir, generation);
    const tournamentIds = fs.readdirSync(generationDir);

    for (const tid of tournamentIds) {
      const yearDir = path.join(generationDir, tid);
      if (!fs.statSync(yearDir).isDirectory()) continue;

      const years = fs.readdirSync(yearDir);
      for (const y of years) {
        // ここだけ置き換え
        const categoriesPath = path.join(yearDir, y, 'categories.json');
        if (!fs.existsSync(categoriesPath)) continue;

        const raw = JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'));
        const categories: Array<{
          id?: string;
          label?: string;
          category: string; // "doubles" / "versus" など
          gender: string; // "boys" / "girls" など
          age?: string; // 無ければ general
        }> = Array.isArray(raw) ? raw : [];

        // categories.json が空/不正でも落ちないようにガード
        for (const c of categories) {
          if (!c || typeof c !== 'object') continue;

          const gameCategory = c.category;
          const gender = c.gender;
          const ageCategory = c.age && c.age.length > 0 ? c.age : 'general';

          if (!gameCategory || !gender) continue;

          paths.push({
            params: {
              generation,
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
  }

  return { paths, fallback: false };
};

// ✅ 該当カテゴリの entries / matches 読み込み
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

  const basePath = path.join(
    process.cwd(),
    'data/temp',
    generation,
    tournamentId,
    year,
  );

  const tournamentMetaPath = path.join(path.dirname(basePath), 'meta.json');
  const tournamentMeta: TournamentMeta = JSON.parse(
    fs.readFileSync(tournamentMetaPath, 'utf-8'),
  );

  const yearMetaPath = path.join(path.dirname(basePath), year, 'meta.json');
  const yearMeta = fs.existsSync(yearMetaPath)
    ? JSON.parse(fs.readFileSync(yearMetaPath, 'utf-8'))
    : {};

  const meta: TournamentMeta = {
    ...tournamentMeta,
    ...(yearMeta.source ? { source: yearMeta.source } : {}),
    ...(yearMeta.sourceUrl ? { sourceUrl: yearMeta.sourceUrl } : {}),
  };

  const categoryKey = `${gameCategory}-${ageCategory}-${gender}`;
  const entriesPath = path.join(basePath, 'entries', `${categoryKey}.json`);
  const matchesPath = path.join(basePath, 'matches', `${categoryKey}.json`);

  const entries = fs.existsSync(entriesPath)
    ? JSON.parse(fs.readFileSync(entriesPath, 'utf-8'))
    : [];
  const matches = fs.existsSync(matchesPath)
    ? JSON.parse(fs.readFileSync(matchesPath, 'utf-8'))
    : null;

  const categoryId = `${gameCategory}-${ageCategory}-${gender}`;
  const categoriesPath = path.join(basePath, 'categories.json');
  const categories: { id: string; label: string }[] = fs.existsSync(
    categoriesPath,
  )
    ? JSON.parse(fs.readFileSync(categoriesPath, 'utf-8'))
    : [];
  const categoryLabel =
    categories.find((c) => c.id === categoryId)?.label ?? '';

  return {
    props: {
      generation,
      tournamentId,
      year,
      gameCategory,
      ageCategory,
      gender,
      entries,
      matches,
      meta,
      categoryLabel,
    },
  };
};
