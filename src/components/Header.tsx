// src/components/Header.tsx
import Link from 'next/link';

import { isDebugMode } from '../../lib/env';
import {
  getPublicMatchesGrowthPath,
  getPublicMatchesListPath,
  isScoreSiteMode,
  siteConfig,
} from '../../lib/siteConfig';

export default function Header() {
  if (isScoreSiteMode()) {
    return (
      <header className="w-full bg-gray-50 text-gray-800 shadow-sm dark:bg-gray-900 dark:text-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link
            href={getPublicMatchesListPath()}
            className="text-xl font-bold tracking-tight"
          >
            {siteConfig.siteName}
          </Link>
          <nav className="flex gap-6">
            <Link
              href={getPublicMatchesListPath()}
              className="hover:text-blue-600 transition-colors"
            >
              試合一覧
            </Link>
            <Link
              href={getPublicMatchesGrowthPath()}
              className="hover:text-blue-600 transition-colors"
            >
              成長分析
            </Link>
          </nav>
        </div>
      </header>
    );
  }

  return (
    <header className="w-full bg-gray-50 text-gray-800 shadow-sm dark:bg-gray-900 dark:text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold tracking-tight">
          {siteConfig.siteName}
        </Link>
        <nav className="flex gap-6">
          <Link
            href="/tournaments"
            className="hover:text-blue-600 transition-colors"
          >
            大会一覧
          </Link>
          <Link
            href="/players"
            className="hover:text-blue-600 transition-colors"
          >
            選手一覧
          </Link>
          <Link href="/news" className="hover:text-blue-600 transition-colors">
            ニュース
          </Link>
          <Link href="/beta" className="hover:text-blue-600 transition-colors">
            ベータ機能
          </Link>
          {isDebugMode() && (
            <Link
              href="/beta/matches"
              className="hover:text-blue-600 transition-colors text-orange-600"
            >
              [DEV] ポイント記録
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
