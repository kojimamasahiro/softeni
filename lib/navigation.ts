// lib/navigation.ts
// 公開サイトのナビ項目を単一ソースで定義する。
// メイン(softeni-pick) / スコア(score) の2モードと DEV 分岐を内包する。
// 参照: docs/wiki/public-pages.md「ナビゲーション再設計方針」/ ADR-006

import { isDebugMode } from './env';
import {
  getPublicMatchesGrowthPath,
  getPublicMatchesListPath,
  isScoreSiteMode,
} from './siteConfig';

export type NavItem = {
  /** 表示ラベル */
  label: string;
  /** 遷移先パス */
  href: string;
  /**
   * 現在地判定の基準パス。前方一致で active を判定する。
   * 省略時は href を使用。'/' は完全一致のみ。
   */
  matchPrefix?: string;
  /** 開発時のみ表示する項目（DEV バッジ表示） */
  devOnly?: boolean;
};

export type NavGroup = {
  /** グループ見出し（省略時は見出しなし） */
  label?: string;
  items: NavItem[];
};

// サイドバーのグループ構成（A案: 「特集」として明示 / ADR-006・Q6）。
// 補足: `大会`(/tournaments) は世代別（国際/総合/大学/高校/ジュニア/シニア/実業団）を
// すべて内包する総合入口。`高校`・`STリーグ` はそのうちの一部を SEO・独自データの
// 都合で個別に切り出した「特集ハブ」であり、学校種別の網羅分類ではない。
// そのため大学・中学に同等項目は無く、特集として明示することで非対称を意図的に見せる。
const SOFTENI_GROUPS: NavGroup[] = [
  {
    label: '成績・記録を調べる',
    items: [
      { label: '大会', href: '/tournaments', matchPrefix: '/tournaments' },
      { label: '選手', href: '/players', matchPrefix: '/players' },
      // チームは一覧ページ（/teams index）が無く /teams/[teamId] のみのため
      // グローバルナビには出さない（/teams は 404）。
    ],
  },
  {
    label: '特集',
    items: [
      // /highschool は /highschool/boys へ 301 されるため直接 boys を指す。
      // active 判定は /highschool 配下全体を対象にする。
      { label: '高校', href: '/highschool/boys', matchPrefix: '/highschool' },
      { label: 'STリーグ', href: '/st-league', matchPrefix: '/st-league' },
    ],
  },
  {
    label: '読みもの・記録',
    items: [
      { label: 'ニュース', href: '/news', matchPrefix: '/news' },
      { label: '成長記録', href: '/growth', matchPrefix: '/growth' },
    ],
  },
  {
    // ベータ機能リンクは公開ナビから除外（commit b298c8ed の意図を踏襲）。
    // DEV のポイント記録のみ isDebugMode() で表示する。
    label: '開発',
    items: [
      {
        label: '[DEV] ポイント記録',
        href: '/beta/matches',
        matchPrefix: '/beta/matches',
        devOnly: true,
      },
    ],
  },
];

const SCORE_NAV: NavItem[] = [
  { label: '試合一覧', href: getPublicMatchesListPath() },
  { label: '成長分析', href: getPublicMatchesGrowthPath() },
];

/**
 * 上部バー用のフラットなナビ項目。
 * - score モード: 上部バーのみ運用（サイドバーは出さない / ADR-006）。試合一覧/成長分析。
 * - softeni-pick モード: グループを平坦化（フォールバック用途）。
 */
export function getNavItems(): NavItem[] {
  if (isScoreSiteMode()) return SCORE_NAV;
  return getNavGroups().flatMap((g) => g.items);
}

/**
 * サイドバー用のグループ化ナビ。
 * DEV 限定項目を除外し、空になったグループは落とす。
 * score モードはサイドバー非表示のため空配列を返す。
 */
export function getNavGroups(): NavGroup[] {
  if (isScoreSiteMode()) return [];

  return SOFTENI_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.devOnly || isDebugMode()),
  })).filter((group) => group.items.length > 0);
}

/**
 * 現在パスに対して item が active かどうか。
 * '/' は完全一致、それ以外は matchPrefix（既定: href）の前方一致。
 * パスはクエリ/ハッシュ除去後の pathname を渡すこと。
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const base = item.matchPrefix ?? item.href;
  const target = base.split('?')[0];
  if (target === '/') return pathname === '/';
  return pathname === target || pathname.startsWith(`${target}/`);
}
