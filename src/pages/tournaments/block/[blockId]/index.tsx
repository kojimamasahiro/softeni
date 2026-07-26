import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import { CategoryLink, TournamentBlock, TournamentCard, YearGroup } from '@/components/tournaments/TournamentCard';

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

type LocalTournamentIndex = {
  tournamentId: string;
  generationId: string;
  federationId?: string;
  blockId?: string;
  label: string;
  officialUrl: string;
};

type TournamentInfo = {
  informationId: string;
  year: number;
  location: string;
  startDate: string;
  endDate: string;
  source: string;
  sourceUrl?: string;
  categories: {
    categoryId: string;
    label: string;
    category: string;
    gender: string;
    age: string;
  }[];
};

type Props = {
  block: Block;
  memberPrefectures: Prefecture[];
  tournaments: TournamentBlock[];
};

export default function BlockPage({ block, memberPrefectures, tournaments }: Props) {
  const pageUrl = `https://softeni-pick.com/tournaments/block/${block.id}/`;

  return (
    <>
      <MetaHead
        title={`${block.name}地区の大会結果 | ソフトテニス情報`}
        description={`${block.name}地区（${memberPrefectures.map((p) => p.name).join('・')}）で開催された大会の試合結果。`}
        url={pageUrl}
        type="article"
      />

      <PageLayout>
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '大会一覧', href: '/tournaments' },
            { label: '地区大会結果', href: '/tournaments/block' },
            { label: `${block.name}地区`, href: pageUrl },
          ]}
        />

        <div className="flex justify-between items-end mb-6">
          <h1 className="text-2xl font-bold">{block.name}地区の大会一覧</h1>
          {block.officialUrl && (
            <a href={block.officialUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-link hover:underline flex items-center">
              地区高体連サイト
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

        <p className="text-text-secondary mb-2">{block.name}地区で開催された大会の結果を掲載しています。</p>
        <p className="text-sm text-text-muted mb-8">
          対象都道府県:{' '}
          {memberPrefectures.map((p, i) => (
            <span key={p.id}>
              {i > 0 && '・'}
              <Link href={`/tournaments/local/${p.id}`} className="text-link hover:underline">
                {p.name}
              </Link>
            </span>
          ))}
        </p>

        <div className="space-y-8">
          {tournaments.length === 0 ? (
            <p className="text-gray-500">現在登録されている大会はありません。</p>
          ) : (
            tournaments.map((t) => <TournamentCard key={`${t.generation}-${t.id}`} tournament={t} />)
          )}
        </div>
      </PageLayout>
    </>
  );
}

// ====== 共通ユーティリティ ======
function readJSONSafe(p: string) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const file = path.join(process.cwd(), 'data/tournaments/blocks.json');
  const blocks: Block[] = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : [];

  const paths = blocks.map((b) => ({
    params: { blockId: b.id },
  }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const blockId = params?.blockId as string;
  const tournamentRoot = path.join(process.cwd(), 'data', 'tournaments');
  const prefFile = path.join(process.cwd(), 'data/prefectures.json');
  const blocksFile = path.join(tournamentRoot, 'blocks.json');
  const localIndexFile = path.join(tournamentRoot, 'local_index.json');
  const informationDir = path.join(tournamentRoot, 'information');
  const detailsDir = path.join(tournamentRoot, 'details');

  const blocks: Block[] = fs.existsSync(blocksFile) ? JSON.parse(fs.readFileSync(blocksFile, 'utf-8')) : [];
  const block = blocks.find((b) => b.id === blockId);

  if (!block) return { notFound: true };

  const prefectures: Prefecture[] = JSON.parse(fs.readFileSync(prefFile, 'utf-8'));
  const prefectureMap = new Map(prefectures.map((p) => [p.id, p]));
  const memberPrefectures = block.prefectureIds.map((id) => prefectureMap.get(id)).filter((p): p is Prefecture => Boolean(p));

  let localTournaments: LocalTournamentIndex[] = [];
  if (fs.existsSync(localIndexFile)) {
    localTournaments = JSON.parse(fs.readFileSync(localIndexFile, 'utf-8'));
  }

  // Filter for this block
  const targetTournaments = localTournaments.filter((t) => t.blockId === blockId);

  const tournaments: TournamentBlock[] = [];

  for (const t of targetTournaments) {
    const infoPath = path.join(informationDir, `${t.tournamentId}.json`);
    const infos = readJSONSafe(infoPath) as TournamentInfo[];
    if (!infos) continue;

    const groups: YearGroup[] = [];
    for (const info of infos) {
      const year = info.year;
      const links: CategoryLink[] = [];
      for (const cat of info.categories) {
        const categoryId = cat.categoryId;
        const detailPath = path.join(detailsDir, t.tournamentId, String(year), `${categoryId}.json`);
        if (fs.existsSync(detailPath)) {
          links.push({
            year,
            gameCategory: cat.category,
            ageCategory: cat.age,
            gender: cat.gender,
            categoryLabel: cat.label,
          });
        }
      }

      const externalResultUrl = info.sourceUrl ?? null;

      if (links.length > 0 || externalResultUrl) {
        groups.push({
          year,
          links,
          externalResultUrl,
        });
      }
    }

    if (groups.length > 0) {
      tournaments.push({
        id: t.tournamentId,
        name: t.label,
        generation: t.generationId,
        groups,
      });
    }
  }

  return {
    props: {
      block,
      memberPrefectures,
      tournaments,
    },
  };
};
