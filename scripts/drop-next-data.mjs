// scripts/drop-next-data.mjs
//
// 静的 export の out/_next/data/（getStaticProps の JSON。クライアント遷移用）を消す。
// Cloudflare Pages の無料プランは1サイト 20,000 ファイルまでで、この JSON が出力の約半分を占めるため。
//
// JSON が無いと Next.js のクライアント遷移は 404 を受けて通常のページ遷移（全体の再読み込み）に切り替わる
// （next/dist/shared/lib/router/router.js の markAssetError → handleHardNavigation）。
// HTML・SEO・OGP は変わらない。shallow な router.replace は JSON を取りに行かないので影響しない。
// 詳細: docs/wiki/deployment.md「出力のファイル数に上限がある」

import fs from 'node:fs';
import path from 'node:path';

const outDir = path.join(process.cwd(), 'out');
const dataDir = path.join(outDir, '_next', 'data');

if (!fs.existsSync(dataDir)) {
  console.log('drop-next-data: out/_next/data が無いためスキップ');
  process.exit(0);
}

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(path.join(dir, entry.name)) : 1;
  }
  return n;
}

const dropped = countFiles(dataDir);
fs.rmSync(dataDir, { recursive: true, force: true });
console.log(`drop-next-data: out/_next/data の ${dropped} ファイルを削除。out/ は ${countFiles(outDir)} ファイル`);
