import crypto from 'crypto';

import {
  detectContentType,
  hasExcludedKeyword,
  hasResultKeyword,
} from './extract-local-source-links.mjs';

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeTrackingParams(url) {
  const next = new URL(url.toString());
  const names = [...next.searchParams.keys()];
  for (const name of names) {
    if (/^utm_/i.test(name)) {
      next.searchParams.delete(name);
    }
  }
  return next;
}

export function normalizeUrl(rawUrl, sourcePageUrl) {
  const url = new URL(rawUrl, sourcePageUrl);
  url.hash = '';
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  const cleaned = removeTrackingParams(url);

  if (
    (cleaned.pathname.match(/\.(pdf|xlsx?|xlsm|csv)(?:$)/i) ||
      detectContentType(cleaned.pathname) === 'excel') &&
    cleaned.pathname.length > 1
  ) {
    cleaned.pathname = cleaned.pathname.replace(/\/+$/g, '');
  }

  return cleaned.toString();
}

function inferYear(...texts) {
  const joined = texts.join(' ');
  const western = joined.match(/\b(20[0-9]{2})\b/);
  if (western) {
    return Number(western[1]);
  }

  const reiwa = joined.match(/令和\s*([0-9]{1,2})\s*年/);
  if (reiwa) {
    return 2018 + Number(reiwa[1]);
  }

  return undefined;
}

const QUALIFIER_PATTERNS = [
  {
    type: 'interhigh',
    pattern:
      /高校総体|インターハイ|インハイ|全国高等学校総合体育大会|高等学校総合体育大会|ＩＨ予選|IH予選/i,
  },
];

export function inferQualifierType(...texts) {
  const joined = texts.join(' ');
  for (const { type, pattern } of QUALIFIER_PATTERNS) {
    if (pattern.test(joined)) return type;
  }
  return undefined;
}

function inferEventType(...texts) {
  const joined = texts.join(' ');
  if (/シングルス|single/i.test(joined)) return 'singles';
  if (/ダブルス|double/i.test(joined)) return 'doubles';
  if (/団体|team/i.test(joined)) return 'team';
  return 'unknown';
}

function inferCategory(...texts) {
  const joined = texts.join(' ');
  if (/男子|men|boys/i.test(joined)) return 'men';
  if (/女子|women|girls/i.test(joined)) return 'women';
  if (/混合|ミックス|mixed/i.test(joined)) return 'mixed';
  return 'unknown';
}

function inferTournamentName(title, contextText) {
  const source = normalizeWhitespace(title || contextText || '');
  if (!source) return undefined;

  const stripped = source
    .replace(/\b20[0-9]{2}\b/g, '')
    .replace(/令和\s*[0-9]{1,2}\s*年/g, '')
    .replace(/(結果|記録|成績|要項|速報)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return stripped || undefined;
}

function inferConfidence({
  title,
  contextText,
  normalizedUrl,
  contentType,
  qualifierType,
}) {
  let score = 0.2;
  if (title) score += 0.25;
  if (contextText) score += 0.15;
  if (hasResultKeyword(title, contextText, normalizedUrl)) score += 0.25;
  if (hasExcludedKeyword(title, contextText, normalizedUrl)) score -= 0.2;
  if (contentType === 'pdf' || contentType === 'excel') score += 0.2;
  if (contentType === 'html') score += 0.1;
  // 毎年開催が確実な定型大会(高校総体予選など)は候補としての確度が高い
  if (qualifierType) score += 0.1;
  return Math.max(0, Math.min(Number(score.toFixed(2)), 0.99));
}

function buildTitle(rawTitle, normalizedUrl) {
  const title = normalizeWhitespace(rawTitle);
  if (title) return title;

  try {
    const url = new URL(normalizedUrl);
    const basename = decodeURIComponent(url.pathname.split('/').pop() || '');
    return normalizeWhitespace(basename);
  } catch {
    return normalizedUrl;
  }
}

export function createIgnoredMatcher(ignoredDocuments) {
  const denySet = new Set(
    (ignoredDocuments || []).map(
      (item) => `${item.prefectureSlug}::${item.normalizedUrl}`,
    ),
  );

  return ({ prefectureSlug, normalizedUrl }) =>
    denySet.has(`${prefectureSlug}::${normalizedUrl}`);
}

export function normalizeLocalTournamentCandidate({
  source,
  sourcePageUrl,
  link,
  ignoredMatcher,
}) {
  const normalizedUrl = normalizeUrl(link.href, sourcePageUrl);
  const denied = ignoredMatcher({
    prefectureSlug: source.slug,
    normalizedUrl,
  });
  if (denied) {
    return { ignored: true, normalizedUrl };
  }

  const contentType =
    link.contentType && link.contentType !== 'unknown'
      ? link.contentType
      : detectContentType(normalizedUrl);

  const title = buildTitle(link.rawTitle, normalizedUrl);
  const rawTitle = normalizeWhitespace(link.rawTitle);
  const contextText = normalizeWhitespace(link.contextText || '') || undefined;

  // 高校総体予選などの定型大会の「結果」資料は、PDF/Excel 直リンクでも候補として保持する
  const isQualifierResult =
    Boolean(inferQualifierType(rawTitle, title, contextText, normalizedUrl)) &&
    hasResultKeyword(rawTitle, contextText, normalizedUrl);

  if (
    (contentType === 'pdf' || contentType === 'excel') &&
    !link.allowDocumentLink &&
    !isQualifierResult
  ) {
    return { ignored: true, normalizedUrl };
  }

  if (
    contentType === 'image' &&
    !hasResultKeyword(rawTitle, contextText, normalizedUrl)
  ) {
    return { ignored: true, normalizedUrl };
  }

  if (
    contentType === 'unknown' &&
    !hasResultKeyword(rawTitle, contextText, normalizedUrl)
  ) {
    return null;
  }

  if (hasExcludedKeyword(rawTitle, title, contextText, normalizedUrl)) {
    return { ignored: true, normalizedUrl };
  }

  const qualifierType = inferQualifierType(
    rawTitle,
    title,
    contextText,
    normalizedUrl,
  );

  const inferred = {
    year: inferYear(rawTitle, title, contextText, normalizedUrl),
    tournamentName: inferTournamentName(title, contextText),
    eventType: inferEventType(rawTitle, title, contextText, normalizedUrl),
    category: inferCategory(rawTitle, title, contextText, normalizedUrl),
    ...(qualifierType ? { qualifierType } : {}),
    confidence: inferConfidence({
      title,
      contextText,
      normalizedUrl,
      contentType,
      qualifierType,
    }),
  };

  const id = `${source.slug}-${crypto
    .createHash('sha1')
    .update(normalizedUrl)
    .digest('hex')
    .slice(0, 12)}`;

  return {
    id,
    prefecture: source.prefecture,
    prefectureSlug: source.slug,
    sourceRootUrl: source.sourceUrl,
    sourcePageUrl,
    url: new URL(link.href, sourcePageUrl).toString(),
    normalizedUrl,
    rawTitle,
    title,
    ...(contextText ? { contextText } : {}),
    contentType,
    inferred,
  };
}
