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

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 border-b text-gray-800 dark:text-white">
        {name}
      </h3>

      {/* 年ごとにカテゴリチップを並べる */}
      {groups
        .sort((a, b) => b.year - a.year)
        .map((group) => (
          <div key={`${generation}-${id}-${group.year}`} className="mb-4">
            <h4 className="text-md mb-2">{group.year}年</h4>
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
          </div>
        ))}
    </div>
  );
};
