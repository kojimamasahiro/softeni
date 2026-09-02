// src/components/tournaments/QualifierFinishersSection.tsx
//
// これから開催される国際大会の大会ハブに出す「日本代表予選会の上位進出者」。
//
// 結果がまだ無い大会のページは実体が薄く、選手ページへのリンクが0本だった。
// 予選会の上位進出者を通算成績つきで出すことで、ページに中身が入り、
// 選手ページ側の導線（PlayerUpcomingInternational）の受け皿にもなる。
// docs/wiki/upcoming-tournaments-runbook.md S2。
//
// **代表選手だとは名乗らない。** 予選会はシングルスのみで団体・混合の選考は別経路のため、
// 当サイトのデータから日本代表は導出できない。断り書きは必ず出す。
//
// 表記ルール: 絵文字は使わない（AGENTS.md。eslint で強制）。

import Link from 'next/link';

import { PLACEMENT_DISCLAIMER, type QualifierFinishersBlock } from '@/lib/qualifierFinishers';
import { SCOPE_NOTE_TOURNAMENTS } from '@/lib/uiText';

function formatDate(d: string | null): string | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[1]}年${Number(m[2])}月` : d;
}

export default function QualifierFinishersSection({ data }: { data: QualifierFinishersBlock }) {
  const when = formatDate(data.startDate);

  return (
    <section className="mb-8" aria-labelledby="qualifier-finishers">
      <h2 id="qualifier-finishers" className="mb-2 text-lg font-bold">
        日本代表予選会の上位進出者
      </h2>

      <p className="mb-1 text-sm text-text-secondary">
        <Link href={data.qualifierHubHref} className="text-link hover:underline">
          {data.qualifierLabel}
        </Link>
        （{[when, data.location].filter(Boolean).join(' / ')}）で上位に進出した選手です。
      </p>
      <p className="mb-3 text-xs text-text-muted">{PLACEMENT_DISCLAIMER}</p>

      <div className="space-y-4">
        {data.groups.map((g) => (
          <div key={g.genderLabel}>
            <h3 className="mb-1.5 text-sm font-semibold text-text-secondary">{g.genderLabel}</h3>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {g.finishers.map((f) => (
                <li key={`${g.genderLabel}-${f.name}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-sm">
                  <span className="w-16 shrink-0 font-semibold text-text-secondary">{f.placementLabel}</span>
                  <span className="font-medium">
                    {f.playerId !== null ? (
                      <Link href={`/players/${f.playerId}/results/`} className="text-link hover:underline">
                        {f.name}
                      </Link>
                    ) : (
                      f.name
                    )}
                  </span>
                  {f.team && <span className="text-xs text-text-muted">{f.team}</span>}
                  {f.record && (
                    <span className="ml-auto text-xs tabular-nums text-text-muted">
                      通算 {f.record.matches}試合 {f.record.wins}勝{f.record.losses}敗（勝率 {(f.record.winRate * 100).toFixed(1)}%）
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-2 text-xs text-text-muted">{SCOPE_NOTE_TOURNAMENTS}</p>
    </section>
  );
}
