// components/MetaHead.tsx
import Head from 'next/head';

type MetaHeadProps = {
  title: string;
  description?: string;
  url?: string;
  image?: string;
  type?: 'website' | 'article';
};

const MetaHead = ({
  title = '試合結果まとめ | ソフトテニス情報',
  description = '最新試合結果・大会情報・成績をまとめたサイトです。',
  url = 'https://softeni.vercel.app',
  image = '/og-image.jpg',
  type = 'website',
}: MetaHeadProps) => {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
    </Head>
  );
};

export default MetaHead;
