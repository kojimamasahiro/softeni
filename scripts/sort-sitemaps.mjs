import fs from 'node:fs';
import path from 'node:path';

const publicDir = path.join(process.cwd(), 'public');
const sitemapFiles = fs
  .readdirSync(publicDir)
  .filter((file) => /^sitemap.*\.xml$/.test(file))
  .map((file) => path.join(publicDir, file));

for (const sitemapFile of sitemapFiles) {
  const xml = fs.readFileSync(sitemapFile, 'utf8');
  const sortedXml = sortSitemapXml(xml);

  if (sortedXml !== xml) {
    fs.writeFileSync(sitemapFile, sortedXml, 'utf8');
  }
}

function sortSitemapXml(xml) {
  if (xml.includes('<urlset')) {
    return sortXmlEntries(xml, 'urlset', 'url');
  }

  if (xml.includes('<sitemapindex')) {
    return sortXmlEntries(xml, 'sitemapindex', 'sitemap');
  }

  return xml;
}

function sortXmlEntries(xml, rootTag, entryTag) {
  const rootPattern = new RegExp(
    `^(?<header><\\?xml[^>]*>\\s*)(?<open><${rootTag}[^>]*>\\s*)(?<body>[\\s\\S]*?)(?<close>\\s*<\\/${rootTag}>\\s*)$`,
  );
  const match = xml.match(rootPattern);

  if (!match?.groups) {
    return xml;
  }

  const entryPattern = new RegExp(
    `<${entryTag}>[\\s\\S]*?<\\/${entryTag}>`,
    'g',
  );
  const entries = match.groups.body.match(entryPattern);

  if (!entries) {
    return xml;
  }

  const sortedEntries = [...entries].sort((a, b) => {
    const aLoc = extractLoc(a);
    const bLoc = extractLoc(b);
    return aLoc.localeCompare(bLoc, 'en');
  });

  return `${match.groups.header}${match.groups.open}${sortedEntries.join('\n')}${match.groups.close}`;
}

function extractLoc(entry) {
  const locMatch = entry.match(/<loc>(.*?)<\/loc>/);
  return locMatch?.[1] ?? '';
}
