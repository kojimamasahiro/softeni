// src/components/MilestoneBadge.tsx
// 「注目ポイント」バッジの共通表示。ラベル本文の前に種別タグ（連覇/初優勝/王者撃破 など、
// milestoneKindTag.ts で定義）を添えることで、複数バッジが並んだときに一目で種類が
// 区別できるようにする。ResultContextBlocks / TournamentContextBlocks / PlayerCareerHighlights
// の3箇所で共通利用し、見た目・挙動を一貫させる。

import { milestoneKindTag } from './milestoneKindTag';

export default function MilestoneBadge({ kind, label, scopeNote }: { kind: string; label: string; scopeNote?: string | null }) {
  const tag = milestoneKindTag(kind);

  return (
    <span
      className="inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100"
      title={scopeNote ?? undefined}
    >
      {tag && <span className={`mr-1.5 rounded px-1.5 py-0.5 align-middle text-[10px] font-bold ${tag.className}`}>{tag.text}</span>}
      {label}
    </span>
  );
}
