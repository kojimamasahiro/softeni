import * as cheerio from 'cheerio';

const RESULT_KEYWORDS = [
  '結果',
  '記録',
  '成績',
  '大会',
  '選手権',
  '速報',
  'pdf',
  'xls',
  'xlsx',
];

const EXCLUDED_KEYWORDS = [
  '要項',
  '開催要項',
  '実施要項',
  '募集',
  '申込',
  '申し込み',
  '申込み',
  'エントリー',
  '案内',
  'お知らせ',
  '連絡',
  '日程',
  '組合せ',
  '組み合わせ',
];

const PDF_PATTERN = /\.(pdf)(?:$|[?#])/i;
const EXCEL_PATTERN = /\.(xlsx?|xlsm|csv)(?:$|[?#])/i;
const IMAGE_PATTERN = /\.(png|jpe?g|gif|webp|svg)(?:$|[?#])/i;
const HTML_PATTERN = /\.(html?|php|aspx?|jsp)(?:$|[?#])/i;

function normalizeText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesResultKeyword(...texts) {
  const haystack = normalizeText(texts.filter(Boolean).join(' ')).toLowerCase();
  return RESULT_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export function detectContentType(href) {
  const value = String(href || '');
  if (PDF_PATTERN.test(value)) return 'pdf';
  if (EXCEL_PATTERN.test(value)) return 'excel';
  if (IMAGE_PATTERN.test(value)) return 'image';
  if (HTML_PATTERN.test(value)) return 'html';
  return 'unknown';
}

export function extractLocalSourceLinks(html) {
  const $ = cheerio.load(html);
  const shimaneTableLinks = extractShimaneTournamentLinks($);
  if (shimaneTableLinks.length > 0) {
    return shimaneTableLinks;
  }

  const links = [];
  const seen = new Set();

  $('a[href]').each((_, element) => {
    const href = normalizeText($(element).attr('href'));
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) {
      return;
    }

    const rawTitle = normalizeText(
      $(element).text() ||
        $(element).attr('title') ||
        $(element).attr('aria-label') ||
        '',
    );
    const parentText = normalizeText($(element).parent().text());
    const contextText =
      parentText && parentText !== rawTitle
        ? parentText.slice(0, 240)
        : undefined;
    const contentType = detectContentType(href);
    const resultKeyword = includesResultKeyword(rawTitle, contextText, href);

    if (contentType === 'image' && !resultKeyword) {
      return;
    }

    const dedupeKey = `${href}::${rawTitle}::${contextText || ''}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);

    links.push({
      href,
      rawTitle,
      contextText,
      contentType,
      resultKeyword,
    });
  });

  return links;
}

function extractShimaneTournamentLinks($) {
  const heading = normalizeText($('h1').first().text());
  const hasShimaneTournamentPage =
    heading.includes('大会情報') &&
    $('table.border th')
      .map((_, element) => normalizeText($(element).text()))
      .get()
      .join(' ')
      .includes('結果');

  if (!hasShimaneTournamentPage) {
    return [];
  }

  const links = [];
  const seen = new Set();

  $('table.border tr').each((index, row) => {
    if (index === 0) {
      return;
    }

    const cells = $(row).find('td');
    if (cells.length < 5) {
      return;
    }

    const date = normalizeText($(cells[0]).text());
    const tournamentName = normalizeText($(cells[1]).text());
    const resultCell = $(cells[4]);
    const resultHref = normalizeText(resultCell.find('a[href]').attr('href'));

    if (!date || !tournamentName || !resultHref) {
      return;
    }

    const rawTitle = `${tournamentName} 結果`;
    const contextText = `${date} ${tournamentName}`;
    const dedupeKey = `${resultHref}::${contextText}`;
    if (seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);

    links.push({
      href: resultHref,
      rawTitle,
      contextText,
      contentType: detectContentType(resultHref),
      resultKeyword: true,
      allowDocumentLink: true,
      rowKey: `${date}::${tournamentName}`,
    });
  });

  return links;
}

export function hasResultKeyword(...texts) {
  return includesResultKeyword(...texts);
}

export function hasExcludedKeyword(...texts) {
  const haystack = normalizeText(texts.filter(Boolean).join(' ')).toLowerCase();
  return EXCLUDED_KEYWORDS.some((keyword) => haystack.includes(keyword));
}
