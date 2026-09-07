// src/components/tournaments/DelegationSection.tsx
//
// これから開催される国際大会の大会ハブに出す「日本代表選手」。
//
// 第1弾では「予選会の上位進出者」を出していたが、予選会はシングルスのみで団体・混合の
// 選考は別経路のため、上位4人には代表に選ばれていない選手が混ざる（2026年のアジア競技大会では
// 8人中3人）。公式の名簿が出た大会ではこちらが代わりに出る。
// docs/wiki/upcoming-tournaments-runbook.md S9。
//
// **名簿は外部の公式発表の転記であって、当サイトの推定ではない。** そのため出典と発表日を
// 必ず併記する。逆に名簿に書かれていないこと（混合ダブルスのペア構成）は書かない。
//
// 表記ルール: 絵文字は使わない（AGENTS.md。eslint で強制）。

import Link from 'next/link';

import type { DelegationBlock } from '@/lib/delegation';
import { SCOPE_NOTE_TOURNAMENTS } from '@/lib/uiText';

function formatDate(d: string | null): string | null {
  if (!d) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : d;
}

export default function DelegationSection({ data }: { data: DelegationBlock }) {
  const announced = formatDate(data.announcedOn);

  return (
    <section className="mb-8" aria-labelledby="delegation">
      <h2 id="delegation" className="mb-2 text-lg font-bold">
        日本代表選手
      </h2>

      <p className="mb-3 text-sm text-text-secondary">
        {data.label}（
        <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
          {data.source}
        </a>
        {announced ? ` ${announced}発表` : ''}）。
      </p>

      <div className="space-y-4">
        {data.groups.map((g) => (
          <div key={g.genderLabel}>
            <h3 className="mb-1.5 text-sm font-semibold text-text-secondary">{g.genderLabel}</h3>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {g.members.map((m) => (
                <li key={`${g.genderLabel}-${m.name}`} className="px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-medium">
                      {m.playerId !== null ? (
                        <Link href={`/players/${m.playerId}/results/`} className="text-link hover:underline">
                          {m.name}
                        </Link>
                      ) : (
                        m.name
                      )}
                    </span>
                    <span className="text-xs text-text-muted">{m.schoolYear ?? m.affiliation}</span>
                    {m.record && (
                      <span className="ml-auto text-xs tabular-nums text-text-muted">
                        通算 {m.record.matches}試合 {m.record.wins}勝{m.record.losses}敗（勝率 {(m.record.winRate * 100).toFixed(1)}%）
                      </span>
                    )}
                  </div>
                  {m.categoryLabels.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {m.categoryLabels.map((label) => (
                        <li
                          key={label}
                          className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs text-text-secondary"
                        >
                          {label}
                        </li>
                      ))}
                    </ul>
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
