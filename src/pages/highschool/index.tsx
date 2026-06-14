import Head from 'next/head';
import Link from 'next/link';

import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';

export default function HighschoolIndex() {
  const redirectHref = '/highschool/boys/';
  // noindex のリダイレクト入口ページ。canonical は遷移先（男子ページ）に統一する。
  const pageUrl = 'https://softeni-pick.com/highschool/boys/';

  return (
    <>
      <MetaHead
        title="高校カテゴリ | ソフトテニス情報"
        description="高校カテゴリの入口ページです。男子ページへ移動します。"
        url={pageUrl}
        type="website"
      />
      <Head>
        <meta httpEquiv="refresh" content={`0; url=${redirectHref}`} />
        <meta name="robots" content="noindex" />
      </Head>
      <PageLayout className="text-center">
        <h1 className="text-2xl font-bold mb-4">高校カテゴリ</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          男子ページへ移動しています。
          <Link
            href={redirectHref}
            className="ml-1 text-blue-600 dark:text-blue-300 hover:underline"
          >
            移動しない場合はこちら
          </Link>
        </p>
      </PageLayout>
    </>
  );
}
