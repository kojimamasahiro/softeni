// scripts/playerStats/cache-sync.mjs
//
// generate-facts の増分ビルド用アーティファクト（_facts / _index / _manifest.json）を
// ビルド間で永続化する。
//
// 背景:
//   これらは .gitignore 対象なので Cloudflare Pages では clone 直後に存在せず、
//   generate-facts が毎回 `full rebuild (no manifest)` に落ちて約2分かかっていた。
//   ローカルでは増分（約10秒）が既定なので、Cloudflare だけが取り残されていた状態。
//
// 仕組み:
//   Cloudflare Pages のビルドキャッシュは Next.js プロジェクトに対して `.next/cache` を
//   保存・復元する（公式ドキュメント "Build caching" > Frameworks で明示）。
//   そこに自前のサブディレクトリを間借りする。
//
// 安全性:
//   - manifest は mtime ではなく「入力ファイルの内容ハッシュ(sha1)」ベース。
//     復元物が古くても、内容が変わっていれば該当選手が再生成される。
//   - engineVersion / globalHash / configHash が変われば全再計算に落ちる。
//   - キャッシュが無い・壊れている・不完全な場合は復元をスキップし、
//     従来どおりのフルビルドになる（= fail safe。遅くなるだけで誤ったデータは出ない）。
//   - このスクリプトは何が起きてもビルドを落とさない（常に exit 0）。
//
// 使い方: node scripts/playerStats/cache-sync.mjs restore | save

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, '.next', 'cache', 'playerstats');
const CACHE_TMP = path.join(ROOT, '.next', 'cache', 'playerstats.tmp');
const META_FILE = 'cache-meta.json';

/** 同期対象。dir = ディレクトリ, file = 単体ファイル。 */
const TARGETS = [
  { kind: 'dir', rel: path.join('data', 'players', '_facts') },
  { kind: 'dir', rel: path.join('data', 'players', '_index') },
  { kind: 'file', rel: path.join('data', 'players', '_manifest.json') },
];

const log = (msg) => console.log(`[cache-sync] ${msg}`);

function countFiles(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) n++;
  }
  return n;
}

function restore() {
  if (!fs.existsSync(CACHE_DIR)) {
    log('no cache found; generate-facts will do a full rebuild');
    return;
  }

  // 復元先が既にある場合（ローカル開発）は触らない。
  const present = TARGETS.filter((t) => fs.existsSync(path.join(ROOT, t.rel)));
  if (present.length > 0) {
    log(`working copy already present (${present.length}/${TARGETS.length}); skipping restore`);
    return;
  }

  // キャッシュの完全性チェック。1つでも欠けていたら中途半端に復元しない。
  // 不完全な _facts と完全な _manifest.json が揃うと、増分ビルドが
  // 「生成済み」と誤認して選手データを取りこぼすため、ここは厳格にする。
  for (const t of TARGETS) {
    if (!fs.existsSync(path.join(CACHE_DIR, t.rel))) {
      log(`cache incomplete (missing ${t.rel}); falling back to full rebuild`);
      return;
    }
  }

  const metaPath = path.join(CACHE_DIR, META_FILE);
  if (!fs.existsSync(metaPath)) {
    log('cache metadata missing; falling back to full rebuild');
    return;
  }
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

  for (const t of TARGETS) {
    if (t.kind !== 'dir') continue;
    const actual = countFiles(path.join(CACHE_DIR, t.rel));
    const expected = meta.fileCounts?.[t.rel];
    if (expected !== actual) {
      log(`cache truncated (${t.rel}: expected ${expected}, found ${actual}); falling back to full rebuild`);
      return;
    }
  }

  for (const t of TARGETS) {
    const src = path.join(CACHE_DIR, t.rel);
    const dest = path.join(ROOT, t.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: t.kind === 'dir' });
  }

  log(`restored from cache (saved at ${meta.savedAt})`);
}

function save() {
  for (const t of TARGETS) {
    if (!fs.existsSync(path.join(ROOT, t.rel))) {
      log(`${t.rel} not found; skipping save`);
      return;
    }
  }

  // 一時ディレクトリに書いてから rename する。途中で落ちても、
  // 不完全なキャッシュが次回ビルドに読まれることがない。
  fs.rmSync(CACHE_TMP, { recursive: true, force: true });

  const fileCounts = {};
  for (const t of TARGETS) {
    const src = path.join(ROOT, t.rel);
    const dest = path.join(CACHE_TMP, t.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: t.kind === 'dir' });
    if (t.kind === 'dir') fileCounts[t.rel] = countFiles(src);
  }

  fs.writeFileSync(path.join(CACHE_TMP, META_FILE), JSON.stringify({ savedAt: new Date().toISOString(), fileCounts }), 'utf-8');

  fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  fs.renameSync(CACHE_TMP, CACHE_DIR);

  log(
    `saved to cache (${Object.entries(fileCounts)
      .map(([k, v]) => `${path.basename(k)}: ${v} files`)
      .join(', ')})`,
  );
}

try {
  const cmd = process.argv[2];
  if (cmd === 'restore') restore();
  else if (cmd === 'save') save();
  else log(`unknown command: ${cmd} (expected "restore" or "save")`);
} catch (err) {
  // キャッシュ層の失敗でビルドを落とさない。最悪フルビルドになるだけ。
  log(`failed (non-fatal): ${err?.message ?? err}`);
}
