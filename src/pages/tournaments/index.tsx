// src/pages/tournaments/index.tsx
import fs from 'fs';
import path from 'path';

import { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';

type GenerationKey =
  | 'international-qualifier'
  | 'all'
  | 'corporate'
  | 'university'
  | 'highschool'
  | 'junior'
  | 'open'
  | 'masters'
  | string;

type CategoryLink = {
  year: number;
  gameCategory: string;
  ageCategory: string;
  gender: string;
  categoryLabel: string;
  isCurrent?: boolean;
};

type YearGroup = {
  year: number;
  links: CategoryLink[];
};

type TournamentBlock = {
  id: string;
  name: string;
  sortId: number;
  generation: GenerationKey;
  groups: YearGroup[];
};

type Props = {
  tournamentsByGeneration: Record<GenerationKey, TournamentBlock[]>;
};

// ====== ラベル辞書（フォールバック用）======
const GAME_LABEL: Record<string, string> = {
  singles: 'シングルス',
  doubles: 'ダブルス',
  team: '団体戦',
  versus: '対抗戦',
};

const GENDER_LABEL: Record<string, string> = {
  boys: '男子',
  girls: '女子',
  men: '男子',
  women: '女子',
  mixed: 'ミックス',
};

const AGE_LABEL: Record<string, string> = {
  none: '',
  general: '',
  u12: 'U12',
  u14: 'U14',
  u15: 'U15',
  u18: 'U18',
  u22: 'U22',
};

// ====== 共通ユーティリティ ======
function toCategoryLabel(
  gameCategory: string,
  ageCategory: string,
  gender: string,
) {
  const game = GAME_LABEL[gameCategory] ?? gameCategory;
  const age =
    AGE_LABEL[ageCategory] ??
    (ageCategory && ageCategory !== 'none' ? ageCategory : '');
  const gen = GENDER_LABEL[gender] ?? gender;
  return [game, age, gen].filter(Boolean).join(' / ');
}

function isYearDir(name: string, dir: string) {
  return (
    /^\d{4}$/.test(name) && fs.statSync(path.join(dir, name)).isDirectory()
  );
}

function readJSONSafe(p: string) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

// === categories.json の読み込み ===
type CategoryDef = {
  id: string; // 例: "doubles-none-boys"
  label: string;
  category: string;
  gender: string;
  age: string;
};

function readCategoryLabelMap(yearDir: string): Record<string, string> {
  const catPath = path.join(yearDir, 'categories.json');
  if (!fs.existsSync(catPath)) return {};
  try {
    const arr = JSON.parse(fs.readFileSync(catPath, 'utf-8')) as CategoryDef[];
    const map: Record<string, string> = {};
    for (const c of arr) {
      map[c.id] = c.label;
    }
    return map;
  } catch {
    return {};
  }
}

// ====== 年度ごとのカテゴリリンク収集 ======
function collectCategoryLinks(
  baseDir: string,
  generation: GenerationKey,
  tournamentId: string,
  year: number,
): CategoryLink[] {
  const resultsDir = path.join(baseDir, String(year), 'results');
  if (!fs.existsSync(resultsDir) || !fs.statSync(resultsDir).isDirectory())
    return [];

  // ★ 年度ごとの categories.json を読み込み
  const labelMap = readCategoryLabelMap(path.join(baseDir, String(year)));

  const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith('.json'));
  const links: CategoryLink[] = [];

  for (const file of files) {
    const m = /^([a-z0-9-]+)-([a-z0-9-]+)-([a-z0-9-]+)\.json$/i.exec(file);
    if (!m) continue;
    const [, gameCategory, ageCategory, gender] = m;

    const full = path.join(resultsDir, file);
    const data = readJSONSafe(full);
    if (data && typeof data === 'object' && 'status' in data) {
      if (data.status !== 'completed') continue;
    }

    // id を直接キーにしてラベルを探す
    const idKey = `${gameCategory}-${ageCategory}-${gender}`;
    const mapped =
      labelMap[idKey] ?? toCategoryLabel(gameCategory, ageCategory, gender);

    links.push({
      year,
      gameCategory,
      ageCategory,
      gender,
      categoryLabel: mapped,
      isCurrent: false,
    });
  }

  links.sort((a, b) => {
    const al = a.categoryLabel.localeCompare(b.categoryLabel, 'ja');
    if (al !== 0) return al;
    if (a.gender !== b.gender) return a.gender.localeCompare(b.gender, 'en');
    return a.ageCategory.localeCompare(b.ageCategory, 'en');
  });

  return links;
}

