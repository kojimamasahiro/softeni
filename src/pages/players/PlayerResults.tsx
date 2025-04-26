import fs from 'fs';
import path from 'path';
import styles from '../../styles/Results.module.css';
import MatchResults from '../../components/MatchResults';
import Head from 'next/head';

interface MatchResult {
  round: string;
  opponent: string;
  result: string;
  score: string;
}

interface Stage {
  format: 'round-robin' | 'tournament';
  group?: string;
  results: MatchResult[];
}

interface Tournament {
  tournament: string;
  dateRange?: string;
  location?: string;
  link?: string;
  format: 'round-robin' | 'tournament' | 'combined';
  finalResult?: string;
  groupStage?: Stage;
  finalStage?: Stage;
  results?: MatchResult[]; // 単独モード
}

interface YearlyResult {
  year: number;
  result: string;
}

interface MajorTitle {
  name: string;
  years: YearlyResult[];
}

interface PlayerData {
  player: string;
  matches: Tournament[];
  majorTitles: MajorTitle[];
}

export default function PlayerResults({ playerData }: { playerData: PlayerData }) {
  // 選手名をスラッグに変換（例：船水颯人 → funemizu）
  const playerSlug = playerData.player === '船水颯人' ? 'funemizu-hayato' : 'default';

  return (
    <>
      <Head>
        <title>{playerData.player}の試合結果まとめ | ソフトテニス速報</title>
        <meta name="description" content={`${playerData.player}の最新試合結果・成績をまとめたページです。`} />

        {/* Open Graph */}
        <meta property="og:title" content={`${playerData.player}の試合結果まとめ`} />
        <meta property="og:description" content={`${playerData.player}の最新の大会情報・結果を一覧表示。`} />
        <meta property="og:image" content={`https://your-site.com/og-image.jpg`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://your-site.com/player/${playerSlug}`} />
      </Head>
      <div className={styles.container}>
        <MatchResults playerData={playerData} />
      </div>
    </>
  );
}

export async function getStaticProps() {
  const filePath = path.join(process.cwd(), 'data/players/funemizu-hayato/results.json');
  const jsonData = fs.readFileSync(filePath, 'utf-8');
  const playerData: PlayerData = JSON.parse(jsonData);

  return {
    props: {
      playerData,
    },
  };
}
