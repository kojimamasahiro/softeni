// src/components/nav/SideNav.tsx
import Link from 'next/link';

import { getNavGroups, isNavItemActive } from '@/lib/navigation';

type Props = {
  /** クエリ/ハッシュ除去後の現在 pathname */
  pathname: string;
  /** リンク選択時のコールバック（モバイルドロワーを閉じる用途） */
  onNavigate?: () => void;
};

/**
 * サイドバー第1階層（セクション入口）。グループ見出し付き。
 * PC サイドバーとモバイルドロワーの両方で共用する。
 */
export default function SideNav({ pathname, onNavigate }: Props) {
  const groups = getNavGroups();

  return (
    <nav aria-label="サイトナビゲーション" className="flex flex-col gap-4 p-3">
      {groups.map((group, gi) => (
        <div key={group.label ?? `group-${gi}`} className="flex flex-col gap-1">
          {group.label && (
            <p className="px-3 pb-1 text-xs font-medium tracking-wide text-gray-400 dark:text-gray-500">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const active = isNavItemActive(item, pathname);
            const base = 'rounded-md px-3 py-2 text-sm transition-colors block';
            const state = active
              ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-900/40 dark:text-blue-200'
              : item.devOnly
                ? 'text-orange-600 hover:bg-gray-100 dark:text-orange-400 dark:hover:bg-gray-800'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800';

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={`${base} ${state}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
