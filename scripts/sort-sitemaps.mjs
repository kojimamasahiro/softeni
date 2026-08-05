// scripts/sort-sitemaps.mjs
//
// next-sitemap が出力した sitemap の <url> を loc 順に並べ替える（差分を読みやすくするため）。
//
// 対象ディレクトリは next-sitemap の outDir に追従させること。
// 2026-08-05 に outDir を public → out に変更した（それ以前は public/ しか見ておらず、
// 配信される out/sitemap-*.xml はソートも noindex 反映も1ビルド遅れていた）。
// 詳細: docs/raw/2026-08-05-seo-audit.md A-1

import fs from 'node:fs';
import path from 'node:path';

// out/（export 構成の配信ディレクトリ）を優先し、無ければ public/（非 export ビルド）を見る。
const candidateDirs = [path.join(process.cwd(), 'out'), path.join(process.cwd(), 'public')];
const targetDir = candidateDirs.find((dir) => fs.existsSync(dir));

if (!targetDir) {
  console.log('sort-sitemaps: 対象ディレクトリが無いためスキップ');
  process.exit(0);
}

const sitemapFiles = fs
  .readdirSync(targetDir)
  .filter((file) => /^sitemap.*\.xml$/.test(file))
  .map((file) => path.join(targetDir, file));

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
  const rootPattern = new RegExp(`^(?<header><\\?xml[^>]*>\\s*)(?<open><${rootTag}[^>]*>\\s*)(?<body>[\\s\\S]*?)(?<close>\\s*<\\/${rootTag}>\\s*)$`);
  const match = xml.match(rootPattern);

  if (!match?.groups) {
    return xml;
  }

  const entryPattern = new RegExp(`<${entryTag}>[\\s\\S]*?<\\/${entryTag}>`, 'g');
  const entries = match.groups.body.match(entryPattern);

  if (!entries) {
    return xml;
  }

  const deduped = dedupeByLoc(entries, entryTag);

  const sortedEntries = deduped.sort((a, b) => {
    const aLoc = extractLoc(a);
    const bLoc = extractLoc(b);
    return aLoc.localeCompare(bLoc, 'en');
  });

  return `${match.groups.header}${match.groups.open}${sortedEntries.join('\n')}${match.groups.close}`;
}

/**
 * 同じ <loc> のエントリを1件にまとめる（2026-08-05・A-2/A-3）。
 *
 * next-sitemap.config.js の `additionalPaths` が明示追加している静的ページ
 * （/about/ /contact/ /faq/ /privacy/ /st-league/about/ /growth/ /growth/<slug>）が
 * 自動列挙とも重なり、<loc> が二重に出ていた（2026-08-05 実測で8件）。
 * additionalPaths 側を削るとバージョン差で自動列挙から漏れたときに気づけないため、
 * 「明示追加は残したまま、出力段で1件にまとめる」方針を採る。
 *
 * 残す1件は <lastmod> を持つほうを優先する（transform で付けた鮮度シグナルを捨てない）。
 */
function dedupeByLoc(entries, entryTag) {
  const byLoc = new Map();
  let dropped = 0;

  for (const entry of entries) {
    const loc = extractLoc(entry);
    const existing = byLoc.get(loc);

    if (!existing) {
      byLoc.set(loc, entry);
      continue;
    }

    dropped += 1;
    if (!existing.includes('<lastmod>') && entry.includes('<lastmod>')) {
      byLoc.set(loc, entry);
    }
  }

  if (dropped > 0) {
    console.log(`sort-sitemaps: 重複 <${entryTag}> を ${dropped} 件まとめました`);
  }

  return [...byLoc.values()];
}

function extractLoc(entry) {
  const locMatch = entry.match(/<loc>(.*?)<\/loc>/);
  return locMatch?.[1] ?? '';
}
