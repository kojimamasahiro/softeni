// src/components/Tournament/TeamResults.tsx
import Link from 'next/link';

import { resultPriority } from '@/lib/utils';

type DisplayPart = {
  text: string;
  id?: string;
  noLink?: boolean;
};

interface Member {
  result: string;
  resultOrder: number;
  displayParts: DisplayPart[];
}

interface TeamGroup {
  team: string;
  teamId: string;
  prefectureId: string;
  members: Member[];
}

interface Props {
  sortedTeams: TeamGroup[];
}

export default function TeamResults({ sortedTeams }: Props) {
  if (sortedTeams.length === 0) {
    return (
      <p className="text-center text-gray-600 dark:text-gray-300 mt-6">
        大会結果はまだすべて揃っていません。判明次第、順次掲載していきます。
      </p>
    );
  }

  return (
    <section className="mb-10">
      {sortedTeams.map(({ team, teamId, prefectureId, members }) => {
        const grouped = members.reduce(
          (acc, m) => {
            if (!acc[m.result]) acc[m.result] = [];
            acc[m.result].push(m);
            return acc;
          },
          {} as Record<string, Member[]>,
        );

        const resultEntries = Object.entries(grouped)
          .map(([result, list]) => ({
            result,
            resultOrder: resultPriority(result),
            members: list,
          }))
          .sort((a, b) => a.resultOrder - b.resultOrder);

        return (
          <div
            key={team}
            className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
          >
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              {prefectureId && teamId ? (
                <Link
                  href={`/highschool/${prefectureId}/${teamId}`}
                  className="text-base font-semibold text-blue-600 dark:text-blue-300 hover:underline"
                >
                  {team}
                </Link>
              ) : (
                <span className="text-base font-semibold text-gray-800 dark:text-gray-200">
                  {team}
                </span>
              )}
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
              {resultEntries.map(({ result, members }, i) => (
                <li key={i} className="flex px-4 py-2 gap-4">
                  <div className="w-20 text-right text-gray-600 dark:text-gray-300">
                    {result}
                  </div>
                  <div className="text-gray-900 dark:text-gray-100 flex flex-wrap gap-x-1">
                    {members.map((m, j) => (
                      <span key={j}>
                        {m.displayParts.map((part, k) =>
                          part.id && !part.noLink ? (
                            <Link
                              key={k}
                              href={`/players/${part.id}/results`}
                              className="text-inherit underline underline-offset-2 decoration-dotted hover:decoration-solid"
                            >
                              {part.text}
                            </Link>
                          ) : (
                            <span key={k}>{part.text}</span>
                          ),
                        )}
                        {j < members.length - 1 && <span>、</span>}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
