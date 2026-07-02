// src/components/ScrollToTop.tsx
import { useCallback, useEffect, useState } from 'react';

/**
 * ページ最上部に戻るボタン。
 * - 一定量スクロールすると右下に表示される。
 * - クリックで最上部へスムーズスクロール。
 */
export default function ScrollToTop({
  /** 表示を開始するスクロール量(px) */
  threshold = 300,
}: {
  threshold?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  const scrollToTop = useCallback(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="ページ最上部に戻る"
      className="fixed bottom-5 right-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-800/90 text-white shadow-lg transition-opacity hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:bg-gray-200/90 dark:text-gray-900 dark:hover:bg-gray-100"
    >
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
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    </button>
  );
}
