import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import SubNav from '@/components/nav/SubNav';
import { TOURNAMENTS_SUBNAV } from '@/pages/tournaments';

type Block = {
  id: string;
  name: string;
  prefectureIds: string[];
  officialUrl?: string;
};

type Prefecture = {
  id: string;
  name: string;
};

type Props = {
  blocks: Block[];
  prefectureMap: Record<string, string>;
};

export default function BlockTournamentsPage({ blocks, prefectureMap }: Props) {
  const pageUrl = `https://softeni-pick.com/tournaments/block/`;

  return (
    <>
      <MetaHead
        title={'地区大会一覧 | ソフトテニス情報'}
        description={'高校総体（インターハイ）の地区大会など、複数の都道府県にまたがるブロック大会の結果一覧。'}
        url={pageUrl}
        type="article"
      />

      <PageLayout>
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '大会一覧', href: '/tournaments' },
            { label: '地区大会結果', href: '/tournaments/block' },
          ]}
        />

        <h1 className="text-2xl font-bold mb-4">地区大会結果</h1>
        <SubNav items={TOURNAMENTS_SUBNAV} label="大会の絞り込み" />
        <p className="text-text-secondary mb-8">高校総体（インターハイ）の地区大会など、複数の都道府県にまたがるブロック大会の結果を掲載しています。</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {blocks.map((block) => (
            <div key={block.id} className="bg-gray-50 dark:bg-gray-800 rounded p-3 flex flex-col justify-between">
              <Link href={`/tournaments/block/${block.id}`} className="text-lg font-semibold text-link hover:underline mb-2 block">
                {block.name}地区
              </Link>
              <p className="text-xs text-text-muted">{block.prefectureIds.map((id) => prefectureMap[id] ?? id).join('・')}</p>
              {block.officialUrl && (
                <a
                  href={block.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-text-muted hover:text-gray-700 dark:hover:text-gray-200 flex items-center mt-2"
                >
                  地区高体連サイト
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
          ))}
        </div>
      </PageLayout>
    </>
  );
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const tournamentRoot = path.join(process.cwd(), 'data', 'tournaments');
  const prefFile = path.join(process.cwd(), 'data/prefectures.json');
  const blocksFile = path.join(tournamentRoot, 'blocks.json');

  const prefectures: Prefecture[] = JSON.parse(fs.readFileSync(prefFile, 'utf-8'));
  const prefectureMap: Record<string, string> = {};
  for (const p of prefectures) {
    prefectureMap[p.id] = p.name;
  }

  let blocks: Block[] = [];
  if (fs.existsSync(blocksFile)) {
    blocks = JSON.parse(fs.readFileSync(blocksFile, 'utf-8'));
  }

  return {
    props: {
      blocks,
      prefectureMap,
    },
  };
};
