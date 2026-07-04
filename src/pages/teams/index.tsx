// src/pages/teams/index.tsx
// チーム一覧(セクション入口・ページタイプ T2)。
// 検索対象はチームマスタの count>=2(D-014)。
// 詳細ページへのリンクは STリーグ集計ページが実在するチームのみ(TeamLink 規則の暫定運用)。
import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { getAllStLeagueTeamIds, getStLeagueYears, loadParticipants } from '@/utils/st-league';

type TeamRow = {
  /** チーム名(マスタの最頻出表記) */
  n: string;
  /** 都道府県(不明時 null) */
  p: string | null;
  /** 収録試合数 */
  c: number;
  /** STリーグ teamId(集計ページが実在する場合のみ) */
  s?: string;
};

type Props = {
  teams: TeamRow[];
  totalCount: number;
};

const INITIAL_LIMIT = 50;

export default function TeamsIndexPage({ teams, totalCount }: Props) {
  const pageUrl = 'https://softeni-pick.com/teams/';
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return teams.slice(0, INITIAL_LIMIT);
    const terms = q.split(/\s+/);
    return teams.filter((t) => {
      const text = `${t.n} ${t.p ?? ''}`.toLowerCase();
      return terms.every((term) => text.includes(term));
    });
  }, [teams, query]);

  const isSearching = query.trim().length > 0;

  return (
    <>
      <MetaHead
        title="チーム一覧 | ソフトテニス情報 Softeni Pick"
        description="ソフトテニスのチーム(学校・実業団・クラブ)を名前・都道府県で検索できます。STリーグ出場チームは年度別成績ページへのリンクつき。"
        url={pageUrl}
        type="website"
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://softeni-pick.com/' },
                { '@type': 'ListItem', position: 2, name: 'チーム一覧', item: pageUrl },
              ],
            }),
          }}
        />
      </Head>

      <PageLayout maxWidth="4xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: 'チーム一覧', href: '/teams' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-2">チーム一覧</h1>
        <p className="text-sm text-text-muted dark:text-gray-400 mb-6">
          大会結果に収録されているチーム(学校・実業団・クラブ)を検索できます。掲載は収録試合が2試合以上のチーム({totalCount.toLocaleString()}
          件)。STリーグ出場チームはチームページへのリンクがあります。
        </p>

        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="チーム名・都道府県で検索(例: 高田商業、長野県)"
            aria-label="チーム検索"
            className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm text-text placeholder:text-gray-400 focus:border-blue-600 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <p className="text-xs text-text-muted dark:text-gray-400 mb-2">
          {isSearching ? `検索結果: ${filtered.length.toLocaleString()}件` : `収録試合数の上位 ${INITIAL_LIMIT} 件を表示中(検索で全件から絞り込めます)`}
        </p>

        <div className="overflow-x-auto rounded-lg border border-border dark:border-gray-700">
          <table className="w-full bg-surface text-sm dark:bg-gray-900">
            <thead>
              <tr className="border-b border-border text-left text-xs text-text-muted dark:border-gray-700 dark:text-gray-400">
                <th className="px-4 py-2 font-medium">チーム</th>
                <th className="px-4 py-2 font-medium">都道府県</th>
                <th className="px-4 py-2 font-medium text-right">収録試合数</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={`${t.n}-${t.p ?? ''}`} className="border-b border-gray-100 last:border-b-0 dark:border-gray-800">
                  <td className="px-4 py-2">
                    {t.s ? (
                      <Link href={`/teams/${t.s}`} className="text-primary hover:underline dark:text-blue-300">
                        {t.n}
                      </Link>
                    ) : (
                      <span className="text-text dark:text-gray-100">{t.n}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-text-muted dark:text-gray-400">{t.p ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-text dark:text-gray-100">{t.c.toLocaleString()}</td>
                </tr>
              ))}
              {isSearching && filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-sm text-text-muted dark:text-gray-400">
                    該当するチームが見つかりませんでした
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-text-muted dark:text-gray-400">
          ※ 収録試合数は当サイトに掲載している大会結果に基づくもので、実際の出場数とは異なる場合があります。
        </p>
      </PageLayout>
    </>
  );
}

// ─── データ取得 ───────────────────────────────────────────────────────────
type TeamMasterEntry = {
  id: number;
  name: string;
  prefecture: string | null;
  count: number;
  aliases?: string[];
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  const teamsPath = path.join(process.cwd(), 'data', 'teams', 'teams.json');
  const master = JSON.parse(fs.readFileSync(teamsPath, 'utf-8')) as TeamMasterEntry[];

  // STリーグチーム名 → teamId の対応(全年度の name バリアントを集約)
  const stIds = new Set(getAllStLeagueTeamIds());
  const nameToStId = new Map<string, string>();
  for (const year of getStLeagueYears()) {
    const participants = loadParticipants(year);
    if (!participants) continue;
    (['boys', 'girls'] as const).forEach((g) => {
      for (const team of participants[g]) {
        if (!stIds.has(team.teamId)) continue;
        for (const name of team.name) nameToStId.set(name, team.teamId);
      }
    });
  }

  const resolveStId = (entry: TeamMasterEntry): string | undefined => {
    if (nameToStId.has(entry.name)) return nameToStId.get(entry.name);
    for (const alias of entry.aliases ?? []) {
      if (nameToStId.has(alias)) return nameToStId.get(alias);
    }
    return undefined;
  };

  // D-014: count>=2 のみ掲載。収録試合数の多い順
  const teams: TeamRow[] = master
    .filter((t) => t.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
    .map((t) => {
      const s = resolveStId(t);
      return { n: t.name, p: t.prefecture, c: t.count, ...(s ? { s } : {}) };
    });

  return { props: { teams, totalCount: teams.length } };
};
