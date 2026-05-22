type SiteMode = 'softeni-pick' | 'score';

const normalizeSiteMode = (value: string | undefined): SiteMode => {
  return value === 'score' ? 'score' : 'softeni-pick';
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const siteMode = normalizeSiteMode(
  process.env.NEXT_PUBLIC_SITE_MODE ?? process.env.SITE_MODE,
);

const defaultBaseUrl =
  siteMode === 'score'
    ? 'https://score.softeni-pick.com'
    : 'https://softeni-pick.com';

const defaultSiteName =
  siteMode === 'score' ? 'Softeni Pick Score' : 'Softeni Pick';

const defaultOgImage =
  siteMode === 'score'
    ? 'https://score.softeni-pick.com/og/twitter-card-summary.png'
    : 'https://softeni-pick.com/og/twitter-card-summary.png';

const rawBaseUrl =
  process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ??
  process.env.PUBLIC_BASE_URL ??
  defaultBaseUrl;

const rawSiteName =
  process.env.NEXT_PUBLIC_SITE_NAME ?? process.env.SITE_NAME ?? defaultSiteName;

const rawOgImage =
  process.env.NEXT_PUBLIC_PUBLIC_OG_IMAGE ??
  process.env.PUBLIC_OG_IMAGE ??
  defaultOgImage;

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

export const buildSiteUrl = (path: string) => {
  if (!path) return siteConfig.baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteConfig.baseUrl}${normalizedPath}`;
};

export const getPublicMatchesListPath = () =>
  isScoreSiteMode() ? '/matches' : '/beta/matches-results';

export const getPublicMatchDetailPath = (matchId: string) =>
  `${getPublicMatchesListPath()}/${matchId}`;

export const getPublicMatchesGrowthPath = (targetKey?: string) => {
  const basePath = `${getPublicMatchesListPath()}/growth`;
  if (!targetKey) return basePath;
  return `${basePath}?targetKey=${encodeURIComponent(targetKey)}`;
};

export const getScoreMatchesUrl = () =>
  'https://score.softeni-pick.com/matches';
