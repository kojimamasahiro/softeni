// 成長レポートの表示パーツ（共有）。
// 成長ページ（/beta/matches-results/growth）とショーケースページの両方から使う。
import { formatGrowthMetricDelta, formatGrowthMetricValue, GrowthComparison, GrowthMetric, GrowthReport, GrowthTarget } from '@/lib/growthAnalysis';

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

// 比べている2つの期間の点の色（前＝灰、今＝青）。凡例は ComparisonBasis に1回だけ出す
const PREVIOUS_DOT_CLASS = 'bg-gray-400 dark:bg-gray-500';
const CURRENT_DOT_CLASS = 'bg-blue-600 dark:bg-blue-400';

// 1指標を1行で出す: 名前 ／ 前 → 今 ／ 差。率の指標は下に前後の2点を結ぶ線を引く（2026-09-27。以前は縦積みでスマホで長かった）。
export const MetricRow = ({ metric }: { metric: GrowthMetric }) => {
  if (metric.denominator === 0 && metric.previousDenominator === 0) {
    return null;
  }
  const comparable = metric.currentValue !== null && metric.previousValue !== null;
  const showBar = comparable && metric.unit === 'percent';
  const clamp = (value: number) => Math.max(0, Math.min(100, value));

  return (
    <div className="border-t border-border py-2.5 first:border-t-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-sm text-text">{metric.label}</p>
        <p className="shrink-0 whitespace-nowrap text-sm tabular-nums">
          <span className="text-text-muted">{formatGrowthMetricValue(metric, metric.previousValue)}</span>
          <span className="mx-1 text-text-muted" aria-label="から">
            →
          </span>
          <span className="font-semibold text-text">{formatGrowthMetricValue(metric, metric.currentValue)}</span>
          {metric.delta !== null && (
            <span className={`ml-2 inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${trendClassName[metric.trend]}`}>
              {formatGrowthMetricDelta(metric)}
            </span>
          )}
        </p>
      </div>
      {showBar && (
        <div className="relative mt-2 h-3" aria-hidden="true">
          <div className="absolute inset-x-0 top-[5px] h-0.5 rounded bg-border" />
          <div
            className="absolute top-1 h-1 bg-gray-300 dark:bg-gray-600"
            style={{
              left: `${clamp(Math.min(metric.previousValue!, metric.currentValue!))}%`,
              width: `${Math.abs(clamp(metric.currentValue!) - clamp(metric.previousValue!))}%`,
            }}
          />
          <div
            className={`absolute top-0.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full ${PREVIOUS_DOT_CLASS}`}
            style={{ left: `${clamp(metric.previousValue!)}%` }}
          />
          <div
            className={`absolute top-0.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full ring-2 ring-surface ${CURRENT_DOT_CLASS}`}
            style={{ left: `${clamp(metric.currentValue!)}%` }}
          />
        </div>
      )}
      {metric.confidence === 'insufficient_sample' && <p className="mt-1 text-xs text-text-muted">データ不足</p>}
    </div>
  );
};

// 「直近3試合」のように名前に試合数が入っていれば、そのまま出す
const withMatchCount = (label: string, count: number) => (label.includes('試合') ? label : `${label}（${count}試合）`);

// 何と何を比べているかと、件数が少ないことを、ページの上に1回だけ書く（各行に「参考値」を付けない）
export const ComparisonBasis = ({ comparison }: { comparison: GrowthComparison }) => {
  const fewMatches = comparison.currentMatchCount <= 2 || comparison.previousMatchCount <= 2;
  return (
    <div className="rounded-lg border border-border bg-gray-50 px-4 py-3 text-sm dark:bg-gray-800/60">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${PREVIOUS_DOT_CLASS}`} />
          {withMatchCount(comparison.previousLabel, comparison.previousMatchCount)}
        </span>
        <span className="text-text-muted" aria-hidden="true">
          →
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${CURRENT_DOT_CLASS}`} />
          {withMatchCount(comparison.currentLabel, comparison.currentMatchCount)}
        </span>
      </p>
      <p className="mt-1 text-xs text-text-muted">
        {comparison.description}
        {fewMatches ? ' 試合数が少ないので、数字は参考値です。' : ' 件数が少ない指標は「データ不足」と出します。'}
      </p>
    </div>
  );
};

export const Card = ({ title, messages, metrics }: { title: string; messages: string[]; metrics: GrowthMetric[] }) => (
  <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
    <h2 className="text-lg font-semibold text-text">{title}</h2>
    {messages.length > 0 && (
      <div className="mt-3 space-y-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>
    )}
    {metrics.length > 0 && (
      <div className="mt-2">
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
