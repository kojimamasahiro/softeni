// src/components/Footer.tsx
import Link from 'next/link';

import { getPublicMatchesListPath, isScoreSiteMode, siteConfig } from '@/lib/siteConfig';

export default function Footer() {
  if (isScoreSiteMode()) {
    return (
      <footer className="w-full bg-bg text-text border-t border-border mt-10">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center">
          <p className="text-sm">
            © {new Date().getFullYear()} {siteConfig.siteName} All rights reserved.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm">
            <Link href={getPublicMatchesListPath()} className="hover:text-primary-hover hover:underline transition duration-200 ease-in-out">
              試合一覧
            </Link>
            <Link href="https://softeni-pick.com" className="hover:text-primary-hover hover:underline transition duration-200 ease-in-out">
              Softeni Pick
            </Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full bg-bg text-text border-t border-border mt-10">
      <div className="max-w-5xl mx-auto px-4 py-6 text-center">
        <p className="text-sm">
          © {new Date().getFullYear()} {siteConfig.siteName} All rights reserved.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm">
          <Link href="/about" aria-label="このサイトについて" className="hover:text-primary-hover hover:underline transition duration-200 ease-in-out">
            このサイトについて
          </Link>
          <Link href="/privacy" aria-label="プライバシーポリシー" className="hover:text-primary-hover hover:underline transition duration-200 ease-in-out">
            プライバシーポリシー
          </Link>
          <Link href="/contact" aria-label="お問い合わせページへ" className="hover:text-primary-hover hover:underline transition duration-200 ease-in-out">
            お問い合わせ
          </Link>
          <Link href="/faq" aria-label="よくあるご質問" className="hover:text-primary-hover hover:underline transition duration-200 ease-in-out">
            よくあるご質問
          </Link>
        </div>
      </div>
    </footer>
  );
}
