// src/components/tournaments/RelatedTournamentsBlock.tsx
//
// 大会ハブページの「関連する大会」ブロック。いまは予選会↔本大会の相互リンクにだけ使う。
//
// 開催前ブロックの中ではなく独立させているのは、**導線として重要なのが
// 「予選会 → 本大会」の向き**だから。予選会側は結果もPVもあるが開催前ブロックは出ない
// （会期が終わっている）ため、開催前ブロックに同居させると片方向しか繋がらない。
// docs/raw/2026-07-26-idea-tournament-metadata-platform.md（追記7）

import Link from 'next/link';

export type RelatedTournamentLink = {
  label: string;
  href: string;
  description: string;
};

export default function RelatedTournamentsBlock({ links }: { links: RelatedTournamentLink[] }) {
  if (links.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface p-4 shadow-sm" aria-labelledby="related-tournaments">
      <h2 id="related-tournaments" className="mb-2 text-base font-bold">
        関連する大会
      </h2>
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.href} className="text-sm">
            <Link href={l.href} className="font-medium text-link hover:underline">
              {l.label}
            </Link>
            <span className="ml-2 text-xs text-text-muted">{l.description}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
