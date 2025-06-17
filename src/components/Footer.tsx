// src/components/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full bg-gray-50 text-gray-800 border-t border-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 mt-10">
      <div className="max-w-5xl mx-auto px-4 py-6 text-center">
        <p className="text-sm">© 2025 Softeni Pick All rights reserved.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-4 text-sm">
          <Link
            href="/about"
            aria-label="このサイトについて"
            className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline transition duration-200 ease-in-out"
          >
            このサイトについて
          </Link>
          <Link
            href="/privacy"
            aria-label="プライバシーポリシー"
            className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline transition duration-200 ease-in-out"
          >
            プライバシーポリシー
          </Link>
          <Link
            href="/contact"
            aria-label="お問い合わせページへ"
            className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline transition duration-200 ease-in-out"
          >
            お問い合わせ
          </Link>
          <Link
            href="/faq"
            aria-label="よくあるご質問"
            className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline transition duration-200 ease-in-out"
          >
            よくあるご質問
          </Link>
        </div>
      </div>
    </footer>
  );
}
