import type { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { Card, comparisonLabels, getTargetMeta, PracticeThemes } from '@/components/growth/GrowthReportView';
import { getGrowthReportFileName, GrowthComparison, GrowthReport, GrowthTarget } from '@/lib/growthAnalysis';
import { buildSiteUrl, getPublicMatchesGrowthPath, getPublicMatchesListPath, isScoreSiteMode } from '@/lib/siteConfig';

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

export function PublicGrowthAnalysisPage({ targets }: GrowthPageProps) {
  const router = useRouter();
  const [report, setReport] = useState<GrowthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedComparisonKind, setSelectedComparisonKind] = useState<GrowthComparison['kind']>('recent_period');

  const selectedTargetKey = useMemo(() => {
    const queryTarget = router.query.targetKey;
    if (typeof queryTarget === 'string') return queryTarget;
    return targets[0]?.key ?? '';
  }, [router.query.targetKey, targets]);

  useEffect(() => {
    if (!selectedTargetKey) return;

    setLoading(true);
    fetch(`/data/beta-matches/growth/reports/${getGrowthReportFileName(selectedTargetKey)}`)
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
    return report.comparisons.find((comparison) => comparison.kind === selectedComparisonKind) ?? report.comparison ?? null;
  }, [report, selectedComparisonKind]);

  const selectedTarget = targets.find((target) => target.key === selectedTargetKey);

  // 対象は「公開されている試合結果（/beta/matches-results）に登場する選手・ペア」。
  // targets.json は同じ公開試合から生成されるため、表示中の試合の参加者と一致する。
  // この面は noindex（/beta 配下・検索非対象）の内部ツール用途（ADR-004）。

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
        noindex
      />
      {/* PageLayout+パンくずを適用(docs/ui M4・T6)。noindex は維持 */}
      <PageLayout maxWidth="6xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '試合一覧', href: getPublicMatchesListPath() },
            { label: '成長分析', href: getPublicMatchesGrowthPath() },
          ]}
        />
        <div>
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="mt-2 text-2xl font-bold">最近の成長</h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">勝ち負けだけでは見えない、試合内容の変化を追えます。</p>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(260px,360px)_minmax(180px,240px)]">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">対象</span>
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
                <span className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">比較</span>
                <select
                  value={selectedComparisonKind}
                  onChange={(event) => setSelectedComparisonKind(event.target.value as GrowthComparison['kind'])}
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
              <p className="text-xl font-semibold">{selectedTarget.displayName}</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{getTargetMeta(selectedTarget)}</p>
            </div>
          )}

          {loading && (
            <div className="rounded-lg border border-gray-200 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-300">読み込み中...</div>
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
                  messages={[selectedComparison.description, ...selectedComparison.messages]}
                  metrics={selectedComparison.metrics.filter((metric) => metric.denominator > 0 || metric.previousDenominator > 0)}
                />
              )}

              {selectedComparison.kind === 'recent_period' &&
                report.sections.map((section) => <Card key={section.id} title={section.title} messages={section.messages} metrics={section.metrics} />)}

              {selectedComparison.kind === 'recent_period' && <PracticeThemes themes={report.practiceThemes} />}
            </div>
          )}
        </div>
      </PageLayout>
    </>
  );
}

export const getPublicGrowthAnalysisStaticProps: GetStaticProps<GrowthPageProps> = async (context?) => {
  void context;

  // 対象一覧は targets.json（公開試合から生成）をそのまま使う。
  // ＝ /beta/matches-results に表示されている試合の参加者と一致する（ADR-004）。
  const fs = await import('fs/promises');
  const path = await import('path');
  const targetsPath = path.join(process.cwd(), 'public', 'data', 'beta-matches', 'growth', 'targets.json');

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
