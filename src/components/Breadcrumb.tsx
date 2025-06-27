// components/Breadcrumb.tsx

import Link from 'next/link';

type Crumb = {
  label: string;
  href: string;
};

export default function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav
      aria-label="パンくずリスト"
      className="text-sm mb-4 text-gray-600 dark:text-gray-300"
    >
      <ol className="list-none flex flex-wrap gap-2 items-center">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <li key={idx} className="flex items-center">
              {idx > 0 && <span className="mx-1">/</span>}
              {isLast ? (
                <span>{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:underline hover:text-blue-500 dark:hover:text-blue-400"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
