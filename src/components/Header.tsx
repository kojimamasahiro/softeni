// src/components/Header.tsx
import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full bg-gray-50 text-gray-800 shadow-sm dark:bg-gray-900 dark:text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Softeni Pick
        </Link>
      </div>
    </header>
  );
}
