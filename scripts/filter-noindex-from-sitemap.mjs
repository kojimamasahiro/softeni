// scripts/filter-noindex-from-sitemap.mjs
//
// postbuild で next-sitemap が生成した sitemap から、robots meta が noindex の
// ページ（例: 収録試合が薄く全国高校大会出場歴も無い選手ページ）を取り除く。
//
// 背景:
// - next-sitemap は `output: 'export'` 時に `out/**/*.html` を一括で列挙するだけで、
//   各ページの `<meta name="robots" content="noindex">` を考慮しない。
//   そのため noindex ページも sitemap に載ってしまい、Google Search Console で
//   「送信された URL が noindex に設定されています」の警告になる。
// - noindex 判定はページ側（src/pages/players/[id]/results.tsx 等）に集約し、
//   このスクリプトは生成済み HTML の実 meta を真実とみなして sitemap を派生させる。
//   判定ロジックを二重に持たないため、ページ側の基準を変えるだけで sitemap も追従する。
//
// 実行: postbuild（next-sitemap → sort-sitemaps → 本スクリプト）
// 仕様: docs/wiki/players-pages.md「選手結果ページの noindex 選別」

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
// `output: 'export'` 構成では next-sitemap の sourceDir/outDir はともに 'out'。
const exportDir = path.join(projectRoot, 'out');

if (!fs.existsSync(exportDir)) {
  // dev（非 export）ビルドでは out/ が無い。何もしない。
  console.log('filter-noindex: out/ が無いためスキップ（非 export ビルド）');
  process.exit(0);
}

/** out/ 配下の HTML を再帰列挙 */
function walkHtml(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...walkHtml(full));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      result.push(full);
    }
  }
  return result;
}

const NOINDEX_RE =
  /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i;
const CANONICAL_RE =
  /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i;

// 1) noindex ページの canonical URL を集める（sitemap の <loc> と完全一致する）
const noindexLocs = new Set();
let scanned = 0;
for (const file of walkHtml(exportDir)) {
  scanned += 1;
  const html = fs.readFileSync(file, 'utf8');
  if (!NOINDEX_RE.test(html)) continue;
  const m = html.match(CANONICAL_RE);
  if (m) {
    noindexLocs.add(m[1]);
  } else {
    console.warn(`filter-noindex: canonical 未検出のためスキップ: ${file}`);
  }
}

console.log(
  `filter-noindex: HTML ${scanned} 件走査、noindex ${noindexLocs.size} 件を検出`,
);

if (noindexLocs.size === 0) {
  console.log('filter-noindex: 除外対象なし。sitemap は変更しません。');
  process.exit(0);
}

// 2) out/（および存在すれば public/）の sitemap-*.xml から該当 <url> を除去
const URL_ENTRY_RE = /<url>[\s\S]*?<\/url>/g;
const LOC_RE = /<loc>(.*?)<\/loc>/;

function filterSitemapDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^sitemap.*\.xml$/.test(f) && f !== 'sitemap.xml');
  for (const f of files) {
    const file = path.join(dir, f);
    const xml = fs.readFileSync(file, 'utf8');
    let removed = 0;
    const next = xml.replace(URL_ENTRY_RE, (entry) => {
      const loc = entry.match(LOC_RE)?.[1] ?? '';
      if (noindexLocs.has(loc)) {
        removed += 1;
        return '';
      }
      return entry;
    });
    if (removed > 0) {
      // 空行が残らないよう連続改行を圧縮
      const cleaned = next.replace(/\n{2,}/g, '\n');
      fs.writeFileSync(file, cleaned, 'utf8');
      console.log(`filter-noindex: ${file} から ${removed} 件除外`);
    }
  }
}

filterSitemapDir(exportDir);
filterSitemapDir(path.join(projectRoot, 'public'));
