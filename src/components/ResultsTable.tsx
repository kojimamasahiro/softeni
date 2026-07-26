// src/components/ResultsTable.tsx
import { MatchRow } from '@/types/tournament';

export default function ResultsTable({ rows, className = '' }: { rows: MatchRow[]; className?: string }) {
  return (
    <table className={`w-full text-sm border border-border ${className}`}>
      <thead className="bg-bg-subtle">
        <tr>
          <th className="border-b border-border-strong px-2 py-1">ラウンド</th>
          <th className="border-b border-border-strong px-2 py-1">対戦相手</th>
          <th className="border-b border-border-strong px-2 py-1">スコア</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((match, i) => {
          const round = match.round ?? '予選';
          const opponentDisplay = match.opponentDisplayName ?? '不明';
          const scoreDisplay = `${match.games.won}-${match.games.lost}`;

          return (
            <tr key={i} className="text-center">
              <td className="border-b border-border px-2 py-1">{round}</td>
              <td className="border-b border-border px-2 py-1">
                {opponentDisplay}
                {/*
                  前哨戦・再戦。直近の他大会（主に地区大会）で同じ相手と対戦していた場合に注記する。
                  大会をまたいだ試合データを持っていて初めて出せる文脈で、薄くなりがちな選手結果
                  ページの情報密度・一意性を上げる狙い（docs/wiki/seo.md #2 と同じ発想）。
                */}
                {match.rematchOf && <span className="mt-0.5 block text-[10px] leading-tight text-text-muted">{match.rematchOf}</span>}
              </td>
              <td className="border-b border-border px-2 py-1">{scoreDisplay}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
