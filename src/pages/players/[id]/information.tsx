import fs from 'fs';
import path from 'path';
import { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import styles from '@/styles/Information.module.css';

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
    <div className={styles.container}>
      <h1 className={styles.title}>{fullName} - プロフィール</h1>

      <section className={styles.profile}>
        <h2 className={styles.heading}>プロフィール</h2>
        <table className={styles.profileTable}>
          <tbody>
            <tr><th>所属</th><td>{player.team}</td></tr>
            <tr><th>ポジション</th><td>{player.position}</td></tr>
            <tr><th>誕生日</th><td>{player.birthDate}</td></tr>
            <tr><th>身長</th><td>{player.height}cm</td></tr>
            <tr><th>利き手</th><td>{player.handedness}</td></tr>
          </tbody>
        </table>
      </section>

      <section className={styles.results}>
        <h2 className={styles.heading}>大会結果</h2>
        <Link href={`/players/${id}/results`} className={styles.link}>
          詳細を見る
        </Link>
      </section>

      <section className={styles.links}>
        <h2 className={styles.heading}>関連リンク</h2>
        <ul className={styles.link}>
          {player.profileLinks.map((link, index) => (
            <li key={index} className={styles.item}>
              <Link href={link.url} target="_blank" rel="noopener noreferrer">
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
