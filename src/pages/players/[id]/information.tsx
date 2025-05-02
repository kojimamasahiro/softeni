import fs from 'fs';
import path from 'path';
import { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';

type PlayerInfo = {
  lastName: string;
  firstName: string;
  lastNameKana: string;
  firstNameKana: string;
  team: string;
  position: string;
  handedness: string;
  birthDate: string;
  height: number;
  profileLinks: {
    label: string;
    url: string;
  }[];
};

type Props = {
  player: PlayerInfo;
  id: string;
};

export default function PlayerInformation({ player, id }: Props) {
  const fullName = `${player.lastName} ${player.firstName}（${player.lastNameKana} ${player.firstNameKana}）`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{fullName}</h1>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">プロフィール</h2>
        <table className="w-full text-sm border border-gray-300 dark:border-gray-600">
          <tbody>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="p-2 text-left bg-gray-100 dark:bg-gray-700 w-32">所属</th>
              <td className="p-2">{player.team}</td>
            </tr>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">ポジション</th>
              <td className="p-2">{player.position}</td>
            </tr>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">誕生日</th>
              <td className="p-2">{player.birthDate}</td>
            </tr>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">身長</th>
              <td className="p-2">{player.height}cm</td>
            </tr>
            <tr>
              <th className="p-2 text-left bg-gray-100 dark:bg-gray-700">利き手</th>
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
          詳細を見る
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
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const playersPath = path.join(process.cwd(), 'data', 'players');
  const dirs = fs.readdirSync(playersPath);
  const paths = dirs.map((dir) => ({
    params: { id: dir },
  }));

  return { paths, fallback: false };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const id = params?.id as string;
  const filePath = path.join(process.cwd(), 'data', 'players', id, 'information.json');
  const fileContents = fs.readFileSync(filePath, 'utf-8');
  const player = JSON.parse(fileContents);

  return {
    props: {
      player,
      id,
    },
  };
};
