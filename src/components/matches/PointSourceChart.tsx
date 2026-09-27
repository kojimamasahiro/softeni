// 試合詳細ページ下段「決め球とミス」。左右に分かれた横棒で、左はチームA・右はチームBが自分でしたことを並べる。
// 上段は自分で決めた点、下段はミスで失った点（自分のミスの種類別）。数は棒の外に必ず文字で出す（色だけに頼らない）。

import type { PointSourceRow, PointSources, TeamKey } from '@/lib/matchAnalysis';

type Props = {
  sources: PointSources;
  teamNames: Record<TeamKey, string>;
};

// 中央の列は幅が狭いので短い名前にする
const SHORT_LABELS: Record<string, string> = {
  smash_winner: 'スマッシュ',
  volley_winner: 'ボレー',
  passing_winner: 'ストローク',
  drop_winner: 'ドロップ',
  net_in_winner: 'ネットイン',
  service_ace: 'サービスエース',
  winner: '決定打',
  net: 'ネット',
  out: 'アウト',
  volley_error: 'ボレーミス',
  smash_error: 'スマッシュミス',
  follow_error: 'フォローミス',
  receive_error: 'レシーブミス',
  double_fault: 'ダブルフォルト',
  forced_error: 'ミス誘発',
  unforced_error: '凡ミス',
};

const BAR_CLASS: Record<TeamKey, string> = {
  A: 'bg-blue-600 dark:bg-blue-400',
  B: 'bg-green-600 dark:bg-green-400',
};

const sum = (rows: PointSourceRow[], team: TeamKey) => rows.reduce((total, row) => total + row.counts[team], 0);

export default function PointSourceChart({ sources, teamNames }: Props) {
  const allRows = [...sources.winners, ...sources.ownErrors];
  if (allRows.length === 0) return null;
  const max = Math.max(1, ...allRows.flatMap((row) => [row.counts.A, row.counts.B]));

  const renderGroup = (title: string, rows: PointSourceRow[]) => {
    if (rows.length === 0) return null;
    return (
      <div className="mt-4 first:mt-0">
        <div className="mb-1 grid grid-cols-[1fr_auto_1fr] items-baseline gap-2 text-xs">
          <span className="text-right text-text-secondary">計 {sum(rows, 'A')}</span>
          <span className="font-semibold text-text">{title}</span>
          <span className="text-text-secondary">計 {sum(rows, 'B')}</span>
        </div>
        <ul className="grid gap-1">
          {rows.map((row) => {
            const label = SHORT_LABELS[row.resultType] ?? row.resultType;
            return (
              <li
                key={row.resultType}
                className="grid grid-cols-[1.25rem_minmax(0,1fr)_5.5rem_minmax(0,1fr)_1.25rem] items-center gap-1 text-xs"
                aria-label={`${label}: ${teamNames.A} ${row.counts.A}点、${teamNames.B} ${row.counts.B}点`}
              >
                <span className="text-right tabular-nums text-text-secondary" aria-hidden="true">
                  {row.counts.A}
                </span>
                <span className="flex justify-end" aria-hidden="true">
                  <span className={`h-2.5 rounded-l ${BAR_CLASS.A}`} style={{ width: `${(row.counts.A / max) * 100}%` }} />
                </span>
                <span className="text-center text-text-secondary" aria-hidden="true">
                  {label}
                </span>
                <span className="flex" aria-hidden="true">
                  <span className={`h-2.5 rounded-r ${BAR_CLASS.B}`} style={{ width: `${(row.counts.B / max) * 100}%` }} />
                </span>
                <span className="tabular-nums text-text-secondary" aria-hidden="true">
                  {row.counts.B}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const otherTotal = sources.other.A + sources.other.B;

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${BAR_CLASS.A}`} />
          {teamNames.A}
        </span>
        <span className="inline-flex items-center justify-end gap-1.5 text-right">
          {teamNames.B}
          <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm ${BAR_CLASS.B}`} />
        </span>
      </div>
      {renderGroup('自分で決めた点', sources.winners)}
      {renderGroup('ミスで失った点', sources.ownErrors)}
      {otherTotal > 0 && (
        <p className="mt-3 text-xs text-text-muted">
          決まり方の記録がない点: {teamNames.A} {sources.other.A}点、{teamNames.B} {sources.other.B}点
        </p>
      )}
    </div>
  );
}
