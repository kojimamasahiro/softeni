// src/components/nav/YearPagerNav.tsx
import Link from 'next/link';

type YearLink = {
  /** 表示する年度（例: 2025） */
  year: number | string;
  /** 遷移先パス */
  href: string;
};

type Props = {
  /** 現在表示中の年度 */
  current: number | string;
  /** 前年（無ければ省略） */
  prev?: YearLink;
  /** 翌年（無ければ省略） */
  next?: YearLink;
  /** 一覧/トップへ戻るリンク（任意） */
  indexHref?: string;
  /** 一覧リンクのラベル（既定: 年度一覧） */
  indexLabel?: string;
  /** ラベルの接尾辞（例: '年度'）。既定は空 */
  unitSuffix?: string;
  className?: string;
};

/**
 * 全エンティティ共通の年度前後ナビ（汎用）。
 * 前後年度の存在判定は呼び出し側が prev/next を渡すことで制御する
 * （既存の絞り込み意図を上書きしないため。ADR-006 / Q6）。
 * 本コンポは表示と前後リンク生成にのみ責務を持つ。
 */
export default function YearPagerNav({
  current,
  prev,
  next,
  indexHref,
  indexLabel = '年度一覧',
  unitSuffix = '',
  className,
}: Props) {
  return (
    <nav
      aria-label="年度ナビゲーション"
      className={`flex items-center justify-between gap-2 text-sm ${className ?? ''}`}
    >
      <div className="flex-1">
        {prev ? (
          <Link
            href={prev.href}
            rel="prev"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-300"
          >
            <span aria-hidden="true">←</span>
            {prev.year}
            {unitSuffix}
          </Link>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">
            <span aria-hidden="true">←</span>
          </span>
        )}
      </div>

      <div className="text-center font-semibold">
        {indexHref ? (
          <Link href={indexHref} className="hover:underline">
            {current}
            {unitSuffix}
          </Link>
        ) : (
          <span>
            {current}
            {unitSuffix}
          </span>
        )}
        {indexHref && (
          <>
            <span className="px-2 text-gray-300 dark:text-gray-600">|</span>
            <Link
              href={indexHref}
              className="font-normal text-blue-600 hover:underline dark:text-blue-300"
            >
              {indexLabel}
            </Link>
          </>
        )}
      </div>

      <div className="flex-1 text-right">
        {next ? (
          <Link
            href={next.href}
            rel="next"
            className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-300"
          >
            {next.year}
            {unitSuffix}
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">
            <span aria-hidden="true">→</span>
          </span>
        )}
      </div>
    </nav>
  );
}
