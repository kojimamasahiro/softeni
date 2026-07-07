// src/pages/rankings/index.tsx
// 年度別ランキングページ（全選手横断・男女別×種目別・上位100位）。
// データは Player Statistics Engine が prebuild で生成する
// data/rankings/{year}-{discipline}-{gender}.json（シーズンポイント: 年度の上位3大会合算）。
// 1 ページに集約し、年度・種目・男女はクライアント側で切り替える（薄いページの量産を避ける。
// docs/wiki/seo.md の方針）。結果ページを持つ選手（index.json count>=5）のみリンクする。

import type { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';

const TOP_N = 100;

type BoardEntry = {
  rank: number;
  playerId: number | null;
  playerName: string;
  team: string | null;
  points: number;
  /** 結果ページ（/players/{id}/results/）が実在するか。 */
  hasPage: boolean;
};

type Board = {
  year: number;
  discipline: string; // singles | doubles
  gender: string; // boys | girls
  outOf: number;
  entries: BoardEntry[];
};

type RankingsPageProps = {
  boards: Board[];
  latestYear: number;
};

const DISCIPLINE_LABEL: Record<string, string> = {
  singles: 'シングルス',
  doubles: 'ダブルス',
};
const GENDER_LABEL: Record<string, string> = {
  boys: '男子',
  girls: '女子',
};

/** タブ順: 男子D → 女子D → 男子S → 女子S（ダブルス主流のため）。 */
const TAB_ORDER: Array<{ discipline: string; gender: string }> = [
  { discipline: 'doubles', gender: 'boys' },
  { discipline: 'doubles', gender: 'girls' },
  { discipline: 'singles', gender: 'boys' },
  { discipline: 'singles', gender: 'girls' },
];

function tabLabel(discipline: string, gender: string): string {
  return `${GENDER_LABEL[gender] ?? gender}${DISCIPLINE_LABEL[discipline] ?? discipline}`;
}

export default function RankingsPage({ boards, latestYear }: RankingsPageProps) {
  const years = useMemo(() => [...new Set(boards.map((b) => b.year))].sort((a, b) => b - a), [boards]);
  const [year, setYear] = useState(latestYear);
  const [tab, setTab] = useState(0);

  // 選択年度に存在するタブだけ出す
  const tabsForYear = TAB_ORDER.filter(({ discipline, gender }) => boards.some((b) => b.year === year && b.discipline === discipline && b.gender === gender));
  const activeTab = tabsForYear[Math.min(tab, Math.max(tabsForYear.length - 1, 0))];
  const board = activeTab ? boards.find((b) => b.year === year && b.discipline === activeTab.discipline && b.gender === activeTab.gender) : undefined;

  const pageUrl = 'https://softeni-pick.com/rankings/';
  const description = `ソフトテニス選手の年度別ランキング。当サイト掲載大会の成績から算出したシーズンポイント（年度の上位3大会合算）による男女別・種目別の順位表です。最新は${latestYear}年度。`;

  return (
    <>
      <MetaHead title="ソフトテニス選手ランキング（年度別・男女別）| Softeni Pick" description={description} url={pageUrl} type="article" />

      <Head>
        {/* ItemList: 初期表示ボード（最新年度・先頭タブ）の上位10位。 */}
        {board && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: `${board.year}年度 ソフトテニス${tabLabel(board.discipline, board.gender)}ランキング`,
                description,
                url: pageUrl,
                numberOfItems: Math.min(10, board.entries.length),
                itemListOrder: 'https://schema.org/ItemListOrderAscending',
                itemListElement: board.entries.slice(0, 10).map((e) => ({
                  '@type': 'ListItem',
                  position: e.rank,
                  name: `${e.playerName}${e.team ? `（${e.team}）` : ''}`,
                  ...(e.hasPage && e.playerId != null ? { url: `https://softeni-pick.com/players/${e.playerId}/results/` } : {}),
                })),
              }),
            }}
          />
        )}
      </Head>

      <PageLayout className="space-y-8">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '選手ランキング', href: '/rankings' },
          ]}
        />

        <header>
          <h1 className="text-2xl font-bold">ソフトテニス選手ランキング</h1>
          <p className="mt-2 text-sm text-text-secondary">
            当サイト掲載大会の成績から算出した年度別ランキングです。ポイントは大会の格 （主要大会・全国大会・地方大会）と最終成績から求め、
            <strong>年度の上位3大会のみを合算</strong>しています（上位{TOP_N}位まで掲載）。
          </p>
          <p className="mt-1 text-xs text-text-muted">
            ※ 当サイトに掲載されている大会のみが対象です。年度により収録大会数・母数が大きく異なるため、 年度をまたいだ順位の比較には適しません。
          </p>
        </header>

        {/* 年度切替 */}
        <div className="flex flex-wrap gap-2">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${y === year ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500' : 'border-gray-300 bg-surface text-gray-700 hover:bg-blue-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}`}
            >
              {y}年度
            </button>
          ))}
        </div>

        {/* 種目×男女タブ */}
        <div className="border-b border-border">
          <div className="-mb-px flex flex-wrap gap-1">
            {tabsForYear.map((t, i) => {
              const active = activeTab === t;
              return (
                <button
                  key={`${t.discipline}-${t.gender}`}
                  type="button"
                  onClick={() => setTab(i)}
                  className={`rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium transition-colors ${active ? 'border-gray-200 bg-surface text-blue-700 dark:border-gray-700 dark:text-blue-300' : 'border-transparent text-text-muted hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  {tabLabel(t.discipline, t.gender)}
                </button>
              );
            })}
          </div>
        </div>

        {board ? (
          <section>
            <h2 className="mb-1 text-lg font-bold">
              {board.year}年度 {tabLabel(board.discipline, board.gender)}ランキング
            </h2>
            <p className="mb-3 text-xs text-text-muted">
              対象 {board.outOf.toLocaleString()}人中の上位
              {Math.min(TOP_N, board.entries.length)}位。
            </p>
            <table className="w-full border border-border-strong text-sm">
              <thead className="bg-bg-subtle text-gray-800 dark:text-gray-200">
                <tr>
                  <th className="py-1.5 px-2 text-center">順位</th>
                  <th className="py-1.5 px-2 text-left">選手</th>
                  <th className="py-1.5 px-2 text-left">所属（当時）</th>
                  <th className="py-1.5 px-2 text-center">ポイント</th>
                </tr>
              </thead>
              <tbody>
                {board.entries.map((e) => (
                  <tr
                    key={`${e.rank}-${e.playerId ?? e.playerName}`}
                    className={`border-t border-border-strong ${e.rank <= 3 ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}
                  >
                    <td className="py-1.5 px-2 text-center font-semibold">{e.rank}</td>
                    <td className="py-1.5 px-2">
                      {e.hasPage && e.playerId != null ? (
                        <Link href={`/players/${e.playerId}/results/`} className="text-link hover:underline">
                          {e.playerName}
                        </Link>
                      ) : (
                        e.playerName
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-text-secondary">{e.team ?? '―'}</td>
                    <td className="py-1.5 px-2 text-center">{e.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <p className="text-sm text-text-muted">この年度のランキングはありません。</p>
        )}

        {/* 全年度・全種目の上位3位（静的HTML）。タブ裏の順位表はクライアント描画で
            クローラに見えないため、選手名と内部リンクをここで担保する（seo.md #9）。 */}
        <section>
          <h2 className="mb-1 text-lg font-bold">年度別 上位選手まとめ</h2>
          <p className="mb-4 text-xs text-text-muted">全年度・全種目の上位3位です。詳細は上の年度・種目切替で確認できます。</p>
          <div className="space-y-4">
            {years.map((y) => (
              <div key={y}>
                <h3 className="mb-1 text-base font-semibold">{y}年度</h3>
                <ul className="space-y-1 text-sm text-text-secondary">
                  {TAB_ORDER.map(({ discipline, gender }) => {
                    const b = boards.find((x) => x.year === y && x.discipline === discipline && x.gender === gender);
                    if (!b || b.entries.length === 0) return null;
                    return (
                      <li key={`${y}-${discipline}-${gender}`}>
                        <span className="font-medium">{tabLabel(discipline, gender)}:</span>{' '}
                        {b.entries.slice(0, 3).map((e, i) => (
                          <span key={`${e.rank}-${e.playerId ?? e.playerName}`}>
                            {i > 0 && '、'}
                            {e.rank}位{' '}
                            {e.hasPage && e.playerId != null ? (
                              <Link href={`/players/${e.playerId}/results/`} className="text-link hover:underline">
                                {e.playerName}
                              </Link>
                            ) : (
                              e.playerName
                            )}
                            {e.team ? `（${e.team}）` : ''}
                          </span>
                        ))}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <div className="text-right">
          <Link href="/players" className="text-sm text-link hover:underline">
            選手一覧はこちら
          </Link>
        </div>
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<RankingsPageProps> = async () => {
  const fs = await import('fs');
  const path = await import('path');
  const root = process.cwd();

  // 結果ページの有無（index.json count>=5）: デッドリンク防止
  const countById = new Map<number, number>();
  try {
    const index = JSON.parse(fs.readFileSync(path.join(root, 'data', 'players', 'index.json'), 'utf-8')) as Array<{ id: number; count?: number }>;
    for (const p of index) countById.set(p.id, p.count ?? 0);
  } catch {
    // index が無ければ全員リンク無し
  }

  const dir = path.join(root, 'data', 'rankings');
  const boards: Board[] = [];
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /^\d{4}-(singles|doubles)-(boys|girls)\.json$/.test(f));
  } catch {
    files = [];
  }
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as {
        year: number;
        discipline: string;
        gender: string;
        outOf: number;
        entries: Array<{
          rank: number;
          playerId: number | null;
          playerName: string;
          team?: string | null;
          points: number;
        }>;
      };
      boards.push({
        year: data.year,
        discipline: data.discipline,
        gender: data.gender,
        outOf: data.outOf,
        entries: data.entries.slice(0, TOP_N).map((e) => ({
          rank: e.rank,
          playerId: e.playerId,
          playerName: e.playerName,
          team: e.team ?? null,
          points: e.points,
          hasPage: e.playerId != null && (countById.get(e.playerId) ?? 0) >= 5,
        })),
      });
    } catch {
      // 壊れたファイルは無視
    }
  }
  boards.sort((a, b) => b.year - a.year || a.discipline.localeCompare(b.discipline) || a.gender.localeCompare(b.gender));

  const latestYear = boards.length > 0 ? Math.max(...boards.map((b) => b.year)) : new Date().getFullYear();
  return { props: { boards, latestYear } };
};
