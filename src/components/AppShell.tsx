// src/components/AppShell.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode, useCallback, useEffect, useLayoutEffect, useState } from 'react';

import ScrollToTop from '@/components/ScrollToTop';
import SideNav from '@/components/nav/SideNav';
import { getNavItems } from '@/lib/navigation';
import { isScoreSiteMode, siteConfig } from '@/lib/siteConfig';

const SIDEBAR_PREF_KEY = 'sideNavOpen';

// SSR では useLayoutEffect が使えないため、クライアントのみ layout effect を使う。
// 保存済みのサイドバー状態を「描画前」に反映してチラつきを防ぐ目的。
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}

/** サイドバー開閉トグル（パネル左）アイコン。 */
function SidebarIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

/**
 * 公開サイト共通シェル（左サイドバー + 上部ヘッダー + ドロワー）。
 * - softeni-pick mode:
 *   - PC: 左に固定サイドバー（幅 280px・独立スクロール）、右に上部固定ヘッダー
 *     （高さ 64px・sticky）＋本文。サイドバーは閉じるボタンで折りたたみでき
 *     （状態は localStorage 保持）、閉じるとヘッダーに開くボタンを出す。
 *   - モバイル: サイドバーはドロワー化。ヘッダーは上部固定のまま、左にハンバーガー。
 *   スクロールはページ（window）スクロールを採用し、サイドバー/ヘッダーを sticky で
 *   固定する。これにより既存の ScrollToTop・スクロール復元・アンカー遷移を壊さず、
 *   見た目は「本文だけがスクロールする」構成になる。
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

  // PC サイドバーの開閉（localStorage で状態保持）。
  // SSR の既定は「開いた状態」。クライアントで保存値を描画前に反映する。
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // 初回マウント後のみ true。これが true の間だけ幅トランジションを有効化し、
  // リロード直後の「開く→閉じる」アニメーションを防ぐ。
  const [hydrated, setHydrated] = useState(false);
  // モバイルドロワーの開閉（保持しない）
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // 描画前に保存済みの開閉状態へ切り替える（チラつき・初回アニメーション防止）。
  useIsomorphicLayoutEffect(() => {
    if (scoreMode) return;
    try {
      const saved = localStorage.getItem(SIDEBAR_PREF_KEY);
      if (saved != null) setSidebarOpen(saved === 'true');
    } catch {
      // localStorage 不可環境では既定値（開いた状態）のまま
    }
  }, [scoreMode]);

  // 初回ペイント後に: トランジションを有効化し、FOUC 防止用クラスを外す。
  // この時点で React 側の状態が確定しているため、以降は React が幅を制御する。
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setHydrated(true);
      document.documentElement.classList.remove('sidebar-collapsed');
    });
    return () => cancelAnimationFrame(id);
  }, []);

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
    <Link href={scoreMode ? (navItems[0]?.href ?? '/') : '/'} className="text-xl font-bold tracking-tight">
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
                <Link key={item.href} href={item.href} className="transition-colors hover:text-blue-600">
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

  // ---- softeni-pick mode: 左固定サイドバー + 上部固定ヘッダー ----
  return (
    <div className="flex min-h-screen">
      {/* 左サイドバー: 幅 280px・独立スクロール（PC のみ）。閉じると幅 0。 */}
      <aside
        data-sidebar
        aria-hidden={!sidebarOpen}
        className={`hidden shrink-0 border-r border-gray-200 bg-gray-50 lg:block dark:border-gray-800 dark:bg-gray-900 ${
          hydrated ? 'transition-[width] duration-200' : ''
        } ${sidebarOpen ? 'lg:w-[280px]' : 'lg:w-0 lg:overflow-hidden lg:border-r-0'}`}
      >
        <div className="sticky top-0 flex h-screen w-[280px] flex-col">
          {/* サイドバー上部: 閉じるボタン（高さ 64px でヘッダーと揃える） */}
          <div className="flex h-16 shrink-0 items-center justify-end border-b border-gray-200 px-3 dark:border-gray-800">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="サイドバーを閉じる"
              aria-expanded={sidebarOpen}
              className="rounded-md p-1.5 text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <SidebarIcon />
            </button>
          </div>
          {/* ナビ本体（独立スクロール） */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SideNav pathname={pathname} />
          </div>
        </div>
      </aside>

      {/* モバイルドロワー */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeDrawer} aria-hidden="true" />
          <div
            id="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="サイトナビゲーション"
            className="absolute left-0 top-0 h-full w-72 max-w-[80%] overflow-y-auto bg-gray-50 shadow-xl dark:bg-gray-900"
          >
            <div className="flex h-16 items-center justify-between px-4">
              <span className="text-lg font-bold">{siteConfig.siteName}</span>
              <button type="button" onClick={closeDrawer} aria-label="メニューを閉じる" className="rounded-md p-1 hover:bg-gray-200 dark:hover:bg-gray-800">
                <CloseIcon />
              </button>
            </div>
            <SideNav pathname={pathname} onNavigate={closeDrawer} />
          </div>
        </div>
      )}

      {/* 右カラム: 上部固定ヘッダー + 本文 + フッター */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ヘッダー: 高さ 64px・上部固定（sticky）。コンテンツが長くても消えない。 */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
          {/* モバイル: ハンバーガー（ヘッダー左） */}
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
          {/* PC: サイドバーを開く（折りたたみ時のみ表示） */}
          {!sidebarOpen && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="サイドバーを開く"
              aria-expanded={sidebarOpen}
              className="hidden rounded-md p-1.5 hover:bg-gray-200 lg:inline-flex dark:hover:bg-gray-800"
            >
              <SidebarIcon />
            </button>
          )}
          {brand}
        </header>

        <main className="min-w-0 flex-1">{children}</main>
        {footer}
      </div>

      <ScrollToTop />
    </div>
  );
}
