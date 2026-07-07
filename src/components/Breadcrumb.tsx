// components/Breadcrumb.tsx

import Head from 'next/head';
import Link from 'next/link';

import { buildSiteUrl } from '@/lib/siteConfig';

type Crumb = {
  label: string;
  href: string;
};

export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const itemListElement = crumbs.map((crumb, idx) => ({
    '@type': 'ListItem',
    position: idx + 1,
    name: crumb.label,
    item: buildSiteUrl(crumb.href),
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
