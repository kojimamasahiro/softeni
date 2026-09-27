// 試合詳細ページ下段「ラリーの長さ別」。ラリーの本数の区切りごとに、どちらが取ったかを100%の横棒で出す。
// 本数が少ない区切りは「参考程度」と添える（件数が少ないと割合が大きくぶれるため）。

import { RALLY_ROW_MIN_RELIABLE, type RallyLengthRow, type TeamKey } from '@/lib/matchAnalysis';

type Props = {
  rows: RallyLengthRow[];
  unknown: number;
  teamNames: Record<TeamKey, string>;
};

const BUCKET_LABELS: Record<RallyLengthRow['bucket'], string> = {
  '1-2': '1〜2本',
  '3-4': '3〜4本',
  '5-8': '5〜8本',
  '9+': '9本以上',
};

const BAR_CLASS: Record<TeamKey, string> = {
  A: 'bg-blue-600 dark:bg-blue-400',
  B: 'bg-green-600 dark:bg-green-400',
};

export default function RallyLengthChart({ rows, unknown, teamNames }: Props) {
  if (rows.every((row) => row.total === 0)) return null;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        {(['A', 'B'] as TeamKey[]).map((team) => (
          <span key={team} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-sm ${BAR_CLASS[team]}`} />
            {teamNames[team]}
          </span>
        ))}
      </div>
      <ul className="grid gap-3">
        {rows.map((row) => (
          <li key={row.bucket}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-text">{BUCKET_LABELS[row.bucket]}</span>
              <span className="tabular-nums text-text-secondary">
                {row.counts.A} - {row.counts.B}（{row.total}本）
              </span>
            </div>
            {row.total > 0 ? (
              <div className="flex h-3 gap-0.5" aria-hidden="true">
                {row.counts.A > 0 && <span className={`rounded-l ${BAR_CLASS.A}`} style={{ flex: row.counts.A }} />}
                {row.counts.B > 0 && <span className={`rounded-r ${BAR_CLASS.B}`} style={{ flex: row.counts.B }} />}
              </div>
            ) : (
              <div className="h-3 rounded bg-bg-subtle" aria-hidden="true" />
            )}
            {row.total > 0 && row.total < RALLY_ROW_MIN_RELIABLE && <p className="mt-1 text-xs text-text-muted">本数が少ないので参考程度</p>}
          </li>
        ))}
      </ul>
      {unknown > 0 && <p className="mt-3 text-xs text-text-muted">ダブルフォルトなど、ラリーの本数に入らない点: {unknown}本</p>}
    </div>
  );
}
