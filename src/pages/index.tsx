// src/pages/index.tsx
import fs from 'fs';
import path from 'path';

import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { getAllDetailRecords, loadInformationMap } from '@/lib/tournamentData';
import { PlayerInfo } from '@/types/index';

const SITE_URL = 'https://softeni-pick.com';

interface RecentTournament {
  id: string;
  year: string;
  name: string;
  startDate: string;
  displayDate: string;
  link: string;
}

interface HomeProps {
  recentTournaments: RecentTournament[];
}

export default function Home({ recentTournaments }: HomeProps) {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Softeni Pick',
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/favicon-32x32.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Softeni Pick',
      alternateName: 'ソフテニ・ピック',
      url: `${SITE_URL}/`,
      inLanguage: 'ja',
      publisher: { '@type': 'Organization', name: 'Softeni Pick' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'ホーム',
          item: `${SITE_URL}/`,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: '最近追加された大会',
      itemListElement: recentTournaments.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: `${t.name}（${t.year}）`,
        url: `${SITE_URL}${t.link}`,
      })),
    },
  ];

  return (
    <>
      <MetaHead
        title="Softeni Pick｜ソフトテニスの大会結果・選手成績データベース"
        description="ソフトテニスの全国大会の試合結果、選手ごとの成績・出場履歴、チーム戦績をまとめたデータベース型サイト。全日本選手権や高校全国大会（インターハイ等）の結果を随時更新しています。"
        url={`${SITE_URL}/`}
      />

      <Head>
        {jsonLd.map((schema, i) => (
          <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
        ))}
      </Head>

      <PageLayout maxWidth="4xl">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs crumbs={[{ label: 'ホーム', href: '/' }]} />
        </div>

        {/* ✅ サイト紹介文（ページ最上部に設置） */}
        <section className="max-w-3xl mx-auto mb-10 px-4">
          <h1 className="text-2xl font-bold mb-4">ソフトテニスの大会結果・選手成績データベース「Softeni Pick」</h1>
          <p className="text-lg leading-relaxed mb-4">
            <strong>Softeni Pick（ソフテニ・ピック）</strong>
            は、ソフトテニスの大会結果・選手成績・チーム戦績を1か所で調べられる、個人運営のデータベース型Webメディアです。
          </p>
          <p className="text-lg leading-relaxed mb-4">
            全日本選手権をはじめとする全国大会や、インターハイなどの高校全国大会を中心に、試合結果やトーナメント表、勝敗データを掲載しています。「あの大会の優勝者は誰か」「気になる選手の戦績」をすぐにたどれます。
          </p>
          <p className="text-lg leading-relaxed mb-4">
            選手ページでは、過去の出場履歴や大会ごとの成績・勝率、主なペアまで確認できます。チームや高校の学校ページでは、年度ごとの戦績やメンバーを、都道府県別にも探せます。
          </p>
          <p className="text-lg leading-relaxed">
            学校やチームの枠を超え、ソフトテニスを「記録」としてたどれる場を目指しています。指導者・選手・ファンの皆様の試合の振り返りや戦績確認、育成・分析にご活用いただけるよう、今後も内容を拡充していきます。
          </p>
        </section>

        {/* ✅ 試合結果・大会リンク */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">ソフトテニス情報</h2>

          {/* ✅ STリーグへのリンク */}
          <section className="max-w-4xl mx-auto mb-8 px-4">
            <Link
              href="/st-league"
              className="block border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 transition hover:bg-gray-50 dark:hover:bg-gray-700 mb-4"
            >
              <h3 className="text-xl font-bold mb-1">STリーグ</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm">ソフトテニス実業団最高峰の戦い</p>
            </Link>
          </section>

          {/* ✅ 最近追加された大会（カード形式） */}
          <section className="max-w-4xl mx-auto mb-12 px-4">
            <h2 className="text-xl font-bold mb-4">最近追加された大会</h2>

            <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">
              全日本選手権や高校の全国大会を中心に、最新の試合結果を随時掲載しています。過去の大会を後から追加した場合も、こちらに表示されます。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 mb-4">
              {recentTournaments.map((tournament) => (
                <Link
                  key={`${tournament.id}-${tournament.year}`}
                  href={tournament.link}
                  className="block border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 transition hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">開催日: {tournament.displayDate}</p>
                  <h3 className="text-lg font-bold">{tournament.name}</h3>
                </Link>
              ))}
            </div>

            <div className="text-right mb-10">
              <Link href="/tournaments" className="text-sm text-blue-500 hover:underline">
                過去の大会一覧はこちら
              </Link>
            </div>
          </section>

          {/* ✅ よく見られている選手（カード形式） */}
          <section className="max-w-4xl mx-auto mb-12 px-4">
            <h2 className="text-xl font-bold mb-4">よく見られている選手</h2>

            <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">本サイトにてよく見られている選手です。選手ごとに大会の成績を確認できます。</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {[
                {
                  id: '19',
                  name: '上松 俊樹',
                  team: 'NTT西日本',
                },
                {
                  id: '20',
                  name: '上岡 俊介',
                  team: 'Up Rise',
                },
                {
                  id: '12',
                  name: '丸山 海斗',
                  team: 'one team',
                },
              ].map((player) => (
                <Link
                  key={player.id}
                  href={`/players/${player.id}/results`}
                  className="block border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 transition hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <h3 className="text-lg font-bold mb-1">{player.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{player.team}</p>
                </Link>
              ))}
            </div>

            {/* ✅ 一覧ページへのリンク */}
            <div className="text-right mb-10">
              <Link href="/players" className="text-sm text-blue-500 hover:underline">
                掲載中の選手一覧はこちら
              </Link>
            </div>
          </section>

          {/* ✅ 選手ランキングへのリンク */}
          <section className="mb-12 px-4">
            <h2 className="text-xl font-semibold mb-4">選手ランキング</h2>

            <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">
              掲載大会の成績から算出した年度別の選手ランキングです。男女別・種目別（シングルス/ダブルス）に上位選手を確認できます。
            </p>

            <Link
              href="/rankings"
              className="block border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 transition hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <h3 className="text-lg font-bold mb-1">年度別ランキング</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm">シーズンポイントによる男女別・種目別の順位表（上位100位）</p>
            </Link>
          </section>

          {/* ✅ 高校カテゴリへのリンク */}
          <section className="mb-12 px-4">
            <h2 className="text-xl font-semibold mb-4">属性別成績</h2>

            <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">
              全国大会での成績を属性別にまとめています。都道府県ごとにも確認できるので、出身地や気になる地域の情報もチェックしてみてください。
            </p>

            <Link
              href="/highschool/boys"
              className="block border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 transition hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <h3 className="text-lg font-bold mb-1">高校カテゴリ</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm">インターハイなど高校全国大会の成績を都道府県・学校別に掲載</p>
            </Link>
          </section>

          {/* ✅ 所属別成績 */}
          <section className="mb-12 px-4">
            <h2 className="text-xl font-semibold mb-4">所属別成績</h2>

            <p className="text-gray-700 dark:text-gray-300 text-sm mb-6">
              所属ごとに選手の年間成績や大会別の記録をまとめています。所属単位での活躍や個人の成績なども確認できます。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  teamId: 'nssu',
                  name: '日本体育大学',
                  official: 'https://nittai-softtennis.com/',
                },
                {
                  teamId: 'watakyu',
                  name: 'ワタキューセイモア',
                  official: 'https://www.watakyu-sports.jp/softtennis/',
                },
              ].map((team) => (
                <div
                  key={team.teamId}
                  className="relative border border-gray-300 rounded-xl p-4 shadow bg-white dark:bg-gray-800 dark:border-gray-700 transition hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <h3 className="text-lg font-bold mb-1">
                    <Link href={`/teams/${team.teamId}`} className="after:absolute after:inset-0">
                      {team.name}
                    </Link>
                  </h3>
                  <a
                    href={team.official}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative inline-flex items-center text-sm text-blue-700 dark:text-blue-300 underline"
                  >
                    公式サイト
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="ml-1 h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>
      </PageLayout>
    </>
  );
}

