// src/components/TeamsYearlySummary.tsx
type TeamsYearlySummaryProps = {
  summary: {
    tournaments: number;
    champions: number;
    runnersUp: number;
    top8OrBetter: number;
    totalPairs: number;
  };
};

export default function TeamsYearlySummary({ summary }: TeamsYearlySummaryProps) {
  return (
    <section className="mb-8 px-4">
      <h2 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-100">年間成績</h2>
      <div className="bg-white rounded-xl shadow-sm dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm justify-start items-baseline">
          <div className="flex items-center gap-1">
            <span className="text-gray-500 dark:text-gray-400">出場大会数</span>
            <span className="text-lg font-bold">{summary.tournaments}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 dark:text-gray-400">出場選手数</span>
            <span className="text-lg font-bold">{summary.totalPairs}</span>
          </div>
          <div className="border-l border-gray-300 dark:border-gray-600 h-4 mx-2 hidden sm:block"></div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 dark:text-gray-400">優勝</span>
            <span className="text-lg font-bold">{summary.champions}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 dark:text-gray-400">準優勝</span>
            <span className="text-lg font-bold">{summary.runnersUp}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 dark:text-gray-400">ベスト8以上</span>
            <span className="text-lg font-bold">{summary.top8OrBetter}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
