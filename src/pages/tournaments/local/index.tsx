import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

type Prefecture = {
  id: string;
  name: string;
  region: string;
};

type FederationInfo = {
  federationId: string;
  region: string;
  label: string;
  officialUrl?: string;
};

type Props = {
  prefectures: Prefecture[];
  federationMap: Record<string, FederationInfo>;
};

export default function LocalTournamentsPage({
  prefectures,
  federationMap,
}: Props) {
  const pageUrl = `https://softeni-pick.com/tournaments/local`;

  // Group by region
  const regions = [
    '北海道',
    '東北',
    '関東',
    '中部',
    '近畿',
    '中国',
    '四国',
    '九州・沖縄',
  ];

  const grouped = regions.map((region) => ({
    region,
    prefectures: prefectures.filter((p) => p.region === region),
  }));

  return (
    <>
      <MetaHead
        title={'地域大会一覧 | ソフトテニス情報'}
        description={`各都道府県の連盟や企業が主催する大会の結果一覧。`}
        url={pageUrl}
        type="article"
      />

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: '大会一覧', href: '/tournaments' },
              { label: '地域大会結果', href: '/tournaments/local' },
            ]}
          />

          <h1 className="text-2xl font-bold mb-6">地域大会結果</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            各都道府県の連盟や企業が主催する大会の結果を掲載しています。
            連盟公式サイトへのリンクもご活用ください。
          </p>

          <div className="space-y-8">
            {grouped
              .filter((g) => g.prefectures.length > 0)
              .map((g) => (
                <section key={g.region}>
                  <h2 className="text-xl font-bold mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
                    {g.region}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {g.prefectures.map((pref) => {
                      const fed = federationMap[pref.id];
                      return (
                        <div
                          key={pref.id}
                          className="bg-gray-50 dark:bg-gray-800 rounded p-3 flex flex-col justify-between"
                        >
                          <Link
                            href={`/tournaments/local/${pref.id}`}
                            className="text-lg font-semibold text-blue-700 dark:text-blue-300 hover:underline mb-2 block"
                          >
                            {pref.name}
                          </Link>
                          {fed?.officialUrl && (
                            <a
                              href={fed.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center"
                            >
                              連盟サイト
                              <svg
                                className="w-3 h-3 ml-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
          </div>
        </div>
      </main>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const tournamentRoot = path.join(process.cwd(), 'data', 'tournaments');
  const prefFile = path.join(process.cwd(), 'data/prefectures.json');
  const fedFile = path.join(tournamentRoot, 'federations.json');

  const prefectures: Prefecture[] = JSON.parse(
    fs.readFileSync(prefFile, 'utf-8'),
  );

  let federations: FederationInfo[] = [];
  if (fs.existsSync(fedFile)) {
    federations = JSON.parse(fs.readFileSync(fedFile, 'utf-8'));
  }

  const federationMap: Record<string, FederationInfo> = {};
  for (const f of federations) {
    federationMap[f.federationId] = f;
  }

  return {
    props: {
      prefectures,
      federationMap,
    },
  };
};