// ====== ページコンポーネント ======
export default function TournamentListPage({ tournamentsByGeneration }: Props) {
  const pageUrl = `https://softeni-pick.com/tournaments`;

  const generationOrder = [
    'international-qualifier',
    'all',
    'corporate',
    'university',
    'highschool',
    'junior',
    'masters',
    'open',
  ] as GenerationKey[];

  const generationTitle = (gen: GenerationKey) => {
    if (gen === 'corporate') return '実業団・社会人カテゴリ';
    if (gen === 'highschool') return '高校カテゴリ';
    if (gen === 'university') return '大学カテゴリ';
    if (gen === 'junior') return 'ジュニアカテゴリ';
    if (gen === 'open') return 'オープンカテゴリ';
    if (gen === 'all') return '総合カテゴリ';
    if (gen === 'international-qualifier') return '国際予選カテゴリ';
    if (gen === 'masters') return 'シニアカテゴリ';
    return String(gen);
  };

  return (
    <>
      <MetaHead
        title={'大会結果一覧 | ソフトテニス情報'}
        description={`過去の大会結果・試合成績を掲載`}
        url={pageUrl}
        type="article"
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: `大会結果一覧`,
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
                  name: `大会結果一覧`,
                  item: pageUrl,
                },
              ],
            }),
          }}
        />
      </Head>

      <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <Breadcrumbs
            crumbs={[
              { label: 'ホーム', href: '/' },
              { label: '大会結果一覧', href: '/tournaments' },
            ]}
          />

          <section className="mb-10">
            <h1 className="text-2xl font-bold mb-4">
              大会一覧 | ソフトテニス主要大会
            </h1>
            <p className="text-lg leading-relaxed mb-4">
              こちらは、Softeni
              Pickが収録しているソフトテニスの大会一覧ページです。
              主要な全日本大会をはじめ、インターハイ・選抜、ジュニアなども整理して掲載していきます。
            </p>
            <p className="text-lg leading-relaxed">
              各大会のページでは、年度ごとの出場選手や試合結果、所属別の記録などを確認できます。
              下記から世代（カテゴリ）ごとにご覧いただけます。
            </p>
          </section>

          {generationOrder
            .filter((g) => tournamentsByGeneration[g]?.length)
            .map((gen) => (
              <section key={gen} className="mb-12">
                <h2 className="text-xl font-semibold mb-6">
                  {generationTitle(gen)}
                </h2>

                <div className="space-y-8">
                  {tournamentsByGeneration[gen]
                    .sort((a, b) => a.sortId - b.sortId)
                    .map((t) => (
                      <div
                        key={`${gen}-${t.id}`}
                        className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow"
                      >
                        <h3 className="text-lg font-semibold mb-4 border-b text-gray-800 dark:text-white">
                          {t.name}
                        </h3>

                        {/* 年ごとにカテゴリチップを並べる */}
                        {t.groups
                          .sort((a, b) => b.year - a.year)
                          .map((group) => (
                            <div
                              className="mb-4"
                              key={`${gen}-${t.id}-${group.year}`}
                            >
                              <h4 className="text-md mb-2">{group.year}年</h4>
                              <ul className="flex flex-wrap gap-2">
                                {group.links.map((link) => (
                                  <li
                                    key={`${gen}-${t.id}-${group.year}-${link.gameCategory}-${link.ageCategory}-${link.gender}`}
                                  >
                                    <Link
                                      href={`/tournaments/${gen}/${t.id}/${group.year}/${link.gameCategory}/${link.ageCategory}/${link.gender}`}
                                    >
                                      <span className="inline-block bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full text-sm hover:opacity-80 transition">
                                        {link.categoryLabel}
                                      </span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                      </div>
                    ))}
                </div>
              </section>
            ))}
        </div>
      </main>
    </>
  );
}

// ====== 生成時処理 ======
export const getStaticProps: GetStaticProps<Props> = async () => {
  // 新Path構成に合わせたルート（必要なら 'data/tournaments' に変更）
  const tournamentsRoot = path.join(process.cwd(), 'data', 'tournaments');
  if (!fs.existsSync(tournamentsRoot)) {
    return {
      props: {
        tournamentsByGeneration: {} as Record<GenerationKey, TournamentBlock[]>,
      },
    };
  }

  const generations = fs
    .readdirSync(tournamentsRoot)
    .filter((g) => fs.statSync(path.join(tournamentsRoot, g)).isDirectory());

  const tournamentsByGeneration: Record<GenerationKey, TournamentBlock[]> =
    {} as Record<GenerationKey, TournamentBlock[]>;

  for (const generation of generations) {
    const genDir = path.join(tournamentsRoot, generation);
    const tournamentIds = fs
      .readdirSync(genDir)
      .filter((tid) => fs.statSync(path.join(genDir, tid)).isDirectory());

    const blocks: TournamentBlock[] = [];

    for (const tournamentId of tournamentIds) {
      const tDir = path.join(genDir, tournamentId);
      const metaPath = path.join(tDir, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;

      const meta = readJSONSafe(metaPath) ?? {};
      const yearDirs = fs
        .readdirSync(tDir)
        .filter((name) => isYearDir(name, tDir));

      const groups: YearGroup[] = [];
      for (const y of yearDirs) {
        const year = parseInt(y, 10);
        const links = collectCategoryLinks(
          tDir,
          generation as GenerationKey,
          tournamentId,
          year,
        );
        if (links.length > 0) {
          groups.push({ year, links });
        }
      }

      if (groups.length === 0) continue;

      blocks.push({
        id: tournamentId,
        name: meta.name || tournamentId,
        sortId: meta.sortId ?? 9999,
        generation: generation as GenerationKey,
        groups,
      });
    }

    if (blocks.length) {
      tournamentsByGeneration[generation as GenerationKey] = blocks;
    }
  }

  return {
    props: {
      tournamentsByGeneration,
    },
  };
};
