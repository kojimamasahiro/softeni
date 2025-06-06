// src/components/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full bg-gray-50 text-gray-800 border-t border-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 mt-10">
      <div className="max-w-5xl mx-auto px-4 py-6 text-center">
        <p className="text-sm">© 2025 Softeni Pick All rights reserved.</p>
        <div className="mt-2 space-x-6 text-sm">
          <Link
            href="/"
            aria-label="Go to Home"
            className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline transition duration-200 ease-in-out"
          >
            Home
          </Link>
          <Link
            href="/about"
            aria-label="Go to About"
            className="hover:text-blue-500 dark:hover:text-blue-400 hover:underline transition duration-200 ease-in-out"
          >
            About
          </Link>
        </div>
      </div>
    </footer>
  );
}
