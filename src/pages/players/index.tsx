// pages/players/index.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import { PlayerInfo } from '@/types';

/** ───────── 型 ───────── */
interface Props {
  players: PlayerInfo[];
}

/** ───────── 画面 ───────── */
export default function PlayersPage({ players }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filtered, setFiltered] = useState<PlayerInfo[]>(players);

  /** 初期は五十音順にソート */
  useEffect(() => {
    setFiltered(
      [...players].sort((a, b) =>
        (a.lastNameKana + a.firstNameKana).localeCompare(
          b.lastNameKana + b.firstNameKana,
          'ja',
        ),
      ),
    );
  }, [players]);

  /** 検索処理 */
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    const normalized = q.replace(/\s/g, '').toLowerCase();

    const hits = players.filter((p) => {
      const haystack = (
        p.lastName +
        p.firstName +
        p.lastNameKana +
        p.firstNameKana +
        p.team
      ).toLowerCase();

      let idx = 0;
      for (const ch of normalized) {
        idx = haystack.indexOf(ch, idx);
        if (idx === -1) return false;
        idx++;
      }
      return true;
    });

    setFiltered(
      hits.sort((a, b) =>
        (a.lastNameKana + a.firstNameKana).localeCompare(
          b.lastNameKana + b.firstNameKana,
          'ja',
        ),
      ),
    );
  };

  return (
    <>
      <MetaHead
        title="選手一覧 | ソフトテニス情報"
        description="ソフトテニス選手を名前・所属で検索できます。"
        url="https://softeni-pick.com/players"
      />

      <Head>
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
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: '選手一覧', href: '/players' },
            ]}
          />
          <h1 className="text-2xl font-bold my-6">選手一覧・検索</h1>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            ソフトテニスの現役・引退選手を掲載しています。名前や所属チームで検索が可能です。各選手ページでは試合結果や戦績を詳しく確認できます。
          </p>


          {/* 検索ボックス */}
          <input
            type="text"
            className="w-full px-4 py-2 mb-6 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="選手名や所属で検索"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />

          {/* 一覧 */}
          {filtered.length === 0 ? (
            <p className="text-gray-600">
              該当する選手が見つかりませんでした。他のキーワードで再度お試しください。
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((p) => {
                const retired = p.retired;
                return (
                  <div
                    key={p.id}
                    onClick={() => (window.location.href = `/players/${p.id}`)}
                    className={`border rounded-xl p-4 shadow cursor-pointer transition
            hover:bg-gray-50 dark:hover:bg-gray-700
            ${retired ? 'opacity-70' : ''}`}
                  >
                    <h2 className="text-lg font-bold mb-1">
                      {p.lastName} {p.firstName}（{p.lastNameKana}{' '}
                      {p.firstNameKana}）
                    </h2>
                    <p className="text-sm mb-2">
                      {retired ? (
                        <span className="inline-block px-2 py-0.5 text-xs text-white bg-gray-500 rounded">
                          引退済み
                        </span>
                      ) : (
                        p.team
                      )}
                    </p>
                    <Link
                      href={`/players/${p.id}/results`}
                      className="inline-block px-3 py-1 mt-1 bg-gray-200 dark:bg-gray-700 rounded text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      試合結果
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

/** ───────── データ取得 ───────── */
export const getStaticProps: GetStaticProps<Props> = async () => {
  const dir = path.join(process.cwd(), 'data/players');
  const ids = fs.readdirSync(dir);
  const players: PlayerInfo[] = ids.flatMap((id) => {
    const file = path.join(dir, id, 'information.json');
    if (!fs.existsSync(file)) return [];
    return [{ id, ...JSON.parse(fs.readFileSync(file, 'utf8')) }];
  });

  return { props: { players } };
};
