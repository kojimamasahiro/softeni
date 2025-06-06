// src/components/MetaHead.tsx
import Head from 'next/head';

type MetaHeadProps = {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: 'website' | 'article';
};

export default function MetaHead({
  title,
  description,
  url,
  image = 'https://softeni-pick.com/og-image.jpg',
  type = 'website',
}: MetaHeadProps) {
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <link rel="canonical" href={url} />
    </Head>
  );
}
