import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import SubNav from '@/components/nav/SubNav';
import { TOURNAMENTS_SUBNAV } from '@/pages/tournaments';

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

type Block = {
  id: string;
  name: string;
  prefectureIds: string[];
};

type Props = {
  prefectures: Prefecture[];
  federationMap: Record<string, FederationInfo>;
  blockIdByName: Record<string, string>;
};

export default function LocalTournamentsPage({ prefectures, federationMap, blockIdByName }: Props) {
  const pageUrl = `https://softeni-pick.com/tournaments/local/`;

  // Group by region（高校総体の地区大会区分と揃えた9区分）
  const regions = ['北海道', '東北', '関東', '北信越', '東海', '近畿', '中国', '四国', '九州'];

  const grouped = regions.map((region) => ({
    region,
    blockId: blockIdByName[region],
    prefectures: prefectures.filter((p) => p.region === region),
  }));

  return (
    <>
      <MetaHead title={'地域大会一覧 | ソフトテニス情報'} description={`各都道府県の連盟や企業が主催する大会の結果一覧。`} url={pageUrl} type="article" />

      <PageLayout>
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '大会一覧', href: '/tournaments' },
            { label: '地域大会結果', href: '/tournaments/local' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-4">地域大会結果</h1>
        <SubNav items={TOURNAMENTS_SUBNAV} label="大会の絞り込み" />
        <p className="text-text-secondary mb-8">各都道府県の連盟や企業が主催する大会の結果を掲載しています。 連盟公式サイトへのリンクもご活用ください。</p>

        <div className="space-y-8">
          {grouped
            .filter((g) => g.prefectures.length > 0)
            .map((g) => (
              <section key={g.region}>
                <h2 className="text-xl font-bold mb-4 border-b border-border pb-2">
                  {g.blockId ? (
                    <Link href={`/tournaments/block/${g.blockId}`} className="text-link hover:underline">
                      {g.region}地区
                    </Link>
                  ) : (
                    g.region
                  )}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {g.prefectures.map((pref) => {
                    const fed = federationMap[pref.id];
                    return (
                      <div key={pref.id} className="bg-gray-50 dark:bg-gray-800 rounded p-3 flex flex-col justify-between">
                        <Link href={`/tournaments/local/${pref.id}`} className="text-lg font-semibold text-link hover:underline mb-2 block">
                          {pref.name}
                        </Link>
                        {fed?.officialUrl && (
                          <a
                            href={fed.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-text-muted hover:text-gray-700 dark:hover:text-gray-200 flex items-center"
                          >
                            連盟サイト
                            <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const tournamentRoot = path.join(process.cwd(), 'data', 'tournaments');
  const prefFile = path.join(process.cwd(), 'data/prefectures.json');
  const fedFile = path.join(tournamentRoot, 'federations.json');
  const blocksFile = path.join(tournamentRoot, 'blocks.json');

  const prefectures: Prefecture[] = JSON.parse(fs.readFileSync(prefFile, 'utf-8'));

  let federations: FederationInfo[] = [];
  if (fs.existsSync(fedFile)) {
    federations = JSON.parse(fs.readFileSync(fedFile, 'utf-8'));
  }

  const federationMap: Record<string, FederationInfo> = {};
  for (const f of federations) {
    federationMap[f.federationId] = f;
  }

  let blocks: Block[] = [];
  if (fs.existsSync(blocksFile)) {
    blocks = JSON.parse(fs.readFileSync(blocksFile, 'utf-8'));
  }

  const blockIdByName: Record<string, string> = {};
  for (const b of blocks) {
    blockIdByName[b.name] = b.id;
  }

  return {
    props: {
      prefectures,
      federationMap,
      blockIdByName,
    },
  };
};
