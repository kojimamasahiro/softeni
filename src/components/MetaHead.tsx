// src/components/MetaHead.tsx
import Head from 'next/head';

import { siteConfig } from '@/lib/siteConfig';

type MetaHeadProps = {
  title: string;
  description: string;
  url: string;
  image?: string;
  twitterCardType?: 'summary' | 'summary_large_image' | 'player' | 'app';
  type?: 'website' | 'article';
  siteName?: string;
  locale?: string;
  noindex?: boolean;
  // noindex 時にリンクは follow させたい場合に true（薄いページを noindex しつつ
  // そこからの内部リンクで残すページへ評価を流す用途）。既定は noindex, nofollow。
  noindexFollow?: boolean;
};

export default function MetaHead({
  title,
  description,
  url,
  image = siteConfig.ogImage,
  twitterCardType = 'summary',
  type = 'website',
  siteName = siteConfig.siteName,
  locale = 'ja_JP',
  noindex = false,
  noindexFollow = false,
}: MetaHeadProps) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      {noindex && (
        <meta
          name="robots"
          content={noindexFollow ? 'noindex, follow' : 'noindex, nofollow'}
        />
      )}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      {image === siteConfig.ogImage && (
        <>
          <meta property="og:image:width" content="192" />
          <meta property="og:image:height" content="192" />
        </>
      )}
      <meta property="og:image:alt" content={title} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={locale} />
      <meta name="twitter:card" content={twitterCardType} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <link rel="canonical" href={url} />
    </Head>
  );
}
