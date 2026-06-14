import type { GetStaticProps } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import MetaHead from '@/components/MetaHead';
import {
  formatGrowthMetricDelta,
  formatGrowthMetricValue,
  getGrowthReportFileName,
  GrowthComparison,
  GrowthMetric,
  GrowthReport,
  GrowthTarget,
} from '@/lib/growthAnalysis';
import {
  buildSiteUrl,
  getPublicMatchesGrowthPath,
  getPublicMatchesListPath,
  isScoreSiteMode,
} from '@/lib/siteConfig';

type GrowthTargetsPayload = {
  generatedAt?: string;
  targets?: GrowthTarget[];
};

type GrowthReportPayload = {
  generatedAt?: string;
  report?: GrowthReport;
};

type GrowthPageProps = {
  targets: GrowthTarget[];
};

const confidenceLabel = {
  enough_sample: '十分',
  small_sample: '参考値',
  insufficient_sample: 'データ不足',
} as const;

const trendClassName = {
  improved:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  declined:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  stable:
    'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
} as const;

const comparisonLabels: Record<GrowthComparison['kind'], string> = {
  recent_period: '期間比較',
  win_loss: '勝ち/負け',
  same_opponent: '同じ相手',
  same_tournament: '同じ大会',
  same_format: '同じ形式',
  same_pair: '同じペア',
  opponent_level: '相手レベル',
};

const getTargetMeta = (target: GrowthTarget) => {
  const pieces = [
    target.kind === 'pair' ? 'ペア' : '選手',
    `${target.completedMatchCount}試合`,
    target.teamNames[0],
    target.regions[0],
  ].filter(Boolean);

  return pieces.join(' / ');
};

