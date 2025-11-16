// src/pages/players/[id]/results.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MajorTitles from '@/components/MajorTitles';
import MetaHead from '@/components/MetaHead';
import { getMajorTitlesForPlayer, MajorTitleData } from '@/lib/majorTitles';
import {
  TournamentDetailData,
  TournamentEntry,
  TournamentMatch,
  TournamentParticipant,
} from '@/types/tournament';

type AggregatedMatch = {
  tournamentFile: string;
  entryNo: number;
  round: string | null;
  opponentNames: string[];
  result: 'win' | 'lose' | 'unknown';
};

type PlayerResultsProps = {
  playerId: string;
  lastName: string;
  firstName: string;
  aggregatedMatches: AggregatedMatch[];
  majorTitlesData: MajorTitleData[];
};

export default function PlayerResultsPage({
  playerId,
  lastName,
  firstName,
  aggregatedMatches,
  majorTitlesData,
}: PlayerResultsProps) {
  const fullName = `${lastName}${firstName}`;
  const pageUrl = `https://softeni-pick.com/players/${playerId}/results`;

  return (
    <>
      <MetaHead
        title={`${fullName} 試合結果 | ソフトテニス情報`}
        description={`${fullName}の主要大会結果や試合速報を掲載`}
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
              headline: `${fullName}の試合結果・大会成績`,
              author: {
                '@type': 'Person',
                name: 'Softeni Pick',
              },
              publisher: {
                '@type': 'Organization',
                name: 'Softeni Pick',
              },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': pageUrl,
              },
              description: `${fullName}の主要大会結果や試合速報を掲載`,
              about: {
                '@type': 'Person',
                name: fullName,
                url: pageUrl,
              },
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
                  name: '選手一覧',
                  item: 'https://softeni-pick.com/players',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: `試合結果`,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-10">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              {
                label: '選手一覧',
                href: '/players',
              },
              {
                label: `${fullName} 試合結果`,
                href: `/players/${playerId}/results`,
              },
            ]}
          />

          <header>
            <h1 className="text-2xl font-bold">{fullName} 選手の試合結果</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              本ページでは、{fullName}{' '}
              選手の出場大会や成績、主な勝ち上がり情報を掲載しています。
            </p>
          </header>

          {/* 主な成績（タイトル）(再現未実装) */}
          <section>
            <h2 className="text-xl font-semibold mb-2">主な成績（タイトル）</h2>
            <MajorTitles majorTitlesData={majorTitlesData} />
          </section>

          <div className="text-right">
            <Link
              href="/tournaments"
              className="text-sm text-blue-600 hover:underline"
            >
              大会結果一覧はこちら
            </Link>
          </div>

          <section>
            <h2 className="text-xl font-semibold mb-2">{`${fullName}選手の出場履歴と戦績`}</h2>
            {/* PlayerResults コンポーネントは既存の playerData 形式を期待するため、
                TournamentDetailData のみを使って完全再現する実装が必要です。
                まずは data/tournament/details を走査して集計した最小情報を表示します。 */}
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{`TournamentDetailData を基に集計した試合数: ${aggregatedMatches.length}`}</p>
              <ul className="text-sm list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
                {aggregatedMatches.slice(0, 20).map((m, i) => {
                  const text = `${path.basename(m.tournamentFile)} — ラウンド: ${m.round ?? 'N/A'} — 対戦相手: ${m.opponentNames.join(', ')} — 結果: ${m.result}`;
                  return <li key={i}>{text}</li>;
                })}
              </ul>
              {aggregatedMatches.length > 20 && (
                <p className="text-xs text-gray-500 mt-2">上位20件のみ表示</p>
              )}
            </div>
          </section>

          <div className="text-right">
            <Link
              href={`/players/${playerId}`}
              className="text-sm text-blue-600 hover:underline"
            >
              {fullName}選手のプロフィールを見る
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  // use data/players/index.json ids
  const indexPath = path.join(process.cwd(), 'data', 'players', 'index.json');
  const entriesRaw = fs.readFileSync(indexPath, 'utf-8');
  const index = JSON.parse(entriesRaw) as Array<{ id: number }>;

  const paths = index.map((p) => ({ params: { id: String(p.id) } }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const playerId = params?.id as string;

  // read index.json to get name
  const indexPath = path.join(process.cwd(), 'data', 'players', 'index.json');
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8')) as Array<{
    id: number;
    lastName: string;
    firstName: string;
  }>;

  const idx = index.find((it) => String(it.id) === playerId);
  if (!idx) {
    return { notFound: true };
  }

  // aggregate matches from data/tournament/details
  const detailsRoot = path.join(process.cwd(), 'data', 'tournament', 'details');
  const jsonFiles: string[] = [];

  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    for (const it of items) {
      const p = path.join(dir, it);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (stat.isFile() && it.endsWith('.json')) jsonFiles.push(p);
    }
  };

  walk(detailsRoot);

  const aggregatedMatches: AggregatedMatch[] = [];

  for (const file of jsonFiles) {
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const detail = JSON.parse(raw) as TournamentDetailData;

      const participants: TournamentParticipant[] = detail.participants || [];
      const participantById = new Map<string, TournamentParticipant>();
      for (const p of participants) participantById.set(p.id, p);

      // find participant ids matching name
      const matchingParticipantIds = participants
        .filter(
          (p) => p.lastName === idx.lastName && p.firstName === idx.firstName,
        )
        .map((p) => p.id);
      if (matchingParticipantIds.length === 0) continue;

      const entries: TournamentEntry[] = detail.entries || [];
      const entryByNo = new Map<number, TournamentEntry>();
      for (const e of entries) {
        entryByNo.set(e.entryNo, e);
      }

      const playerEntryNos = new Set<number>();
      for (const e of entries) {
        if (Array.isArray(e.playerIds)) {
          for (const pid of e.playerIds) {
            if (matchingParticipantIds.includes(pid)) {
              playerEntryNos.add(e.entryNo);
              break;
            }
          }
        }
      }

      const matches: TournamentMatch[] = detail.matches || [];
      for (const m of matches) {
        if (!Array.isArray(m.entries) || m.entries.length === 0) continue;
        const matchEntries: number[] = m.entries;

        const intersection = matchEntries.filter((n) => playerEntryNos.has(n));
        if (intersection.length === 0) continue;

        // determine player's entryNo (pick first)
        const playerEntryNo = intersection[0];

        const opponentEntryNos = matchEntries.filter(
          (n) => n !== playerEntryNo,
        );
        const opponentNames: string[] = [];
        for (const o of opponentEntryNos) {
          const oe = entryByNo.get(o);
          if (oe && Array.isArray(oe.playerIds)) {
            for (const pid of oe.playerIds) {
              const p = participantById.get(pid);
              if (p) opponentNames.push(`${p.lastName}${p.firstName}`);
            }
          }
        }

        let result: 'win' | 'lose' | 'unknown' = 'unknown';
        if (typeof m.winnerEntryNo === 'number') {
          result = m.winnerEntryNo === playerEntryNo ? 'win' : 'lose';
        }

        aggregatedMatches.push({
          tournamentFile: file,
          entryNo: playerEntryNo,
          round: m.round ?? m.stage ?? null,
          opponentNames,
          result,
        });
      }
    } catch {
      // ignore parse errors
    }
  }
  return {
    props: {
      playerId,
      lastName: idx.lastName,
      firstName: idx.firstName,
      aggregatedMatches,
      majorTitlesData: getMajorTitlesForPlayer(idx.lastName, idx.firstName),
    },
  };
};
