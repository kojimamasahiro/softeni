// src/pages/tournaments/[tournamentId]/[year]/data.tsx
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
  team?: string; // 団体の場合
  prefecture?: string; // 団体の場合
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
  player1: {
    entryNo: number;
    won: number;
    lost: number;
  };
  player2: {
    entryNo: number;
    won: number;
    lost: number;
  };
  winner: number;
}

interface Props {
  tournamentId: string;
  year: string;
  entries: Record<string, EntryInfo[]>;
  matches: MatchResult[] | null;
  meta: TournamentMeta;
}

export default function EntryDataPage({
  tournamentId,
  year,
  entries,
  matches,
  meta,
}: Props) {
  const jsonStr = JSON.stringify(entries, null, 2);

  return (
    <>
      <MetaHead
        title={`${meta.name} ${year} 大会データ（JSON形式） - ソフトテニス情報`}
        description={`${meta.name} ${year} 年の大会出場選手データを掲載。非営利目的の活用が可能です。`}
        url={`https://softeni-pick.com/tournaments/${tournamentId}/${year}/data`}
        type="article"
      />

      <Head>
        <title>
          {meta.name} {year} 大会データ | ソフトテニス情報
        </title>
        <meta
          name="description"
          content={`${meta.name} ${year} 年の大会データを掲載しています。`}
        />
      </Head>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '大会結果一覧', href: '/tournaments' },
            {
              label: `${meta.name} ${year}年`,
              href: `/tournaments/${tournamentId}/${year}`,
            },
            {
              label: '出場選手データ',
              href: `/tournaments/${tournamentId}/${year}/data`,
            },
          ]}
        />

        <h1 className="text-2xl font-bold mb-4">
          {meta.name} {year}年 出場選手データ
        </h1>

        {/* ✅ 導入説明 */}
        <section className="text-sm text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
          <p className="mb-2">
            このページでは、<strong>{meta.name}</strong>（{year}
            年）に出場した選手・ペアの情報を掲載しています。学校・団体別の選手構成や出場者の分析、資料作成などにご活用いただけます。
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

        <h2 className="text-xl font-semibold mt-8 mb-2">出場選手データ</h2>
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
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(matches, null, 2));
                alert('クリップボードにコピーしました');
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              JSONをコピー（対戦結果）
            </button>
          </>
        )}

        <EntryOverview entries={entries} />

        {/* ✅ 戻るリンク 差分 */}
        <div className="mt-6">
          <Link
            href={`/tournaments/${tournamentId}/${year}`}
            className="text-sm text-blue-600 hover:underline"
          >
            大会結果ページ
          </Link>
        </div>

        {/* ✅ 注意文 */}
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

export const getStaticPaths: GetStaticPaths = async () => {
  const baseDir = path.join(process.cwd(), 'data/tournaments');
  const tournamentIds = fs.readdirSync(baseDir);

  const paths: { params: { tournamentId: string; year: string } }[] = [];

  for (const tid of tournamentIds) {
    const yearDir = path.join(baseDir, tid);
    if (!fs.statSync(yearDir).isDirectory()) continue;

    const years = fs.readdirSync(yearDir);
    for (const y of years) {
      const entryPath = path.join(yearDir, y, 'entries.json');
      if (fs.existsSync(entryPath)) {
        paths.push({
          params: {
            tournamentId: tid,
            year: y,
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
  const { tournamentId, year } = context.params as {
    tournamentId: string;
    year: string;
  };

  const basePath = path.join(process.cwd(), 'data/tournaments', tournamentId);

  // meta.json を読み込む（存在チェック付き）
  const metaPath = path.join(basePath, 'meta.json');
  const meta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    : null;

  const entries = JSON.parse(
    fs.readFileSync(path.join(basePath, year, 'entries.json'), 'utf-8'),
  );

  const matchesPath = path.join(basePath, year, 'matches.json');
  const matches = fs.existsSync(matchesPath)
    ? JSON.parse(fs.readFileSync(matchesPath, 'utf-8'))
    : null;

  return {
    props: {
      tournamentId,
      year,
      entries,
      matches,
      meta,
    },
  };
};
