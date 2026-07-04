import type { GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { gatherShowcaseRecords, loadFeaturedEntries, loadGrowthTargets, showcaseDisplayName } from '@/lib/growthShowcase';
import { buildSiteUrl, isScoreSiteMode } from '@/lib/siteConfig';

type HubItem = {
  slug: string;
  title: string;
  summary: string;
  totalMatches: number;
};

type HubProps = {
  items: HubItem[];
};

// 成長記録ハブ（公開・インデックス対象）。featured 選手の入口と概要を集約する。
export default function GrowthHubPage({ items }: HubProps) {
  return (
    <>
      <MetaHead
        title="成長記録 | ソフトテニス"
        description="勝ち負けだけでは見えない試合内容の変化を、サーブ・レシーブ・競り合いなどの指標で追ったソフトテニス選手の成長記録です。"
        url={buildSiteUrl('/growth/')}
        type="website"
      />
      {/* PageLayout+パンくずを適用(docs/ui M4・T2) */}
      <PageLayout maxWidth="5xl">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '成長記録', href: '/growth' },
          ]}
        />
        <div>
          <h1 className="text-2xl font-bold">成長記録</h1>
          <p className="mt-3 text-sm leading-7 text-gray-700 dark:text-gray-200">
            勝ち負けだけでは見えない「試合内容の変化」を、サーブ時の得点率、レシーブ、競り合い（デュースやゲームポイント）、流れの立て直しといった指標で追っています。試合を重ねるごとに、どこが伸びているかが記録として積み上がっていきます。
          </p>

          {items.length > 0 ? (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {items.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/growth/${item.slug}`}
                    className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-400 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                    {item.summary && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.summary}</p>}
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">収録 {item.totalMatches} 試合</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 rounded-lg border border-gray-200 p-6 text-center text-gray-600 dark:border-gray-700 dark:text-gray-300">
              現在公開中の成長記録はありません。
            </div>
          )}

          {/* score 導線プレースホルダ。score の方針が固まるまで配線しない（ADR-004）。 */}
          <section className="mt-10 rounded-lg border border-dashed border-gray-300 bg-white p-5 text-center dark:border-gray-600 dark:bg-gray-800">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">自分の試合でもこうした成長記録をつけられます</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">（score 連携は準備中です）</p>
          </section>
        </div>
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<HubProps> = async () => {
  if (isScoreSiteMode()) {
    return { notFound: true };
  }

  const targets = loadGrowthTargets();
  const items: HubItem[] = [];

  for (const entry of loadFeaturedEntries()) {
    const records = gatherShowcaseRecords(entry, targets);
    if (records.length === 0) continue;

    items.push({
      slug: entry.slug,
      title: entry.title ?? `${showcaseDisplayName(entry, targets)} の成長記録`,
      summary: records.map((record) => record.label).join('・'),
      totalMatches: records.reduce((sum, record) => sum + record.report.completedMatchCount, 0),
    });
  }

  return { props: { items } };
};
