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
      <h2 className="text-xl font-semibold mb-3 text-text">年間成績</h2>
      <div className="bg-surface rounded-xl shadow-sm p-4 border border-border">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm justify-start items-baseline">
          <div className="flex items-center gap-1">
            <span className="text-text-muted">出場大会数</span>
            <span className="text-lg font-bold">{summary.tournaments}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-text-muted">出場選手数</span>
            <span className="text-lg font-bold">{summary.totalPairs}</span>
          </div>
          <div className="border-l border-border-strong h-4 mx-2 hidden sm:block"></div>
          <div className="flex items-center gap-1">
            <span className="text-text-muted">優勝</span>
            <span className="text-lg font-bold">{summary.champions}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-text-muted">準優勝</span>
            <span className="text-lg font-bold">{summary.runnersUp}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-text-muted">ベスト8以上</span>
            <span className="text-lg font-bold">{summary.top8OrBetter}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
