// src/components/nav/SubNav.tsx
// 本文上部のサブナビ(セグメント型リンク)。
// URL が変わる切替に使う(docs/ui/deliverables/07-components.md §3)。
// グローバルナビは「セクション入口のみ」の方針のため、入口内の
// 絞り込み・兄弟ページ間の移動は本コンポーネントが担う(04 §4)。
import Link from 'next/link';
import { useRouter } from 'next/router';

export type SubNavItem = {
  /** 表示ラベル */
  label: string;
  /** 遷移先パス */
  href: string;
  /**
   * 現在地判定の基準パス(前方一致)。省略時は href の完全一致のみ。
   * 例: /tournaments は配下に major/local を含むため exact 判定にする。
   */
  matchPrefix?: string;
  /** true のとき href の完全一致のみで active 判定する */
  exact?: boolean;
};

type Props = {
  items: SubNavItem[];
  /** aria-label(例: "大会の絞り込み") */
  label: string;
};

function isActive(item: SubNavItem, pathname: string): boolean {
  const normalized = pathname.replace(/\/$/, '') || '/';
  const target = (item.matchPrefix ?? item.href).replace(/\/$/, '') || '/';
  if (item.exact || !item.matchPrefix) return normalized === target;
  return normalized === target || normalized.startsWith(`${target}/`);
}

export default function SubNav({ items, label }: Props) {
  const router = useRouter();
  const pathname = router.asPath.split(/[?#]/)[0];

  return (
    <nav aria-label={label} className="mb-6">
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
        {items.map((item) => {
          const active = isActive(item, pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                active ? 'bg-blue-600 font-semibold text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
