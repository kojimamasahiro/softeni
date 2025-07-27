// src/components/TeamsEventSummary.tsx
type TeamsEventSummaryProps = {
  overallTable: {
    name: string;
    link?: string;
    results: string;
    count: number;
  }[];
};

export default function TeamsEventSummary({
  overallTable,
}: TeamsEventSummaryProps) {
  return (
    <section className="mb-8 px-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
        大会別成績
      </h2>
      <div className="space-y-4">
        {overallTable.map((r, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-bold mb-1 text-gray-800 dark:text-gray-100">
              {r.name}
            </h3>
            <div className="text-sm space-y-1">
              {r.link && (
                <a
                  href={r.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center underline text-blue-600 dark:text-blue-400"
                >
                  大会ページ
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="ml-1 h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
              <p>
                <span className="text-gray-500 dark:text-gray-400 font-medium">
                  出場数:
                </span>{' '}
                {r.count}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
