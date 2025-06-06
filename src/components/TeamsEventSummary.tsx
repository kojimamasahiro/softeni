// src/components/TeamsEventSummary.tsx
type TeamsEventSummaryProps = {
  overallTable: {
    name: string;
    results: string;
    count: number;
  }[];
};

export default function TeamsEventSummary({ overallTable }: TeamsEventSummaryProps) {
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
            <h3 className="text-lg font-bold mb-1 text-gray-800 dark:text-gray-100">{r.name}</h3>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-gray-500 dark:text-gray-400 font-medium">成績:</span>{' '}
                {r.results}
              </p>
              <p>
                <span className="text-gray-500 dark:text-gray-400 font-medium">出場数:</span>{' '}
                {r.count}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

