/**
 * ベータ機能一覧ページ
 */

import type { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

interface BetaFeature {
  id: string;
  title: string;
  description: string;
  href: string;
  status: '試作中' | '検証中' | '改善中';
  icon: string;
}

const betaFeatures: BetaFeature[] = [
  {
    id: 'same-name-players',
    title: '同姓同名選手一覧',
    description:
      '大会結果から同じ名前の選手を抽出し、所属チームや成績で識別できる機能です。',
    href: '/beta/same-name-players',
    status: '試作中',
    icon: '👥',
  },
];

export default function BetaIndexPage() {
  return (
    <>
      <MetaHead
        title="ベータ機能 | ソフトテニス情報"
        description="試作中・検証中の新機能をお試しいただけます。フィードバックをお待ちしています。"
        url="https://softeni-pick.com/beta"
        type="article"
      />

      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: 'ベータ機能一覧',
              description: '試作中・検証中の新機能',
              inLanguage: 'ja',
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': 'https://softeni-pick.com/beta',
              },
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: 'ベータ機能', href: '/beta' },
            ]}
          />

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-4 flex items-center gap-3">
              🧪 ベータ機能
              <span className="text-lg font-normal text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded text-sm">
                試作版
              </span>
            </h1>
            <p className="text-gray-600 dark:text-gray-300 text-lg">
              新しい機能を試験的に公開しています。
            </p>
          </div>

          <section className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
              ⚠️ ベータ機能について
            </h2>
            <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>
                  これらの機能は開発中のため、予告なく変更・削除される可能性があります
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>データの正確性や完全性は保証されません</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>
                  不具合やご要望がございましたら、お気軽にフィードバックをお寄せください
                </span>
              </li>
            </ul>
          </section>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              利用可能な機能
            </h2>

            {betaFeatures.map((feature) => (
              <Link
                key={feature.id}
                href={feature.href}
                className="block p-6 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 hover:border-amber-300 dark:hover:border-amber-600 hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{feature.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {feature.title}
                      </h3>
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full">
                        {feature.status}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                  <div className="text-gray-400 group-hover:text-amber-500 transition-colors">
                    <svg
                      className="w-5 h-5"
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
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              ← ホームに戻る
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
  };
};
