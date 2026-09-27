// 試合詳細ページ上段の小さなスコア表（チーム×ゲーム、右端に取ったゲーム数）。
// どのゲームを誰が取り、何ゲーム取って勝ったかを読むための表で、ゲームの中の流れは下の「ポイントの並び」が受け持つ。
// スマホで横スクロールにならないよう、名前は名字だけ・列幅は固定にする。取った側のマスはチームの色＋太字（色だけに頼らない）。
// 仕様: docs/wiki/score-analysis.md「上段の並びと重なりの整理」。

import type { TeamKey } from '@/lib/matchAnalysis';

export type ScoreboardGame = {
  gameNumber: number;
  points: Record<TeamKey, number>;
  winner: TeamKey | null;
};

type Props = {
  games: ScoreboardGame[];
  /** 表に出す短い名前（名字だけ） */
  teamLabels: Record<TeamKey, string>;
  /** 読み上げ用の正式な名前 */
  teamNames: Record<TeamKey, string>;
};

const WON_CELL_CLASS: Record<TeamKey, string> = {
  A: 'bg-blue-100 font-bold text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
  B: 'bg-green-100 font-bold text-green-900 dark:bg-green-900/40 dark:text-green-100',
};

const SWATCH_CLASS: Record<TeamKey, string> = {
  A: 'bg-blue-600 dark:bg-blue-400',
  B: 'bg-green-600 dark:bg-green-400',
};

export default function GameScoreboard({ games, teamLabels, teamNames }: Props) {
  if (games.length === 0) return null;
  const gamesWon = {
    A: games.filter((game) => game.winner === 'A').length,
    B: games.filter((game) => game.winner === 'B').length,
  };

  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <caption className="sr-only">
        ゲームごとのスコア。{teamNames.A} {gamesWon.A}ゲーム、{teamNames.B} {gamesWon.B}ゲーム
      </caption>
      <thead>
        <tr className="text-xs text-text-muted">
          <th scope="col" className="w-[6.5rem] border border-border px-1.5 py-1 text-left font-normal sm:w-40">
            <span className="sr-only">チーム</span>
          </th>
          {games.map((game) => (
            <th key={game.gameNumber} scope="col" className="border border-border px-0.5 py-1 text-center font-normal">
              {game.gameNumber}
            </th>
          ))}
          <th scope="col" className="w-9 border border-border px-0.5 py-1 text-center font-normal">
            計
          </th>
        </tr>
      </thead>
      <tbody>
        {(['A', 'B'] as TeamKey[]).map((team) => (
          <tr key={team}>
            <th scope="row" className="border border-border px-1.5 py-1.5 text-left font-medium text-text">
              <span className="flex min-w-0 items-center gap-1.5">
                <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${SWATCH_CLASS[team]}`} />
                <span className="truncate" title={teamNames[team]}>
                  {teamLabels[team]}
                </span>
              </span>
            </th>
            {games.map((game) => (
              <td
                key={game.gameNumber}
                className={`border border-border px-0.5 py-1.5 text-center tabular-nums ${game.winner === team ? WON_CELL_CLASS[team] : 'text-text-secondary'}`}
              >
                {game.points[team]}
              </td>
            ))}
            <td
              className={`border border-border px-0.5 py-1.5 text-center tabular-nums ${
                gamesWon[team] > gamesWon[team === 'A' ? 'B' : 'A'] ? 'font-bold text-text' : 'text-text-secondary'
              }`}
            >
              {gamesWon[team]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