const MetricRow = ({ metric }: { metric: GrowthMetric }) => {
  if (metric.denominator === 0 && metric.previousDenominator === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 border-t border-gray-100 py-3 first:border-t-0 dark:border-gray-700 md:grid-cols-[1.4fr_1fr_1fr_0.8fr]">
      <div>
        <p className="font-medium text-gray-900 dark:text-gray-100">
          {metric.label}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {metric.summary}
        </p>
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-200">
        <span className="text-xs text-gray-500 dark:text-gray-400">今回</span>
        <div className="font-semibold">
          {formatGrowthMetricValue(metric, metric.currentValue)}
        </div>
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-200">
        <span className="text-xs text-gray-500 dark:text-gray-400">比較</span>
        <div className="font-semibold">
          {formatGrowthMetricValue(metric, metric.previousValue)}
        </div>
      </div>
      <div className="flex items-start justify-between gap-2 md:block">
        <span
          className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${trendClassName[metric.trend]}`}
        >
          {metric.delta === null ? '—' : formatGrowthMetricDelta(metric)}
        </span>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {confidenceLabel[metric.confidence]}
        </p>
      </div>
    </div>
  );
};

const Card = ({
  title,
  messages,
  metrics,
}: {
  title: string;
  messages: string[];
  metrics: GrowthMetric[];
}) => (
  <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
      {title}
    </h2>
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

export function PublicGrowthAnalysisPage({ targets }: GrowthPageProps) {
  const router = useRouter();
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedComparisonKind, setSelectedComparisonKind] =
    useState<GrowthComparison['kind']>('recent_period');

  const selectedTargetKey = useMemo(() => {
    const queryTarget = router.query.targetKey;
    if (typeof queryTarget === 'string') return queryTarget;
    return targets[0]?.key ?? '';
  }, [router.query.targetKey, targets]);

  useEffect(() => {
    if (!selectedTargetKey) return;

    setLoading(true);
    fetch(
      `/data/beta-matches/growth/reports/${getGrowthReportFileName(
        selectedTargetKey,
      )}`,
    )
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as GrowthReportPayload;
      })
      .then((payload) => {
        setReport(payload?.report ?? null);
        setSelectedComparisonKind('recent_period');
      })
      .catch((error) => {
        console.error('Failed to load growth report:', error);
        setReport(null);
      })
      .finally(() => setLoading(false));
  }, [selectedTargetKey]);

  const selectedComparison = useMemo(() => {
    if (!report) return null;
    return (
      report.comparisons.find(
        (comparison) => comparison.kind === selectedComparisonKind,
      ) ??
      report.comparison ??
      null
    );
  }, [report, selectedComparisonKind]);

  const selectedTarget = targets.find(
    (target) => target.key === selectedTargetKey,
  );

  const handleTargetChange = (targetKey: string) => {
    router.replace(
      {
        pathname: router.pathname,
        query: targetKey ? { targetKey } : {},
      },
      undefined,
      { shallow: true },
    );
  };

  return (
    <>
      <MetaHead
        title="最近の成長"
        description="勝ち負けだけでは見えない、試合内容の変化を追える成長分析ページです。"
        url={buildSiteUrl(`${getPublicMatchesGrowthPath()}/`)}
        type="website"
      />
      <div className="min-h-screen bg-white px-4 py-8 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Link
                href={getPublicMatchesListPath()}
                className="text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                試合結果一覧へ
              </Link>
              <h1 className="mt-2 text-3xl font-bold">最近の成長</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                勝ち負けだけでは見えない、試合内容の変化を追えます。
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(260px,360px)_minmax(180px,240px)]">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  対象
                </span>
                <select
                  value={selectedTargetKey}
                  onChange={(event) => handleTargetChange(event.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  {targets.map((target) => (
                    <option key={target.key} value={target.key}>
                      {target.displayName} ({target.completedMatchCount}試合)
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                  比較
                </span>
                <select
                  value={selectedComparisonKind}
                  onChange={(event) =>
                    setSelectedComparisonKind(
                      event.target.value as GrowthComparison['kind'],
                    )
                  }
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                  disabled={!report || report.comparisons.length === 0}
                >
                  {(report?.comparisons ?? []).map((comparison) => (
                    <option key={comparison.kind} value={comparison.kind}>
                      {comparisonLabels[comparison.kind]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {selectedTarget && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/70">
              <p className="text-xl font-semibold">
                {selectedTarget.displayName}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {getTargetMeta(selectedTarget)}
              </p>
            </div>
          )}

          {loading && (
            <div className="rounded-lg border border-gray-200 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-300">
              読み込み中...
            </div>
          )}

          {!loading && targets.length === 0 && (
            <div className="rounded-lg border border-gray-200 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-300">
              まだ成長分析に使える試合がありません。
            </div>
          )}

          {!loading && report?.emptyMessage && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              {report.emptyMessage}
            </div>
          )}

          {!loading && report && selectedComparison && (
            <div className="space-y-5">
              {selectedComparison.kind !== 'recent_period' && (
                <Card
                  title={selectedComparison.title}
                  messages={[
                    selectedComparison.description,
                    ...selectedComparison.messages,
                  ]}
                  metrics={selectedComparison.metrics.filter(
                    (metric) =>
                      metric.denominator > 0 || metric.previousDenominator > 0,
                  )}
                />
              )}

              {selectedComparison.kind === 'recent_period' &&
                report.sections.map((section) => (
                  <Card
                    key={section.id}
                    title={section.title}
                    messages={section.messages}
                    metrics={section.metrics}
                  />
                ))}

              {selectedComparison.kind === 'recent_period' && (
                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    練習テーマ
                  </h2>
                  {report.practiceThemes.length > 0 ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      {report.practiceThemes.map((theme) => (
                        <div
                          key={theme.id}
                          className="rounded border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/60"
                        >
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            テーマ {theme.priority}
                          </p>
                          <h3 className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
                            {theme.title}
                          </h3>
                          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                            {theme.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                      今回は大きく注意する項目はありません。次の試合でも同じ観点を見てみましょう。
                    </p>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const getPublicGrowthAnalysisStaticProps: GetStaticProps<
  GrowthPageProps
> = async (context?) => {
  void context;
  const fs = await import('fs/promises');
  const path = await import('path');
  const targetsPath = path.join(
    process.cwd(),
    'public',
    'data',
    'beta-matches',
    'growth',
    'targets.json',
  );

  try {
    const raw = await fs.readFile(targetsPath, 'utf-8');
    const payload = JSON.parse(raw) as GrowthTargetsPayload;
    return {
      props: {
        targets: payload.targets ?? [],
      },
    };
  } catch (error) {
    console.warn('Growth targets JSON is missing:', error);
    return {
      props: {
        targets: [],
      },
    };
  }
};

export const getStaticProps: GetStaticProps<GrowthPageProps> = async () => {
  if (isScoreSiteMode()) {
    return { notFound: true };
  }

  return getPublicGrowthAnalysisStaticProps({} as never);
};

export default PublicGrowthAnalysisPage;
