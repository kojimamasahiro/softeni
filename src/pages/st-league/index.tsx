import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

const stLeagueYears = [2025]; // 必要に応じて年度を追加

const menuItems = [
  {
    id: 'teams',
    title: '出場チーム・選手',
    description: '出場全チームの戦力分析と選手紹介',
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
    colorClass: 'bg-blue-500',
  },
  {
    id: 'matches',
    title: '試合結果・日程',
    description: '対戦カードごとの詳細スコアと日程',
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
    colorClass: 'bg-green-500',
  },
  {
    id: 'data',
    title: 'データ・分析',
    description: '各種スタッツランキングと傾向分析',
    icon: (
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"
        />
      </svg>
    ),
    colorClass: 'bg-purple-500',
  },
];

export default function STLeagueHub() {
  const pageTitle = 'STリーグ | ソフトテニス情報';
  const pageUrl = 'https://softeni-pick.com/st-league';

  return (
    <>
      <MetaHead
        title={pageTitle}
        description="ソフトテニスの実業団最高峰リーグ「STリーグ」の情報ページ。STリーグの概要、最新年度の情報、過去の記録など。"
        url={pageUrl}
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: 'STリーグ',
              description:
                'ソフトテニスの実業団最高峰リーグ「STリーグ」の情報ページ。',
              url: pageUrl,
            }),
          }}
        />
      </Head>
      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: 'STリーグ', href: '/st-league' },
            ]}
          />
        </div>

        {/* サイト紹介文 */}
        <section className="max-w-3xl mx-auto mb-10 px-4">
          <h1 className="text-2xl font-bold mb-4">STリーグとは</h1>
          <p className="text-lg leading-relaxed mb-4">
            <strong>STリーグ</strong>
            は、日本の実業団チームによる最高レベルのリーグ戦です。トップ選手たちがチームの誇りをかけて戦う熱い試合の魅力や、リーグの仕組みについて解説します。
          </p>
          <p className="text-lg leading-relaxed mb-4">
            本ページでは、STリーグの概要、最新年度の情報、過去の記録などをまとめています。
          </p>
          <Link
            href="/st-league/about"
            className="inline-flex items-center text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            もっと詳しく知る
            <svg
              className="w-4 h-4 ml-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </section>

        {/* 年度ごとのSTリーグブロック */}
        <div className="max-w-6xl mx-auto">
          <section className="max-w-4xl mx-auto mb-8 px-4">
            <div className="space-y-10">
              {stLeagueYears.map((year) => (
                <div
                  key={year}
                  className="relative bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm overflow-hidden"
                >
                  <div className="relative z-10">
                    <span className="inline-block bg-blue-100 text-blue-800 text-s font-bold px-2 py-1 rounded">
                      SEASON {year}
                    </span>
                  </div>
                  {/* Background decoration */}
                  <div className="absolute top-0 right-0 -mt-10 -mr-10 text-9xl font-bold text-gray-100 dark:text-gray-700/50 select-none">
                    {year}
                  </div>
                  <div className="grid md:grid-cols-3 gap-6 mt-8">
                    {menuItems.map((item) =>
                      item.id === 'teams' || item.id === 'matches' ? (
                        <div key={item.id} className="space-y-2">
                          <Link
                            href={
                              item.id === 'teams'
                                ? `/st-league/${year}/teams`
                                : `/st-league/${year}/matches`
                            }
                            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition block focus:outline-none focus:ring-2 focus:ring-blue-400 ${item.id === 'matches' ? 'ring-green-400' : ''}`}
                            tabIndex={0}
                          >
                            <div
                              className={`absolute top-0 right-0 p-3 rounded-bl-2xl text-white ${item.colorClass} opacity-90`}
                            >
                              {item.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors">
                              {item.title}
                            </h3>
                            <p className="text-sm text-gray-500 mb-6">
                              {item.description}
                            </p>
                          </Link>
                        </div>
                      ) : (
                        <div
                          key={item.id}
                          className="bg-gray-100 dark:bg-gray-700/70 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 relative overflow-hidden group transition opacity-80 cursor-not-allowed"
                        >
                          <div
                            className={`absolute top-0 right-0 p-3 rounded-bl-2xl text-white ${item.colorClass} opacity-90`}
                          >
                            {item.icon}
                          </div>
                          <h3 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors">
                            {item.title}
                          </h3>
                          <p className="text-sm text-gray-500 mb-6">
                            {item.description}
                          </p>
                          <div className="absolute bottom-6 left-6 right-6">
                            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              準備中
                            </span>
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
