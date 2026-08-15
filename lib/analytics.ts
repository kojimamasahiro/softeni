// lib/analytics.ts
//
// 回遊（サイト内の次の1クリック）を計測するための GA4 イベント送信。
// 手順・指標の定義は docs/wiki/circulation-verification.md（回遊検証ランブック）が正。
//
// 設計の要点:
// - 主指標は「モジュールCTR = internal_link_click ÷ page_view」。どちらもイベント数なので、
//   同意状態（analytics_storage）に依存せずに比として読める。未同意でも cookieless ping で
//   イベント自体は GA4 に届くため、ここでは同意状態を見ずに常に送る。
// - 計測対象は <main> 内のリンクだけ。サイドナビ・フッターは全ページ共通の定型リンクで、
//   「そのページが次のクリックを作れたか」を測る対象ではない。この線引きは
//   ランブックの実測（out/ の静的解析）と同じ定義で、数値を突き合わせられるようにしてある。

/** ページ種別。GA4 のカスタムディメンション from_type / to_type に入る値。 */
export type PageType =
  | 'top'
  | 'player_results'
  | 'player_profile'
  | 'players_index'
  | 'tour_index'
  | 'tour_match'
  | 'tour_year'
  | 'tour_hub'
  | 'hs_top'
  | 'hs_rankings'
  | 'hs_rekidai_index'
  | 'hs_rekidai'
  | 'hs_school'
  | 'hs_pref'
  | 'hs_gender'
  | 'jhs_pathways'
  | 'jhs_team'
  | 'jhs_pref'
  | 'jhs_top'
  | 'teams_index'
  | 'team_year'
  | 'team_hub'
  | 'stleague'
  | 'news'
  | 'rankings'
  | 'match_bare'
  | 'beta'
  | 'other';

/** 判定順に並べる（具体的なものが先）。next.config.mjs が trailingSlash: true なので末尾スラッシュ前提。 */
const PAGE_TYPE_RULES: ReadonlyArray<readonly [RegExp, PageType]> = [
  [/^\/$/, 'top'],
  [/^\/players\/\d+\/results\/$/, 'player_results'],
  [/^\/players\/$/, 'players_index'],
  [/^\/players\/[^/]+\/$/, 'player_profile'],
  [/^\/tournaments\/$/, 'tour_index'],
  [/^\/tournaments\/[^/]+\/[^/]+\/matches\//, 'tour_match'],
  [/^\/tournaments\/[^/]+\/[^/]+\/\d{4}\//, 'tour_year'],
  [/^\/tournaments\/[^/]+\/[^/]+\/$/, 'tour_hub'],
  [/^\/highschool\/$/, 'hs_top'],
  [/^\/highschool\/rankings\/$/, 'hs_rankings'],
  [/^\/highschool\/tournaments\/$/, 'hs_rekidai_index'],
  [/^\/highschool\/tournaments\/[^/]+\/$/, 'hs_rekidai'],
  [/^\/highschool\/(?:boys|girls)\/[^/]+\/[^/]+\/$/, 'hs_school'],
  [/^\/highschool\/(?:boys|girls)\/[^/]+\/$/, 'hs_pref'],
  [/^\/highschool\/(?:boys|girls)\/$/, 'hs_gender'],
  [/^\/secondaryschool\/$/, 'jhs_top'],
  [/^\/secondaryschool\/pathways\//, 'jhs_pathways'],
  [/^\/secondaryschool\/[^/]+\/[^/]+\/$/, 'jhs_team'],
  [/^\/secondaryschool\/[^/]+\/$/, 'jhs_pref'],
  [/^\/teams\/$/, 'teams_index'],
  [/^\/teams\/[^/]+\/\d{4}\//, 'team_year'],
  [/^\/teams\/[^/]+\/$/, 'team_hub'],
  [/^\/st-league\//, 'stleague'],
  [/^\/news\//, 'news'],
  [/^\/rankings\/$/, 'rankings'],
  [/^\/matches\//, 'match_bare'],
  [/^\/beta\//, 'beta'],
];

/** パスを正規化する（クエリ・ハッシュを落とし、末尾スラッシュを付ける）。 */
export function normalizePath(pathOrHref: string): string {
  const path = pathOrHref.split('#')[0].split('?')[0];
  if (!path.startsWith('/')) return path;
  return path.endsWith('/') ? path : `${path}/`;
}

/** パスからページ種別を求める。純関数（テスト: npm run analytics:test）。 */
export function getPageType(pathOrHref: string): PageType {
  const path = normalizePath(pathOrHref);
  for (const [re, type] of PAGE_TYPE_RULES) {
    if (re.test(path)) return type;
  }
  return 'other';
}

/**
 * 計測対象の内部リンクかどうか。
 * 外部リンク・アンカーのみ・Next の内部アセット・自ページへのリンクは除く。
 */
export function isTrackableInternalHref(href: string, currentPath: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  const path = normalizePath(href);
  if (path === '/') return true;
  if (path.startsWith('/_next') || path.startsWith('/api/')) return false;
  if (/\.[a-z0-9]{2,4}\/$/i.test(path)) return false; // 画像・PDF等のファイル
  return path !== normalizePath(currentPath);
}

/** 本文内リンクのクリックを送る。module 未指定は 'unclassified'。 */
export function trackInternalLinkClick(params: { module: string; fromType: PageType; toType: PageType }): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', 'internal_link_click', {
    module: params.module,
    from_type: params.fromType,
    to_type: params.toType,
  });
}

/** Cookie バナーの操作を送る。同意率の分母・分子になる（バナーを操作せず離脱した人は含まれない）。 */
export function trackConsentChoice(granted: boolean): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', granted ? 'consent_accept' : 'consent_decline');
}

/** リンクを含む要素に付ける data 属性名。モジュール単位の CTR を出すために使う。 */
export const LINK_MODULE_ATTR = 'data-link-module';

/**
 * <main> 内のリンククリックを拾って GA4 へ送る委譲リスナーを張る。戻り値は解除関数。
 *
 * 個々のリンクコンポーネントに手を入れずに全ページを一度に計測対象にするための実装。
 * 新しい回遊モジュールを作るときは、その節の要素に data-link-module="..." を付けるだけで
 * module 別に分離できる（付けなければ 'unclassified' にまとまる）。
 */
export function attachInternalLinkTracking(doc: Document): () => void {
  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (!anchor.closest('main')) return; // 本文内のみ（サイドナビ・フッターは対象外）

    const href = anchor.getAttribute('href') || '';
    const currentPath = window.location.pathname;
    if (!isTrackableInternalHref(href, currentPath)) return;

    const moduleEl = anchor.closest(`[${LINK_MODULE_ATTR}]`);
    const linkModule = moduleEl?.getAttribute(LINK_MODULE_ATTR) || 'unclassified';

    trackInternalLinkClick({
      module: linkModule,
      fromType: getPageType(currentPath),
      toType: getPageType(href),
    });
  };

  // capture フェーズで拾う（React のルーティングが先に走っても取りこぼさないため）。
  doc.addEventListener('click', onClick, true);
  return () => doc.removeEventListener('click', onClick, true);
}
