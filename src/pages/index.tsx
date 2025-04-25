import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>試合結果まとめ | ソフトテニス情報</title>
        <meta name="description" content="最新試合結果・大会情報・成績をまとめた非公式ファンサイトです。" />
        <meta property="og:title" content="試合結果まとめ" />
        <meta property="og:description" content="最新試合情報を随時更新中！" />
        <meta property="og:image" content="/public/images/og.png" />
        <meta property="og:url" content="https://yourdomain.com" />
        <meta property="og:type" content="website" />
      </Head>
      {/* コンテンツ */}
    </>
  );
}
