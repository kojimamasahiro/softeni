import { useEffect, useRef, useState } from 'react';

import { trackPointShare } from '@/lib/analytics';

interface PointShareButtonProps {
  /** 共有する文面（URL は含めない） */
  text: string;
  url: string;
  title?: string;
  className?: string;
}

type ShareStatus = 'idle' | 'copied' | 'failed';

/**
 * 1本のラリーを共有するボタン。Web Share API があれば共有シート、なければ文面＋URL をコピーする。
 * 仕様は docs/wiki/beta-matches-results.md「ラリー共有リンク」。
 */
export default function PointShareButton({ text, url, title, className = '' }: PointShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>('idle');
  const resetTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const showStatus = (next: ShareStatus) => {
    setStatus(next);
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => setStatus('idle'), 2000);
  };

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    // 名場面カードなど、ボタン自体がクリック可能な要素の中に置かれる場合がある
    event.stopPropagation();

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        trackPointShare('share');
        return;
      } catch (error) {
        // 利用者が共有シートを閉じただけなら何もしない
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      trackPointShare('copy');
      showStatus('copied');
    } catch {
      showStatus('failed');
    }
  };

  const label = status === 'copied' ? 'コピーしました' : status === 'failed' ? 'コピーできませんでした' : '共有';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={status === 'idle' ? 'このラリーを共有' : label}
      className={`inline-flex items-center gap-1 rounded border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-bg-subtle ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M8 10V2M5 5l3-3 3 3M3 9v4h10V9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span aria-live="polite">{label}</span>
    </button>
  );
}
