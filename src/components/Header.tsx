import Link from 'next/link';

export default function Header() {
  return (
    <header className="w-full bg-gray-50 text-gray-800 shadow-sm dark:bg-gray-900 dark:text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Softeni Pick
        </Link>
        <nav className="space-x-6 text-sm">
          <Link href="/" className="hover:text-blue-500 dark:hover:text-blue-400 transition">
            Home
          </Link>
        </nav>
      </div>
    </header>
  );
}
