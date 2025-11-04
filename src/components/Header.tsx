// src/components/Header.tsx
import Link from 'next/link';

import { isDebugMode } from '../../lib/env';

export default function Header() {
  return (
    <header className="w-full bg-gray-50 text-gray-800 shadow-sm dark:bg-gray-900 dark:text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Softeni Pick
        </Link>
        <nav className="flex gap-6">
          <Link
            href="/tournaments"
            className="hover:text-blue-600 transition-colors"
          >
            大会結果
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
