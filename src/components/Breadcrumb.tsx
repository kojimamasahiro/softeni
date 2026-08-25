// components/Breadcrumb.tsx

import Head from 'next/head';
import Link from 'next/link';

import { buildSiteUrl } from '@/lib/siteConfig';

type Crumb = {
  label: string;
  href: string;
};

// crumb.href は相対パス（'/players'）でも絶対 URL（'https://softeni-pick.com/players/'）でも
// 渡されうるので、JSON-LD に載せる前に絶対 URL へ正規化する。
// - 絶対 URL はそのまま（buildSiteUrl に渡すとベース URL が二重に付いてしまう）
// - 末尾スラッシュは next.config.mjs の trailingSlash: true に合わせ、canonical と同じ形に揃える
const toBreadcrumbItemUrl = (href: string) => {
  const absolute = /^https?:\/\//.test(href) ? href : buildSiteUrl(href);
  const [, pathPart, suffix = ''] = absolute.match(/^([^?#]*)([?#].*)?$/) ?? [];
  if (!pathPart) return absolute;
  return pathPart.endsWith('/') ? absolute : `${pathPart}/${suffix}`;
};

// パンくずの構造化データ（BreadcrumbList）はこのコンポーネントが唯一の出力元。
// ページ側で個別に BreadcrumbList を出すと 1 ページに 2 個出てしまうので追加しないこと。
export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const itemListElement = crumbs.map((crumb, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    name: crumb.label,
    item: toBreadcrumbItemUrl(crumb.href),
  }));

  return (
    <>
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement,
            }),
          }}
        />
      </Head>
      <nav aria-label="パンくずリスト" className="text-sm mb-4 text-text-secondary">
        <ol className="list-none flex flex-wrap gap-2 items-center">
          {crumbs.map((crumb, idx) => {
            const isLast = idx === crumbs.length - 1;
            return (
              <li key={idx} className="flex items-center">
                {idx > 0 && <span className="mx-1">/</span>}
                {isLast ? (
                  <span>{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="hover:underline hover:text-primary-hover">
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
