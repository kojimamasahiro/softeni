// src/components/TeamsEventSummary.tsx
import Link from 'next/link';

type PlayerEntry = { name: string; playerId?: number };

type TeamsEventSummaryProps = {
  overallTable: {
    name: string;
    categoryLabel?: string;
    link?: string;
    results: string;
    players: (PlayerEntry | string)[];
  }[];
};

export default function TeamsEventSummary({ overallTable }: TeamsEventSummaryProps) {
  return (
    <section className="mb-8 px-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">大会別成績</h2>
      <div className="space-y-4">
        {overallTable.map((r, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-1 text-gray-800 dark:text-gray-100">
              {r.link ? (
                <Link href={r.link} className="hover:underline text-blue-600 dark:text-blue-400">
                  {r.name}
                  {r.categoryLabel && <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">({r.categoryLabel})</span>}
                </Link>
              ) : (
                <>
                  {r.name}
                  {r.categoryLabel && <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">({r.categoryLabel})</span>}
                </>
              )}
            </h3>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-gray-500 dark:text-gray-400 font-medium">出場選手:</span>{' '}
                {r.players.map((p, idx) => {
                  const name = typeof p === 'string' ? p : p.name;
                  const playerId = typeof p === 'string' ? undefined : p.playerId;
                  return (
                    <span key={idx}>
                      {idx > 0 && '、'}
                      {playerId !== undefined ? (
                        <Link href={`/players/${playerId}/results`} className="underline underline-offset-2 decoration-dotted hover:decoration-solid">
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </span>
                  );
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
