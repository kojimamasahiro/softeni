// 試合詳細ページ上段の「ポイントの並び」。1ゲーム1行で、1本ごとに取った側の色の四角を左から並べる。
// ゲームスコアと取ったゲーム数は上の小さなスコア表（GameScoreboard）が受け持つので、行にはスコアを出さない。
// 先行・連続得点・デュースの長さを色の並びで読む。長いゲームは折り返して2行になる。
// 行そのものがボタンで、押すと下の「試合の流れ」でそのゲームを開く（四角は小さく指では押し分けられないため、押す単位はゲーム）。
// 折れ線（累計の点差・ゲームごとの点差）は読みにくく棄却した。仕様: docs/wiki/score-analysis.md「試合で分かったこと」。

import { useMemo, useState } from 'react';

import type { ReconstructedPointContext, TeamKey } from '@/lib/matchAnalysis';

type Props = {
  contexts: ReconstructedPointContext[];
  teamNames: Record<TeamKey, string>;
  getResultLabel: (resultType: string) => string;
  onSelectGame: (gameNumber: number) => void;
};

const SQUARE_CLASS: Record<TeamKey, string> = {
  A: 'bg-blue-600 dark:bg-blue-400',
  B: 'bg-green-600 dark:bg-green-400',
};

type GameRow = {
  gameNumber: number;
  winner: TeamKey | null;
  score: string;
  points: ReconstructedPointContext[];
};

const teamOf = (context: ReconstructedPointContext): TeamKey | null =>
  context.point.winner_team === 'A' || context.point.winner_team === 'B' ? context.point.winner_team : null;

export default function MatchFlowChart({ contexts, teamNames, getResultLabel, onSelectGame }: Props) {
  const [hovered, setHovered] = useState<ReconstructedPointContext | null>(null);

  const rows = useMemo(() => {
    const result: GameRow[] = [];
    contexts.forEach((context) => {
      let row = result[result.length - 1];
      if (!row || row.gameNumber !== context.gameNumber) {
        row = { gameNumber: context.gameNumber, winner: null, score: '', points: [] };
        result.push(row);
      }
      row.points.push(context);
      const { A, B } = context.scoreAfter;
      row.winner = A > B ? 'A' : B > A ? 'B' : null;
      row.score = `${A}-${B}`;
    });
    return result;
  }, [contexts]);

  if (rows.length === 0) return null;

  const hoveredTeam = hovered ? teamOf(hovered) : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        {(['A', 'B'] as TeamKey[]).map((team) => (
          <span key={team} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-sm ${SQUARE_CLASS[team]}`} />
            {teamNames[team]}の得点
          </span>
        ))}
      </div>
      <ul className="grid gap-1" onMouseLeave={() => setHovered(null)}>
        {rows.map((row) => (
          <li key={row.gameNumber}>
            <button
              type="button"
              onClick={() => onSelectGame(row.gameNumber)}
              aria-label={`第${row.gameNumber}ゲーム ${row.score}${row.winner ? `、${teamNames[row.winner]}が取得` : ''}。${row.points.length}本。押すと詳細を開きます`}
              className="grid w-full grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded px-1 py-1.5 text-left hover:bg-bg-subtle"
            >
              <span className="text-xs text-text-muted" aria-hidden="true">
                G{row.gameNumber}
              </span>
              <span className="flex flex-wrap gap-0.5" aria-hidden="true">
                {row.points.map((context) => {
                  const team = teamOf(context);
                  return (
                    <span
                      key={context.point.id}
                      onMouseEnter={() => setHovered(context)}
                      className={`h-3 w-3 rounded-sm ${team ? SQUARE_CLASS[team] : 'bg-gray-300 dark:bg-gray-600'}`}
                    />
                  );
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 min-h-[1.25rem] text-xs text-text-secondary" aria-live="polite">
        {hovered
          ? `第${hovered.gameNumber}ゲーム ${hovered.scoreAfter.A}-${hovered.scoreAfter.B}・${hoveredTeam ? teamNames[hoveredTeam] : '不明'}の得点（${getResultLabel(hovered.point.result_type ?? '')}${hovered.point.rally_count !== null && hovered.point.rally_count !== undefined ? `・ラリー${hovered.point.rally_count}本` : ''}）`
          : '行を押すと、そのゲームの1本ずつの記録を開きます。'}
      </p>
    </div>
  );
}
