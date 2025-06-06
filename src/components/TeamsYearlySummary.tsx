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
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
        年間成績
      </h2>
      <div className="bg-white rounded-2xl shadow dark:bg-gray-800 p-6 border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">出場大会数</p>
            <p className="text-lg font-bold">{summary.tournaments}回</p>
          </div>
          <div>
          </div>
          <div>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">優勝</p>
            <p className="text-lg font-bold">{summary.champions}人</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">準優勝</p>
            <p className="text-lg font-bold">{summary.runnersUp}人</p>
          </div>
          <div>
            <p className="text-gray-500 dark:text-gray-400">ベスト8以上</p>
            <p className="text-lg font-bold">{summary.top8OrBetter}人</p>
          </div>
        </div>
      </div>
    </section>
  );
}
