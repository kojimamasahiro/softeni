// src/components/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="w-full text-center py-6 mt-10 border-t border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400">
      <p className="text-sm">
        © 2025 Softeni Pick All rights reserved.
      </p>
      <div className="mt-2 space-x-4">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <Link href="/about" className="hover:underline">
          About
        </Link>
      </div>
    </footer>
  );
}
