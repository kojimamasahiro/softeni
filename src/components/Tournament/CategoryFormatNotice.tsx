// src/components/Tournament/CategoryFormatNotice.tsx
//
// 大会結果ページに出す「競技方式」のブロック。docs/adr/ADR-021。
//
// 主催者が方式を文章で公開していない大会のための受け皿。転記と推定が混ざるので、
// 出典・確認日を必ず併記し、推定は「当サイトの推定」として本文と分けて出す。
// format を持たない種目（＝ほとんどの大会）では何も描画しない。

import { formatCheckedOn, type CategoryFormat } from '@/lib/categoryFormat';

interface CategoryFormatNoticeProps {
  format: CategoryFormat | null;
  /** 見出しに添える種目名（例: 混合ダブルス）。無ければ「競技方式」だけ */
  categoryLabel?: string;
}

export default function CategoryFormatNotice({ format, categoryLabel }: CategoryFormatNoticeProps) {
  if (!format) return null;

  const checkedOn = format.checkedOn ? formatCheckedOn(format.checkedOn) : null;

  return (
    <section className="mb-6 rounded-lg border border-border bg-bg-subtle px-3 py-3" aria-labelledby="category-format-heading">
      <h2 id="category-format-heading" className="mb-1.5 text-sm font-semibold text-text-secondary">
        {categoryLabel ? `${categoryLabel}の競技方式` : '競技方式'}
      </h2>
      <p className="text-sm leading-relaxed text-text">{format.summary}</p>
      {format.assumptions.length > 0 && (
        <ul className="mt-2 space-y-1">
          {format.assumptions.map((a) => (
            <li key={a} className="text-xs leading-relaxed text-text-muted">
              ※ {a}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-text-muted">
        出典:{' '}
        <a href={format.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-link hover:underline">
          {format.source}
        </a>
        {checkedOn ? `（${checkedOn}時点）` : ''}。
      </p>
    </section>
  );
}
