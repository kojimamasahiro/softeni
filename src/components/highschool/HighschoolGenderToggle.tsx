import Link from 'next/link';

type HighschoolGenderToggleProps = {
  gender: 'boys' | 'girls';
  boysHref: string;
  girlsHref: string;
  className?: string;
};

export default function HighschoolGenderToggle({
  gender,
  boysHref,
  girlsHref,
  className = '',
}: HighschoolGenderToggleProps) {
  const getButtonClassName = (isActive: boolean) =>
    [
      'flex-1 rounded-full px-4 py-3 text-sm font-semibold text-center transition',
      'min-h-12',
      isActive
        ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700'
        : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100',
    ].join(' ');

  return (
    <nav
      aria-label="高校カテゴリの性別切り替え"
      className={`rounded-full bg-gray-100 p-1 dark:bg-gray-800 ${className}`}
    >
      <div className="flex gap-1">
        <Link
          href={boysHref}
          aria-current={gender === 'boys' ? 'page' : undefined}
          className={getButtonClassName(gender === 'boys')}
        >
          男子
        </Link>
        <Link
          href={girlsHref}
          aria-current={gender === 'girls' ? 'page' : undefined}
          className={getButtonClassName(gender === 'girls')}
        >
          女子
        </Link>
      </div>
    </nav>
  );
}
