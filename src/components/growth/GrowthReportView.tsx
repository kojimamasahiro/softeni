// 成長レポートの表示パーツ（共有）。
// 成長ページ（/beta/matches-results/growth）とショーケースページの両方から使う。
import { formatGrowthMetricDelta, formatGrowthMetricValue, GrowthComparison, GrowthMetric, GrowthReport, GrowthTarget } from '@/lib/growthAnalysis';

export const confidenceLabel = {
  enough_sample: '十分',
  small_sample: '参考値',
  insufficient_sample: 'データ不足',
} as const;

export const trendClassName = {
  improved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  declined: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  stable: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
} as const;

export const comparisonLabels: Record<GrowthComparison['kind'], string> = {
  recent_period: '期間比較',
  win_loss: '勝ち/負け',
  same_opponent: '同じ相手',
  same_tournament: '同じ大会',
  same_format: '同じ形式',
  same_pair: '同じペア',
  opponent_level: '相手レベル',
};

export const getTargetMeta = (target: GrowthTarget) => {
  const pieces = [target.kind === 'pair' ? 'ペア' : '選手', `${target.completedMatchCount}試合`, target.teamNames[0], target.regions[0]].filter(Boolean);

  return pieces.join(' / ');
};

export const MetricRow = ({ metric }: { metric: GrowthMetric }) => {
  if (metric.denominator === 0 && metric.previousDenominator === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 border-t border-border py-3 first:border-t-0 md:grid-cols-[1.4fr_1fr_1fr_0.8fr]">
      <div>
        <p className="font-medium text-text">{metric.label}</p>
        <p className="mt-1 text-xs text-text-muted">{metric.summary}</p>
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-200">
        <span className="text-xs text-text-muted">今回</span>
        <div className="font-semibold">{formatGrowthMetricValue(metric, metric.currentValue)}</div>
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-200">
        <span className="text-xs text-text-muted">比較</span>
        <div className="font-semibold">{formatGrowthMetricValue(metric, metric.previousValue)}</div>
      </div>
      <div className="flex items-start justify-between gap-2 md:block">
        <span className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${trendClassName[metric.trend]}`}>
          {metric.delta === null ? '—' : formatGrowthMetricDelta(metric)}
        </span>
        <p className="mt-1 text-xs text-text-muted">{confidenceLabel[metric.confidence]}</p>
      </div>
    </div>
  );
};

export const Card = ({ title, messages, metrics }: { title: string; messages: string[]; metrics: GrowthMetric[] }) => (
  <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
    <h2 className="text-lg font-semibold text-text">{title}</h2>
    <div className="mt-3 space-y-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
    </div>
    {metrics.length > 0 && (
      <div className="mt-4">
        {metrics.map((metric) => (
          <MetricRow key={metric.key} metric={metric} />
        ))}
      </div>
    )}
  </section>
);

// 練習テーマの表示（成長ページ・ショーケース共通）。
export const PracticeThemes = ({ themes }: { themes: GrowthReport['practiceThemes'] }) => (
  <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
    <h2 className="text-lg font-semibold text-text">練習テーマ</h2>
    {themes.length > 0 ? (
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {themes.map((theme) => (
          <div key={theme.id} className="rounded border border-border bg-gray-50 p-4 dark:bg-gray-900/60">
            <p className="text-xs font-medium text-text-muted">テーマ {theme.priority}</p>
            <h3 className="mt-1 font-semibold text-text">{theme.title}</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{theme.description}</p>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-3 text-sm text-text-secondary">今回は大きく注意する項目はありません。次の試合でも同じ観点を見てみましょう。</p>
    )}
  </section>
);