export async function getStaticProps() {
  const playersDir = path.join(process.cwd(), 'data/players');
  const playerIds = fs.readdirSync(playersDir);
  const players: PlayerInfo[] = [];

  for (const id of playerIds) {
    const filePath = path.join(playersDir, id, 'information.json');
    if (fs.existsSync(filePath)) {
      const jsonData = fs.readFileSync(filePath, 'utf-8');
      const playerData = JSON.parse(jsonData);
      players.push({ id, ...playerData });
    }
  }

  // Fetch recent tournaments
  const detailRecords = await getAllDetailRecords();
  const infoMap = await loadInformationMap();

  // Group by tournamentId + year to deduplicate
  const uniqueTournaments = new Map<string, RecentTournament>();

  for (const record of detailRecords) {
    const key = `${record.tournamentId}-${record.year}`;
    if (uniqueTournaments.has(key)) continue;

    const infoList = infoMap.get(record.tournamentId);
    const info = infoList?.find((i) => i.year === Number(record.year));

    if (!info) continue;

    // Find the category info for this specific record (file)
    // record.fileName is like "doubles-none-boys.json"
    const categoryId = record.fileName.replace('.json', '');
    const categoryInfo = info.categories.find((c) => c.categoryId === categoryId);

    if (!categoryInfo) continue;

    // 大会ハブページ（年度なし）へリンクする
    const link = `/tournaments/${record.generation}/${record.tournamentId}`;

    // SSG とクライアントで同じ文字列になるよう、ロケール依存の
    // toLocaleDateString を使わず YYYY-MM-DD から決定的に整形する
    const [y, m, d] = (info.startDate ?? '').split('-');
    const displayDate = y && m && d ? `${y}年${Number(m)}月${Number(d)}日` : info.startDate;

    uniqueTournaments.set(key, {
      id: record.tournamentId,
      year: record.year,
      name: record.tournamentName || record.tournamentId,
      startDate: info.startDate,
      displayDate,
      link,
    });
  }

  const tournaments = Array.from(uniqueTournaments.values())
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
    .slice(0, 4);

  return {
    props: {
      recentTournaments: tournaments,
    },
  };
}
