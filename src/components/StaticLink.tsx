// src/components/StaticLink.tsx
//
// 本番ビルドで `next/link` の代わりに使う素の <a>（next.config.mjs の webpack alias で差し替える）。
// postbuild の drop-next-data.mjs が out/_next/data を消すため、next/link のままだと
// 画面内のリンクごとに prefetch が 404 になり、クリック時も 404 を受けてから全体を再読み込みする。
// 素の <a> にすれば最初から通常のページ遷移になる。
// 詳細: docs/wiki/deployment.md「出力のファイル数に上限がある」

import type { LinkProps } from 'next/link';
import { formatUrl } from 'next/dist/shared/lib/router/utils/format-url';
import React from 'react';

type StaticLinkProps = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    children?: React.ReactNode;
  };

function toHref(href: LinkProps['href']): string {
  return typeof href === 'string' ? href : formatUrl(href);
}

// next/link 固有の props。<a> には渡さない
const LINK_ONLY_PROPS = new Set(['href', 'as', 'replace', 'scroll', 'shallow', 'passHref', 'prefetch', 'locale', 'legacyBehavior', 'onNavigate']);

const StaticLink = React.forwardRef<HTMLAnchorElement, StaticLinkProps>(function StaticLink(props, ref) {
  const anchorProps = Object.fromEntries(Object.entries(props).filter(([key]) => !LINK_ONLY_PROPS.has(key))) as React.AnchorHTMLAttributes<HTMLAnchorElement>;
  return <a ref={ref} {...anchorProps} href={toHref(props.as ?? props.href)} />;
});

export default StaticLink;
