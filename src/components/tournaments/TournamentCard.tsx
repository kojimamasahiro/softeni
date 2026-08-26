import Link from 'next/link';

import { getTournamentHubHref } from '@/lib/highschoolNationalTournamentMeta';

export type CategoryLink = {
  year: number;
  gameCategory: string;
  ageCategory: string;
  gender: string;
  categoryLabel: string;
  isCurrent?: boolean;
};

export type YearGroup = {
  year: number;
  links: CategoryLink[];
  externalResultUrl?: string | null;
  /**
   * まだ結果が無い年度に出す一言（例: 開催予定 2026年9月18日〜9月23日 愛知県）。
   * 結果リンクが1つも無い年度でも、大会が一覧から消えないようにするために使う。
   */
  upcomingNote?: string | null;
  /**
   * 結果が `data/tournaments/details/` ではなくサイト内の特集ページにある場合の内部URL
   * （STリーグ → `/st-league/2025/matches/`）。カテゴリチップの代わりに1本リンクを出す。
   */
  internalResultHref?: string | null;
};

export type TournamentBlock = {
  id: string;
  name: string;
  generation: string;
  groups: YearGroup[];
};

type Props = {
  tournament: TournamentBlock;
};

export const TournamentCard = ({ tournament }: Props) => {
  const { id, name, generation, groups } = tournament;

  // 高校全国大会は汎用ハブが noindex のため、歴代記録ページへ直接リンクする（seo.md #3）
  const hubHref = getTournamentHubHref(generation, id);

  return (
    <div className="bg-surface p-4 rounded-lg shadow">
      <div className="mb-4 border-b pb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          <Link href={hubHref} className="hover:underline">
            {name}
          </Link>
        </h3>
        <Link href={hubHref} className="text-sm text-link hover:underline whitespace-nowrap">
          歴代結果・優勝者まとめ →
        </Link>
      </div>

      {/* 年ごとにカテゴリチップを並べる */}
      {groups
        .sort((a, b) => b.year - a.year)
        .map((group) => (
          <div key={`${generation}-${id}-${group.year}`} className="mb-4">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h4 className="text-md">{group.year}年</h4>
              {group.externalResultUrl && (
                <a
                  href={group.externalResultUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-text-secondary bg-bg-subtle px-2.5 py-1 rounded-full hover:opacity-80 transition"
                >
                  {getExternalResultLabel(group.externalResultUrl)}
                </a>
              )}
            </div>
            {group.upcomingNote && <p className="text-sm text-text-secondary">{group.upcomingNote}</p>}
            {group.internalResultHref && (
              <Link href={group.internalResultHref} className="text-sm text-link hover:underline">
                結果・順位表を見る →
              </Link>
            )}
            {group.links.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {group.links.map((link) => (
                  <li key={`${generation}-${id}-${group.year}-${link.gameCategory}-${link.ageCategory}-${link.gender}`}>
                    <Link href={`/tournaments/${generation}/${id}/${group.year}/${link.gameCategory}/${link.ageCategory}/${link.gender}`}>
                      <span className="inline-block bg-info-bg text-info px-3 py-1 rounded-full text-sm hover:opacity-80 transition">{link.categoryLabel}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
    </div>
  );
};

function getExternalResultLabel(url: string): string {
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf')) return '結果PDF';
  if (/^https?:\/\/(www\.)?(x\.com|twitter\.com)/.test(lower)) {
    return 'Xで結果';
  }
  return '公式結果';
}
