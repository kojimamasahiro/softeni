// scripts/filter-noindex-from-sitemap.mjs
//
// postbuild で next-sitemap が生成した sitemap から、**そのページ自身を正として
// インデックスさせたくない URL** を取り除く。除外条件は2つ:
//
//   1) robots meta が noindex（例: 収録試合が薄い選手ページ・チームページ）
//   2) canonical が自分自身の URL を指していない（＝正は別 URL の重複ページ）
//
// 背景:
// - next-sitemap は `output: 'export'` 時に `out/**/*.html` を一括で列挙するだけで、
//   各ページの `<meta name="robots">` も `<link rel="canonical">` も考慮しない。
//   そのため noindex ページや重複ページも sitemap に載り、Google Search Console で
//   「送信された URL が noindex に設定されています」「代替ページ（適切な canonical
//   タグあり）」の警告になる。
// - 判定はページ側（src/pages/players/[id]/results.tsx、lib/siteConfig.ts の
//   getPublicMatchDetailPath 等）に集約し、このスクリプトは生成済み HTML の実 meta を
//   真実とみなして sitemap を派生させる。判定ロジックを二重に持たないため、
//   ページ側の基準を変えるだけで sitemap も追従する。
//
// 条件 2) を入れた理由（2026-08-05・A-2）:
//   score ドメイン用の `/matches/<id>/` が softeni-pick 側のビルドにも出力され、
//   掲載大会の試合（siteLink あり）では canonical が `/tournaments/.../matches/<id>/` を
//   指すのに sitemap には両方載っていた（21件）。
//   `exclude: ['/matches/*']` で消すこともできるが、それだと **野良試合（siteLink なし）**
//   にとっては `/matches/<id>/` が正の URL なので、将来それが出てきたときに
//   「正なのに sitemap に無い」状態になる。canonical で判定すれば、
//   siteLink あり＝自動で除外／野良試合＝自動で残る、と両方正しくなる。
//
// 実行: postbuild（next-sitemap → sort-sitemaps → 本スクリプト）
// 仕様: docs/wiki/seo.md「sitemap 生成の運用」、
//       docs/wiki/players-pages.md「選手結果ページの noindex 選別」

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

const NOINDEX_RE = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i;
const CANONICAL_RE = /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i;

/**
 * out/ 配下の HTML ファイルパスから、そのページ自身の URL パスを求める。
 * `trailingSlash: true` 構成なので公開ページは必ず `<dir>/index.html`。
 * それ以外（404.html・サーチコンソール認証ファイル等）は sitemap に載らないので null。
 */
function ownPathOf(file) {
  const rel = path.relative(exportDir, file).split(path.sep).join('/');
  if (rel === 'index.html') return '/';
  if (!rel.endsWith('/index.html')) return null;
  return `/${rel.slice(0, -'index.html'.length)}`;
}

// 1) 除外対象の loc を集める（sitemap の <loc> と完全一致する形で持つ）
const excludedLocs = new Set();
let scanned = 0;
let noindexCount = 0;
let canonicalMismatchCount = 0;

for (const file of walkHtml(exportDir)) {
  scanned += 1;
  const html = fs.readFileSync(file, 'utf8');
  const isNoindex = NOINDEX_RE.test(html);
  const canonical = html.match(CANONICAL_RE)?.[1] ?? null;

  if (!canonical) {
    // canonical が無いページは自 URL を組み立てられない（origin が分からない）。
    // noindex なら本来除外したいので警告を残す。
    if (isNoindex) console.warn(`filter-noindex: canonical 未検出のためスキップ: ${file}`);
    continue;
  }

  const ownPath = ownPathOf(file);
  // 自 URL は canonical と同じ origin で組み立てる（siteUrl をここで二重に持たないため）。
  const ownLoc = ownPath ? `${new URL(canonical).origin}${ownPath}` : canonical;

  if (isNoindex) {
    excludedLocs.add(ownLoc);
    noindexCount += 1;
    continue;
  }

  // canonical が自分以外を指す＝正は別 URL の重複ページ。sitemap には載せない。
  if (ownPath && new URL(canonical).pathname !== ownPath) {
    excludedLocs.add(ownLoc);
    canonicalMismatchCount += 1;
  }
}

console.log(
  `filter-noindex: HTML ${scanned} 件走査、除外 ${excludedLocs.size} 件` + `（noindex ${noindexCount} / canonical 不一致 ${canonicalMismatchCount}）`,
);

if (excludedLocs.size === 0) {
  console.log('filter-noindex: 除外対象なし。sitemap は変更しません。');
  process.exit(0);
}

// 2) out/ の sitemap-*.xml から該当 <url> を除去
const URL_ENTRY_RE = /<url>[\s\S]*?<\/url>/g;
const LOC_RE = /<loc>(.*?)<\/loc>/;

function filterSitemapDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => /^sitemap.*\.xml$/.test(f) && f !== 'sitemap.xml');
  for (const f of files) {
    const file = path.join(dir, f);
    const xml = fs.readFileSync(file, 'utf8');
    let removed = 0;
    const next = xml.replace(URL_ENTRY_RE, (entry) => {
      const loc = entry.match(LOC_RE)?.[1] ?? '';
      if (excludedLocs.has(loc)) {
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

// 対象は out/ のみ。2026-08-05 に next-sitemap の outDir を public → out に変更したため、
// public/ 側には sitemap が生成されなくなった（.gitignore 済み）。
filterSitemapDir(exportDir);
