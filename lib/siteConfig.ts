type SiteMode = 'softeni-pick' | 'score';

const normalizeSiteMode = (value: string | undefined): SiteMode => {
  return value === 'score' ? 'score' : 'softeni-pick';
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const siteMode = normalizeSiteMode(process.env.NEXT_PUBLIC_SITE_MODE ?? process.env.SITE_MODE);

const defaultBaseUrl = siteMode === 'score' ? 'https://score.softeni-pick.com' : 'https://softeni-pick.com';

const defaultSiteName = siteMode === 'score' ? 'Softeni Pick Score' : 'Softeni Pick';

const defaultOgImage =
  siteMode === 'score' ? 'https://score.softeni-pick.com/og/twitter-card-summary.png' : 'https://softeni-pick.com/og/twitter-card-summary.png';

const rawBaseUrl = process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ?? process.env.PUBLIC_BASE_URL ?? defaultBaseUrl;

const rawSiteName = process.env.NEXT_PUBLIC_SITE_NAME ?? process.env.SITE_NAME ?? defaultSiteName;

const rawOgImage = process.env.NEXT_PUBLIC_PUBLIC_OG_IMAGE ?? process.env.PUBLIC_OG_IMAGE ?? defaultOgImage;

const normalizedBaseUrl = trimTrailingSlash(rawBaseUrl);

const toAbsoluteUrl = (value: string) => {
  if (/^https?:\/\//.test(value)) {
    return value;
  }

  const path = value.startsWith('/') ? value : `/${value}`;
  return `${normalizedBaseUrl}${path}`;
};

export const siteConfig = {
  mode: siteMode,
  baseUrl: normalizedBaseUrl,
  siteName: rawSiteName,
  ogImage: toAbsoluteUrl(rawOgImage),
} as const;

export const isScoreSiteMode = () => siteConfig.mode === 'score';

export const isSofteniPickSiteMode = () => siteConfig.mode === 'softeni-pick';

// 成長分析のグループ限定アクセス（A1: パスワード/限定リンク）が整うまでは false。
// false の間は、成長ページで全対象を列挙するドロップダウンを公開しない（ADR-004）。
export const isGrowthGroupAccessEnabled = () => (process.env.NEXT_PUBLIC_GROWTH_GROUP_ACCESS ?? process.env.GROWTH_GROUP_ACCESS) === 'true';

export const buildSiteUrl = (path: string) => {
  if (!path) return siteConfig.baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteConfig.baseUrl}${normalizedPath}`;
};

// 記録試合の公開 URL は両モードとも /matches に正規化(docs/ui C-1・M3、2026-07-04)。
// 旧 /beta/matches-results/** は public/_redirects で 301。
export const getPublicMatchesListPath = () => '/matches';

// 掲載大会に紐づく試合（siteLink あり）は大会ページ配下のネスト URL、
// 野良試合（siteLink なし）は従来の一覧配下 URL を返す。
// score モードでは大会ページ群を持たないため常に一覧配下 URL を使う。
// 仕様: docs/wiki/score-site-link.md
export const getPublicMatchDetailPath = (match: { id: string; siteLink?: { tournamentPath: string } | null }) => {
  if (!isScoreSiteMode() && match.siteLink?.tournamentPath) {
    return `${match.siteLink.tournamentPath}/matches/${match.id}`;
  }
  return `${getPublicMatchesListPath()}/${match.id}`;
};

export const getPublicMatchesGrowthPath = (targetKey?: string) => {
  const basePath = `${getPublicMatchesListPath()}/growth`;
  if (!targetKey) return basePath;
  return `${basePath}?targetKey=${encodeURIComponent(targetKey)}`;
};

export const getScoreMatchesUrl = () => 'https://score.softeni-pick.com/matches';
