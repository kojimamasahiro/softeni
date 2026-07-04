// src/pages/tournaments/major/index.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Head from 'next/head';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import PageLayout from '@/components/PageLayout';
import SubNav from '@/components/nav/SubNav';
import { TOURNAMENTS_SUBNAV } from '@/pages/tournaments';
import { CategoryLink, TournamentBlock, TournamentCard, YearGroup } from '@/components/tournaments/TournamentCard';

// Since GenerationKey was just `string` alias locally, I can either import it if I exported it (I didn't) or keep it here.
// I didn't export GenerationKey in Previous step. Let's keep it local or modify the previous file.
// Actually, `TournamentBlock` in the component uses `generation: string`.
// The local file used `generation: GenerationKey`.
// Let's adjust imports.

type GenerationKey = string;

type Props = {
  generationOrder: GenerationKey[];
  generationTitleMap: Record<GenerationKey, string>;
  tournamentsByGeneration: Record<GenerationKey, TournamentBlock[]>;
};

// ====== ラベル辞書（フォールバック用）======
// (削除)

// ====== 共通ユーティリティ ======
function readJSONSafe(p: string) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

type TournamentIndex = {
  tournamentId: string;
  generationId: string;
  label: string;
  isMajorTitle: boolean;
  officialUrl: string;
};

type TournamentInfo = {
  informationId: string;
  year: number;
  location: string;
  startDate: string;
  endDate: string;
  source: string;
  sourceUrl: string;
  categories: {
    categoryId: string;
    label: string;
    category: string;
    gender: string;
    age: string;
  }[];
};

// ====== ページコンポーネント ======
export default function TournamentListPage({ generationOrder, generationTitleMap, tournamentsByGeneration }: Props) {
  const pageUrl = 'https://softeni-pick.com/tournaments/major/';

  const generationTitle = (gen: GenerationKey) => {
    return generationTitleMap[gen] || String(gen);
  };

  return (
    <>
      <MetaHead title={'主要大会一覧 | ソフトテニス情報'} description={`過去の大会結果・試合成績を掲載`} url={pageUrl} type="article" />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: `主要大会一覧`,
              author: { '@type': 'Person', name: 'Softeni Pick' },
              publisher: { '@type': 'Organization', name: 'Softeni Pick' },
              datePublished: new Date().toISOString().split('T')[0],
              dateModified: new Date().toISOString().split('T')[0],
              inLanguage: 'ja',
              mainEntityOfPage: { '@type': 'WebPage', '@id': pageUrl },
              description: `過去の大会結果・試合成績を掲載`,
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'ホーム',
                  item: 'https://softeni-pick.com/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: `大会一覧`,
                  item: 'https://softeni-pick.com/tournaments/',
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: `主要大会結果`,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <PageLayout>
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            { label: '大会一覧', href: '/tournaments' },
            { label: '主要大会結果', href: '/tournaments/major' },
          ]}
        />

        <section className="mb-10">
          <h1 className="text-2xl font-bold mb-4">主要大会結果</h1>
          <SubNav items={TOURNAMENTS_SUBNAV} label="大会の絞り込み" />
          <p className="text-lg leading-relaxed mb-4">
            こちらは、Softeni Pickが収録しているソフトテニスの大会結果一覧ページです。
            主要な全日本大会をはじめ、インターハイ・選抜、ジュニアなども整理して掲載していきます。
          </p>
          <p className="text-lg leading-relaxed">
            各大会のページでは、年度ごとの出場選手や試合結果、所属別の記録などを確認できます。 下記から世代（カテゴリ）ごとにご覧いただけます。
          </p>
        </section>

        {generationOrder
          .filter((g) => tournamentsByGeneration[g]?.length)
          .map((gen) => (
            <section key={gen} className="mb-12">
              <h2 className="text-xl font-semibold mb-6">{generationTitle(gen)}カテゴリ</h2>

              <div className="space-y-8">
                {tournamentsByGeneration[gen].map((t) => (
                  <TournamentCard key={`${gen}-${t.id}`} tournament={t} />
                ))}
              </div>
            </section>
          ))}
      </PageLayout>
    </>
  );
}

// ====== 生成時処理 ======
export const getStaticProps: GetStaticProps<Props> = async () => {
  const tournamentRoot = path.join(process.cwd(), 'data', 'tournaments');
  const generationsPath = path.join(tournamentRoot, 'generations.json');
  const indexPath = path.join(tournamentRoot, 'index.json');
  const informationDir = path.join(tournamentRoot, 'information');
  const detailsDir = path.join(tournamentRoot, 'details');

  const generations = readJSONSafe(generationsPath) as {
    generationId: string;
    label: string;
  }[];
  const generationOrder = generations.map((g) => g.generationId);
  const generationTitleMap: Record<GenerationKey, string> = {};
  for (const g of generations) {
    generationTitleMap[g.generationId] = g.label;
  }

  if (!fs.existsSync(indexPath)) {
    return {
      props: {
        generationOrder,
        generationTitleMap,
        tournamentsByGeneration: {} as Record<GenerationKey, TournamentBlock[]>,
      },
    };
  }

  const tournaments = readJSONSafe(indexPath) as TournamentIndex[];
  const tournamentsByGeneration: Record<GenerationKey, TournamentBlock[]> = {} as Record<GenerationKey, TournamentBlock[]>;

  for (const tournament of tournaments) {
    const generation = tournament.generationId as GenerationKey;
    if (!tournamentsByGeneration[generation]) {
      tournamentsByGeneration[generation] = [];
    }

    const infoPath = path.join(informationDir, `${tournament.tournamentId}.json`);
    const infos = readJSONSafe(infoPath) as TournamentInfo[];
    if (!infos) continue;

    const groups: YearGroup[] = [];
    for (const info of infos) {
      const year = info.year;
      const links: CategoryLink[] = [];
      for (const cat of info.categories) {
        const categoryId = cat.categoryId;
        const detailPath = path.join(detailsDir, tournament.tournamentId, String(year), `${categoryId}.json`);
        if (fs.existsSync(detailPath)) {
          links.push({
            year,
            gameCategory: cat.category,
            ageCategory: cat.age,
            gender: cat.gender,
            categoryLabel: cat.label,
            isCurrent: false,
          });
        }
      }
      if (links.length > 0) {
        groups.push({ year, links });
      }
    }

    if (groups.length > 0) {
      tournamentsByGeneration[generation].push({
        id: tournament.tournamentId,
        name: tournament.label,
        generation,
        groups,
      });
    }
  }

  return {
    props: {
      generationOrder,
      generationTitleMap,
      tournamentsByGeneration,
    },
  };
};
