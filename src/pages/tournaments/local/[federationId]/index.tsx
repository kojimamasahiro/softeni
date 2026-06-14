import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import {
  CategoryLink,
  TournamentBlock,
  TournamentCard,
  YearGroup,
} from '@/components/tournaments/TournamentCard';

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

type LocalTournamentIndex = {
  tournamentId: string;
  generationId: string;
  federationId: string;
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
  prefecture: Prefecture;
  federation: FederationInfo | null;
  tournaments: TournamentBlock[];
};

export default function LocalFederationPage({
  prefecture,
  federation,
  tournaments,
}: Props) {
  const pageUrl = `https://softeni-pick.com/tournaments/local/${prefecture.id}/`;

  return (
    <>
      <MetaHead
        title={`${prefecture.name}の大会結果 | ソフトテニス情報`}
        description={`${prefecture.name}で開催された大会の試合結果。`}
        url={pageUrl}
        type="article"
      />

      <PageLayout>
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '大会一覧', href: '/tournaments' },
            { label: '地域大会結果', href: '/tournaments/local' },
            { label: prefecture.name, href: pageUrl },
          ]}
        />

        <div className="flex justify-between items-end mb-6">
          <h1 className="text-2xl font-bold">{prefecture.name}の大会一覧</h1>
          {federation?.officialUrl && (
            <a
              href={federation.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center"
            >
              連盟公式サイト
              <svg
                className="w-4 h-4 ml-1"
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

        <p className="text-gray-600 dark:text-gray-300 mb-8">
          {prefecture.name}で開催された大会・予選の結果を掲載しています。
        </p>

        <div className="space-y-8">
          {tournaments.length === 0 ? (
            <p className="text-gray-500">
              現在登録されている大会はありません。
            </p>
          ) : (
            tournaments.map((t) => (
              <TournamentCard key={`${t.generation}-${t.id}`} tournament={t} />
            ))
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
  const file = path.join(process.cwd(), 'data/prefectures.json');
  const prefectures: Prefecture[] = JSON.parse(fs.readFileSync(file, 'utf-8'));

  const paths = prefectures.map((p) => ({
    params: { federationId: p.id },
  }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const federationId = params?.federationId as string;
  const tournamentRoot = path.join(process.cwd(), 'data', 'tournaments');
  const prefFile = path.join(process.cwd(), 'data/prefectures.json');
  const fedFile = path.join(tournamentRoot, 'federations.json');
  const localIndexFile = path.join(tournamentRoot, 'local_index.json');
  const informationDir = path.join(tournamentRoot, 'information');
  const detailsDir = path.join(tournamentRoot, 'details');

  const prefectures: Prefecture[] = JSON.parse(
    fs.readFileSync(prefFile, 'utf-8'),
  );
  const prefecture = prefectures.find((p) => p.id === federationId);

  if (!prefecture) return { notFound: true };

  let federations: FederationInfo[] = [];
  if (fs.existsSync(fedFile)) {
    federations = JSON.parse(fs.readFileSync(fedFile, 'utf-8'));
  }
  const federation =
    federations.find((f) => f.federationId === federationId) || null;

  let localTournaments: LocalTournamentIndex[] = [];
  if (fs.existsSync(localIndexFile)) {
    localTournaments = JSON.parse(fs.readFileSync(localIndexFile, 'utf-8'));
  }

  // Filter for this federation
  const targetTournaments = localTournaments.filter(
    (t) => t.federationId === federationId,
  );

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
        const detailPath = path.join(
          detailsDir,
          t.tournamentId,
          String(year),
          `${categoryId}.json`,
        );
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
      prefecture,
      federation,
      tournaments,
    },
  };
};
