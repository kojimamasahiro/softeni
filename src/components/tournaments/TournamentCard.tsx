import Link from 'next/link';

export type CategoryLink = {
  year: number;
  gameCategory: string;
  ageCategory: string;
  gender: string;
  categoryLabel: string;
  isCurrent?: boolean;
};

export type YearGroup = {
  year: number;
  links: CategoryLink[];
  externalResultUrl?: string | null;
};

export type TournamentBlock = {
  id: string;
  name: string;
  generation: string;
  groups: YearGroup[];
};

type Props = {
  tournament: TournamentBlock;
};

export const TournamentCard = ({ tournament }: Props) => {
  const { id, name, generation, groups } = tournament;

  const hubHref = `/tournaments/${generation}/${id}`;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <div className="mb-4 border-b pb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          <Link href={hubHref} className="hover:underline">
            {name}
          </Link>
        </h3>
        <Link
          href={hubHref}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
        >
          歴代結果・優勝者まとめ →
        </Link>
      </div>

      {/* 年ごとにカテゴリチップを並べる */}
      {groups
        .sort((a, b) => b.year - a.year)
        .map((group) => (
          <div key={`${generation}-${id}-${group.year}`} className="mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h4 className="text-md">{group.year}年</h4>
              {group.externalResultUrl && (
                <a
                  href={group.externalResultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full hover:opacity-80 transition"
                >
                  {getExternalResultLabel(group.externalResultUrl)}
                </a>
              )}
            </div>
            {group.links.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {group.links.map((link) => (
                  <li
                    key={`${generation}-${id}-${group.year}-${link.gameCategory}-${link.ageCategory}-${link.gender}`}
                  >
                    <Link
                      href={`/tournaments/${generation}/${id}/${group.year}/${link.gameCategory}/${link.ageCategory}/${link.gender}`}
                    >
                      <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full text-sm hover:opacity-80 transition">
                        {link.categoryLabel}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
    </div>
  );
};

function getExternalResultLabel(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf')) return '結果PDF';
  if (/^https?:\/\/(www\.)?(x\.com|twitter\.com)/.test(lower)) {
    return 'Xで結果';
  }
  return '公式結果';
}
