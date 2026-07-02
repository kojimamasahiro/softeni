// Cloudflare Pages の 20,000 ファイル上限対策。
// デプロイ出力 (out/) から未使用の大量 JSON を除外する。
//
// - data/player-stats/{id}.json (約8,000件) はクライアント遅延取得用として
//   generate-public-json.ts が生成するが、現時点で fetch する消費側が未実装のため
//   デプロイからは除外する (生成自体は SSR と同一 facade の検証も兼ねるので残す)。
//   消費側を実装する際は、シャーディングか R2 配信に切り替えること (ADR-011 参照)。

import fs from 'fs';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'out');
const PRUNE_DIRS = ['data/player-stats'];

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    n += entry.isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

let removed = 0;
for (const rel of PRUNE_DIRS) {
  const target = path.join(OUT_DIR, rel);
  if (!fs.existsSync(target)) continue;
  const n = countFiles(target);
  fs.rmSync(target, { recursive: true, force: true });
  removed += n;
  console.log(`[prune-deploy-output] removed ${rel} (${n} files)`);
}

const total = countFiles(OUT_DIR);
console.log(`[prune-deploy-output] out/ total: ${total} files (removed ${removed})`);
if (total >= 20000) {
  console.error(
    `[prune-deploy-output] ERROR: out/ still has ${total} files (Cloudflare Pages limit: 20,000)`,
  );
  process.exit(1);
}
