import fs from 'fs';
import path from 'path';

// 本体ページ（大会・選手）→ 試合詳細 の逆引き表を読むサーバー専用ヘルパー。
// 生成は scripts/generate-match-reverse-index.mjs。
// getStaticProps からのみ使う（fs 依存のためクライアントへ import しない）。
// 仕様: docs/wiki/score-site-link.md

export interface ScoreMatchLink {
  matchId: string;
  detailPath: string;
  round: string | null;
  entryNos: number[];
  teamA: string;
  teamB: string;
}

const reverseRoot = path.join(process.cwd(), 'public', 'data', 'beta-matches', 'reverse');

const readJsonIfExists = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
};

// by-tournament.json / by-player.json は全ページ共通のデータだが、これらの
// getter は選手ページ・大会ページから1ページにつき1回ずつ呼ばれる(合計で
// 数千回)。ファイル自体は読むたびに再パースしていたので、プロセス内で一度だけ
// 読み込んでキャッシュし、重複したI/O・JSON.parseをなくす。
let cachedByTournament: { tournaments?: Record<string, ScoreMatchLink[]> } | null | undefined;
let cachedByPlayer: { players?: Record<string, ScoreMatchLink[]> } | null | undefined;

export const getScoreMatchLinksForTournament = (tournamentPath: string): ScoreMatchLink[] => {
  if (cachedByTournament === undefined) {
    cachedByTournament = readJsonIfExists<{
      tournaments?: Record<string, ScoreMatchLink[]>;
    }>(path.join(reverseRoot, 'by-tournament.json'));
  }
  return cachedByTournament?.tournaments?.[tournamentPath] ?? [];
};

export const getScoreMatchLinksForPlayer = (playerId: string | number): ScoreMatchLink[] => {
  if (cachedByPlayer === undefined) {
    cachedByPlayer = readJsonIfExists<{
      players?: Record<string, ScoreMatchLink[]>;
    }>(path.join(reverseRoot, 'by-player.json'));
  }
  return cachedByPlayer?.players?.[String(playerId)] ?? [];
};
