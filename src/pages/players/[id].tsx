// src/pages/players/[id].tsx
import fs from 'fs';
import path from 'path';

import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';

import Breadcrumbs from '@/components/Breadcrumb';
import MetaHead from '@/components/MetaHead';
import { PlayerInfo } from '@/types/index';

type Props = {
  player: PlayerInfo;
  id: string;
};

const calculateAge = (birthDate?: string): number | null => {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  const dayDiff = today.getDate() - birth.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age;
};

const formatJapaneseDate = (dateString?: string): string | null => {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export default function PlayerInformation({ player, id }: Props) {
  const age = calculateAge(player.birthDate);
  const formattedBirthDate = formatJapaneseDate(player.birthDate);

  return (
    <>
      <MetaHead
        title={`${player.lastName}${player.firstName} 選手情報 | ソフトテニス情報`}
        description={`${player.lastName}${player.firstName}選手のプロフィール、所属、ポジション、生年月日などを掲載しています。`}
        url={`https://softeni-pick.com/players/${id}/information`}
        image={`https://softeni-pick.com/api/og/player?name=${encodeURIComponent(`${player.lastName} ${player.firstName}`)}`}
      />

      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Person',
              name: `${player.lastName} ${player.firstName}`,
              alternateName: `${player.lastNameKana} ${player.firstNameKana}`,
              birthDate: formattedBirthDate,
              height: `${player.height} cm`,
              memberOf: {
                '@type': 'Organization',
                name: player.team,
              },
              url: `https://softeni-pick.com/players/${id}`,
              sameAs: player.profileLinks.map((link) => link.url),
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
                  name: `${player.lastName}${player.firstName}`,
                  item: `https://softeni-pick.com/players/${id}`,
                },
                {
                  '@type': 'ListItem',
                  position: 3,
                  name: `試合結果`,
                  item: `https://softeni-pick.com/players/${id}/results`,
                },
              ],
            }),
          }}
        />
      </Head>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Breadcrumbs
          crumbs={[
            { label: 'ホーム', href: '/' },
            {
              label: `${player.lastName}${player.firstName}`,
              href: `/players/${id}`,
            },
          ]}
        />

        <h1 className="text-2xl font-bold mb-6">
          {player.lastName} {player.firstName}
        </h1>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">プロフィール</h2>
          <table className="w-full text-sm border border-gray-300 dark:border-gray-600">
            <tbody>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-2 text-left bg-gray-100 dark:bg-gray-700 w-32">
                  所属
                </th>
                <td className="p-2">
                  {player.retired ? '引退済み' : player.team}
                </td>
              </tr>

              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">
                  ポジション
                </th>
                <td className="p-2">{player.position}</td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">
                  誕生日
                </th>
                <td className="p-2">
                  {formattedBirthDate
                    ? `${formattedBirthDate}${age !== null ? `（${age}歳）` : ''}`
                    : '年月日（歳）'}
                </td>
              </tr>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">
                  身長
                </th>
                <td className="p-2">{player.height}cm</td>
              </tr>
              <tr>
                <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">
                  利き手
                </th>
                <td className="p-2">{player.handedness}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-2">試合結果</h2>
          <Link
            href={`/players/${id}/results`}
            className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition"
          >
            試合結果を見る
          </Link>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">関連リンク</h2>
          <ul className="list-disc list-inside space-y-1">
            {player.profileLinks.map((link, index) => (
              <li key={index}>
                <Link
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const playersPath = path.join(process.cwd(), 'data', 'players');
  const entries = fs.readdirSync(playersPath);

  const paths = entries
    .filter((entry) => {
      const fullPath = path.join(playersPath, entry);
      return fs.statSync(fullPath).isDirectory(); // ディレクトリのみ
    })
    .map((dir) => ({
      params: { id: dir },
    }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const id = params?.id as string;
  const filePath = path.join(
    process.cwd(),
    'data',
    'players',
    id,
    'information.json',
  );
  const fileContents = fs.readFileSync(filePath, 'utf-8');
  const player = JSON.parse(fileContents);

  return {
    props: {
      player,
      id,
    },
  };
};
