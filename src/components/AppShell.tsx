// src/components/AppShell.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode, useCallback, useEffect, useState } from 'react';

import ScrollToTop from '@/components/ScrollToTop';
import SideNav from '@/components/nav/SideNav';
import { getNavItems } from '@/lib/navigation';
import { isScoreSiteMode, siteConfig } from '@/lib/siteConfig';

const SIDEBAR_PREF_KEY = 'sideNavOpen';

function HamburgerIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

/**
 * 公開サイト共通シェル（上部バー＋サイドバー＋ドロワー）。
 * - softeni-pick mode: PC=2ペイン（折りたたみ可能・状態保持）、モバイル=ドロワー。
 * - score mode: サイドバーは出さず上部バーのみ（ADR-006）。
 */
export default function AppShell({
  children,
  footer,
}: {
  children: ReactNode;
  /** コンテンツ下に全幅で表示するフッター */
  footer?: ReactNode;
}) {
  const router = useRouter();
  const pathname = (router.asPath || '/').split('?')[0].split('#')[0];
  const scoreMode = isScoreSiteMode();
  const navItems = getNavItems();

  // PC サイドバーの開閉（localStorage で状態保持）
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // モバイルドロワーの開閉（保持しない）
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (scoreMode) return;
    try {
      const saved = localStorage.getItem(SIDEBAR_PREF_KEY);
      if (saved != null) setSidebarOpen(saved === 'true');
    } catch {
      // localStorage 不可環境では既定値のまま
    }
  }, [scoreMode]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_PREF_KEY, String(next));
      } catch {
        // 無視
      }
      return next;
    });
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // ルート遷移でドロワーを閉じる
  useEffect(() => {
    router.events.on('routeChangeComplete', closeDrawer);
    return () => router.events.off('routeChangeComplete', closeDrawer);
  }, [router.events, closeDrawer]);

  // ドロワー表示中は Esc で閉じる＋背面スクロール抑止
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen, closeDrawer]);

  const brand = (
    <Link
      href={scoreMode ? (navItems[0]?.href ?? '/') : '/'}
      className="text-xl font-bold tracking-tight"
    >
      {siteConfig.siteName}
    </Link>
  );

  // ---- score mode: 上部バーのみ ----
  if (scoreMode) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="w-full bg-gray-50 text-gray-800 shadow-sm dark:bg-gray-900 dark:text-gray-100">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            {brand}
            <nav className="flex gap-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-blue-600"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        {footer}
        <ScrollToTop />
      </div>
    );
  }

  // ---- softeni-pick mode: 2ペイン ----
  return (
    <div className="flex min-h-screen flex-col">
      {/* モバイルは非sticky（自動広告の上部アンカーと最上部で競合させない）。PC のみ固定。 */}
      <header className="z-30 w-full bg-gray-50 text-gray-800 shadow-sm lg:sticky lg:top-0 dark:bg-gray-900 dark:text-gray-100">
        <div className="flex items-center gap-3 px-4 py-4">
          {/* モバイル: ドロワー開閉 */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="メニューを開く"
            aria-controls="mobile-drawer"
            aria-expanded={drawerOpen}
            className="inline-flex rounded-md p-1 hover:bg-gray-200 lg:hidden dark:hover:bg-gray-800"
          >
            <HamburgerIcon />
          </button>
          {/* PC: サイドバー折りたたみ */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={
              sidebarOpen ? 'サイドバーを折りたたむ' : 'サイドバーを開く'
            }
            aria-expanded={sidebarOpen}
            className="hidden rounded-md p-1 hover:bg-gray-200 lg:inline-flex dark:hover:bg-gray-800"
          >
            <HamburgerIcon />
          </button>
          {brand}
        </div>
      </header>

      <div className="flex flex-1">
        {/* PC サイドバー */}
        <aside
          aria-hidden={!sidebarOpen}
          className={`hidden shrink-0 border-r border-gray-200 bg-gray-50 transition-all duration-200 lg:block dark:border-gray-800 dark:bg-gray-900 ${
            sidebarOpen ? 'lg:w-60' : 'lg:w-0 lg:overflow-hidden lg:border-r-0'
          }`}
        >
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] w-60 overflow-y-auto">
            <SideNav pathname={pathname} />
          </div>
        </aside>

        {/* モバイルドロワー */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={closeDrawer}
              aria-hidden="true"
            />
            <div
              id="mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="サイトナビゲーション"
              className="absolute left-0 top-0 h-full w-72 max-w-[80%] overflow-y-auto bg-gray-50 shadow-xl dark:bg-gray-900"
            >
              <div className="flex items-center justify-between px-4 py-4">
                <span className="text-lg font-bold">{siteConfig.siteName}</span>
                <button
                  type="button"
                  onClick={closeDrawer}
                  aria-label="メニューを閉じる"
                  className="rounded-md p-1 hover:bg-gray-200 dark:hover:bg-gray-800"
                >
                  <CloseIcon />
                </button>
              </div>
              <SideNav pathname={pathname} onNavigate={closeDrawer} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {footer}
      <ScrollToTop />
    </div>
  );
}
